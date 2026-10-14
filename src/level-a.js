// level-a — level (part 1 of 3)
// Lines 557-590 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= level ================= */
  const CORRIDOR_W = 5.6,
    CORRIDOR_H = 4.2,
    ZSTART = 5.5,
    CEND = -127,
    BZ1 = -143,
    BAY_W = 14,
    BAY_H = 8;
  const DOORS = [
    { z: -40, hp: 5 },
    { z: -82, hp: 7 },
    { z: -124, hp: 9 },
  ];
  const AIRLOCK = vec3(6.3, 0, -134);
  function box(w, h, d, mat, x, y, z, parent, shadow) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    if (shadow) m.castShadow = true;
    (parent || scene).add(m);
    return m;
  }
  function texBox(w, h, d, mat, rx, ry) {
    const m = mat.clone();
    m.map = mat.map.clone();
    m.map.needsUpdate = true;
    m.map.repeat.set(rx, ry);
    if (mat.bumpMap) {
      m.bumpMap = mat.bumpMap.clone();
      m.bumpMap.needsUpdate = true;
      m.bumpMap.repeat.set(rx, ry);
    }
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  }
