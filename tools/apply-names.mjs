// apply-names.mjs — apply the hand-authored semantic rename list to the chunk's
// slices, at identifier-token spans (the campaign writer, PLAN §5).
//
//   node tools/apply-names.mjs <capture rel> [names.json]
//   node tools/apply-names.mjs --all [names.json]
//   node tools/apply-names.mjs <capture rel> --dry
//
// The rename LIST is the review; this file is only the writer. It splices
// identifier spans in the prettified chunk, so whitespace, comments and literal
// text cannot move — which is what lets tools/recover-scoped-map.mjs recover the
// exact map and tools/verify-rename.mjs / tools/audit.js re-prove every slice.
//
// Scope is what makes a list of short names safe: in this mirror everything
// lives inside one classic IIFE, so the CHUNK SCOPE is the IIFE body's function
// scope, and every rename fires only on identifiers that resolve, through the
// real scope chain, to a declaration in that scope (the game's own top-level
// bindings). Shadowed locals inside nested functions are untouched — `mk` is a
// top-level mesh-maker AND a local texture-maker inside `sharedTex`, and only
// the top-level one is renamed. Public API positions are never renamed, and a
// binding that appears in such a position is refused entirely:
//
//   · shorthand object-literal / destructuring properties — `{x}` / `const {x} = …`
//     (the key IS the identifier text; splicing would rewrite the key too)
//   · unaliased export specifiers (`export {x}`) — there are none in this
//     classic script, but the refusal is kept for the fleet idiom
//   · shorthand imports (`import {x} from …`) — likewise none here
//
// Collisions are refused too: a target may not be an existing top-level name, a
// free/global name used in the chunk, a reserved word, or another rule's source
// (no chained renames).
//
// After writing, every slice is parse-checked with the exact standalone gate.
// usage: node tools/apply-names.mjs <capture rel>|--all [names.json] [--dry]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getAcorn } from "./lib-acorn.mjs";
import { sliceHeader } from "./engine/rename-layer.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, "..");
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const namesFile = args.find((a) => a.endsWith(".json")) || path.join(here, "names.json");
const target = args.find((a) => !a.endsWith(".json") && a !== "--all" && !a.startsWith("--"));

const acorn = await getAcorn();
const spec = JSON.parse(fs.readFileSync(path.join(proj, "split-spec.json"), "utf8"));
const allNames = JSON.parse(fs.readFileSync(namesFile, "utf8"));

const RESERVED = new Set(
  ("break case catch class const continue debugger default delete do else enum export extends false finally for function if import in " +
    "instanceof new null return super switch this throw true try typeof var void while with yield let static await async of as from get set " +
    "implements interface package private protected public arguments eval undefined NaN Infinity")
    .split(" "),
);

