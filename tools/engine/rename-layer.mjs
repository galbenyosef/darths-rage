// Shared rename-layer logic for the darths-rage offline mirror: tokenize,
// apply, and verify a semantic rename map over the readable layer. (Copied +
// adapted from the madrid-rush / desimayhem / zombie-game-made-by-claude
// fleet precedent tools/engine/rename-layer.mjs.)
//
// Ported from the fleet's rename-campaign engine (templates/rename-campaign/
// engine/rename-layer.mjs): when an index-only skipped tail is rebuilt, the
// chunk's OWN public export name is preserved — a shorthand export
// (`export { i }`) is rewritten as `TARGET as ORIGINAL`, so the binding keeps
// its semantic name and the chunk still exports the name it always exported.
// The alias keyword is found BY POSITION (one identifier is a shorthand, a
// group whose second identifier is the keyword is aliased), never by value.
// A "rename layer" is what turns a prettified chunk range into a readable src/
// slice. The campaign (tools/apply-names.mjs) renames a chunk's chunk-scope
// bindings with a scope-aware token pass, so the relationship between a slice
// and its source range is exact and invertible:
//
//     committed slice body  ==  source range with identifiers substituted
//
// Recovering the map is therefore mechanical: tokenize both sides (comments and
// whitespace dropped, string/template literals atomic) and require the
// *non-identifier* token streams to be identical. Identifiers then pair up
// positionally and every differing pair is a rename.
//
// This is deliberately not a heuristic. If the non-identifier streams disagree,
// the slice is not a rename of its source range and recovery *fails* rather
// than inventing a plausible map — which is the difference between a verified
// readable layer and one that merely looks right.
//
// Layout note (this mirror): everything that is code lives inside the single
// inline <script> of the entry document, so there is one chunk:
// readable/index-inline-1.pretty.js. It is one classic IIFE — the chunk scope
// is the IIFE body's function scope, and slices are section-aligned cuts of
// the body named after the author's section banners (src/level-a.js,
// src/updates-c.js, src/boot.js, …). Sections in split-spec.json carry that
// repo-relative sourceFile plus the section title the slice header repeats.
//
// The tokenizer here is THE tokenizer: tools/derive.mjs (re-cut), tools/audit.js
// (gate), tools/recover-scoped-map.mjs (map recovery) and tools/apply-names.mjs
// (campaign writer) all splice through these spans, so an index recorded by one
// means the same position to the others.
import fs from "fs";
import path from "path";

// ---- scanner ---------------------------------------------------------------
// Tokenize JS, dropping whitespace and comments. A string literal is one token.
// A *template* literal is split, because `${...}` holds real code: literal runs
// are emitted as `lit` and each substitution is tokenized recursively.
const ID_START = /[A-Za-z_$]/;
const ID_PART = /[\w$]/;

/** Tokenize a whole source text. Every token carries its span (`s`..`e`). */
export function tokens(text) {
  const st = { i: 0, text, out: [] };
  scan(st, undefined);
  return st.out;
}

function emit(st, t, v, s, e) {
  st.out.push({ t, v, s, e: e === undefined ? s + v.length : e });
}

