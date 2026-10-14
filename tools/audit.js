// audit.js — integrity gate (PLAN §5), tailored to darths-rage's shape.
//
// RAGE (https://darths-rage.netlify.app/) is capture-class: a single-file
// three.js action game served by Netlify at the origin root. Everything that
// is code lives inside the entry document, so the derived pipeline is:
//
//   index.html inline <script> -> readable/index-inline-1.pretty.js
//                              -> src/<section>[-a|b|…].js  (section-aligned
//                                 slices named after the author's 21 banners)
//   index.html inline <style>s -> readable/index-inline-1|2.pretty.css      (wholeFile)
//   readable/index-inline-map.json                                         (byte ranges + sha256)
//   rename-map.json            -> recovered word-boundary + token-index records
//   capture non-code payloads  -> split-spec notRendered hashed records     (bytes + sha256)
//
// split-spec.json records that pipeline and this gate keeps it honest:
//
//   1. split-spec.json parses, carries project/kind/note/renderOptions/structure/
//      rename/sources/sections/notRendered, and a defaultFile exists.
//   2. Every section resolves: ranged slices have a src/<section>.js file on
//      disk, a readable *.pretty.js sourceFile and in-bounds startLine/endLine;
//      wholeFile sections (the two inline <style> blocks) and skipped sections
//      (IIFE wrapper head/tail + the top-level-return statements) must NOT have
//      a src file; skipped sections are re-verified textually against their
//      recorded firstLine/lastLine.
//   3. The ranges of each sourceFile tile it exactly: first starts at line 1,
//      each next starts at previous end + 1, last ends at EOF — no gaps, no
//      overlaps.
//   4. Byte-exact round-trip through the rename layer: every src slice minus its
//      exact 2-line header (`// <slice base> — <title>` +
//      `// Lines A-B of <sourceFile> (statement-aligned).`) equals its recorded
//      sourceFile range byte for byte with the recorded rename map applied
//      (applyRecordedMap); a slice body that differs from its range WITHOUT a
//      recorded map is an unrecorded rename — a problem.
//   5. Every slice parses standalone with the exact gate command
//      `node --input-type=module --check -` (stdin), as does every readable
//      *.pretty.js; the *.pretty.css twins brace-balance.
//   6. src/*.js on disk and the spec's ranged slices are the same set — no
//      unlisted or missing reversals; wholeFile/skipped names are not on disk.
//   7. Every readable pretty is referenced by the spec and is NOT byte-identical
//      to the inline block it was derived from. Inline-block twins are validated
//      byte-for-byte against their capture block: twin exists, prettier did run,
//      and twin content re-renders byte-exact from the capture byte range under
//      the pinned prettier.
//   8. Inline-block scan: every inline <script>/<style> content block in the
//      captured HTML document must have its readable twin and a
//      readable/index-inline-map.json entry whose byte range + sha256 match the
//      capture bytes.
//   9. The hard rule — src/ import resolution: any specifier a slice carries
//      must resolve to a file the CAPTURE carries (there are none here: the
//      game is a plain inline script with no import statements; the scanner
//      still runs, so a future refresh that introduces imports is checked).
//  10. Rename-map honesty (the campaign gate): rename-map.json parses; every
//      recorded file is a ranged slice on disk; every scoped index addresses
//      the recorded identifier token in its slice range and never an
//      import/export specifier (foreign) position; every renamed slice's body
//      actually differs from its raw range (the record applied).
//  11. sources[] provenance re-verified against disk (pretty lines/bytes,
//      capture bytes/sha256, inline block range + sha256) and every notRendered
//      record re-hashed.
//  12. Derived layers never enter the capture sums: no readable/, src/, legacy/
//      path or split-spec.json / rename-map.json / _mirror-report.json entry
//      may appear in .upstream/manifest.json.
//  13. Shape guard: the inline script twin must carry the game's own
//      fingerprints (three.js usage, the Sevrane loader, the frame loop) — a
//      silently reshaped readable fails the gate instead of passing.
//
// usage: node tools/audit.js
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyRecordedMap, foreignNameIndices, tokens } from "./engine/rename-layer.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, "..");
const srcDir = path.join(proj, "src");
const readableDir = path.join(proj, "readable");
const PINNED = "3.9.6";

const problems = [];
const problem = (msg) => problems.push(msg);

// ── helpers ─────────────────────────────────────────────────────────────
const readLines = (abs) => {
  const t = fs.readFileSync(abs, "utf8");
  const l = t.split("\n");
  if (l.length && l[l.length - 1] === "") l.pop();
  return l;
};
const linesCache = new Map();
const getLines = (abs) => {
  if (!linesCache.has(abs)) linesCache.set(abs, readLines(abs));
  return linesCache.get(abs);
};
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

