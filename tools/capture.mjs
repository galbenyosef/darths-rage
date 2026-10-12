// capture.mjs — byte-exact capture + runtime-closure fetch for darths-rage.
//
// RAGE (https://darths-rage.netlify.app/) is a single-file three.js action
// game ("Rage") served by Netlify at the origin root: one 182,970 B entry
// document carrying a ~170 KB inline <script> (the whole game) and two inline
// <style> blocks, plus nine jsdelivr <script src> CDN loads (three.js r147
// build + examples/js shaders/postprocessing/loaders/utils) and a Google
// Fonts stylesheet. The CDN/font loads stay CDN — never captured (socker
// precedent, PLAN §1: do not backfill a CDN dependency into the capture).
//
// This tool fetches the entry document, then iterates the runtime closure to
// a fixpoint over every captured text file:
//
//   - HTML: src/href/poster/srcset attributes, inline <script>/<style> bodies
//     (the game's own code lives there), comments
//   - JS:   dynamic import("…"), bare import "…", static from "…",
//           new URL("…", import.meta.url) and asset-path string literals
//   - CSS:  url(…) and @import "…"
//   - JSON: asset-path string literals (scene/model JSON payloads)
//
// The game's asset references are relative document-root paths: fetch()/
// decodeAudioData loaders call fetch('music.mp3'), load('sevrane-model.json')
// etc. Two runtime-instantiated template families are enumerated explicitly
// (KNOWN below) because the static scanner cannot see the loop index:
//   - deflection whooshes: `load('deflect'+i+'.mp3')` for i in 0..9
//   - swing whooshes:      `load('swing'+i+'.mp3')`   for i in 0..21
//   - character/prop models: a generic loader builds `<prefix>-model.json` /
//     `<prefix>-geometry.json` — the literal login is `prefix+'-geometry.json'`
//     (its bare fragment is what the scanner would wrongly probe as
//     "-geometry.json"), and the concrete prefixes are the four families the
//     game instantiates: sevrane (a direct literal in loadSevrane), trooper,
//     courier and crate. The model JSONs then list their own texture images
//     (trooper-Image_N.webp, courier-tex*.webp, crate-tex*.webp), which the
//     JSON scan closes over. This model bank was found by the opencli browser
//     network-log cross-check during the boot test (the local serve log showed
//     /trooper-model.json, /courier-*.json and /crate-*.json 404ing while the
//     game ran) — exactly the closure gap a literal scan alone misses.
//   - favicon.ico: browser-implicit root request; upstream serves a real one.
//
// Every referenced-but-missing same-origin file is fetched until a scan round
// finds none; 404s are recorded as unresolved gaps in _mirror-report.json (and
// the README) — never fabricated. External (off-origin) references are
// recorded as `external` and left on the CDN: the jsdelivr three.js r147
// scripts and the Google Fonts stylesheet/font origins.
//
// Output (all byte-exact, nothing edited):
//   <mirror root>/…            captured files as served (entry index.html at root)
//   _mirror-report.json        crawl record (dead-world shape)
//   .upstream/manifest.json    Gen-A { generated, origin, files: { rel: {bytes, sha256} } }
//
// usage: node tools/capture.mjs [--check] [--report-only]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, "..");
const ORIGIN = "https://darths-rage.netlify.app";
const ENTRY = "index.html"; // served at the origin root; capture at repo root (DISK_PREFIX = "")
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0" };

// runtime-instantiated template targets (see header) — the loop indices and
// loader prefixes the literal scanner cannot resolve; every concrete value is
// enumerated.
const KNOWN = [
  ...Array.from({ length: 10 }, (_, i) => `deflect${i}.mp3`),
  ...Array.from({ length: 22 }, (_, i) => `swing${i}.mp3`),
  // the four model families the generic loader instantiates
  ...["sevrane", "trooper", "courier", "crate"].flatMap((p) => [`${p}-model.json`, `${p}-geometry.json`]),
  "favicon.ico",
];

// strings that look like asset paths but are not fetched refs
const EXCLUDE = new Set();

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const EXT =
  "js|mjs|css|png|jpe?g|webp|gif|svg|avif|ico|ktx2|basis|mp3|ogg|wav|m4a|mp4|webm|json|wasm|data|bin|glb|gltf|woff2?|ttf|otf|hdr|exr|txt|csv|glsl|vert|frag|map|xml";