function scan(st, stop) {
  const { text } = st;
  const n = text.length;
  // Template-substitution scans (stop === "}") must close on the MATCHING
  // brace: an object literal inside ${…} used to end the substitution early,
  // which pushed the rest of the expression into the outer template's literal
  // run and broke recovery alignment (madrid-rush 2026-10-14:
  // ${de ? q(`exc.goalsDone`, { n: de }) : q(`exc.noGoals`)}).
  let braceDepth = 0;
  while (st.i < n) {
    const c = text[st.i];
    const start = st.i;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      st.i++;
      continue;
    }
    if (c === "/" && text[st.i + 1] === "/") {
      while (st.i < n && text[st.i] !== "\n") st.i++;
      continue;
    }
    if (c === "/" && text[st.i + 1] === "*") {
      st.i += 2;
      while (st.i < n && !(text[st.i] === "*" && text[st.i + 1] === "/")) st.i++;
      st.i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = st.i + 1;
      while (j < n) {
        if (text[j] === "\\") {
          j += 2;
          continue;
        }
        if (text[j] === c) {
          j++;
          break;
        }
        j++;
      }
      emit(st, "lit", text.slice(st.i, j), start);
      st.i = j;
      continue;
    }
    if (c === "`") {
      scanTemplate(st);
      continue;
    }
    // Regex literal: a `/` is a regex start when the previous significant token
    // cannot end an expression — otherwise it is division. Scanning it as one
    // token keeps flag letters (`/gm`) and body text out of the identifier
    // stream, where a map key like `gm` would otherwise rewrite regex flags.
    if (c === "/" && isRegexStart(st)) {
      let j = st.i + 1,
        inClass = !1;
      while (j < n) {
        const d = text[j];
        if (d === "\\") {
          j += 2;
          continue;
        }
        if (d === "[") inClass = !0;
        else if (d === "]") inClass = !1;
        else if (d === "/" && !inClass) break;
        else if (d === "\n") break; // unterminated: not a regex after all
        j++;
      }
      if (j < n && text[j] === "/") {
        j++;
        while (j < n && /[a-z]/.test(text[j])) j++; // flags
        emit(st, "re", text.slice(st.i, j), start);
        st.i = j;
        continue;
      }
    }
    if (stop === "}" && (c === "{" || c === "}")) {
      if (c === "}") {
        if (braceDepth === 0) {
          st.i++;
          return;
        }
        braceDepth--;
      } else braceDepth++;
      // fall through: the brace is a real token of the substitution
    }
    if (ID_START.test(c)) {
      let j = st.i + 1;
      while (j < n && ID_PART.test(text[j])) j++;
      emit(st, "id", text.slice(st.i, j), start);
      st.i = j;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = st.i + 1;
      while (j < n && /[\w.]/.test(text[j])) j++;
      emit(st, "num", text.slice(st.i, j), start);
      st.i = j;
      continue;
    }
    emit(st, "pun", c, start);
    st.i++;
  }
}

function isRegexStart(st) {
  const prev = st.out[st.out.length - 1];
  if (!prev) return !0;
  if (prev.t === "pun") return !(")]}".includes(prev.v) || prev.v === "++" || prev.v === "--");
  if (prev.t === "id")
    return /^(?:return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await|throw)$/.test(prev.v);
  return !1; // after id/num/str/template/regex, `/` is division
}

function scanTemplate(st) {
  const { text } = st;
  const n = text.length;
  emit(st, "pun", "`", st.i);
  st.i++;
  let run = "";
  let runStart = st.i;
  const flush = () => {
    if (run) emit(st, "lit", run, runStart);
    run = "";
  };
  while (st.i < n) {
    const c = text[st.i];
    if (c === "\\") {
      if (!run) runStart = st.i;
      run += text.slice(st.i, st.i + 2);
      st.i += 2;
      continue;
    }
    if (c === "`") {
      flush();
      emit(st, "pun", "`", st.i);
      st.i++;
      return;
    }
    if (c === "$" && text[st.i + 1] === "{") {
      flush();
      emit(st, "pun", "${", st.i);
      st.i += 2;
      scan(st, "}");
      emit(st, "pun", "}", st.i - 1);
      runStart = st.i;
      continue;
    }
    if (!run) runStart = st.i;
    run += c;
    st.i++;
  }
  flush();
}

// ---- slice headers ---------------------------------------------------------
// The derive writer prepends a 2-line provenance header
//   // <slice base> — <section title>
//   // Lines A-B of <sourceFile> (statement-aligned).
// It is not part of the source range, so verification and recovery both strip
// it — EXACTLY those two lines, never a run of leading `//` lines: a slice body
// can itself open with real `//` comments (that is why this is shape-checked
// rather than prefix-based).
export function stripHeader(committed) {
  const nl1 = committed.indexOf("\n");
  const nl2 = nl1 >= 0 ? committed.indexOf("\n", nl1 + 1) : -1;
  if (nl2 >= 0) {
    const l1 = committed.slice(0, nl1);
    const l2 = committed.slice(nl1 + 1, nl2);
    if (l1.startsWith("// ") && /^\/\/ Lines \d+-\d+ of .+ \(statement-aligned\)\.$/.test(l2))
      return committed.slice(nl2 + 1).replace(/[\n\s]+$/, "");
  }
  return committed.replace(/[\n\s]+$/, "");
}