const parses = (text) => {
  const r = spawnSync(process.execPath, ["--input-type=module", "--check", "-"], {
    input: text,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: r.status === 0, why: (r.stderr || "").trim().split("\n").slice(-3).join(" | ") };
};

const SKIP_KEYS = new Set(["type", "start", "end", "loc", "range", "raw", "__scope", "__fns"]);

// ── scope walk (adapted from the sunlandia/games-gamma fleet precedent) ──
function analyze(programText) {
  let ast;
  try {
    ast = acorn.parse(programText, { ecmaVersion: 2023, sourceType: "module" });
  } catch {
    ast = acorn.parse(programText, { ecmaVersion: 2023, sourceType: "script" });
  }
  // The chunk is one classic IIFE (this mirror): the rename scope is the IIFE
  // body's function scope — the game's own top-level bindings live there, not
  // in the (empty) Program scope.
  let iifeArrow = null;
  if (ast.body.length === 1 && ast.body[0].type === "ExpressionStatement") {
    const e = ast.body[0].expression;
    const fn = e.type === "CallExpression" && e.callee ? e.callee : e;
    if ((fn.type === "ArrowFunctionExpression" || fn.type === "FunctionExpression") && fn.body.type === "BlockStatement") iifeArrow = fn;
  }
  let current = { parent: null, fnScope: null, names: new Map(), fnName: null, __fns: [] };
  current.fnScope = current;
  const programScope = current;
  let chunkScope = programScope;
  const blocked = new Map(); // name -> reason
  const free = new Set(); // referenced, resolves to nothing

  const block = (name, reason) => {
    if (name && !blocked.has(name)) blocked.set(name, reason);
  };
  const declare = (name, kind, scope = current, node = null) => {
    if (kind === "var" || kind === "function") scope = scope.fnScope;
    if (!scope.names.has(name)) scope.names.set(name, { kind, decls: [] });
    if (node) scope.names.get(name).decls.push([node.start, node.end]);
    return scope;
  };
  const mark = (node, owner) => {
    node.__scope = owner;
  };
  const pushScope = (isFunction, fnName = null) => {
    const s = { parent: current, fnScope: null, names: new Map(), fnName, __fns: [] };
    s.fnScope = isFunction ? s : current.fnScope;
    current = s;
    return s;
  };
  const popScope = () => {
    const s = current;
    current = s.parent;
    return s;
  };
  const isName = (node, parent) => {
    if (!parent) return false;
    if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) return true;
    if (parent.type === "Property" && parent.key === node) return !parent.computed && !parent.shorthand;
    if (parent.type === "MethodDefinition" && parent.key === node && !parent.computed) return true;
    if (parent.type === "PropertyDefinition" && parent.key === node && !parent.computed) return true;
    if ((parent.type === "LabeledStatement" || parent.type === "BreakStatement" || parent.type === "ContinueStatement") && parent.label === node) return true;
    if (parent.type === "ImportSpecifier" || parent.type === "ImportDefaultSpecifier" || parent.type === "ImportNamespaceSpecifier") return true;
    if (parent.type === "ExportSpecifier") return true;
    return false;
  };
  const collectPatternNames = (p, out) => {
    if (!p) return;
    if (p.type === "Identifier") out.push(p.name);
    else if (p.type === "ObjectPattern") for (const q of p.properties) collectPatternNames(q.type === "RestElement" ? q.argument : q.value, out);
    else if (p.type === "ArrayPattern") for (const el of p.elements) collectPatternNames(el, out);
    else if (p.type === "AssignmentPattern") collectPatternNames(p.left, out);
    else if (p.type === "RestElement") collectPatternNames(p.argument, out);
  };
  const predeclare = (p, kind = "let") => {
    if (!p) return;
    switch (p.type) {
      case "Identifier":
        mark(p, declare(p.name, kind, current, p));
        return;
      case "ObjectPattern":
        for (const prop of p.properties) {
          if (prop.shorthand) block(prop.value.name, `destructuring shorthand {${prop.key.name ?? ""}}`);
          predeclare(prop.type === "RestElement" ? prop.argument : prop.value, kind);
        }
        return;
      case "ArrayPattern":
        for (const el of p.elements) predeclare(el, kind);
        return;
      case "AssignmentPattern":
        predeclare(p.left, kind);
        return;
      case "RestElement":
        predeclare(p.argument, kind);
        return;
    }
  };
  const bindPattern = (p, kind = "let") => {
    if (!p) return;
    switch (p.type) {
      case "Identifier":
        mark(p, declare(p.name, kind, current, p));
        return;
      case "ObjectPattern":
        for (const prop of p.properties) {
          if (prop.type === "RestElement") bindPattern(prop.argument, kind);
          else if (prop.value) {
            if (prop.shorthand) block(prop.value.name, `destructuring shorthand {${prop.key.name ?? ""}}`);
            bindPattern(prop.value, kind);
          }
        }
        return;
      case "ArrayPattern":
        for (const el of p.elements) bindPattern(el, kind);
        return;
      case "AssignmentPattern":
        bindPattern(p.left, kind);
        if (p.right) walk(p.right, p);
        return;
      case "RestElement":
        bindPattern(p.argument, kind);
        return;
    }
  };
  const hoist = (st) => {
    if (!st) return;
    if (st.type === "FunctionDeclaration" && st.id) declare(st.id.name, "function", current, st.id);
    else if (st.type === "ClassDeclaration" && st.id) declare(st.id.name, "class", current, st.id);
    else if (st.type === "VariableDeclaration") for (const d of st.declarations) predeclare(d.id, st.kind);
  };

  function walk(node, parent) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const c of node) walk(c, parent);
      return;
    }
    if (typeof node.type !== "string") {
      for (const k of Object.keys(node)) if (!SKIP_KEYS.has(k)) walk(node[k], node);
      return;
    }
    switch (node.type) {
      case "Program":
        for (const s of node.body) hoist(s);
        for (const s of node.body) walk(s, node);
        return;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression": {
        const isDecl = node.type === "FunctionDeclaration";
        if (isDecl && node.id) mark(node.id, declare(node.id.name, "function", current, node.id));
        const s = pushScope(true, node.id?.name ?? null);
        if (node === iifeArrow) chunkScope = s;
        if (!isDecl && node.id) mark(node.id, declare(node.id.name, "function", s, node.id));
        for (const p of node.params) bindPattern(p);
        if (node.body.type === "BlockStatement") {
          for (const st of node.body.body) hoist(st);
          for (const st of node.body.body) walk(st, node);
        } else walk(node.body, node);
        popScope();
        return;
      }
      case "BlockStatement":
      case "StaticBlock": {
        pushScope(false);
        for (const st of node.body) hoist(st);
        for (const st of node.body) walk(st, node);
        popScope();
        return;
      }
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement": {
        pushScope(false);
        if (node.init && node.init.type !== "VariableDeclaration") walk(node.init, node);
        else if (node.init) {
          for (const d of node.init.declarations) bindPattern(d.id, node.init.kind);
          walk(node.init, node);
        }
        if (node.left && node.left.type !== "VariableDeclaration") bindPattern(node.left, "var");
        else if (node.left) for (const d of node.left.declarations) bindPattern(d.id, node.left.kind);
        walk(node.test, node);
        walk(node.update, node);
        walk(node.right, node);
        walk(node.body, node);
        popScope();
        return;
      }
      case "VariableDeclaration":
        for (const d of node.declarations) {
          bindPattern(d.id, node.kind);
          walk(d.init, node);
        }
        return;
      case "CatchClause": {
        pushScope(false);
        if (node.param) bindPattern(node.param);
        walk(node.body, node);
        popScope();
        return;
      }
      case "ClassDeclaration":
      case "ClassExpression": {
        if (node.id) mark(node.id, declare(node.id.name, "class", current, node.id));
        pushScope(false, node.id?.name ?? null);
        if (node.superClass) walk(node.superClass, node);
        for (const el of node.body.body) walk(el, node);
        popScope();
        return;
      }
      case "Property": {
        // Object-literal / destructuring shorthand: the key and the value share
        // the token text, so a splice would rewrite the key too. But only a
        // shorthand whose VALUE resolves to the chunk scope actually shares a
        // token with a rename target — a nested local `{A}` (its own binding,
        // e.g. a per-soldier sub-object) is a different name and must not
        // block the chunk-scope rename. So: resolve the value first, then
        // block by name only when the owner is the chunk scope.
        if (node.shorthand) {
          walk(node.value, node);
          if (node.value.__scope === chunkScope)
            block(node.value.name, `object-literal shorthand {${node.key.name ?? node.key.value}}`);
          return;
        }
        if (node.computed) walk(node.key, node);
        walk(node.value, node);
        return;
      }
      case "Identifier": {
        if (isName(node, parent)) return;
        let owner = current;
        while (owner && !owner.names.has(node.name)) owner = owner.parent;
        mark(node, owner);
        if (!owner) free.add(node.name);
        return;
      }
      case "LabeledStatement":
      case "BreakStatement":
      case "ContinueStatement":
        return;
      case "ImportDeclaration": {
        for (const s of node.specifiers) {
          const local = s.local;
          if (s.type === "ImportSpecifier" && s.imported.start === s.local.start) {
            // `import {x} from …`: imported public name and local alias are one token
            mark(local, declare(local.name, "import", current, null));
            block(local.name, `shorthand import {${s.imported.name}} from "${node.source.value}"`);
          } else {
            mark(local, declare(local.name, "import", current, local));
          }
        }
        return;
      }
      case "ExportNamedDeclaration": {
        if (node.declaration) {
          const d = node.declaration;
          const names = [];
          if (d.type === "VariableDeclaration") for (const dec of d.declarations) collectPatternNames(dec.id, names);
          else if (d.id) names.push(d.id.name);
          for (const n of names) block(n, "declaration-form export (public name)");
        }
        for (const s of node.specifiers || []) {
          if (s.local && s.exported && s.local.start === s.exported.start)
            block(s.local.name, `unaliased export specifier {${s.local.name}} (public name)`);
        }
        if (node.declaration) walk(node.declaration, node);
        for (const s of node.specifiers || []) if (s.local && s.exported && s.local.start !== s.exported.start) walk(s.local, node);
        return;
      }
      case "ExportAllDeclaration":
        return;
    }
    for (const k of Object.keys(node)) if (!SKIP_KEYS.has(k)) walk(node[k], node);
  }

  walk(ast, null);
  return { ast, programScope: chunkScope, blocked, free };
}

