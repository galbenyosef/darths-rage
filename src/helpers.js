// helpers — helpers
// Lines 11-26 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= helpers ================= */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const ease = (t) => t * t * (3 - 2 * t);
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const angWrap = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };
  const vec3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touchUI = matchMedia("(hover:none) and (pointer:coarse)").matches;

