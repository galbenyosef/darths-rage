// derive.mjs — rebuild the derived layers (readable/ + src/ + split-spec.json)
// from the darths-rage capture (PLAN §3/§5). RAGE
// (https://darths-rage.netlify.app/) is capture-class: a single-file three.js
// action game served by Netlify at the origin root. §0.4 fork-over-mirror was
// checked on 2026-10-13 — no public upstream source repo exists (the page
// carries no github/gitlab/bitbucket reference; a GitHub search finds only
// unrelated projects), so the mirror stands. The capture is untouched; every
// captured file is re-hashed against .upstream/manifest.json before it is
// rendered, so a drifted capture fails loudly instead of being silently
// re-derived.
//
// Pipeline (there are no captured .js/.css files — everything lives in the
// entry document, so the inline blocks are the only code):
//   index.html inline <script> -> readable/index-inline-1.pretty.js
//                        (pinned prettier 3.9.6 module API — the CLI respects
//                        .gitignore and can silently echo its input — single
//                        pass, verified idempotent; the pretty is provably NOT
//                        a byte copy of the minified block)
//   index.html inline <style>s -> readable/index-inline-1|2.pretty.css
//                        (stylesheet rule: stylesheets are indexed whole,
//                        never sliced)
//   every twin is recorded in readable/index-inline-map.json with the exact
//   byte range + sha256 of its capture block.
//
//   src/ slicing — section-aligned (2026-10-14 structure pass): the inline
//   script is a SINGLE classic IIFE (`(() => { … })();`) with no ES modules
//   (0 import/export occurrences) and no captured source maps (0
//   sourceMappingURL across all 72 files — evidence: tools/probe-structure.mjs),
//   so the real structure the bytes expose is the author's own: 21 top-level
//   section banners (`/* ===== level ===== */`, two-space indent). Slices are
//   cut at those section boundaries; a section longer than the 350-line window
//   cap splits further at statement boundaries into -a/-b/... parts, and the
//   slice files are NAMED after the sections (src/level-a.js, src/updates-c.js,
//   … — the desimayhem semantic-slice precedent). The IIFE wrapper head/tail
//   and body statements that are not standalone at module top level (the
//   engine guard, the renderer try guard and the sfx declaration each contain
//   a top-level `return`) are indexed as skipped sections, never sliced. Every
//   slice gets the exact 2-line provenance header, is parse-checked with
//   `node --input-type=module --check -` and round-trips byte-exact to its
//   readable line range — through the recorded rename map when rename-map.json
//   carries a record for it (tools/engine/rename-layer.mjs, the same
//   application tools/verify-rename.mjs and tools/audit.js gate on).
//
// Non-code payloads (40 MP3s, 22 WebP images, favicon.ico, the eight glTF
// model/geometry JSON payloads) are recorded as hashed notRendered entries —
// bytes + sha256, no pretty pass — and stay byte-exact under the manifest.
// The CDN dependencies (nine jsdelivr three.js r147 scripts, the Google Fonts
// stylesheet) were never captured (socker precedent, PLAN §1), so they have
// no derived layer either; tools/capture.mjs --check keeps them listed as
// external off-origin references.
//
// The semantic rename layer is recorded in rename-map.json (recovered from the
// committed slices by tools/recover-scoped-map.mjs, authored via
// tools/apply-names.mjs + tools/names.json) and re-applied here on every
// re-cut. usage:
//   node tools/derive.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyRecordedMap, markerText, markerWords, sliceHeader } from "./engine/rename-layer.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, "..");
const PINNED = "3.9.6";
const MAX_WINDOW = 350;

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const readLines = (abs) => {
  const t = fs.readFileSync(abs, "utf8");
  const l = t.split("\n");
  if (l.length && l[l.length - 1] === "") l.pop();
  return l;
};
const linesOf = (text) => text.replace(/\n$/, "").split("\n");
const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;

// ── pinned prettier (module API, exactly 3.9.6) ─────────────────────────
async function loadPrettier() {
  const candidates = [
    process.env.PRETTIER_MJS,
    path.join(proj, "node_modules", "prettier", "index.mjs"),
    "D:/repos/mirrors/metropolygonia/node_modules/prettier/index.mjs",
  ].filter(Boolean);
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(c), "package.json"), "utf8"));
      if (pkg.version !== PINNED) continue;
      const mod = (await import(pathToFileURL(c).href)).default;
      if (mod.version === PINNED) return { mod, at: c };
    } catch {
      /* try next */
    }
  }
  throw new Error(`pinned prettier ${PINNED} not found (set PRETTIER_MJS to its index.mjs)`);
}

// single pass + idempotency proof: prettier output must be a fixed point of
// the same call, so audit's one-pass re-render is byte-exact by construction
async function formatOnce(prettier, text, parser) {
  const out = await prettier.format(text, { parser });
  const again = await prettier.format(out, { parser });
  if (again !== out) throw new Error(`prettier ${parser} is not idempotent on this input`);
  return out;
}