// selected spans for one program-scope binding, in source order
function selectSpans(ast, programScope, oldName, to) {
  const marks = [];
  (function choose(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const c of node) choose(c);
      return;
    }
    if (typeof node.type !== "string") {
      for (const k of Object.keys(node)) if (!SKIP_KEYS.has(k)) choose(node[k]);
      return;
    }
    if (node.type === "Identifier" && node.__scope === programScope && node.name === oldName)
      marks.push({ start: node.start, end: node.end, to });
    for (const k of Object.keys(node)) if (!SKIP_KEYS.has(k)) choose(node[k]);
  })(ast);
  marks.sort((a, b) => a.start - b.start);
  return marks;
}

function splice(text, marks) {
  let out = "";
  let last = 0;
  for (const m of marks) {
    if (m.start < last) throw new Error(`overlapping rename at ${m.start}`);
    out += text.slice(last, m.start) + m.to;
    last = m.end;
  }
  return out + text.slice(last);
}

// ── run ─────────────────────────────────────────────────────────────────
const entries = Object.entries(allNames).filter(([k]) => !k.startsWith("__"));
if (!target && !args.includes("--all")) {
  console.error("usage: node tools/apply-names.mjs <capture rel>|--all [names.json] [--dry]");
  process.exit(2);
}
const todo = entries.filter(([capture]) => args.includes("--all") || capture === target);
if (!todo.length) {
  console.error(`names.json has no entry for ${target}`);
  process.exit(2);
}

