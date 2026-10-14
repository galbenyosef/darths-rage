// verify-rename.mjs — apply rename-map.json to a slice's readable range and
// require an exact reproduction of the committed slice, then prove the rename
// layer kept every reference and binding intact across the chunk.
//
//   node tools/verify-rename.mjs <slice-file> [<slice-file> …]
//   node tools/verify-rename.mjs --all
//
// `files` word-boundary records and `scoped` token-index records are applied by
// tools/engine/rename-layer.mjs applyRecordedMap — the SAME application
// tools/derive.mjs re-cuts with and tools/audit.js gates on, so an index means
// the same position everywhere.
//
// The token-level proof cannot see a rename applied at some references and not
// others (the streams still line up — both sides are just identifiers).
// tools/refcheck.mjs closes that hole: the WHOLE chunk is reconstructed with the
// committed slice bodies substituted and its unbound-name set and resolved
// binding trace are compared against the pristine readable chunk. A name that
// was bound before and is unbound after is a declaration renamed without its
// callers — or vice versa.
//
// The index-only skipped sections of the chunk — the IIFE wrapper head/tail and
// the non-standalone guard/sfx statements (no src file) — reference the renamed
// chunk-scope bindings, so the reconstruction applies the chunk's recorded
// binding map (split-spec sources[].renameBindings, computed by
// tools/derive.mjs from tools/names.json and the recorded map) to those
// sections.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyBindingMap, applyRecordedMap, sourceResolver } from "./engine/rename-layer.mjs";
import { bindingDrift, refDrift } from "./refcheck.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, "..");
const spec = JSON.parse(fs.readFileSync(path.join(proj, "split-spec.json"), "utf8"));
const prettyFor = sourceResolver(proj, spec);

const rmPath = path.join(proj, "rename-map.json");
const rm = fs.existsSync(rmPath) ? JSON.parse(fs.readFileSync(rmPath, "utf8")) : { files: {}, scoped: {} };
const recordFor = (file) => {
  const files = rm.files?.[file];
  const scoped = rm.scoped?.[file];
  return files || scoped ? { files, scoped } : null;
};
const bindingsOf = (sourceFile) => spec.sources.find((s) => s.sourceFile === sourceFile)?.renameBindings || {};
const committedBody = (file) => {
  // strip exactly the 2-line provenance header — never a run of leading //
  // lines (sw.js opens with real comments that are part of its body)
  const raw = fs.readFileSync(path.join(proj, "src", file), "utf8").replace(/\r\n/g, "\n");
  const nl1 = raw.indexOf("\n");
  const nl2 = nl1 >= 0 ? raw.indexOf("\n", nl1 + 1) : -1;
  return (nl2 >= 0 ? raw.slice(nl2 + 1) : raw).replace(/[\n\s]+$/, "");
};

// chunk-level gate: reconstruct the whole chunk and compare traces
const chunkCache = new Map();
async function verifyChunk(sourceFile) {
  if (chunkCache.has(sourceFile)) return chunkCache.get(sourceFile);
  const sections = spec.sections
    .filter((s) => s.sourceFile === sourceFile && !s.wholeFile && typeof s.startLine === "number")
    .sort((a, b) => a.startLine - b.startLine);
  const lines = prettyFor(sections[0]);
  const fullText = lines.join("\n");
  const prefix = new Array(lines.length + 1).fill(0);
  for (let i = 0; i < lines.length; i++) prefix[i + 1] = prefix[i] + lines[i].length + 1;

  let cursor = 0;
  let out = "";
  let reproduced = 0;
  let rangedCount = 0;
  let renamed = 0;
  let occurrences = 0;
  const perFile = new Map();
  for (const sec of sections) {
    const start = prefix[sec.startLine - 1];
    const end = prefix[sec.endLine] - 1;
    const range = fullText.slice(start, end);
    let piece = range;
    if (sec.skipped) {
      piece = applyBindingMap(range, bindingsOf(sourceFile));
      perFile.set(sec.file, { skipped: true });
    } else {
      const record = recordFor(sec.file);
      const srcAbs = path.join(proj, "src", sec.file);
      rangedCount++;
      if (fs.existsSync(srcAbs)) {
        const body = committedBody(sec.file);
        let ok = false;
        let why = "";
        try {
          const applied = applyRecordedMap(range, record).replace(/[\n\s]+$/, "");
          ok = applied === body;
        } catch (e) {
          why = e.message;
        }
        if (ok) reproduced++;
        perFile.set(sec.file, { reproduced: ok, why, renamed: !!record });
        if (record) {
          renamed++;
          occurrences += Object.values(record.scoped || {}).flat().length;
        }
        piece = body + (body.endsWith("\n") ? "" : "\n");
      } else {
        perFile.set(sec.file, { reproduced: false, why: "src file missing" });
      }
    }
    out += fullText.slice(cursor, start) + piece;
    cursor = end;
  }
  out += fullText.slice(cursor);
  const drift = await refDrift(out, fullText);
  const rebound = await bindingDrift(out, fullText);
  const result = { sections: sections.length, rangedCount, reproduced, renamed, occurrences, drift, rebound, perFile, reconstructed: out, fullText };
  chunkCache.set(sourceFile, result);
  return result;
}