// ---- markers for slice titles (top tokens, lowercase; fleet convention) ----
const STOP = new Set(
  ("function return typeof undefined object string number boolean prototype length value default " +
    "exports import this that with from then else case break continue delete instanceof constructor " +
    "arguments void null true false call apply name type text target window document globalthis self " +
    "require module async await yield static class const let var new for while switch throw try catch " +
    "finally extends super using debugger of in do if has own hasown get set")
    .split(" ")
    .filter(Boolean),
);
export function markerWords(text, n = 2) {
  // URLs/identifiers living inside string literals (import paths, asset names)
  // are not code tokens — strip quoted strings before counting
  const code = text.replace(/`[^`]*`|"[^"\n]*"|'[^'\n]*'/g, " ");
  const counts = new Map();
  for (const m of code.matchAll(/[A-Za-z][A-Za-z0-9_]{2,}/g)) {
    const w = m[0].toLowerCase();
    if (STOP.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}
export const markerText = (ms) => ms.map(([w, c]) => `${w}(${c})`).join(", ");

/** The exact 2-line provenance header the derive writer prepends to a slice. */
export function sliceHeader({ base, title, sourceFile, startLine, endLine }) {
  return `// ${base} — ${title}\n` + `// Lines ${startLine}-${endLine} of ${sourceFile} (statement-aligned).\n`;
}

// ---- source resolution -----------------------------------------------------
/**
 * Locate the prettified source for a spec section. Sections name their own
 * repo-relative `sourceFile` (readable/…); the fallback keeps older records
 * readable. Returns LF-split lines.
 */
export function sourceResolver(dir, spec) {
  const cache = new Map();
  return (section) => {
    const rel = section.sourceFile;
    if (!rel) throw new Error(`no source for ${section.file}: no sourceFile recorded`);
    if (cache.has(rel)) return cache.get(rel);
    const hit = path.join(dir, rel);
    if (!fs.existsSync(hit)) throw new Error(`source not found for ${section.file}: ${rel}`);
    const lines = fs.readFileSync(hit, "utf8").split(/\r?\n/);
    cache.set(rel, lines);
    return lines;
  };
}

/** The raw text of a section's source range (with the trailing newline). */
export function rangeText(prettyFor, section) {
  return prettyFor(section).slice(section.startLine - 1, section.endLine).join("\n") + "\n";
}

// ---- apply -----------------------------------------------------------------
/** Apply a flat map the way a word-boundary pass would: longest key first. */
export function compileMap(map) {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  if (!keys.length) return null;
  return new RegExp(`\\b(${keys.map((k) => k.replace(/\$/g, "\\$")).join("|")})\\b`, "g");
}
export function applyMap(text, map) {
  const re = compileMap(map);
  return re ? text.replace(re, (m) => map[m]) : text;
}

/**
 * Identifier positions inside `import { … }` / `export { … }` that name the
 * *other* module, not a local binding: the imported name in `import { a as e }`
 * has to keep matching the module it comes from, and the alias in
 * `export { H as REFLECT_EXTRA_LAYER }` is the public API.
 */
export function foreignNameIndices(toks) {
  const foreign = new Set();
  for (let i = 0; i < toks.length - 1; i++) {
    const kw = toks[i];
    if (kw.t !== "id" || (kw.v !== "import" && kw.v !== "export")) continue;
    if (toks[i + 1].t !== "pun" || toks[i + 1].v !== "{") continue;
    let end = i + 2;
    while (end < toks.length && !(toks[end].t === "pun" && toks[end].v === "}")) end++;
    let group = [];
    const flush = () => {
      const ids = group.filter((k) => toks[k].t === "id");
      if (kw.v === "import") {
        if (ids.length) foreign.add(ids[0]); // import: first name is foreign, `as` introduces the local one
      } else if (ids.length > 1) {
        foreign.add(ids[ids.length - 1]); // export: local first, alias is the public API
      }
      group = [];
    };
    for (let k = i + 2; k < end; k++) {
      if (toks[k].t === "pun" && toks[k].v === ",") flush();
      else group.push(k);
    }
    flush();
  }
  return foreign;
}