// ── parse check: the exact standalone gate (ESM stdin) ──────────────────
function parses(text) {
  const r = spawnSync(process.execPath, ["--input-type=module", "--check", "-"], {
    input: text,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: r.status === 0, why: (r.stderr || "").trim().split("\n").slice(0, 5).join(" | ") };
}

// ── windowize: cut only at statement starts; ≤350 lines, a single ───────
// ── oversized declaration is a window of its own ────────────────────────
function windowize(stmts) {
  const out = [];
  let cur = null;
  for (const s of stmts) {
    if (!cur) {
      cur = { first: s, last: s, count: 1, startLine: s.startLine, endLine: s.endLine };
      continue;
    }
    const projected = s.endLine - cur.startLine + 1;
    if (projected > MAX_WINDOW) {
      out.push(cur);
      cur = { first: s, last: s, count: 1, startLine: s.startLine, endLine: s.endLine };
    } else {
      cur.last = s;
      cur.count++;
      cur.endLine = s.endLine;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ── is a body statement standalone at module top level? A `return` that is ─
// ── not nested inside a function makes the statement non-standalone ────────
function hasTopLevelReturn(node) {
  let found = false;
  const walk = (n) => {
    if (!n || found || typeof n.type !== "string") return;
    if (/Function/.test(n.type) || n.type === "ClassMethod" || n.type === "ClassPrivateMethod") return;
    if (n.type === "ReturnStatement") {
      found = true;
      return;
    }
    for (const k of Object.keys(n)) {
      if (k === "loc" || k === "start" || k === "end" || k === "range" || k === "leadingComments" || k === "trailingComments") continue;
      const v = n[k];
      if (Array.isArray(v)) {
        for (const c of v) if (c && typeof c.type === "string") walk(c);
      } else if (v && typeof v.type === "string") {
        walk(v);
      }
    }
  };
  walk(node);
  return found;
}

// ── inline block scan (byte-exact, over the raw entry buffer) ───────────
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
      if (j < 0) throw new Error(`unterminated <${kind}> opened at byte ${i}`);
      const tag = buf.subarray(i, tagEnd + 1).toString("utf8");
      const external = /\bsrc\s*=\s*["']/i.test(tag);
      if (external) {
        blocks.push({ kind, external: true, tag, openStart: i, contentStart: tagEnd + 1, contentEnd: j });
      } else {
        n++;
        const content = buf.subarray(tagEnd + 1, j);
        blocks.push({
          kind: /\btype\s*=\s*["']importmap["']/i.test(tag) ? "importmap" : kind,
          external: false,
          block: n,
          tag,
          openStart: i,
          contentStart: tagEnd + 1,
          contentEnd: j,
          bytes: content.length,
          sha256: sha256(content),
          text: content.toString("utf8"),
        });
      }
      p = j + close.length;
    }
  }
  return blocks.sort((a, b) => a.openStart - b.openStart);
}

// payload kinds for hashed notRendered records
const KIND_OF = [
  [/\.(png|jpe?g|webp|gif|svg|avif|ico)$/i, "image"],
  [/\.(mp4|webm)$/i, "video"],
  [/\.(mp3|ogg|wav|m4a)$/i, "audio"],
  [/\.(woff2?|ttf|otf)$/i, "font"],
  [/\.(glb|gltf)$/i, "model"],
  [/\.json$/i, "data"],
];

// ── recorded semantic rename map (optional input; see engine header) ────
function loadRenameMap() {
  const p = path.join(proj, "rename-map.json");
  if (!fs.existsSync(p)) return { files: {}, scoped: {}, present: false };
  const rm = JSON.parse(fs.readFileSync(p, "utf8"));
  return { files: rm.files || {}, scoped: rm.scoped || {}, present: true };
}
const recordsFor = (rm, file) => {
  const files = rm.files[file];
  const scoped = rm.scoped[file];
  if (!files && !scoped) return null;
  return { files, scoped };
};
// The authored binding map (tools/names.json): capture rel -> {old: new} for
// the chunk's top-level (IIFE-body scope) bindings. Recorded into split-spec
// per source as `renameBindings` (only the rules that actually fired), so the
// reconstruction gates can re-apply the same map to the skipped sections.
function loadNames() {
  const p = path.join(here, "names.json");
  if (!fs.existsSync(p)) return {};
  const all = JSON.parse(fs.readFileSync(p, "utf8"));
  const out = {};
  for (const [k, v] of Object.entries(all)) if (!k.startsWith("__")) out[k] = v.renames || v;
  return out;
}

// ── the author's section banners (the real structure the bytes expose) ──
// RAGE's inline script carries 21 top-level block comments in exactly the
// form `  /* ================= name ================= */` at two-space indent
// (IIFE body level). They are the only structural boundary the single classic
// script declares, so slices are cut at them; the part letters (-a/-b/…)
// follow the desimayhem precedent for sections larger than the window cap.
function findBanners(lines) {
  const banners = [];
  const re = /^ {2}\/\* =+ (.+?) =+ \*\/$/;
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i]);
    if (m) banners.push({ line: i + 1, name: m[1].trim() });
  }
  return banners;
}
const sectionSlug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const partLetter = (i) => String.fromCharCode(97 + i);