let failed = 0;
let grandNames = 0;
let grandOccurrences = 0;
for (const [capture, value] of todo) {
  const renames = value.renames || value;
  const note = value.note;
  const source = spec.sources.find((s) => s.capture === capture && s.slicingMode);
  if (!source) {
    console.error(`${capture}: no slicable split-spec source record`);
    failed++;
    continue;
  }
  const prettyAbs = path.join(proj, source.sourceFile);
  const prettyText = fs.readFileSync(prettyAbs, "utf8").replace(/\n$/, "");
  const { ast, programScope, blocked, free } = analyze(prettyText);

  const topNames = new Set(programScope.names.keys());
  const ruleKeys = new Set(Object.keys(renames));
  const kept = new Set([...topNames].filter((n) => !ruleKeys.has(n)));

  const allMarks = [];
  const skipped = [];
  const counts = new Map();
  for (const [oldName, newName] of Object.entries(renames)) {
    if (oldName === newName) {
      skipped.push([oldName, "maps to itself"]);
      continue;
    }
    if (blocked.has(oldName)) {
      skipped.push([oldName, blocked.get(oldName)]);
      continue;
    }
    if (ruleKeys.has(newName)) {
      skipped.push([oldName, `chained rename (target "${newName}" is itself renamed)`]);
      continue;
    }
    if (!/^[A-Za-z_$][\w$]*$/.test(newName) || RESERVED.has(newName)) {
      skipped.push([oldName, `invalid or reserved target "${newName}"`]);
      continue;
    }
    if (kept.has(newName) || free.has(newName)) {
      skipped.push([
        oldName,
        `target "${newName}" collides with ${kept.has(newName) ? "an existing top-level name" : "a free/global name used in the chunk"}`,
      ]);
      continue;
    }
    const entry = programScope.names.get(oldName);
    if (!entry || !entry.decls.length) {
      skipped.push([oldName, "not a top-level binding declared in this chunk"]);
      continue;
    }
    const marks = selectSpans(ast, programScope, oldName, newName);
    counts.set(oldName, marks.length);
    allMarks.push(...marks);
  }

  let renamedText;
  try {
    renamedText = splice(prettyText, allMarks.sort((a, b) => a.start - b.start));
  } catch (e) {
    console.error(`${capture}: ${e.message}`);
    failed++;
    continue;
  }
  const renamedLines = renamedText.split("\n");
  if (renamedLines.length !== prettyText.split("\n").length) {
    console.error(`${capture}: rename changed the line count — refusing`);
    failed++;
    continue;
  }

  const names = [...counts.values()].filter((n) => n > 0).length;
  const occurrences = [...counts.values()].reduce((n, v) => n + v, 0);
  grandNames += names;
  grandOccurrences += occurrences;
  console.log(`${capture}${note ? ` — ${note}` : ""}`);
  for (const [k, n] of [...counts].sort()) console.log(`  ${k} -> ${renames[k]}: ${n} identifier(s)`);
  for (const [k, why] of skipped) console.log(`  SKIP ${k}: ${why}`);

  if (dry) {
    console.log(`  --dry: ${names} name(s), ${occurrences} identifier(s), nothing written`);
    continue;
  }

  const chunkSections = spec.sections
    .filter((s) => s.sourceFile === source.sourceFile && !s.wholeFile && !s.skipped && typeof s.startLine === "number")
    .sort((a, b) => a.startLine - b.startLine);
  if (!chunkSections.length) {
    console.error(`${capture}: split-spec has no ranged slices for ${source.sourceFile}`);
    failed++;
    continue;
  }
  let written = 0;
  for (const sec of chunkSections) {
    const body = renamedLines.slice(sec.startLine - 1, sec.endLine).join("\n") + "\n";
    const base = sec.file.replace(/\.js$/, "");
    const text = sliceHeader({ base, title: sec.title, sourceFile: source.sourceFile, startLine: sec.startLine, endLine: sec.endLine }) + body;
    const chk = parses(text);
    if (!chk.ok) {
      console.error(`  FAIL src/${sec.file} does not parse standalone: ${chk.why}`);
      failed++;
      continue;
    }
    fs.mkdirSync(path.dirname(path.join(proj, "src", sec.file)), { recursive: true });
    fs.writeFileSync(path.join(proj, "src", sec.file), text);
    written++;
  }
  console.log(`  wrote ${written}/${chunkSections.length} slice(s) for ${source.sourceFile}`);
}
console.log(`apply-names: ${grandNames} name(s), ${grandOccurrences} identifier(s) across ${todo.length} chunk(s)${dry ? " (dry run)" : ""}`);
process.exit(failed ? 1 : 0);
