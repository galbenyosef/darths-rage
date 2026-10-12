// net-crosscheck.mjs — dynamic closure cross-check for RAGE.
//
// The static closure (tools/capture.mjs --check) proves the captured text files
// reference nothing un-captured. This tool adds the dynamic half: it compares an
// opencli browser network log, recorded while the mirror was actually played on
// loopback, against .upstream/manifest.json:
//   - every same-origin request must be a captured file (a MISSING line is a
//     closure gap the static scan did not see — this is exactly how the
//     trooper/courier/crate model bank was found on 2026-10-13);
//   - captured files that were never requested are listed (informational:
//     audio banks the session did not reach);
//   - off-origin requests are summarised (the jsdelivr three.js r147 scripts
//     and Google Fonts stay external by design);
//   - failed requests (status >= 400) are listed.
//
// usage: opencli browser <session> network --all --since 15m > docs/boot-network-<date>.json
//        node tools/net-crosscheck.mjs docs/boot-network-<date>.json
import fs from "node:fs";

const log = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const manifest = JSON.parse(
  fs.readFileSync(new URL("../.upstream/manifest.json", import.meta.url), "utf8"),
);
const have = new Set(Object.keys(manifest.files));

const sameOrigin = new Map(); // path -> statuses
const offOrigin = new Map();
for (const e of log.entries) {
  let u;
  try {
    u = new URL(e.url);
  } catch {
    continue;
  }
  if (u.hostname === "127.0.0.1" || u.hostname === "localhost") {
    const p = u.pathname.replace(/^\//, "") || "index.html";
    if (!sameOrigin.has(p)) sameOrigin.set(p, []);
    sameOrigin.get(p).push(e.status);
  } else {
    if (!offOrigin.has(u.origin)) offOrigin.set(u.origin, 0);
    offOrigin.set(u.origin, offOrigin.get(u.origin) + 1);
  }
}
console.log(`entries: ${log.entries.length} (off-origin: ${[...offOrigin.entries()].map(([o, n]) => `${o} x${n}`).join(", ")})`);
console.log("--- same-origin requests not in manifest (excluding favicon/probes):");
let miss = 0;
for (const [p, st] of [...sameOrigin.entries()].sort()) {
  const ok = have.has(p);
  if (!ok) {
    miss++;
    console.log(`  MISSING ${p} statuses=${[...new Set(st)].join(",")}`);
  }
}
console.log(miss ? `${miss} missing` : "0 missing — every same-origin request is captured");
console.log("--- captured-but-never-requested (expected: audio banks not yet played):");
const req = new Set(sameOrigin.keys());
for (const rel of [...have].sort()) if (!req.has(rel)) console.log(`  ${rel}`);
console.log(`--- same-origin request count: ${sameOrigin.size}; failed (>=400 or 0):`);
for (const [p, st] of [...sameOrigin.entries()].sort()) if (st.some((s) => s >= 400 || s === 0)) console.log(`  ${p} statuses=${[...new Set(st)].join(",")}`);