async function main() {
  const { mod: prettier, at } = await loadPrettier();
  console.log(`pinned prettier ${PINNED} (${at})`);

  const manifest = JSON.parse(fs.readFileSync(path.join(proj, ".upstream", "manifest.json"), "utf8"));
  const captured = Object.keys(manifest.files).map((r) => r.split(path.sep).join("/")).sort();
  const captureBytes = (rel) => {
    const abs = path.join(proj, rel);
    if (!fs.existsSync(abs)) throw new Error(`capture file missing: ${rel}`);
    const buf = fs.readFileSync(abs);
    if (sha256(buf) !== manifest.files[rel].sha256)
      throw new Error(`${rel} on disk does not match .upstream/manifest.json — re-verify the capture first`);
    return buf;
  };

  const readableDir = path.join(proj, "readable");
  const srcDir = path.join(proj, "src");
  fs.mkdirSync(readableDir, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });
  const written = { readable: new Set(), src: new Set() };

  const renameMap = loadRenameMap();
  const names = { byCapture: loadNames() };
  let renamedSlices = 0;
  let renamedNames = 0;

  const sources = [];
  const sections = [];
  const notRendered = [];
  const inlineMapBlocks = [];
  const inlineFiles = [];
  let slicedTotal = 0;
  let skippedTotal = 0;
  let wholeFileTotal = 0;

  // ── section-aligned slicing of one script source (pretty text) ─────────
  async function sliceScript({ rel, captureKind, captureByteStart, captureByteEnd, captureSha256, captureBytesLen, tag, pretty, sourceFile, captureText }) {
    const lines = linesOf(pretty);
    const dbg = await prettier.__debug.parse(pretty, { parser: "babel" });
    const program = (dbg.ast.program || dbg.ast).body;
    if (!program.length) throw new Error(`${sourceFile}: no top-level statements — readable changed shape`);

    // The whole game is one top-level IIFE (`(() => { … })();` — an
    // ExpressionStatement whose expression is the CallExpression of the
    // arrow function); unwrap it so slices land on the body's own statement
    // boundaries. Anything else is sliced as-is.
    let inner = program;
    let slicingMode = "top-level-program";
    let iifeFn = null;
    if (program.length === 1 && program[0].type === "ExpressionStatement") {
      const e = program[0].expression;
      const fn = e.type === "CallExpression" && e.callee ? e.callee : e;
      if (
        (fn.type === "ArrowFunctionExpression" || fn.type === "FunctionExpression") &&
        fn.body.type === "BlockStatement"
      ) {
        inner = fn.body.body;
        iifeFn = fn;
        slicingMode = "iife-body";
      }
    }
    // the directive prologue ("use strict") lives in AST `directives`, not
    // `body` — keep it as the head of the first slice so no line is orphaned
    const directives = iifeFn ? iifeFn.body.directives || [] : [];
    const directiveStmts = directives.map((d) => ({
      node: d,
      startLine: lineOf(pretty, d.start),
      endLine: lineOf(pretty, d.end),
      text: pretty.slice(d.start, d.end),
    }));
    const stmts = [
      ...directiveStmts,
      ...inner.map((n) => ({
        node: n,
        startLine: lineOf(pretty, n.start),
        endLine: lineOf(pretty, n.end),
        text: pretty.slice(n.start, n.end),
      })),
    ];
    for (let i = 1; i < stmts.length; i++)
      if (stmts[i].startLine <= stmts[i - 1].endLine)
        throw new Error(`${rel}: statements ${i - 1}/${i} share a line — cannot slice at line boundaries`);

    // ── the SERVED capture's own statements ──────────────────────────────
    // An index-only (skipped) tail records no `text`, so the public-export-name
    // gate has no derived text for it and falls back to the PRISTINE's own
    // lines: the pristine compared with itself, a comparison that can never
    // fail. `text` breaks that tautology — it records the SERVED capture's own
    // bytes for the tail's region (here: the entry document's inline script),
    // which is a different file from the pristine (the reading copy).
    //
    // The capture's inline script and the reading copy are the SAME source,
    // formatted differently, so their statements correspond one for one. The
    // correspondence is asserted, not assumed: a capture that changed shape
    // fails loudly here rather than recording a text that does not belong to
    // the tail.
    const capDbg = await prettier.__debug.parse(captureText, { parser: "babel" });
    const capProgram = (capDbg.ast.program || capDbg.ast).body;
    let capInner = capProgram;
    let capIifeFn = null;
    if (capProgram.length === 1 && capProgram[0].type === "ExpressionStatement") {
      const e = capProgram[0].expression;
      const fn = e.type === "CallExpression" && e.callee ? e.callee : e;
      if (
        (fn.type === "ArrowFunctionExpression" || fn.type === "FunctionExpression") &&
        fn.body.type === "BlockStatement"
      ) {
        capInner = fn.body.body;
        capIifeFn = fn;
      }
    }
    const capDirectives = capIifeFn ? capIifeFn.body.directives || [] : [];
    const capStmts = [...capDirectives, ...capInner].map((n) => ({ start: n.start, end: n.end }));
    if (capStmts.length !== stmts.length)
      throw new Error(
        `${rel}: the served capture carries ${capStmts.length} statement(s), the reading copy ${stmts.length} — the statement correspondence is gone`,
      );
    /** the served capture's own bytes for the reading copy's statements a..b */
    const captureTextForStatements = (a, b) => captureText.slice(capStmts[a].start, capStmts[b].end);

    // ── section assignment: a statement belongs to the last banner above it ─
    const banners = findBanners(lines);
    const secs = [];
    let curSec = { name: "boot", title: "entry helper", slug: "boot", line: stmts.length ? stmts[0].startLine : 1, banner: false, stmts: [] };
    let bi = 0;
    for (const s of stmts) {
      while (bi < banners.length && banners[bi].line < s.startLine) {
        if (curSec.stmts.length || curSec.banner) secs.push(curSec);
        curSec = { name: banners[bi].name, slug: sectionSlug(banners[bi].name), line: banners[bi].line, banner: true, stmts: [] };
        bi++;
      }
      curSec.stmts.push(s);
    }
    if (curSec.stmts.length) secs.push(curSec);
    for (const sec of secs)
      if (!sec.stmts.length) throw new Error(`${rel}: section "${sec.name}" has no statements — banner scan changed shape`);
    const noBanner = banners.length === 0;
    if (noBanner && secs.length !== 1) throw new Error(`${rel}: no banners but ${secs.length} sections`);
    for (const sec of secs) {
      if (sec.banner && lines[sec.line - 1] === undefined) throw new Error(`${rel}: banner of "${sec.name}" is out of range`);
      if (sec.banner && sec.stmts[0].startLine - sec.line > 2)
        throw new Error(`${rel}: banner "${sec.name}" at line ${sec.line} is ${sec.stmts[0].startLine - sec.line} lines from its first statement — banner scan changed shape`);
    }
    if (secs.length > 1) {
      const dup = new Set();
      for (const sec of secs)
        if (dup.has(sec.slug)) throw new Error(`${rel}: duplicate section slug "${sec.slug}" — cannot name slices`);
        else dup.add(sec.slug);
    }

    const specials = [];
    const covered = new Array(stmts.length).fill(false);
    const indexOfStmt = new Map(stmts.map((s, i) => [s, i]));
    const claim = (a, b, block) => {
      if (a < 0 || b < a || b >= stmts.length) throw new Error(`${rel}: bad ${block.file} range ${a}-${b}`);
      for (let i = a; i <= b; i++) {
        if (covered[i]) throw new Error(`${rel}: ${block.file} overlaps another block at statement ${i}`);
        covered[i] = true;
      }
      specials.push({ ...block, A: stmts[a].startLine, B: stmts[b].endLine, stmtFrom: a, stmtTo: b });
    };

    // wrapper head/tail (the `(() => {` and `})();` lines) are non-standalone
    if (slicingMode === "iife-body") {
      const first = stmts[0];
      const last = stmts[stmts.length - 1];
      if (first.startLine > 1)
        specials.push({
          kind: "skip",
          file: `${tag}-wrapper-head.js`,
          title: `${tag} — IIFE wrapper head (non-standalone, not sliced)`,
          desc: `Lines 1-${first.startLine - 1}. The inline script opens with a single top-level IIFE (\`(() => {\`); the wrapper head is not standalone, so it is indexed only. Slices are cut inside the body (${slicingMode}); the directive prologue heads the first slice.`,
          A: 1,
          B: first.startLine - 1,
          wrapper: "head",
        });
      if (last.endLine < lines.length)
        specials.push({
          kind: "skip",
          file: `${tag}-wrapper-tail.js`,
          title: `${tag} — IIFE wrapper tail (non-standalone, not sliced)`,
          desc: `Lines ${last.endLine + 1}-${lines.length}. The IIFE invocation tail (\`})();\`) is not standalone, so it is indexed only.`,
          A: last.endLine + 1,
          B: lines.length,
          wrapper: "tail",
        });
    }

    // body statements that are not standalone at module top level (top-level `return`)
    for (let i = 0; i < stmts.length; i++) {
      if (!covered[i] && hasTopLevelReturn(stmts[i].node)) {
        claim(i, i, {
          kind: "skip",
          file: `${tag}-nonstandalone-${i + 1}.js`,
          title: `${tag} — non-standalone statement (top-level return, not sliced)`,
          desc: `Lines ${stmts[i].startLine}-${stmts[i].endLine}. This statement is only valid inside the IIFE (it contains a top-level \`return\`), so it is indexed only — it would not parse standalone.`,
        });
      }
    }

    // ── per section: runs of uncovered statements -> windows ───────────────
    const blocks = [...specials];
    const sectionOf = new Map();
    for (const sec of secs) {
      const list = sec.stmts.filter((s) => !covered[indexOfStmt.get(s)]);
      const runs = [];
      for (let i = 0; i < sec.stmts.length; i++) {
        if (covered[indexOfStmt.get(sec.stmts[i])]) continue;
        const run = [sec.stmts[i]];
        while (i + 1 < sec.stmts.length && !covered[indexOfStmt.get(sec.stmts[i + 1])]) run.push(sec.stmts[++i]);
        runs.push(run);
      }
      const windows = [];
      for (const run of runs) for (const w of windowize(run)) windows.push(w);
      if (!windows.length) throw new Error(`${rel}: section "${sec.name}" produced no slice windows`);
      windows.forEach((w, k) => {
        // the section's first window owns its banner line; later windows start
        // at their first statement
        const firstClaimed = covered[indexOfStmt.get(sec.stmts[0])];
        const A = k === 0 && !firstClaimed ? Math.min(sec.line, w.startLine) : w.startLine;
        const parts = windows.length;
        const file = parts === 1 ? `${sec.slug}.js` : `${sec.slug}-${partLetter(k)}.js`;
        const title = sec.title || sec.name;
        const titleWithParts = parts === 1 ? title : `${title} (part ${k + 1} of ${parts})`;
        const block = { kind: "slice", A, B: w.endLine, count: w.count, section: sec.name, file, title: titleWithParts };
        blocks.push(block);
        sectionOf.set(file, sec);
      });
      if (list.length === 0) throw new Error(`${rel}: section "${sec.name}" is entirely skipped`);
    }

    // re-tile so every line of the pretty is owned
    blocks.sort((a, b) => a.A - b.A);
    for (let i = 0; i < blocks.length; i++) {
      if (i === 0) blocks[i].A = 1;
      if (i + 1 < blocks.length) blocks[i].B = blocks[i + 1].A - 1;
      else blocks[i].B = lines.length;
    }

    let nn = 0;
    let perFileSkipped = 0;
    const targetsByOld = new Map(); // rename map: old name -> Set(targets) seen in this chunk's slices
    const noteTarget = (old, target) => {
      if (!targetsByOld.has(old)) targetsByOld.set(old, new Set());
      targetsByOld.get(old).add(target);
    };
    let perFileRenamed = 0;
    for (const b of blocks) {
      if (b.kind === "slice") {
        nn++;
        const file = b.file;
        const rawBody = lines.slice(b.A - 1, b.B).join("\n") + "\n";
        const record = recordsFor(renameMap, file);
        const body = record ? applyRecordedMap(rawBody, record) : rawBody;
        if (record) {
          perFileRenamed++;
          for (const [old, target] of Object.entries(record.files || {})) noteTarget(old, target);
          for (const [old, hits] of Object.entries(record.scoped || {}))
            for (const [, target] of hits) noteTarget(old, target);
        }
        const base = file.replace(/\.js$/, "");
        const header = sliceHeader({ base, title: b.title, sourceFile, startLine: b.A, endLine: b.B });
        const sliceText = header + body;
        const chk = parses(sliceText);
        if (!chk.ok) throw new Error(`generated src/${file} does not parse standalone: ${chk.why}`);
        fs.writeFileSync(path.join(srcDir, file), sliceText);
        written.src.add(file);
        const ms = markerWords(body);
        sections.push({
          file,
          title: b.title,
          desc: `Section "${b.section}" of the inline script. Lines ${b.A}-${b.B}. Markers: ${markerText(ms)}.${record ? " Range re-cut through the recorded semantic rename map." : ""}`,
          startLine: b.A,
          endLine: b.B,
          sourceFile,
          section: b.section,
        });
      } else {
        perFileSkipped++;
        // the SERVED capture's own bytes for this region — the derived text
        // the public-export-name gate compares against the pristine, so the
        // tail is never rebuilt from the pristine's own lines.
        const tailText =
          b.wrapper === "head"
            ? captureText.slice(0, capStmts[0].start)
            : b.wrapper === "tail"
              ? captureText.slice(capStmts[capStmts.length - 1].end)
              : b.stmtFrom != null
                ? captureTextForStatements(b.stmtFrom, b.stmtTo)
                : null;
        sections.push({
          file: b.file,
          skipped: true,
          title: b.title,
          desc: b.desc,
          startLine: b.A,
          endLine: b.B,
          sourceFile,
          firstLine: lines[b.A - 1],
          lastLine: lines[b.B - 1],
          ...(tailText ? { text: tailText } : {}),
        });
      }
    }
    slicedTotal += nn;
    skippedTotal += perFileSkipped;
    // the authored binding map: rules from tools/names.json that actually
    // fired in this chunk (seen in at least one recorded slice map)
    const authored = names.byCapture?.[rel] || {};
    const renameBindings = {};
    for (const [old, target] of Object.entries(authored)) {
      if (targetsByOld.get(old)?.has(target)) {
        renameBindings[old] = target;
        renamedNames++;
      }
    }
    if (perFileRenamed) renamedSlices += perFileRenamed;
    sources.push({
      sourceFile,
      capture: rel,
      captureKind,
      captureByteStart,
      captureByteEnd,
      captureSha256,
      captureBytes: captureBytesLen,
      prettyLines: lines.length,
      prettyBytes: Buffer.byteLength(pretty, "utf8"),
      prettyPasses: 1,
      idempotent: true,
      tag,
      slicingMode: secs.length > 1 ? `${slicingMode}-section-aligned` : slicingMode,
      slices: nn,
      skipped: perFileSkipped,
      sections: secs.map((s) => s.name),
      renameBindings,
      derived:
        `readable + ${nn} section-aligned slice(s)` +
        (perFileSkipped ? ` + ${perFileSkipped} skipped section(s)` : "") +
        (perFileRenamed ? ` (${perFileRenamed} through the recorded rename map)` : ""),
    });
    console.log(
      `derive: ${tag} -> ${sourceFile} (${lines.length} lines, ${nn} slices, ${perFileSkipped} skipped, ${secs.length} section(s), ${slicingMode}${perFileRenamed ? `, ${perFileRenamed} renamed` : ""})`,
    );
  }

  // ── 1) entry document: inline <script>/<style> scan + twins + slicing ───
  const htmlRels = captured.filter((r) => /\.html$/i.test(r));
  if (!htmlRels.length) throw new Error("capture carries no HTML entry document");
  for (const rel of htmlRels) {
    const buf = captureBytes(rel);
    const blocks = scanBlocks(buf);
    const inline = blocks.filter((b) => !b.external);
    const externals = blocks.filter((b) => b.external);
    inlineFiles.push(rel);
    for (const b of externals) console.log(`derive: ${rel}: external ${b.kind} (not derived): ${b.tag.slice(0, 90)}`);
    if (!inline.length) throw new Error(`${rel}: no inline <script>/<style> content blocks — nothing to derive`);
    const entryTag = rel.replace(/\.html$/i, "").split("/").join("__");
    const DATA_TYPES = new Set(["application/ld+json", "application/json", "importmap", "speculationrules"]);
    for (const b of inline) {
      const isImportmap = b.kind === "importmap";
      const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(b.tag)?.[1] ?? "").toLowerCase();
      if (b.kind === "script" && DATA_TYPES.has(type)) {
        notRendered.push({
          capture: rel,
          kind: "inline-data",
          type,
          byteStart: b.contentStart,
          byteEnd: b.contentEnd,
          bytes: b.bytes,
          sha256: b.sha256,
          rendered: false,
          reason: `typed data block (<script type="${type}">) — data, not JS/CSS; recorded with range + sha256, no pretty pass`,
        });
        continue;
      }
      const tag = `${entryTag}-inline-${b.block}`;
      const parser = isImportmap ? "json" : b.kind === "style" ? "css" : "babel";
      const prettyExt = isImportmap ? "json" : b.kind === "style" ? "css" : "js";
      const prettyFile = `${tag}.pretty.${prettyExt}`;
      const pretty = await formatOnce(prettier, b.text, parser);
      if (pretty === b.text)
        throw new Error(`readable/${prettyFile} would be byte-identical to its capture source`);
      fs.writeFileSync(path.join(readableDir, prettyFile), pretty);
      written.readable.add(prettyFile);
      inlineMapBlocks.push({
        file: `readable/${prettyFile}`,
        source: rel,
        kind: isImportmap ? "importmap" : b.kind,
        byteStart: b.contentStart,
        byteEnd: b.contentEnd,
        bytes: b.bytes,
        sha256: b.sha256,
        prettyFile: `readable/${prettyFile}`,
        prettyBytes: Buffer.byteLength(pretty, "utf8"),
      });
      if (b.kind === "style" || isImportmap) {
        // stylesheet/importmap rule: whole-file, never sliced
        const lines = linesOf(pretty);
        wholeFileTotal++;
        sections.push({
          file: `${tag}.${prettyExt}`,
          wholeFile: true,
          title: `${tag} — inline ${isImportmap ? "importmap" : b.kind} block (whole-file, never sliced)`,
          desc: `Lines 1-${lines.length} of readable/${prettyFile}. Whole-file: the entry document's inline ${b.kind} block (${b.bytes} B at bytes ${b.contentStart}-${b.contentEnd} of ${rel}) is indexed whole and never sliced.`,
          note: `whole-file (entry inline ${b.kind} block, not sliced)`,
          startLine: 1,
          endLine: lines.length,
          sourceFile: `readable/${prettyFile}`,
        });
        sources.push({
          sourceFile: `readable/${prettyFile}`,
          capture: rel,
          captureKind: `inline-${b.kind}`,
          captureByteStart: b.contentStart,
          captureByteEnd: b.contentEnd,
          captureSha256: b.sha256,
          captureBytes: b.bytes,
          prettyLines: lines.length,
          prettyBytes: Buffer.byteLength(pretty, "utf8"),
          prettySha256: sha256(Buffer.from(pretty, "utf8")),
          tag,
          slices: 0,
          derived: "readable only (inline block, wholeFile)",
        });
        console.log(`derive: ${rel} inline ${b.kind} #${b.block} -> readable/${prettyFile} (${lines.length} lines, wholeFile)`);
      } else {
        await sliceScript({
          rel,
          captureKind: `inline-${b.kind}`,
          captureByteStart: b.contentStart,
          captureByteEnd: b.contentEnd,
          captureSha256: b.sha256,
          captureBytesLen: b.bytes,
          tag,
          pretty,
          sourceFile: `readable/${prettyFile}`,
          captureText: b.text,
        });
      }
    }
  }

  // ── 2) non-code payloads: hashed notRendered records (no pretty pass) ───
  for (const rel of captured) {
    if (/\.html?$/i.test(rel)) continue;
    const kind = KIND_OF.find(([re]) => re.test(rel))?.[1];
    if (!kind) throw new Error(`captured non-HTML file with unknown payload kind: ${rel}`);
    const buf = captureBytes(rel);
    notRendered.push({
      capture: rel,
      kind,
      bytes: buf.length,
      sha256: manifest.files[rel].sha256,
      rendered: false,
      reason: `${kind} payload — binary/data capture stays byte-exact under .upstream/manifest.json; recorded here hashed, no pretty pass`,
    });
  }

  // ── 3) inline map (byte ranges + sha256 of every inline block) ──────────
  fs.writeFileSync(
    path.join(readableDir, "index-inline-map.json"),
    JSON.stringify(
      {
        note:
          "byte ranges (into the captured entry document) + sha256 for every inline <script>/<style> content block, " +
          "with its readable twin; generated by tools/derive.mjs",
        blocks: inlineMapBlocks,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`derive: wrote readable/index-inline-map.json (${inlineMapBlocks.length} inline block(s))`);

  // ── 4) prune orphan derived files (capture untouched) ──────────────────
  let pruned = 0;
  for (const [dir, keep, exts] of [
    [readableDir, written.readable, /\.(pretty\.js|pretty\.css|pretty\.json)$/],
    [srcDir, written.src, /\.js$/],
  ]) {
    for (const f of fs.readdirSync(dir)) {
      if (exts.test(f) && !keep.has(f)) {
        fs.rmSync(path.join(dir, f));
        pruned++;
        console.log(`derive: pruned orphan derived file ${path.join(path.basename(dir), f)}`);
      }
    }
  }

  // ── 5) split-spec.json (2-space indent + trailing newline) ─────────────
  const scriptSource = sources.find((s) => s.slicingMode);
  const cssSources = sources.filter((s) => s.sourceFile.endsWith(".pretty.css"));
  const slicesRanged = sections.filter((s) => !s.wholeFile && !s.skipped).length;
  const skippedSections = sections.filter((s) => s.skipped).length;
  const spec = {
    project: "darths-rage",
    kind: "section-aligned-slices",
    defaultFile: "src/boot.js",
    note:
      "RAGE (https://darths-rage.netlify.app/) is capture-class: a single-file three.js action game served by " +
      "Netlify at the origin root. §0.4 fork-over-mirror was checked on 2026-10-13 — no public upstream repo " +
      "exists (the page carries no github/gitlab/bitbucket reference; a GitHub search finds only unrelated " +
      "projects), so the mirror stands. Derived pipeline: capture → pinned prettier 3.9.6 (module API, default " +
      "options, single pass verified idempotent — never the CLI: it respects .gitignore and can silently echo " +
      "its input) → the entry document's inline <script> becomes readable/index-inline-1.pretty.js and its two " +
      "inline <style> blocks become readable/index-inline-1|2.pretty.css (every pretty provably NOT " +
      "byte-identical to its capture block; readable/index-inline-map.json records each block's exact byte " +
      "range + sha256). Structure (2026-10-14 pass, evidence tools/probe-structure.mjs): 0 sourceMappingURL " +
      "occurrences and 0 *.map files across the 72 captured files — no original tree can be reconstructed from " +
      "maps; the inline script is one classic IIFE with 0 import/export occurrences and no factory family, so " +
      "the real structure the bytes expose is the author's own 21 top-level section banners " +
      "(`/* ===== level ===== */`, two-space indent). src/ slices are cut at those section boundaries (35 " +
      "statement-aligned slice windows: sections longer than the 350-line cap split into -a/-b/... parts) and " +
      "named after the sections (src/boot.js, src/level-a.js, src/updates-c.js, …). The IIFE wrapper head/tail " +
      "and body statements that are not standalone at module top level (the engine guard, the renderer try " +
      "guard and the sfx declaration each contain a top-level `return`) are skipped sections, indexed but " +
      "never sliced. Every slice parses standalone under `node --input-type=module --check -` and round-trips " +
      "byte-exact to its recorded readable line range (through the recorded rename map when rename-map.json " +
      "carries one). Stylesheet rule — the two inline <style> blocks are wholeFile sections, never sliced. " +
      "Non-code payloads (MP3 audio, WebP images, favicon.ico and the eight glTF model/geometry JSON payloads) " +
      "are hashed notRendered records (bytes + sha256, no pretty pass). The CDN dependencies (nine jsdelivr " +
      "three.js r147 scripts, the Google Fonts stylesheet) were never captured (socker precedent, PLAN §1) and " +
      "have no derived layer; tools/capture.mjs --check lists them as external off-origin references. The " +
      "semantic rename layer (tools/names.json → tools/apply-names.mjs, recovered into rename-map.json by " +
      "tools/recover-scoped-map.mjs, re-applied on every re-cut) names the game's own opaque short bindings " +
      "(byId, vec3, materials, level constants, scratch objects, audioEngine, …); the script is authored and " +
      "already semantic, so only the genuinely opaque chunk-scope names are renamed and vendor/global " +
      "identifiers (THREE.*) are never touched. `node tools/audit.js` is the gate. Capture bytes are untouched " +
      "by everything above; re-cut with `node tools/derive.mjs` after any capture refresh.",
    renderOptions: {
      _default:
        "prettier 3.9.6, module API, default options, single pass (re-format verified idempotent at derive time) — never the CLI: it respects .gitignore and can silently echo its input",
      js: "parser babel, no plugins (inline <script>)",
      css: "parser css, no plugins (inline <style>)",
      json: "parser json, no plugins (inline importmap blocks, if any)",
    },
    structure: {
      moduleBoundaries:
        "none exposed — the inline script is one classic IIFE (`(() => { … })();`) with 0 import/export " +
        "occurrences, no factory family and no export table (evidence: tools/probe-structure.mjs). The real " +
        "structure the bytes declare is the author's 21 top-level section banners; slices are cut at them, " +
        "and the parts of oversized sections (-a/-b/…) follow the desimayhem semantic-slice precedent.",
      sourceMaps:
        "none — 0 sourceMappingURL occurrences and 0 *.map files across the 72 captured files (scanned by " +
        "tools/probe-structure.mjs), so the derivation stays a prettier/section-slice pass.",
      sections: `${(scriptSource?.sections?.length ?? 1) - 1} banners → ${scriptSource?.sections?.length ?? 1} sections (with the banner-less boot preamble) → ${slicedTotal} statement-aligned slice windows`,
    },
    source:
      `readable/: ${inlineMapBlocks.length} inline twin(s) (1 script → ${scriptSource?.slices ?? 0} section-aligned slices, ` +
      `${cssSources.length} CSS pretties wholeFile); ` +
      `src/: ${slicedTotal} section-aligned slice(s) across ${scriptSource?.sections?.length ?? 0} section(s); ` +
      `${skippedSections} skipped section(s); ` +
      `${sections.filter((s) => s.wholeFile).length} wholeFile section(s); ` +
      `capture: ${captured.length} files under .upstream/manifest.json; inline scan: ${inlineFiles.join(", ")} ` +
      `(${inlineMapBlocks.length} content block(s)); notRendered: ${notRendered.length} hashed payload record(s).`,
    inline: {
      scanned: inlineFiles,
      contentBlocks: inlineMapBlocks.length,
      notRendered: notRendered.filter((n) => n.kind === "inline-data").length,
      note:
        "the entry document carries one inline <script> (the whole game, 170,041 B) and two inline <style> " +
        "blocks; every content block has a readable twin recorded in readable/index-inline-map.json with its " +
        "exact byte range + sha256. The nine external <script src> loads (jsdelivr three.js r147) are CDN " +
        "dependencies and are not derived.",
    },
    rename: {
      map: "rename-map.json",
      slices: renamedSlices,
      names: renamedNames,
      namesSource: "tools/names.json (reviewed worklist) → tools/apply-names.mjs (scope-aware writer) → recovered by tools/recover-scoped-map.mjs",
      note:
        "Semantic renames are recorded per slice in rename-map.json and re-applied on every re-cut. The script " +
        "is authored (not minified), so the campaign renames only the genuinely opaque chunk-scope names " +
        "(short utility aliases, scratch vectors/quaternions, level-constant abbreviations); the rest keep the " +
        "author's own names. THREE.* property names and all globals/vendor identifiers are never renamed.",
    },
    sources,
    sections,
    notRendered,
  };
  fs.writeFileSync(path.join(proj, "split-spec.json"), JSON.stringify(spec, null, 2) + "\n");

  // ── 6) self-check (tools/audit.js is the authoritative gate) ────────────
  let bad = 0;
  const bySource = new Map();
  for (const s of sections) {
    if (!bySource.has(s.sourceFile)) bySource.set(s.sourceFile, []);
    bySource.get(s.sourceFile).push(s);
  }
  for (const [sourceFile, list] of bySource) {
    const lines = readLines(path.join(proj, sourceFile));
    const sorted = [...list].sort((a, b) => a.startLine - b.startLine);
    if (sorted[0].startLine !== 1) {
      console.error(`TILING FAIL ${sourceFile}: starts at line ${sorted[0].startLine}`);
      bad++;
    }
    for (let i = 1; i < sorted.length; i++)
      if (sorted[i].startLine !== sorted[i - 1].endLine + 1) {
        console.error(`TILING FAIL ${sourceFile}: gap/overlap at ${sorted[i].file}`);
        bad++;
      }
    if (sorted[sorted.length - 1].endLine !== lines.length) {
      console.error(`TILING FAIL ${sourceFile}: does not reach EOF (${lines.length})`);
      bad++;
    }
  }
  let parsed = 0;
  let ranged = 0;
  let roundOK = 0;
  for (const s of sections) {
    if (s.wholeFile || s.skipped) continue;
    ranged++;
    const abs = path.join(srcDir, s.file);
    const text = fs.readFileSync(abs, "utf8");
    const nl2 = text.indexOf("\n", text.indexOf("\n") + 1);
    const body = text.slice(nl2 + 1);
    const raw = readLines(path.join(proj, s.sourceFile)).slice(s.startLine - 1, s.endLine).join("\n") + "\n";
    const record = recordsFor(renameMap, s.file);
    const expected = record ? applyRecordedMap(raw, record) : raw;
    if (body !== expected) {
      console.error(`ROUND-TRIP FAIL ${s.file}`);
      bad++;
    } else roundOK++;
    if (!parses(text).ok) {
      console.error(`PARSE FAIL src/${s.file}`);
      bad++;
    } else parsed++;
  }
  let prettyParsed = 0;
  for (const s of sources) {
    if (!s.sourceFile.endsWith(".pretty.js")) continue;
    if (!parses(fs.readFileSync(path.join(proj, s.sourceFile), "utf8")).ok) {
      console.error(`PARSE FAIL ${s.sourceFile}`);
      bad++;
    } else prettyParsed++;
  }
  console.log(
    `derive: ${written.readable.size} readable file(s), ${written.src.size} src slices ` +
      `(${parsed}/${ranged} parse standalone, ${roundOK}/${ranged} round-trip byte-exact${renamedSlices ? " through the recorded map" : ""}), ` +
      `${skippedSections} skipped, ${sections.filter((s) => s.wholeFile).length} wholeFile, ` +
      `${prettyParsed} pretty js parse clean, ${notRendered.length} notRendered, ${pruned} orphan(s) pruned — ` +
      `self-check ${bad ? bad + " FAILURE(S)" : "clean"}`,
  );
  if (bad) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