/**
 * Token indices of SHORTHAND export entries — `export { i }`, where the single
 * identifier is BOTH the local binding and the chunk's public export name.
 *
 * A group with more than one identifier has a separate alias side (the last
 * name), which `foreignNameIndices` already protects: the alias IS the public
 * API and the local may be renamed freely. A ONE-identifier group has no alias
 * side, so its identifier is simultaneously the local and the public name —
 * renaming it moves the chunk's public API and every importer of that name
 * stops resolving. lagoon-tree-village proved it: `i` became LAGOON_LOBES and
 * `a f n p t` became angleToDir/polylinePath/RAD_TO_DEG/resampleCatmullRom/
 * DEG_TO_RAD, and twelve chunks importing those names broke.
 */
export function shorthandExportIndices(toks) {
  const out = new Set();
  for (let i = 0; i < toks.length - 1; i++) {
    const kw = toks[i];
    if (kw.t !== "id" || kw.v !== "export") continue;
    if (toks[i + 1].t !== "pun" || toks[i + 1].v !== "{") continue;
    let end = i + 2;
    while (end < toks.length && !(toks[end].t === "pun" && toks[end].v === "}")) end++;
    let group = [];
    const flush = () => {
      // The alias KEYWORD is found BY POSITION, not by value: a chunk can have
      // a local literally named `as`, and then the group is
      // `export { as as o }` — ids = [as, as, o] — where a value-based lookup
      // finds the LOCAL, not the keyword. Worse, a group of ONE id whose
      // value is "as" (`export { as }`) is a SHORTHAND export of a local named
      // `as`, and a value-based "is there an `as` here?" test would wrongly
      // call it an alias and skip it.
      //   one id            -> shorthand: the local IS the public name
      //   ids[1] === "as"   -> aliased: the public name is ids[2]
      const ids = group.filter((k) => toks[k].t === "id");
      if (ids.length === 1) out.add(ids[0]);
      group = [];
    };
    for (let k = i + 2; k < end; k++) {
      if (toks[k].t === "pun" && toks[k].v === ",") flush();
      else group.push(k);
    }
    flush();
  }
  return out;
}

/**
 * The names a source re-exports under their OWN name — the shorthand exports
 * (`export { i }`). These are the chunk's public API names.
 */
export function shorthandExportLocals(text) {
  const toks = tokens(text);
  const out = new Set();
  for (const i of shorthandExportIndices(toks)) out.add(toks[i].v);
  return out;
}

/** Rewrite text by replacing the spans in `reps` (any order). */
export function spliceTokens(text, reps) {
  if (!reps.length) return text;
  const sorted = [...reps].sort((a, b) => a.s - b.s);
  let out = "";
  let last = 0;
  for (const r of sorted) {
    if (r.s < last) throw new Error(`overlapping splice at ${r.s}`);
    out += text.slice(last, r.s) + r.to;
    last = r.e;
  }
  return out + text.slice(last);
}

/**
 * Apply a rename-map record ({ scoped, files }) to a source range: token-index
 * entries take precedence, then flat word-boundary entries for identifier
 * tokens that sit in a *binding* position (property accesses, object keys and
 * labels live in another namespace and stay). This is the exact application
 * tools/verify-rename.mjs and tools/audit.js use; tools/derive.mjs uses it to
 * re-cut slices. Indices are validated against the recorded names, so a drifted
 * readable or a stale map fails loudly instead of silently mis-renaming.
 */
