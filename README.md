# RAGE — offline mirror

Full mirror of **RAGE** (https://darths-rage.netlify.app/) — "Rage", a
single-file three.js action game: a Netlify deploy with the entire game in one
entry document.

Source: https://darths-rage.netlify.app/

![RAGE](docs/cover.png)

## Stack

- **Single-file three.js game** — the whole game (rendering, physics, AI,
  audio, HUD) is one ~170 KB inline `<script>` plus two inline `<style>`
  blocks inside a 182,970 B `index.html`; the capture is that document plus
  its runtime asset bank (MP3s, WebP textures, glTF model/geometry JSON
  payloads, favicon)
- **three.js r147 from jsdelivr — stays external** — nine CDN `<script src>`
  loads (`three@0.147.0/build/three.min.js` plus `examples/js` shaders,
  postprocessing, loaders and utils: CopyShader, LuminosityHighPassShader,
  EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, GLTFLoader,
  SkeletonUtils) are not captured (socker precedent, PLAN §1: never backfill
  a CDN dependency into the capture). A local serve therefore runs the game
  only with internet access for those nine scripts; without them the page
  shows its own "The 3D engine failed to load" guard
- **Google Fonts — stays external** — the `Big Shoulders Display` /
  `Share Tech Mono` stylesheet and font origins are off-origin references,
  recorded in `_mirror-report.json` (`external`), never captured
- **procedural + glTF-Transform models** — four character/prop families
  (Sevrane, trooper, courier, crate) are served as `*-model.json` +
  `*-geometry.json` glTF-Transform v4.5.1 payloads with WebP textures,
  loaded by hand through `THREE.GLTFLoader.parse()`

## What this is

RAGE (darths-rage.netlify.app) — a single-file browser action game: you play
Sevrane, a courier boarding a ship, igniting a red energy blade, fighting
guards through the corridors, gripping crates and blast doors and carrying a
data card to the escape. The whole game is one entry document: the inline
script builds the scene, the ship, the AI, the blade and the post-processing
with three.js r147 (loaded from jsdelivr), and pulls its asset bank from the
origin root. Captured whole, byte-exact under `.upstream/manifest.json`:
**72 files, 13,069,690 bytes** — the entry document (182,970 B, the
170,041 B inline game script and two inline stylesheets), 40 MP3s (music,
blade hum start/loop, ignition, breathing, spin, stress, blaster, ten
deflection whooshes, twenty-two swing whooshes), 22 WebP textures (logo,
Sevrane/trooper/courier/crate), favicon.ico and eight glTF
model/geometry JSON payloads.

The runtime closure was driven to a fixpoint by `tools/capture.mjs`, then
cross-checked against an opencli browser network log recorded while the game
was played on loopback: 84 requests, **72/72 captured files actually
requested, 0 same-origin requests missing, 0 failures** — the cross-check is
what found the trooper/courier/crate model bank (the static scan saw only the
`prefix+'-model.json'` template), which was fetched from the origin and
added before the capture was frozen.

## Layout

- `index.html` — the capture at the origin root (served paths = on-disk
  paths; inline game script + styles)
- `.upstream/manifest.json` — sha256 + bytes for every captured file (Gen-A)
- `_mirror-report.json` — crawl record: request count, fetched paths,
  recorded 404 gaps, external references
- `readable/` — prettified derived layer (pinned prettier 3.9.6):
  `index-inline-1.pretty.js` (the game, 7,869 lines),
  `index-inline-1.pretty.css` (508 lines), `index-inline-2.pretty.css`
  (7 lines) + `index-inline-map.json` (byte ranges + sha256)
- `src/` + `split-spec.json` — 28 statement-aligned slices with the recorded
  derivation spec (35 sections)
- `docs/cover.png` — gameplay cover; `docs/boot-2026-10-13.png` — boot
  evidence; `docs/boot-network-2026-10-13.json` — the opencli network log
  from the play test
- `tools/capture.mjs` — byte-exact capture + runtime-closure fetch (`--check`
  for a residual closure audit)
- `tools/derive.mjs` — rebuild `readable/` + `src/` + `split-spec.json`
- `tools/verify.mjs` — re-hash the capture against the manifest
- `tools/update.mjs` — read-only drift probe against the live origin
- `tools/audit.js` — integrity gate for the derived layers (`AUDIT PASS`)
- `tools/net-crosscheck.mjs` — compare an opencli network log against the
  manifest (dynamic closure check)

## Assets

- **audio** — 40 file(s), origin root: `music.mp3` (1,127,445 B loop),
  `hum_loop.mp3`, `hum_start.mp3`, `ignition.mp3`, `breathing.mp3`,
  `spin.mp3`, `stress.mp3`, `blaster.mp3`, `deflect0-9.mp3` (10 deflection
  whooshes), `swing0-21.mp3` (22 swing whooshes)
- **images** — 22 WebP + 1 ICO: `logo.webp` (title logo),
  `sevrane-Image_0-2.webp`, `trooper-Image_0-2.webp`, `courier-tex*.webp`
  (7), `crate-tex*.webp` (8) — character/prop textures; `favicon.ico`
- **models** — 4 families as glTF-Transform v4.5.1 JSON payloads:
  `sevrane-`, `trooper-`, `courier-`, `crate-` each with `-model.json`
  (materials/images/skins/animations) and `-geometry.json` (mesh/index/
  vertex buffers as base64), loaded via `THREE.GLTFLoader.parse()`

## Run

Open `index.html` through any static file server (the capture is a static
site served at the origin root; no build step):

```
npx serve .
```

Internet is required for the nine jsdelivr three.js r147 scripts and the
Google Fonts stylesheet (they stay CDN by design). With them reachable the
game boots from the captured files alone: the boot evidence in
`docs/boot-2026-10-13.png` was taken through a local serve on loopback, and
the cover shows actual gameplay (Sevrane in the corridor, blade ignited,
crates and guards in view).

## Verify

```
node tools/verify.mjs     # re-hash the capture against the manifest → 72 files checked, 0 problems
node tools/audit.js       # derived-layer integrity gate → AUDIT PASS
node tools/capture.mjs --check   # residual closure audit → 0 new unresolved
```

## Updating from upstream

```
node tools/update.mjs     # read-only drift probe: what changed upstream
```

The probe never rewrites the capture — a mirror is a point-in-time snapshot.
Only captured (same-origin) files are probed: the manifest is the closure,
and the CDN dependencies (jsdelivr three.js r147, Google Fonts) have no
manifest entries — they are external by design, documented in
`_mirror-report.json` and listed by `tools/capture.mjs --check`, so they are
never probed as if local. Netlify serves the entry at both `/` and
`/index.html`; the probe keeps the root-form fallback. Refreshing means
re-fetching into a clean tree (`node tools/capture.mjs`), re-cutting the
manifest, and re-deriving `readable/` + `src/` from the new entry document
with `node tools/derive.mjs`.

### 2026-10-13 capture + readable/src derivation

- **Capture** (byte-exact, nothing edited): 72 files, 13,069,690 bytes —
  `index.html` (182,970 B) containing the 170,041 B inline game script and
  two inline `<style>` blocks (8,228 B + 63 B), 40 MP3s, 22 WebP textures,
  `favicon.ico` and 8 glTF model/geometry JSON payloads (largest:
  `sevrane-geometry.json`, 3,833,126 B). Closure was driven to a fixpoint by
  `tools/capture.mjs` (74 requests, 3 rounds): entry document → inline script
  refs → the four model families (`sevrane` literal + `trooper`/`courier`/
  `crate` runtime templates, enumerated in the tool's KNOWN list because the
  scanner only sees `prefix+'-model.json'`) → the models' own texture images
  (`trooper-Image_N.webp`, `courier-tex*.webp`, `crate-tex*.webp`, closed
  over from the captured JSON) → `favicon.ico`. The two recorded 404s
  (`-model.json`, `-geometry.json`) are the bare template fragments the
  scanner probes before the prefix bindings are known — they are never
  requested at runtime, and both concrete families resolve to captured
  files; they stay in `_mirror-report.json` as probed-and-recorded gaps so
  `--check` proves 0 *new* unresolved references. External (never captured):
  nine jsdelivr three.js r147 scripts + three Google Fonts origins.
- **Dynamic closure cross-check** — the mirror was served on loopback and
  played through an opencli browser session; the recorded network log
  (`docs/boot-network-2026-10-13.json`, 84 requests) contains **zero
  same-origin requests that are not captured files**, all 72 captured files
  were actually requested by the running game, and there were zero failed
  requests. The only off-origin traffic is the CDN set above (plus one
  embedded `data:` texture).
- **readable/** — pinned prettier 3.9.6 (module API, default options, single
  pass verified idempotent — never the CLI, it respects `.gitignore` and can
  silently echo its input) rendered the inline game script to
  `readable/index-inline-1.pretty.js` (7,869 lines) and the two inline
  `<style>` blocks to `readable/index-inline-1.pretty.css` (508 lines) and
  `readable/index-inline-2.pretty.css` (7 lines). Every pretty is provably
  not a byte copy of its capture block and re-renders byte-exact under the
  pinned version. Block numbering is per tag kind (the fleet convention):
  `index-inline-1.pretty.js` is script block #1, `index-inline-1|2.pretty.css`
  are style blocks #1 and #2.
- **Inline blocks** — all three content blocks get whole-file twins plus
  `readable/index-inline-map.json` recording each block's exact byte range +
  sha256 inside `index.html`. The nine external `<script src>` CDN loads are
  not derived (external by design).
- **src/** — 28 statement-aligned slices (`src/index-inline-1-NN.js`, exact
  2-line provenance header) recorded in `split-spec.json` (35 sections):
  28/28 parse standalone (`node --input-type=module --check -`) and
  round-trip byte-exact to their readable line ranges. The inline script is
  a single top-level IIFE (`(() => { … })();`), so slices are cut at the
  IIFE body's top-level statement boundaries (~250–350 line windows;
  oversized single declarations stay whole; the `"use strict"` directive
  prologue heads the first slice). Non-standalone parts are skipped sections,
  indexed but never sliced (5): the IIFE wrapper head and tail, and the three
  body statements that carry a top-level `return` (the engine guard and two
  other early-exit guards) — a `return` is not valid at module top level, so
  those ranges could never parse standalone.
- **Stylesheet rule** — the two inline `<style>` blocks are wholeFile
  sections, never sliced.
- **notRendered** — 71 hashed payload records in `split-spec.json` (40 audio,
  22 images + favicon, 8 glTF data JSONs; bytes + sha256, no pretty pass).
- **Gates**: `node tools/verify.mjs` → `72 files checked, 0 problems`;
  `node tools/audit.js` → `AUDIT PASS` (28/28 round-trips, 3/3 pretty
  sources tiled, 5/5 skipped sections re-verified textually, 3/3 pretties
  re-render byte-exact, inline-script shape guard held);
  `node tools/capture.mjs --check` → `0 new unresolved`; independent 3-slice
  round-trip check → 3/3 byte-exact + header-exact + parse standalone;
  `node tools/update.mjs` → `up to date: 72 captured files identical
  upstream`. Boot test: mirror served on loopback, opened through opencli —
  title screen rendered (`docs/boot-2026-10-13.png`), a key started the run,
  Space ignited the blade, arrows walked/turned and the blade was swung; the
  cover shows live gameplay (Sevrane in the ship corridor, ignited blade,
  crates, guards ahead). Serve probe: entry + `music.mp3` +
  `sevrane-model.json` + `trooper-Image_1.webp` + `swing21.mp3` over HTTP 200
  at their recorded sizes, listener PID killed, port proven closed
  (`netstat` + connection refused).
- **§0.4 fork-over-mirror checked 2026-10-13**: no public upstream source
  repo exists — the captured content carries no github/gitlab/bitbucket
  reference (the only off-origin URLs in captured text are the nine jsdelivr
  script URLs, the Google Fonts origins and the Netlify hosting-promo comment
  in the entry head), a GitHub search for the project finds only this
  mirror's own repo, and the glTF payloads name only the export tool
  (`glTF-Transform v4.5.1` — a library credit, not an upstream source repo).
  The mirror stands.
- **Open task (PLAN §5)**: identifiers in `src/` are the bundle's own
  minified names; the deep identifier-rename campaign is not yet done.
  Rebuild the derived layers any time with `node tools/derive.mjs`.

## Mirror conventions

- **Capture layer** — the captured files are byte-exact copies of what the
  origin served; nothing in them is edited. `.gitattributes` pins `* -text`
  so git never normalizes EOLs.
- **CDN dependencies stay CDN** — the jsdelivr three.js r147 scripts and the
  Google Fonts stylesheet are recorded as external references and are never
  backfilled into the capture (PLAN §1, socker precedent).
- **Readable layer** — `readable/` is derived (prettified) and never shipped
  to a browser; it exists so the single inline script can actually be read.
- **Provenance** — `.upstream/manifest.json` records sha256 for each captured
  artifact, and `tools/verify.mjs` re-checks it; `_mirror-report.json` is the
  crawl record.
- **Drift** — `tools/update.mjs` is read-only: it reports what changed
  upstream and never rewrites the capture.

## Fleet status

<!-- mirror-status:start — feeds _standard/REPO-INDEX.md. Update ONLY your own mirror's block; never edit the shared index (PLAN §8). Rebuild: node _standard/build-index.mjs -->
<!-- cols: cls=classification · ver=verify 0 problems · upd=drift probe · man=manifest · rdbl=readable re-derived · src=reversed src · boot=boot test · top=offline-mirror topic · tag=backup tag · staged=staged not committed -->
| # | repo | cls | ver | upd | man | rdbl | src | boot | top | tag | staged |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 299 | darths-rage | mirror | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
<!-- mirror-status:end -->