async function verifyOne(file) {
  const sec = spec.sections.find((s) => s.file === file);
  if (!sec) {
    console.error(`no section for ${file}`);
    return false;
  }
  const record = recordFor(file);
  const res = await verifyChunk(sec.sourceFile);
  const mine = res.perFile.get(file) || {};
  const flat = Object.keys(record?.files || {}).length;
  const indexed = Object.values(record?.scoped || {}).flat().length;
  console.log(`${file}`);
  console.log(`  flat renames    : ${flat}`);
  console.log(`  indexed renames : ${indexed} occurrence(s)`);
  console.log(`  reproduces slice: ${mine.reproduced ? "YES" : "NO"}`);
  if (!mine.reproduced && mine.why) console.log(`    ${mine.why}`);
  console.log(`  references ok   : ${res.drift ? "NO" : "YES"} (whole ${sec.sourceFile})`);
  if (res.drift) {
    console.log(`    unbound only in slices: ${res.drift.extra.slice(0, 20).join(", ") || "(none)"}`);
    console.log(`    unbound only in source: ${res.drift.missing.slice(0, 20).join(", ") || "(none)"}`);
  }
  console.log(`  bindings ok     : ${res.rebound ? "NO" : "YES"} (whole ${sec.sourceFile})`);
  if (res.rebound) console.log(`    reference ${res.rebound.at} resolves to a different binding (${res.rebound.reason})`);
  return !!mine.reproduced && !res.drift && !res.rebound;
}

async function verifyAll() {
  const byChunk = new Map();
  for (const s of spec.sections) {
    if (s.wholeFile || s.skipped || typeof s.startLine !== "number") continue;
    if (!byChunk.has(s.sourceFile)) byChunk.set(s.sourceFile, 0);
    byChunk.set(s.sourceFile, byChunk.get(s.sourceFile) + 1);
  }
  let slices = 0;
  let reproduced = 0;
  let renamed = 0;
  let occurrences = 0;
  let chunksOk = 0;
  let chunksBad = 0;
  for (const [sourceFile, count] of [...byChunk].sort()) {
    const res = await verifyChunk(sourceFile);
    slices += res.rangedCount;
    reproduced += res.reproduced;
    renamed += res.renamed;
    occurrences += res.occurrences;
    const ok = res.reproduced === res.rangedCount && !res.drift && !res.rebound;
    if (ok) chunksOk++;
    else {
      chunksBad++;
      console.error(`${sourceFile}: reproduces ${res.reproduced}/${res.rangedCount}, references ok: ${res.drift ? "NO" : "YES"}, bindings ok: ${res.rebound ? "NO" : "YES"}`);
      if (res.drift) {
        console.error(`  unbound only in slices: ${res.drift.extra.slice(0, 20).join(", ") || "(none)"}`);
        console.error(`  unbound only in source: ${res.drift.missing.slice(0, 20).join(", ") || "(none)"}`);
      }
      if (res.rebound) console.error(`  binding drift at ${res.rebound.at} (${res.rebound.reason})`);
    }
    console.log(
      `${sourceFile}: ${res.rangedCount} slice(s), ${res.renamed} renamed, reproduces: ${res.reproduced}/${res.rangedCount}, ` +
        `references ok: ${res.drift ? "NO" : "YES"}, bindings ok: ${res.rebound ? "NO" : "YES"}`,
    );
  }
  console.log(
    `verify-rename: ${reproduced}/${slices} slice(s) reproduce byte-exact, ${renamed} renamed slice(s) ` +
      `(${occurrences} indexed occurrence(s)), ${chunksOk}/${byChunk.size} chunk(s) references+bindings YES`,
  );
  return chunksBad === 0 && reproduced === slices;
}

const targets = process.argv.slice(2).filter((a) => !a.startsWith("--"));
let ok = true;
if (process.argv.includes("--all")) {
  ok = await verifyAll();
} else {
  if (!targets.length) {
    console.error("usage: node tools/verify-rename.mjs <slice-file> […] | --all");
    process.exit(2);
  }
  for (const f of targets) ok = (await verifyOne(f)) && ok;
}
process.exit(ok ? 0 : 1);