export function applyRecordedMap(text, record) {
  if (!record) return text;
  const scoped = record.scoped || {};
  const flat = record.files || {};
  const ts = tokens(text);
  const foreign = foreignNameIndices(ts);
  const at = new Map();
  for (const [name, hits] of Object.entries(scoped))
    for (const [i, target] of hits) {
      const t = ts[i];
      if (!t || t.t !== "id" || t.v !== name)
        throw new Error(`rename map addresses token ${i} as "${name}" but the range has ${t ? t.t + "(" + JSON.stringify(t.v.slice(0, 30)) + ")" : "no such token"}`);
      at.set(i, { name, target });
    }
  let out = "";
  let last = 0;
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.t === "id") {
      const hit = at.get(i);
      const prev = ts[i - 1];
      const isSpread =
        prev && prev.t === "pun" && prev.v === "." && ts[i - 2] && ts[i - 2].t === "pun" && ts[i - 2].v === ".";
      const isProp = prev && prev.t === "pun" && prev.v !== "?" && (prev.v === "." || prev.v === "?.") && !isSpread;
      const next = ts[i + 1];
      const isKey = next && next.t === "pun" && next.v === ":" && !(prev && prev.t === "pun" && prev.v === "?");
      const target = hit
        ? hit.target
        : !foreign.has(i) && !isProp && !isKey && Object.prototype.hasOwnProperty.call(flat, t.v)
          ? flat[t.v]
          : undefined;
      if (target !== undefined) {
        out += text.slice(last, t.s) + target;
        last = t.e;
        continue;
      }
    }
    out += text.slice(last, t.e);
    last = t.e;
  }
  return out + text.slice(last);
}

/**
 * Apply a chunk-level BINDING map ({ oldTopLevelName: newName }) to a piece of
 * the chunk that is NOT re-cut into src/ — the final `export {…}` table, which
 * split-spec records as an index-only skipped section. Its local-side names are
 * references to the chunk's own top-level bindings, so the campaign renames them
 * too; the public (aliased) side is foreign and stays. The reconstruction gates
 * use this to make the whole chunk parse and resolve again. Property accesses,
 * object keys, labels and foreign positions are left alone, exactly as in
 * applyRecordedMap.
 */
export function applyBindingMap(text, map) {
  if (!map || !Object.keys(map).length) return text;
  const ts = tokens(text);
  const foreign = foreignNameIndices(ts);
  const shorthand = shorthandExportIndices(ts);
  const reps = [];
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.t !== "id") continue;
    if (!Object.prototype.hasOwnProperty.call(map, t.v)) continue;
    if (foreign.has(i)) continue;
    const prev = ts[i - 1];
    const isSpread =
      prev && prev.t === "pun" && prev.v === "." && ts[i - 2] && ts[i - 2].t === "pun" && ts[i - 2].v === ".";
    const isProp = prev && prev.t === "pun" && prev.v !== "?" && (prev.v === "." || prev.v === "?.") && !isSpread;
    const next = ts[i + 1];
    const isKey = next && next.t === "pun" && next.v === ":" && !(prev && prev.t === "pun" && prev.v === "?");
    if (isProp || isKey) continue;
    // A shorthand export names the binding publicly: rename the local but keep
    // the public name — `TARGET as ORIGINAL`. This is safe HERE and only here:
    // this text is an index-only skipped tail, which no gate token-aligns
    // against a pristine range, so the only contracts are that the rebuilt
    // chunk parses and exports the same public names. The same form inside a
    // committed src slice would insert two tokens and break the byte-exact
    // round trip (recoverSlice requires equal token counts), which is why a
    // shorthand export inside a slice is REFUSED rather than rewritten.
    const to = shorthand.has(i) ? `${map[t.v]} as ${t.v}` : map[t.v];
    reps.push({ s: t.s, e: t.e, to });
  }
  return spliceTokens(text, reps);
}

