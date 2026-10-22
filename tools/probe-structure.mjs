// probe-structure.mjs — structure evidence for the 2026-10-14 structure pass
// (PLAN §5: "the served path is the truth" / true module boundaries).
//
// Answers three questions from the BYTES, not from opinion:
//
//   1. source maps: does anything in the capture carry `sourceMappingURL` or a
//      `.map` reference? (a real original tree would change the derivation)
//   2. module boundaries: does the inline script expose ES modules, a factory
//      family, an export table — or is it one classic IIFE statement list?
//   3. the author's own structure: top-level section banners inside the IIFE
//      body, and how the statement-aligned slicing windows fall against them.
//
// It reads only readable/index-inline-1.pretty.js (derived) and the capture
// manifest (for the map scan); it writes nothing.
//
// usage: node tools/probe-structure.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, "..");
const PINNED = "3.9.6";

// pinned prettier (module API, exactly 3.9.6) — same loader shape as derive.mjs
async function loadPrettier() {
  const candidates = [
    process.env.PRETTIER_MJS,
    path.join(proj, "tools", "vendor", "prettier", "index.mjs"),
    path.join(proj, "node_modules", "prettier", "index.mjs"),
  ].filter(Boolean);
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(c), "package.json"), "utf8"));
      if (pkg.version !== PINNED) continue;
      const mod = (await import(pathToFileURL(c).href)).default;
      if (mod.version === PINNED) return mod;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    `pinned prettier ${PINNED} not found.\n` +
      `  tried:\n` +
      candidates.map((c) => `    ${c}`).join("\n") +
      `\n  fix: restore the vendored copy (git checkout -- tools/vendor/prettier) ` +
      `or install it (npm install --no-save prettier@${PINNED}), ` +
      `or point PRETTIER_MJS at its index.mjs`,
  );
}

const hasTopLevelReturn = (node) => {
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
};

async function main() {
  const prettier = await loadPrettier();

  // ── 1) source-map scan over the whole capture ────────────────────────────
  const manifest = JSON.parse(fs.readFileSync(path.join(proj, ".upstream", "manifest.json"), "utf8"));
  let mapHits = 0;
  let mapFiles = [];
  for (const rel of Object.keys(manifest.files)) {
    const buf = fs.readFileSync(path.join(proj, rel));
    const s = buf.toString("latin1");
    if (/sourceMappingURL/.test(s)) {
      mapHits++;
      mapFiles.push(rel);
    }
  }
  const mapFilesOnDisk = Object.keys(manifest.files).filter((r) => /\.map$/i.test(r));
  console.log(`source maps: ${mapHits} sourceMappingURL occurrence(s) across ${Object.keys(manifest.files).length} captured files, ${mapFilesOnDisk.length} *.map file(s) on disk`);
  if (mapFiles.length) console.log(`  files carrying sourceMappingURL: ${mapFiles.join(", ")}`);

  // ── 2) inline script module/structure census ─────────────────────────────
  const rel = "readable/index-inline-1.pretty.js";
  const text = fs.readFileSync(path.join(proj, rel), "utf8");
  const lines = text.replace(/\n$/, "").split("\n");
  const dbg = await prettier.__debug.parse(text, { parser: "babel" });
  const program = (dbg.ast.program || dbg.ast).body;
  console.log(`\ninline script: ${lines.length} lines, ${program.length} top-level statement(s)`);

  const importCount = (text.match(/\bimport\s*[({'"`]/g) || []).length;
  const exportCount = (text.match(/\bexport\b/g) || []).length;
  console.log(`ESM census: ${importCount} import occurrence(s), ${exportCount} export occurrence(s)`);

  // unwrap the single top-level IIFE
  let slicingMode = "top-level-program";
  let body = program;
  if (program.length === 1 && program[0].type === "ExpressionStatement") {
    const e = program[0].expression;
    const fn = e.type === "CallExpression" && e.callee ? e.callee : e;
    if ((fn.type === "ArrowFunctionExpression" || fn.type === "FunctionExpression") && fn.body.type === "BlockStatement") {
      body = fn.body.body;
      slicingMode = "iife-body";
    }
  }
  console.log(`slicing mode: ${slicingMode} (${body.length} body statement(s))`);

  const lineOf = (o) => text.slice(0, o).split("\n").length;
  const fnNode = slicingMode === "iife-body" ? program[0].expression.callee : null;
  const stmts = [
    ...(fnNode?.body?.directives || []).map((d) => ({ node: d, startLine: lineOf(d.start), endLine: lineOf(d.end) })),
    ...body.map((n) => ({ node: n, startLine: lineOf(n.start), endLine: lineOf(n.end) })),
  ];
  const kinds = new Map();
  for (const s of stmts) kinds.set(s.node.type, (kinds.get(s.node.type) || 0) + 1);
  console.log(`statement kinds: ${[...kinds].map(([k, v]) => `${k}:${v}`).join(" ")}`);

  // ── 3) section banners + section-aligned windows ─────────────────────────
  const banners = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^  \/\* =+ (.+?) =+ \*\/$/.exec(lines[i]);
    if (m) banners.push({ line: i + 1, name: m[1].trim() });
  }
  console.log(`\nsection banners (author's own, 2-space indent, IIFE body level): ${banners.length}`);
  for (const b of banners) console.log(`  line ${String(b.line).padStart(5)}  ${b.name}`);

  // partition statements into sections (statement belongs to the last banner above it)
  const secs = [];
  let cur = { name: "boot (preamble, no banner)", line: stmts.length ? stmts[0].startLine : 1, stmts: [] };
  let bi = 0;
  for (const s of stmts) {
    while (bi < banners.length && banners[bi].line < s.startLine) {
      secs.push(cur);
      cur = { name: banners[bi].name, line: banners[bi].line, stmts: [] };
      bi++;
    }
    cur.stmts.push(s);
  }
  secs.push(cur);

  const MAX_WINDOW = 350;
  const windowize = (list) => {
    const out = [];
    let w = null;
    for (const s of list) {
      if (!w) {
        w = { count: 1, startLine: s.startLine, endLine: s.endLine };
        continue;
      }
      if (s.endLine - w.startLine + 1 > MAX_WINDOW) {
        out.push(w);
        w = { count: 1, startLine: s.startLine, endLine: s.endLine };
      } else {
        w.count++;
        w.endLine = s.endLine;
      }
    }
    if (w) out.push(w);
    return out;
  };

  let total = 0;
  console.log(`\nsection-aligned windows (statements first claimed as skipped when they carry a top-level return; window cap ${MAX_WINDOW} lines):`);
  for (const sec of secs) {
    const skipped = sec.stmts.filter((s) => hasTopLevelReturn(s.node));
    const runs = [];
    for (let i = 0; i < sec.stmts.length; i++) {
      if (skipped.includes(sec.stmts[i])) continue;
      const run = [sec.stmts[i]];
      while (i + 1 < sec.stmts.length && !skipped.includes(sec.stmts[i + 1])) run.push(sec.stmts[++i]);
      runs.push(run);
    }
    const windows = [];
    for (const run of runs) for (const w of windowize(run)) windows.push(w);
    total += windows.length;
    const skipText = skipped.length ? `  skip ${skipped.map((s) => `${s.startLine}-${s.endLine}`).join(", ")}` : "";
    console.log(`  ${sec.name.padEnd(22)} ${String(sec.stmts.length).padStart(3)} stmt(s) -> ${windows.length} slice window(s): ${windows.map((w) => `${w.startLine}-${w.endLine}`).join(" ")}${skipText}`);
  }
  console.log(`total slice windows: ${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