const RE_EXT_END = new RegExp(`\\.(?:${EXT})$`, "i");

// quoted-string scanner used for both HTML attributes/URLs and JS literals
const RE_QUOTED = new RegExp(`["'\`]([^"'\`\\n\\r]{1,300}?\\.(?:${EXT}))(?:\\?[^"'\`\\n\\r]*)?["'\`]`, "gi");
const RE_SPECIFIER = /\b(?:import|from)\s*\(?\s*["'`]([^"'`\n\r]+)["'`]/g;
const RE_NEW_URL = /\bnew\s+URL\s*\(\s*["'`]([^"'`\n\r]+)["'`]/g;
const RE_CSS_URL = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
const RE_CSS_IMPORT = /@import\s+(?:url\(\s*)?["']([^"']+)["']/g;
const RE_SRC_HREF = /\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi;
const RE_SRCSET = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
// a captured URL must look like a sane relative path: no spaces, quotes,
// interpolation, operators or query syntax (kills minifier-expression artifacts)
const SANE = (s) => s.length > 0 && s.length <= 250 && !/[\s"'`&?!=<>|;(){}$,:\\]/.test(s);

const normalize = (p) => {
  const out = [];
  for (const part of p.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
};

function classifyUrl(raw, baseDir, extHint) {
  let s = raw.trim();
  if (!s || s.includes("${")) return null;
  if (/^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(s)) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) {
    if (s.startsWith(ORIGIN + "/")) s = s.slice(ORIGIN.length);
    else if (s === ORIGIN) return null;
    else return { external: s };
  }
  if (s.startsWith("//")) return { external: s };
  if (!SANE(s)) return null;
  if (s.startsWith("/")) return { path: normalize(s.replace(/^\//, "")) };
  // relative: try module-dir base first, then the origin root (document base)
  const mod = baseDir && baseDir !== "." ? normalize(path.posix.join(baseDir, s)) : normalize(s);
  const root = normalize(s);
  const paths = [...new Set([mod, root])];
  return { paths };
}

// extract candidate references from a captured text file; each entry is a
// candidate-base GROUP for one reference (probe() closes it if any base works)
function refsOf(relPath, text, external) {
  const groups = [];
  const add = (r) => {
    if (!r) return;
    if (r.external) {
      external.add(r.external);
      return;
    }
    const paths = (r.paths ?? [r.path]).filter((p) => p && !EXCLUDE.has(p));
    if (paths.length) groups.push(paths);
  };
  const addMany = (results) => {
    const paths = [];
    for (const r of results) {
      if (!r) continue;
      if (r.external) {
        external.add(r.external);
        continue;
      }
      for (const p of r.paths ?? [r.path]) if (p && !EXCLUDE.has(p) && !paths.includes(p)) paths.push(p);
    }
    if (paths.length) groups.push(paths);
  };
  const baseDir = path.posix.dirname(relPath);
  const isHtml = /\.html?$/i.test(relPath);
  const isCss = /\.css$/i.test(relPath);
  const isJs = /\.(js|mjs)$/i.test(relPath);
  const isJson = /\.json$/i.test(relPath);

  if (isHtml) {
    for (const m of text.matchAll(RE_SRC_HREF)) add(classifyUrl(m[1], "", ""));
    for (const m of text.matchAll(RE_SRCSET))
      for (const part of m[1].split(",")) add(classifyUrl(part.trim().split(/\s+/)[0], "", ""));
    for (const m of text.matchAll(RE_QUOTED)) {
      const v = m[1];
      if (RE_EXT_END.test(v) && !v.includes("://")) add(classifyUrl(v, "", ""));
    }
    // HTML comments can carry loader hints
    for (const m of text.matchAll(/<!--([\s\S]*?)-->/g))
      for (const t of m[1].matchAll(new RegExp(`([A-Za-z0-9_./-]{1,200}\\.(?:${EXT}))`, "gi")))
        add(classifyUrl(t[1], "", ""));
  }
  if (isJson) {
    for (const m of text.matchAll(RE_QUOTED)) add(classifyUrl(m[1], baseDir, ""));
  }
  if (isCss) {
    for (const m of text.matchAll(RE_CSS_URL)) add(classifyUrl(m[1], baseDir, ""));
    for (const m of text.matchAll(RE_CSS_IMPORT)) add(classifyUrl(m[1], baseDir, ""));
  }
  if (isJs) {
    for (const m of text.matchAll(RE_QUOTED)) add(classifyUrl(m[1], baseDir, ""));
    for (const m of text.matchAll(RE_SPECIFIER)) {
      const v = m[1];
      if (/^(\.{0,2}\/)/.test(v) || /\.(js|mjs|css|json|wasm)(\?|$)/i.test(v)) add(classifyUrl(v, baseDir, ""));
    }
    for (const m of text.matchAll(RE_NEW_URL)) {
      const v = m[1];
      if (!v.includes("${")) add(classifyUrl(v, baseDir, ""));
    }
  }
  const seen = new Set();
  return groups.filter((g) => {
    const k = g.join("|");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const external = new Set();
const state = {
  start: ORIGIN + "/",
  origin: ORIGIN,
  gated: false,
  sessionRenewal: "none",
  requests: 0,
  fetched: new Map(), // rel -> { bytes, sha256, buf }
  unresolved: [],
  unreachable: [],
};

const unresolvedSeen = new Set();
const unreachableSeen = new Set();
const probedFailed = new Map(); // candidate rel -> last non-200 status this run
const badStatus = (status, rel) => {
  if (status === 404 && !unresolvedSeen.has(rel)) {
    unresolvedSeen.add(rel);
    state.unresolved.push({ status, path: rel, probes: 1 });
  } else if (status !== 404 && !unreachableSeen.has(rel)) {
    unreachableSeen.add(rel);
    state.unreachable.push({ status, path: rel, probes: 1 });
  }
};

// one raw fetch; never records — probe() decides what a failure means.
// The root-hosted entry document is served at both "/" and "/index.html"
// (Netlify serves pretty URLs), so index.html maps to the origin root.
async function tryFetch(rel) {
  const url =
    rel === "index.html"
      ? ORIGIN + "/"
      : ORIGIN + "/" + rel.split("/").map(encodeURIComponent).join("/");
  state.requests++;
  let r;
  try {
    r = await fetch(url, { headers: UA });
  } catch (e) {
    return { status: `net:${e.message}`, buf: null };
  }
  if (r.status !== 200) return { status: r.status, buf: null };
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: 200, buf };
}

// probe one reference: try every candidate base path; a reference is a gap only
// when EVERY base 404s (then each probed form is recorded, dead-world style);
// once any base is captured the reference is closed
async function probe(paths) {
  if (paths.some((p) => state.fetched.has(p))) return true;
  const fresh = paths.filter((p) => !probedFailed.has(p));
  if (!fresh.length) return false;
  const failed = [];
  for (const rel of fresh) {
    const res = await tryFetch(rel);
    if (res.buf) {
      state.fetched.set(rel, { bytes: res.buf.length, sha256: sha256(res.buf), buf: res.buf });
      return true;
    }
    probedFailed.set(rel, res.status);
    failed.push({ status: res.status, rel });
  }
  for (const f of failed) badStatus(f.status, f.rel);
  return false;
}

async function fetchEntry(rel) {
  const res = await tryFetch(rel);
  if (!res.buf) throw new Error(`entry ${rel} not fetchable (HTTP ${res.status})`);
  state.fetched.set(rel, { bytes: res.buf.length, sha256: sha256(res.buf), buf: res.buf });
  return res.buf;
}

// --check: residual closure audit. Every reference scanned out of the captured
// text files must resolve to a captured file (any candidate base) or be a gap
// already recorded in _mirror-report.json — run after a capture to prove the
// runtime graph is closed.
function checkClosure() {
  const manifestPath = path.join(proj, ".upstream", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const have = new Set(Object.keys(manifest.files));
  const recorded = new Set();
  try {
    const rep = JSON.parse(fs.readFileSync(path.join(proj, "_mirror-report.json"), "utf8"));
    for (const u of rep.unresolved ?? []) recorded.add(u.path);
  } catch {
    /* no report yet: every unresolved reference counts as new */
  }
  const ext = new Set();
  let groups = 0;
  const missing = [];
  const scanExternal = new Set();
  for (const rel of Object.keys(manifest.files).filter((r) => /\.(html?|js|mjs|css|json)$/i.test(r))) {
    const text = fs.readFileSync(path.join(proj, rel), "utf8");
    for (const g of refsOf(rel, text, scanExternal)) {
      groups++;
      const k = g.join("|");
      if (ext.has(k)) continue;
      ext.add(k);
      if (!g.some((p) => have.has(p))) missing.push({ from: rel, candidates: g });
    }
  }
  const novel = missing.filter((m) => !m.candidates.some((c) => recorded.has(c)));
  for (const m of missing)
    console.log(
      `UNRESOLVED ${m.from} -> ${m.candidates.join(" | ")}` +
        (m.candidates.some((c) => recorded.has(c)) ? "  (recorded gap)" : "  (NEW)"),
    );
  console.log(
    `closure check: ${groups} reference group(s), ${missing.length} unresolved (${novel.length} new vs _mirror-report.json), ` +
      `${scanExternal.size} external off-origin reference(s) (left on CDN)`,
  );
  for (const e of [...scanExternal].sort()) console.log(`  external: ${e}`);
  process.exit(novel.length ? 1 : 0);
}

async function main() {
  if (process.argv.includes("--check")) return checkClosure();
  if (process.argv.includes("--report-only")) {
    console.log("report-only: no fetch performed");
    return;
  }

  // round 0: entry + runtime-instantiated template targets
  if (!state.fetched.has(ENTRY)) await fetchEntry(ENTRY);
  for (const rel of KNOWN) if (!state.fetched.has(rel)) await probe([rel]);

  // iterate closure to fixpoint
  let round = 0;
  let newRefs = 0;
  do {
    newRefs = 0;
    round++;
    for (const [rel, rec] of [...state.fetched.entries()].sort()) {
      if (!/\.(html?|js|mjs|css|json)$/i.test(rel)) continue;
      const text = rec.buf.toString("utf8");
      if (!Buffer.from(text, "utf8").equals(rec.buf)) continue; // non-utf8, not scannable
      for (const group of refsOf(rel, text, external)) {
        if (group.some((p) => state.fetched.has(p))) continue;
        if (group.every((p) => probedFailed.has(p))) continue;
        newRefs++;
        await probe(group);
      }
    }
    console.log(`round ${round}: ${newRefs} new reference(s) probed, ${state.fetched.size} file(s) in closure`);
  } while (newRefs > 0);

  // write every captured file byte-exact at the capture root
  let bytes = 0;
  for (const [rel, rec] of [...state.fetched.entries()].sort()) {
    const abs = path.join(proj, rel);
    if (!path.resolve(abs).startsWith(path.resolve(proj) + path.sep) && path.resolve(abs) !== path.resolve(proj))
      throw new Error(`path escapes capture root: ${rel}`);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, rec.buf);
    bytes += rec.bytes;
  }
  state.bytes = bytes;

  // crawl record
  const report = {
    start: state.start,
    origin: state.origin,
    gated: state.gated,
    sessionRenewal: state.sessionRenewal,
    requests: state.requests,
    fetched: state.fetched.size,
    bytes: state.bytes,
    paths: [...state.fetched.keys()].sort(),
    unresolved: state.unresolved.sort((a, b) => a.path.localeCompare(b.path)),
    unreachable: state.unreachable.sort((a, b) => a.path.localeCompare(b.path)),
    external: [...external].sort(),
  };
  fs.writeFileSync(path.join(proj, "_mirror-report.json"), JSON.stringify(report, null, 2) + "\n");

  // Gen-A manifest over EVERY captured file
  const files = {};
  for (const [rel, rec] of [...state.fetched.entries()].sort()) files[rel] = { bytes: rec.bytes, sha256: rec.sha256 };
  fs.mkdirSync(path.join(proj, ".upstream"), { recursive: true });
  fs.writeFileSync(
    path.join(proj, ".upstream", "manifest.json"),
    JSON.stringify({ generated: new Date().toISOString(), origin: ORIGIN, files }, null, 2) + "\n",
  );

  console.log(
    `capture: ${state.fetched.size} file(s), ${bytes} bytes, ${state.requests} request(s), ` +
      `${state.unresolved.length} unresolved 404, ${state.unreachable.length} unreachable, ${external.size} external`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