// ---- recovery --------------------------------------------------------------
// Drop whole-line `//` comments -- but only lines where that `//` is real code.
// A slice can carry a GLSL or shader template literal whose lines begin with
// `//`, and those are payload, not commentary.
export function stripCommentLines(lines) {
  const out = [];
  let inBlock = false;
  let inStr = null; // '"', "'" or "`" when a string spans the newline
  for (const line of lines) {
    const trimmed = line.trimStart();
    const outsideCode = !inBlock && !inStr;
    if (outsideCode && trimmed.startsWith("//")) continue;
    out.push(line);
    let i = 0;
    while (i < line.length) {
      const c = line[i];
      if (inBlock) {
        if (c === "*" && line[i + 1] === "/") {
          inBlock = false;
          i += 2;
          continue;
        }
        i++;
        continue;
      }
      if (inStr) {
        if (c === "\\") {
          i += 2;
          continue;
        }
        if (c === inStr) inStr = null;
        i++;
        continue;
      }
      if (c === "/" && line[i + 1] === "*") {
        inBlock = true;
        i += 2;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        inStr = c;
        i++;
        continue;
      }
      i++;
    }
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Recover the rename record for one slice: token-align its source range against
 * the committed body and classify every changed identifier as a word-boundary
 * (`files`) or index-addressed (`scoped`) rename.
 *
 * Returns { ok: true, flat, scoped, tokens, renames } or { ok: false, why }.
 */
export function recoverSlice(range, committedBody) {
  const a = tokens(range.replace(/[\n\s]+$/, ""));
  const b = tokens(committedBody.replace(/[\n\s]+$/, ""));
  if (a.length !== b.length) return { ok: false, why: `token count ${a.length} vs ${b.length}` };
  for (let i = 0; i < a.length; i++) {
    if (a[i].t !== b[i].t) return { ok: false, why: `token ${i} type ${a[i].t}/${b[i].t}` };
    if (a[i].t !== "id" && a[i].v !== b[i].v)
      return { ok: false, why: `non-identifier diff at ${i}: ${JSON.stringify(a[i].v.slice(0, 40))} vs ${JSON.stringify(b[i].v.slice(0, 40))}` };
  }
  const byName = new Map();
  for (let i = 0; i < a.length; i++) {
    if (a[i].t !== "id" || a[i].v === b[i].v) continue;
    if (!byName.has(a[i].v)) byName.set(a[i].v, []);
    byName.get(a[i].v).push([i, b[i].v]);
  }
  // A name goes in the flat map only when it reaches ONE target, covers EVERY
  // occurrence in the range, is never a property or object key, and is not the
  // ambiguous `c ? x : y` middle token.
  const isKey = (name) =>
    new RegExp(`\\.\\s*${escapeRe(name)}\\b`).test(range) || new RegExp(`[{,]\\s*${escapeRe(name)}\\s*:`).test(range);
  const ambiguous = new Set();
  for (let i = 0; i < a.length; i++) {
    if (a[i].t !== "id") continue;
    const prev = a[i - 1],
      next = a[i + 1];
    if (prev && prev.t === "pun" && prev.v === "?" && next && next.t === "pun" && next.v === ":") ambiguous.add(a[i].v);
  }
  const occurrences = new Map();
  for (const t of a) if (t.t === "id") occurrences.set(t.v, (occurrences.get(t.v) || 0) + 1);
  const flat = {},
    scoped = {};
  for (const [name, hits] of byName) {
    const targets = new Set(hits.map(([, t]) => t));
    if (targets.size === 1 && occurrences.get(name) === hits.length && !isKey(name) && !ambiguous.has(name))
      flat[name] = [...targets][0];
    else scoped[name] = hits;
  }
  const renames = [...byName.values()].reduce((n, h) => n + h.length, 0);
  return { ok: true, flat, scoped, tokens: a.length, renames };
}

/** Serialise a recovered map for storage next to the project. */
export function serializeMap({ files, scoped }) {
  return {
    note:
      "Semantic rename map for src/, recovered mechanically by anchor alignment from the " +
      "committed slices (tools/recover-scoped-map.mjs): the token streams of a slice and its " +
      "readable range must be identical in every non-identifier position, so every differing " +
      "identifier pair is a proven rename, not a guess. `files` is a word-boundary map, used " +
      "only where a name means the same thing everywhere in the slice and is never a property " +
      "or object key; `scoped` addresses the rest by exact token index as { name: [[i, target], …] }. " +
      "tools/derive.mjs re-applies this map when it re-cuts src/ (index-validated), " +
      "tools/verify-rename.mjs and tools/audit.js re-prove every slice from it, and " +
      "tools/check-chunk.mjs proves cross-slice references still resolve. Regenerate with " +
      "`node tools/recover-scoped-map.mjs` after any rename batch.",
    files: Object.fromEntries(
      Object.entries(files)
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([f, m]) => [f, Object.fromEntries(Object.entries(m).sort())]),
    ),
    scoped: Object.fromEntries(
      Object.entries(scoped)
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([f, m]) => [f, Object.fromEntries(Object.entries(m).sort())]),
    ),
  };
}