// parse check — the exact standalone gate: node --input-type=module --check - < file
function parseCheck(abs, rel) {
  const r = spawnSync(process.execPath, ["--input-type=module", "--check", "-"], {
    input: fs.readFileSync(abs),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0)
    problem(`standalone ESM parse failed: ${rel} — ${(r.stderr || "").trim().split("\n").slice(0, 4).join(" | ")}`);
  return r.status === 0;
}

// CSS well-formedness: braces balance outside comments and quoted strings.
function cssBracesBalanced(text) {
  let depth = 0,
    i = 0,
    mode = null;
  while (i < text.length) {
    const c = text[i],
      n = text[i + 1];
    if (mode === "comment") {
      if (c === "*" && n === "/") {
        mode = null;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (mode === '"' || mode === "'") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === mode) mode = null;
      i++;
      continue;
    }
    if (c === "/" && n === "*") {
      mode = "comment";
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      mode = c;
      i++;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth < 0) return false;
    }
    i++;
  }
  return depth === 0 && mode === null;
}

// inline <script>/<style> scan (byte-exact, same shape as tools/derive.mjs)
function scanBlocks(buf) {
  const blocks = [];
  for (const [open, close, kind] of [
    ["<script", "</script", "script"],
    ["<style", "</style", "style"],
  ]) {
    let p = 0;
    let n = 0;
    while (true) {
      const i = buf.indexOf(open, p);
      if (i < 0) break;
      const after = buf[i + open.length];
      const boundary =
        after === 0x3e || after === 0x2f || after === 0x20 || after === 0x09 || after === 0x0a || after === 0x0d;
      if (!boundary) {
        p = i + open.length;
        continue;
      }
      const tagEnd = buf.indexOf(">", i);
      if (tagEnd < 0) break;
      const j = buf.indexOf(close, tagEnd + 1);
      if (j < 0) {
        problem(`unterminated <${kind}> opened at byte ${i}`);
        break;
      }
      const tag = buf.subarray(i, tagEnd + 1).toString("utf8");
      const external = /\bsrc\s*=\s*["']/i.test(tag);
      if (!external) {
        n++;
        const content = buf.subarray(tagEnd + 1, j);
        blocks.push({
          kind: /\btype\s*=\s*["']importmap["']/i.test(tag) ? "importmap" : kind,
          block: n,
          contentStart: tagEnd + 1,
          contentEnd: j,
          bytes: content.length,
          sha256: sha256(content),
        });
      }
      p = j + close.length;
    }
  }
  return blocks.sort((a, b) => a.contentStart - b.contentStart);
}

// ── specifier extraction + export tables (the hard rule) ─────────────────
function extractSpecifiers(code) {
  const out = [];
  const push = (spec, kind, clause) => out.push({ spec, kind, clause: clause || "" });
  let m;
  const fromRe = /\bimport\s+([^;('"]*?)\s*from\s*(["'])([^"']+)\2/g;
  while ((m = fromRe.exec(code))) push(m[3], "from", m[1]);
  const sideRe = /\bimport\s*(["'])([^"']+)\1/g;
  while ((m = sideRe.exec(code))) push(m[2], "side-effect", "");
  const reExpRe = /\bexport\s+[^;()]*?\bfrom\s*(["'])([^"']+)\1/g;
  while ((m = reExpRe.exec(code))) push(m[2], "re-export", "");
  const dynRe = /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g;
  while ((m = dynRe.exec(code))) push(m[2], "dynamic", "");
  const dynTplRe = /\bimport\s*\(\s*`([^`]*)`\s*\)/g;
  while ((m = dynTplRe.exec(code))) if (!m[1].includes("${")) push(m[1], "dynamic", "");
  const urlRe = /\bnew\s+URL\s*\(\s*(["'`])([^"'`]+)\1\s*,/g;
  while ((m = urlRe.exec(code))) push(m[2], "worker-url", "");
  if (/\brequire\s*\(/.test(code)) push("<require()>", "require", "");
  return out;
}
function namedImports(clause) {
  const names = [];
  const brace = /\{([^}]*)\}/s.exec(clause);
  if (brace) {
    for (let part of brace[1].split(",")) {
      part = part.trim();
      if (!part) continue;
      const as = /\s+as\s+([\w$]+)\s*$/.exec(part);
      names.push(as ? part.slice(0, as.index).trim() : part); // imported name precedes `as`
    }
  } else {
    const head = clause.split(",")[0].trim();
    if (head && !head.startsWith("*")) names.push(head); // default import
  }
  return names.filter(Boolean);
}
function exportsOf(code) {
  const names = new Set();
  for (const m of code.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (let part of m[1].split(",")) {
      part = part.trim();
      if (!part) continue;
      const as = /\s+as\s+([\w$]+)\s*$/.exec(part);
      names.add(as ? as[1] : part);
    }
  }
  for (const m of code.matchAll(/\bexport\s+(?:async\s+)?(?:function|class)\s+([\w$]+)/g)) names.add(m[1]);
  for (const m of code.matchAll(/\bexport\s+(?:const|let|var)\s+([\w$]+)/g)) names.add(m[1]);
  if (/\bexport\s+default\b/.test(code)) names.add("default");
  if (/\bexport\s+\*\s+from\b/.test(code)) names.add("*");
  return names;
}

// ── capture manifest ────────────────────────────────────────────────────
let manifest = null;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(proj, ".upstream", "manifest.json"), "utf8"));
} catch (e) {
  problem(`.upstream/manifest.json does not parse: ${e.message}`);
}
const captured = manifest?.files ? Object.keys(manifest.files).map((r) => r.split(path.sep).join("/")).sort() : [];
const captureSet = new Set(captured);

// ── split-spec.json ─────────────────────────────────────────────────────
const specPath = path.join(proj, "split-spec.json");
if (!fs.existsSync(specPath)) problem("split-spec.json missing at repo root");
let spec = null;
try {
  spec = specPath ? JSON.parse(fs.readFileSync(specPath, "utf8")) : null;
} catch (e) {
  problem(`split-spec.json does not parse: ${e.message}`);
}
const sections = Array.isArray(spec?.sections) ? spec.sections : [];
if (spec && !Array.isArray(spec?.sections)) problem("split-spec.json has no sections array");
if (spec && spec.project !== "darths-rage") problem(`split-spec project is "${spec.project}", expected "darths-rage"`);
if (spec && spec.kind !== "section-aligned-slices") problem(`split-spec kind is "${spec.kind}", expected "section-aligned-slices"`);
if (!String(spec?.note ?? "").trim()) problem("split-spec.json has no note (derivation record)");
if (!spec?.renderOptions || typeof spec.renderOptions !== "object")
  problem("split-spec.json records no renderOptions (prettier options for re-derivation)");
if (!Array.isArray(spec?.sources)) problem("split-spec.json records no sources array (capture provenance)");
if (!Array.isArray(spec?.notRendered)) problem("split-spec.json records no notRendered array (non-code payloads)");
if (spec && (!spec?.structure || typeof spec.structure !== "object"))
  problem("split-spec.json records no structure block (module-boundary / source-map evidence)");
else if (spec?.structure && !String(spec.structure.moduleBoundaries ?? "").trim())
  problem("split-spec structure block records no moduleBoundaries evidence");
if (spec && (!spec?.rename || typeof spec.rename !== "object")) problem("split-spec.json records no rename block");
else if (spec?.rename && spec.rename.map !== "rename-map.json") problem(`split-spec rename.map is "${spec.rename.map}", expected "rename-map.json"`);
if (spec?.defaultFile) {
  const df = path.join(proj, String(spec.defaultFile));
  if (!fs.existsSync(df)) problem(`split-spec defaultFile "${spec.defaultFile}" does not exist`);
}

// ── sources[] provenance map: pretty -> capture (file or inline block) ──
const sourceByPretty = new Map();
for (const rec of spec?.sources ?? []) {
  if (typeof rec.sourceFile !== "string") {
    problem(`sources[] entry without sourceFile: ${JSON.stringify(rec).slice(0, 80)}`);
    continue;
  }
  sourceByPretty.set(rec.sourceFile, rec);
}

// ── rename-map.json (the campaign record this gate re-proves) ───────────
const renameMapPath = path.join(proj, "rename-map.json");
let renameMap = { files: {}, scoped: {} };
const renameSlices = new Set();
let flatRecorded = 0,
  scopedRecorded = 0;
if (fs.existsSync(renameMapPath)) {
  try {
    const rm = JSON.parse(fs.readFileSync(renameMapPath, "utf8"));
    renameMap = { files: rm.files || {}, scoped: rm.scoped || {}, note: rm.note || "" };
    if (!String(renameMap.note).trim()) problem("rename-map.json has no note (recovery record)");
    for (const [f, map] of Object.entries(renameMap.files)) {
      renameSlices.add(f);
      for (const [name, target] of Object.entries(map)) {
        flatRecorded++;
        if (target === name) problem(`rename-map.json ${f}: "${name}" maps to itself`);
        if (!/^[A-Za-z_$][\w$]*$/.test(target)) problem(`rename-map.json ${f}: "${name}" → "${target}" is not an identifier`);
      }
    }
    for (const [f, map] of Object.entries(renameMap.scoped)) {
      renameSlices.add(f);
      for (const [name, hits] of Object.entries(map))
        for (const [i, target] of hits) {
          scopedRecorded++;
          if (target === name) problem(`rename-map.json ${f}: "${name}" maps to itself at ${i}`);
        }
    }
  } catch (e) {
    problem(`rename-map.json does not parse: ${e.message}`);
  }
}
const recordFor = (file) => {
  const files = renameMap.files[file];
  const scoped = renameMap.scoped[file];
  return files || scoped ? { files, scoped } : null;
};

// ── section set sanity ──────────────────────────────────────────────────
const seen = new Set();
const rangedFiles = new Set();
const indexOnlyFiles = new Set();
for (const s of sections) {
  if (!s.file) {
    problem("split-spec section without a file");
    continue;
  }
  if (seen.has(s.file)) problem(`split-spec lists ${s.file} twice`);
  seen.add(s.file);
  const isWhole = s.wholeFile === true;
  const isSkipped = s.skipped === true;
  if (isWhole && isSkipped) problem(`section ${s.file}: both wholeFile and skipped`);
  if (typeof s.startLine !== "number" || typeof s.endLine !== "number")
    problem(`section ${s.file}: no startLine/endLine range recorded`);
  if (typeof s.sourceFile !== "string") problem(`section ${s.file}: no sourceFile provenance recorded`);
  if (isWhole || isSkipped) indexOnlyFiles.add(s.file);
  else {
    rangedFiles.add(s.file);
    if (typeof s.title !== "string" || !s.title.trim()) problem(`ranged slice ${s.file}: no section title recorded`);
    if (typeof s.section !== "string" || !s.section.trim()) problem(`ranged slice ${s.file}: no section name recorded`);
  }
}
if (!rangedFiles.size) problem("no ranged src slices in split-spec.json (no reversed layer)");

const onDisk = fs.existsSync(srcDir)
  ? fs.readdirSync(srcDir).filter((f) => f.endsWith(".js")).sort()
  : [];
if (!onDisk.length) problem("src/ missing or empty (no reversed layer)");
for (const f of onDisk) if (!rangedFiles.has(f)) problem(`src/${f} exists but is not a ranged slice in split-spec.json`);
for (const f of rangedFiles) if (!onDisk.includes(f)) problem(`split-spec lists ${f} but it is not on disk`);
for (const f of indexOnlyFiles)
  if (onDisk.includes(f)) problem(`index-only section ${f} must not have a src file on disk (wholeFile/skipped)`);
for (const f of renameSlices) {
  if (!rangedFiles.has(f)) problem(`rename-map.json records ${f} but it is not a ranged slice in split-spec.json`);
  else if (!onDisk.includes(f)) problem(`rename-map.json records ${f} but it is not on disk`);
}

// ── ranges: existence, bounds, tiling ───────────────────────────────────
const bySource = new Map();
for (const s of sections) {
  if (!s.file || typeof s.sourceFile !== "string") continue;
  const src = path.join(proj, s.sourceFile);
  if (!fs.existsSync(src)) {
    problem(`section ${s.file}: sourceFile missing: ${s.sourceFile}`);
    continue;
  }
  if (!/\.pretty\.(js|css)$/i.test(s.sourceFile)) {
    problem(`section ${s.file}: sourceFile is not a readable pretty: ${s.sourceFile}`);
    continue;
  }
  const srcLines = getLines(src);
  const A = s.startLine,
    B = s.endLine;
  if (!Number.isInteger(A) || !Number.isInteger(B) || A < 1 || B < A || B > srcLines.length) {
    problem(`section ${s.file}: bad range ${A}-${B} vs ${s.sourceFile} (${srcLines.length} lines)`);
    continue;
  }
  if (!bySource.has(s.sourceFile)) bySource.set(s.sourceFile, []);
  bySource.get(s.sourceFile).push({ s, A, B });
}
let tiledOK = 0;
for (const [sourceFile, list] of bySource) {
  let ok = true;
  list.sort((x, y) => x.A - y.A);
  const srcLines = getLines(path.join(proj, sourceFile));
  if (list[0].A !== 1) {
    problem(`${sourceFile}: first section starts at line ${list[0].A}, not 1`);
    ok = false;
  }
  for (let k = 1; k < list.length; k++) {
    if (list[k].A !== list[k - 1].B + 1) {
      problem(
        `${sourceFile}: ranges not contiguous at ${list[k].s.file} (starts ${list[k].A}, previous ends ${list[k - 1].B})`,
      );
      ok = false;
    }
  }
  if (list[list.length - 1].B !== srcLines.length) {
    problem(`${sourceFile}: last section ends at ${list[list.length - 1].B}, not ${srcLines.length}`);
    ok = false;
  }
  if (ok) tiledOK++;
}

// ── byte-exact round-trip through the rename layer + header provenance ──
let roundOK = 0,
  ranged = 0,
  renamedSlices = 0;
for (const [, list] of bySource) {
  for (const { s, A, B } of list) {
    if (s.wholeFile === true || s.skipped === true) continue;
    ranged++;
    const srcAbs = path.join(srcDir, path.basename(String(s.file)));
    if (!fs.existsSync(srcAbs)) continue; // already reported
    const text = fs.readFileSync(srcAbs, "utf8");
    const nl1 = text.indexOf("\n");
    const nl2 = nl1 >= 0 ? text.indexOf("\n", nl1 + 1) : -1;
    if (nl2 < 0) {
      problem(`src/${s.file}: missing 2-line header`);
      continue;
    }
    const header1 = text.slice(0, nl1);
    const header2 = text.slice(nl1 + 1, nl2);
    const base = path.basename(String(s.file)).replace(/\.js$/, "");
    const want1 = `// ${base} — ${s.title}`;
    if (header1 !== want1) problem(`src/${s.file}: header line 1 is not the recorded title: ${header1}`);
    const want2 = `// Lines ${A}-${B} of ${s.sourceFile} (statement-aligned).`;
    if (header2 !== want2) problem(`src/${s.file}: header line 2 is not the recorded range: ${header2}`);
    const body = text.slice(nl2 + 1);
    const raw = getLines(path.join(proj, s.sourceFile)).slice(A - 1, B).join("\n") + "\n";
    const record = recordFor(s.file);
    let expected = raw;
    if (record) {
      try {
        expected = applyRecordedMap(raw, record);
        renamedSlices++;
      } catch (e) {
        problem(`src/${s.file}: recorded rename map does not apply: ${e.message}`);
        continue;
      }
      if (body === raw) problem(`src/${s.file}: rename-map.json records a map but the body is unchanged (record not applied)`);
    } else if (body !== raw) {
      problem(`src/${s.file}: body differs from its readable range but rename-map.json records no map (unrecorded rename)`);
      continue;
    }
    if (body !== expected) problem(`src/${s.file}: body is not a byte-exact round-trip of ${s.sourceFile} lines ${A}-${B}`);
    else roundOK++;
  }
}

// ── skipped sections: textual re-verification ───────────────────────────
let skippedOK = 0,
  skippedTotal = 0;
for (const s of sections) {
  if (s.skipped !== true || typeof s.sourceFile !== "string") continue;
  skippedTotal++;
  const src = path.join(proj, s.sourceFile);
  if (!fs.existsSync(src)) {
    problem(`skipped section ${s.file}: sourceFile missing: ${s.sourceFile}`);
    continue;
  }
  const lines = getLines(src);
  if (!Number.isInteger(s.startLine) || !Number.isInteger(s.endLine) || s.startLine < 1 || s.endLine > lines.length)
    continue;
  const first = lines[s.startLine - 1],
    last = lines[s.endLine - 1];
  if (typeof s.firstLine !== "string" || typeof s.lastLine !== "string")
    problem(`skipped section ${s.file}: no firstLine/lastLine recorded`);
  else if (first !== s.firstLine || last !== s.lastLine)
    problem(`skipped section ${s.file}: range text does not match the recorded first/last lines`);
  else skippedOK++;
}

// ── rename-map honesty: indices address the recorded identifier tokens ──
let scopedOK = 0;
for (const [file, scoped] of Object.entries(renameMap.scoped)) {
  const sec = sections.find((s) => s.file === file);
  if (!sec || sec.wholeFile || sec.skipped) continue; // already reported above
  const srcLines = getLines(path.join(proj, sec.sourceFile));
  const raw = srcLines.slice(sec.startLine - 1, sec.endLine).join("\n") + "\n";
  const ts = tokens(raw);
  const foreign = foreignNameIndices(ts);
  for (const [name, hits] of Object.entries(scoped)) {
    for (const [i, target] of hits) {
      const t = ts[i];
      if (!t || t.t !== "id" || t.v !== name) {
        problem(`rename-map.json ${file}: index ${i} is not the identifier "${name}" (${t ? t.t : "none"})`);
        continue;
      }
      if (foreign.has(i)) problem(`rename-map.json ${file}: index ${i} ("${name}") is an import/export specifier (foreign) position`);
      if (!/^[A-Za-z_$][\w$]*$/.test(target)) problem(`rename-map.json ${file}: "${name}" → "${target}" is not an identifier`);
    }
  }
  scopedOK++;
}
// flat records: every word-boundary key must actually occur as an identifier in
// the slice range (a stale map would otherwise round-trip just as happily)
for (const [file, map] of Object.entries(renameMap.files)) {
  const sec = sections.find((s) => s.file === file);
  if (!sec || sec.wholeFile || sec.skipped) continue;
  const srcLines = getLines(path.join(proj, sec.sourceFile));
  const raw = srcLines.slice(sec.startLine - 1, sec.endLine).join("\n") + "\n";
  const ids = new Set(tokens(raw).filter((t) => t.t === "id").map((t) => t.v));
  for (const name of Object.keys(map)) if (!ids.has(name)) problem(`rename-map.json ${file}: word-boundary key "${name}" does not occur in the slice range`);
}

// ── every src + pretty parses standalone; CSS brace-balanced ────────────
let checkOK = 0;
for (const f of onDisk) if (parseCheck(path.join(srcDir, f), `src/${f}`)) checkOK++;

const prettyFiles = [];
const walkPretty = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkPretty(p);
    else if (/\.pretty\.(js|css|json)$/i.test(e.name)) prettyFiles.push(p);
  }
};
walkPretty(readableDir);
if (!prettyFiles.length) problem("readable/ has no *.pretty.js|css (derived layer missing)");
let prettyOK = 0,
  prettyParsed = 0;
for (const abs of prettyFiles) {
  const rel = path.relative(proj, abs).split(path.sep).join("/");
  if (/\.pretty\.css$/i.test(rel)) {
    if (!cssBracesBalanced(fs.readFileSync(abs, "utf8"))) problem(`${rel}: CSS braces do not balance`);
    continue;
  }
  if (!/\.pretty\.js$/i.test(rel)) continue; // JSON pretties are parsed in the twin loop
  prettyParsed++;
  if (parseCheck(abs, rel)) prettyOK++;
}

// ── inline block twins + map (deliverable rule) ─────────────────────────
const inlineMapPath = path.join(readableDir, "index-inline-map.json");
let inlineMap = null;
if (fs.existsSync(inlineMapPath)) {
  try {
    inlineMap = JSON.parse(fs.readFileSync(inlineMapPath, "utf8"));
  } catch (e) {
    problem(`readable/index-inline-map.json does not parse: ${e.message}`);
  }
}
const inlineTwinRels = new Set();
let inlineBlocks = 0;
for (const capRel of Object.keys(manifest?.files ?? {})) {
  if (!/\.html$/i.test(capRel)) continue;
  const buf = fs.readFileSync(path.join(proj, capRel));
  const blocks = scanBlocks(buf);
  inlineBlocks += blocks.length;
  const entryTag = capRel.replace(/\.html$/i, "").split("/").join("__");
  for (const b of blocks) {
    const twinExt = b.kind === "style" ? "css" : b.kind === "importmap" ? "json" : "js";
    const twin = `readable/${entryTag}-inline-${b.block}.pretty.${twinExt}`;
    inlineTwinRels.add(twin);
    if (!fs.existsSync(path.join(proj, twin))) problem(`${capRel}: inline ${b.kind} #${b.block} has no twin ${twin}`);
    else {
      const twinText = fs.readFileSync(path.join(proj, twin), "utf8");
      const content = buf.subarray(b.contentStart, b.contentEnd);
      if (twinText === content.toString("utf8"))
        problem(`${twin}: byte-identical to its capture block (prettier did not run?)`);
      if (twinExt === "json") {
        try {
          JSON.parse(twinText);
        } catch (e) {
          problem(`${twin}: does not parse as JSON: ${e.message}`);
        }
      }
    }
    const rec = inlineMap?.blocks?.find((x) => x.file === twin && x.source === capRel);
    if (!rec) {
      problem(`${capRel}: inline ${b.kind} #${b.block} is missing from readable/index-inline-map.json`);
      continue;
    }
    if (rec.byteStart !== b.contentStart || rec.byteEnd !== b.contentEnd || rec.sha256 !== b.sha256)
      problem(`${twin}: recorded inline byte range/sha256 does not match the capture bytes`);
  }
}
if (inlineMap && inlineBlocks === 0) problem("readable/index-inline-map.json exists but the capture has no inline blocks");

// ── every pretty referenced + provably derived + layer completeness ─────
const referenced = new Set();
for (const [sourceFile] of bySource) referenced.add(sourceFile.split(path.sep).join("/"));
let derivedOK = 0;
for (const abs of prettyFiles) {
  const rel = path.relative(proj, abs).split(path.sep).join("/");
  if (!referenced.has(rel))
    problem(`readable/${path.basename(rel)} exists but is not referenced by split-spec.json`);
  if (inlineTwinRels.has(rel)) {
    derivedOK++; // inline twins are byte-compared against their capture block above
    continue;
  }
  problem(`${rel}: no capture .js/.css maps to this pretty (inline twins are the only pretties expected)`);
}
if (manifest) {
  for (const capRel of Object.keys(manifest.files)) {
    if (!/\.(js|css)$/i.test(capRel)) continue;
    problem(`captured ${capRel} has no readable twin referenced by the spec`);
  }
}

// ── shape guard: the inline script twin carries the game's fingerprints ──
// (vendor-rule analogue: content-anchored, fails loudly when the readable
// silently changes shape)
{
  const twinRel = "readable/index-inline-1.pretty.js";
  if (fs.existsSync(path.join(proj, twinRel))) {
    const text = fs.readFileSync(path.join(proj, twinRel), "utf8");
    for (const [re, what] of [
      [/new THREE\.WebGLRenderer/, "WebGLRenderer"],
      [/EffectComposer/, "EffectComposer post-processing"],
      [/loadSevrane/, "the Sevrane model loader"],
      [/trooper|courier|crate/, "the model families"],
      [/requestAnimationFrame\(frame\)/, "the frame loop"],
      [/updateDark/, "the dark intro sequence"],
    ])
      if (!re.test(text)) problem(`${twinRel}: shape guard failed (${what}) — the inline script twin changed shape`);
  }
}

// ── the hard rule: src/ import resolution against the capture ───────────
let checkedImports = 0,
  resolvedImports = 0,
  whitelisted = 0;
for (const s of sections) {
  if (s.wholeFile === true || s.skipped === true) continue;
  if (!s.file || typeof s.sourceFile !== "string") continue;
  const srcAbs = path.join(srcDir, path.basename(String(s.file)));
  if (!fs.existsSync(srcAbs)) continue;
  // slices come from an inline block: their base dir is the capture root
  const baseDir = "";
  const code = fs.readFileSync(srcAbs, "utf8");
  for (const { spec: specifier, kind, clause } of extractSpecifiers(code)) {
    checkedImports++;
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const target = path.posix.normalize(path.posix.join(baseDir, specifier));
      if (!fs.existsSync(path.join(proj, target)) || !captureSet.has(target)) {
        problem(`src/${s.file}: unresolvable ${kind} import "${specifier}" (capture carries no ${target})`);
        continue;
      }
      resolvedImports++;
      const targetCode = fs.readFileSync(path.join(proj, target), "utf8");
      const targetExports = exportsOf(targetCode);
      for (const n of namedImports(clause)) {
        if (n === "*" || targetExports.has(n)) continue;
        problem(`src/${s.file}: imports { ${n} } from "${specifier}" but ${target} does not export it`);
      }
      continue;
    }
    if (specifier.startsWith("node:") || specifier.startsWith("vite/") || specifier.startsWith("/")) {
      whitelisted++;
      continue;
    }
    problem(`src/${s.file}: unresolvable ${kind} import "${specifier}" — bare/URL specifier not whitelisted`);
  }
}

// ── sources[]: provenance re-verified against disk ──────────────────────
let sourcesOK = 0;
for (const rec of spec?.sources ?? []) {
  if (typeof rec.sourceFile !== "string") continue;
  const srcAbs = path.join(proj, rec.sourceFile);
  if (!fs.existsSync(srcAbs)) {
    problem(`sources: ${rec.sourceFile} missing`);
    continue;
  }
  const prettyText = fs.readFileSync(srcAbs, "utf8");
  const prettyLines = readLines(srcAbs).length;
  if (rec.prettyLines !== prettyLines) problem(`sources: ${rec.sourceFile} prettyLines ${rec.prettyLines} != ${prettyLines} on disk`);
  if (rec.prettyBytes !== undefined && rec.prettyBytes !== Buffer.byteLength(prettyText, "utf8"))
    problem(`sources: ${rec.sourceFile} prettyBytes ${rec.prettyBytes} != ${Buffer.byteLength(prettyText, "utf8")} on disk`);
  const capAbs = path.join(proj, String(rec.capture));
  if (!fs.existsSync(capAbs)) {
    problem(`sources: capture ${rec.capture} missing`);
    continue;
  }
  const capBuf = fs.readFileSync(capAbs);
  if (Number.isInteger(rec.captureByteStart) && Number.isInteger(rec.captureByteEnd)) {
    // inline block source: captureBytes/sha256 cover the block inside the
    // entry document, not the whole file
    const block = capBuf.subarray(rec.captureByteStart, rec.captureByteEnd);
    if (rec.captureBytes !== block.length)
      problem(`sources: ${rec.sourceFile} inline block bytes ${rec.captureBytes} != ${block.length}`);
    if (rec.captureSha256 !== sha256(block)) problem(`sources: ${rec.sourceFile} inline block sha256 mismatch`);
  } else {
    if (rec.captureBytes !== capBuf.length) problem(`sources: ${rec.capture} bytes ${rec.captureBytes} != ${capBuf.length} on disk`);
    if (rec.captureSha256 !== sha256(capBuf)) problem(`sources: ${rec.capture} sha256 mismatch`);
  }
  sourcesOK++;
}

// ── notRendered records re-hashed ───────────────────────────────────────
let notRenderedOK = 0;
const notRendered = Array.isArray(spec?.notRendered) ? spec.notRendered : [];
for (const rec of notRendered) {
  const abs = path.join(proj, String(rec.capture));
  if (!fs.existsSync(abs)) {
    problem(`notRendered: ${rec.capture} missing`);
    continue;
  }
  const buf = fs.readFileSync(abs);
  if (rec.byteStart !== undefined && rec.byteEnd !== undefined) {
    const slice = buf.subarray(rec.byteStart, rec.byteEnd);
    if (rec.bytes !== slice.length) problem(`notRendered inline ${rec.capture}: bytes ${rec.bytes} != ${slice.length}`);
    if (rec.sha256 !== sha256(slice)) problem(`notRendered inline ${rec.capture}: sha256 mismatch`);
  } else {
    if (rec.bytes !== buf.length) problem(`notRendered ${rec.capture}: bytes ${rec.bytes} != ${buf.length} on disk`);
    if (rec.sha256 !== sha256(buf)) problem(`notRendered ${rec.capture}: sha256 mismatch`);
  }
  if (rec.rendered === true) problem(`notRendered ${rec.capture}: rendered flag must not be true (capture stays byte-exact)`);
  notRenderedOK++;
}

// ── derived layers must never enter the capture sums ────────────────────
if (manifest) {
  for (const rel of Object.keys(manifest.files)) {
    const norm = rel.split(path.sep).join("/");
    if (/^(readable|src|legacy)\//.test(norm) || ["split-spec.json", "rename-map.json", "_mirror-report.json"].includes(norm))
      problem(`derived layer leaked into the capture manifest: ${rel}`);
  }
}

// ── best-effort: re-render every pretty with the pinned prettier 3.9.6 ─
const prettierCandidates = [
  process.env.PRETTIER_MJS,
  path.join(proj, "node_modules", "prettier", "index.mjs"),
  "D:/repos/mirrors/metropolygonia/node_modules/prettier/index.mjs",
].filter(Boolean);
function loadPinnedPrettier() {
  for (const c of prettierCandidates) {
    if (!fs.existsSync(c)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(c), "package.json"), "utf8"));
      if (pkg.version !== PINNED) continue;
      return c;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

let renderNote = `prettier ${PINNED} not importable — renderOptions recorded, re-render check skipped`;
const prettierPath = loadPinnedPrettier();
if (prettierPath) {
  const prettier = (await import(pathToFileURL(prettierPath).href)).default;
  // format-to-fixed-point: derive asserts single-pass idempotency, so the
  // fixed point equals the recorded single pass; the loop only guards
  // against a prettier build that needs an extra pass.
  const renderFix = async (text, parser) => {
    const p1 = await prettier.format(text, { parser });
    const p2 = await prettier.format(p1, { parser });
    if (p2 === p1) return p1;
    const p3 = await prettier.format(p2, { parser });
    return p3 === p2 ? p2 : null;
  };
  let renderOK = 0;
  let renderTotal = 0;
  // inline twins re-render from their capture byte range (all pretties here)
  for (const rec of inlineMap?.blocks ?? []) {
    const capAbs = path.join(proj, rec.source);
    if (!fs.existsSync(capAbs)) continue; // already reported
    const parser = rec.kind === "importmap" ? "json" : rec.kind === "style" ? "css" : "babel";
    const src = fs.readFileSync(capAbs).subarray(rec.byteStart, rec.byteEnd).toString("utf8");
    const got = await renderFix(src, parser);
    const want = fs.readFileSync(path.join(proj, rec.file), "utf8");
    renderTotal++;
    if (got === want) renderOK++;
    else problem(`${rec.file}: does not re-render byte-exact under pinned prettier ${PINNED} ({parser:${parser}}, fixed-point method)`);
  }
  // any other pretty (not expected here) re-renders from its capture source
  for (const abs of prettyFiles) {
    const rel = path.relative(proj, abs).split(path.sep).join("/");
    if (inlineTwinRels.has(rel)) continue;
    renderTotal++;
    problem(`${rel}: pretty with no capture source mapping — cannot re-render`);
  }
  renderNote = `${renderOK}/${renderTotal} pretties re-render byte-exact under pinned prettier ${PINNED} (format-to-fixed-point)`;
}

if (problems.length) {
  console.error(`AUDIT FAIL — ${problems.length} problem(s)`);
  for (const p of problems.slice(0, 80)) console.error("  " + p);
  if (problems.length > 80) console.error(`  … ${problems.length - 80} more`);
  process.exit(1);
}
console.log(
  `AUDIT PASS — ${sections.length} spec sections (${roundOK}/${ranged} src↔pretty round-trips byte-exact through the recorded rename map, ` +
    `${renamedSlices} renamed slice(s), ${tiledOK}/${bySource.size} pretty sources tiled contiguously, ` +
    `${skippedOK}/${skippedTotal} skipped non-standalone sections re-verified textually, ` +
    `${checkOK}/${onDisk.length} src slices + ${prettyOK}/${prettyParsed} readable/*.pretty.js parse standalone (node --input-type=module --check -), ` +
    `${derivedOK}/${prettyFiles.length} pretties provably distinct from their capture source, ` +
    `${indexOnlyFiles.size} index-only wholeFile/skipped sections carry no src file, ` +
    `${inlineBlocks} inline content block(s) with twins + index-inline-map.json, ` +
    `${resolvedImports}/${checkedImports} imports resolve inside the capture (${whitelisted} whitelisted machinery), ` +
    `rename map: ${flatRecorded} word-boundary + ${scopedRecorded} indexed record(s) over ${renameSlices.size} slice(s) (${scopedOK} scoped slice(s) token-validated, no foreign position), ` +
    `${sourcesOK}/${spec?.sources?.length ?? 0} source provenance record(s) re-verified, ` +
    `${notRenderedOK}/${notRendered.length} notRendered record(s) re-hashed, ` +
    `${renderNote}, inline-script shape guard held, capture manifest free of derived layers)`,
);
