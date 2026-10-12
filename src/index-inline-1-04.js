// index-inline-1 04 — three
// Lines 388-590 of readable/index-inline-1.pretty.js (statement-aligned).
  const M = {
    wall: new THREE.MeshStandardMaterial({
      map: wallTex,
      bumpMap: wallBump,
      bumpScale: 0.05,
      roughnessMap: wallBump,
      roughness: 1,
      metalness: 0.7,
    }),
    floor: new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.55,
      metalness: 0.75,
    }),
    grate: new THREE.MeshStandardMaterial({
      map: grateT.map,
      bumpMap: grateT.bump,
      bumpScale: 0.06,
      roughness: 0.32,
      metalness: 0.85,
    }),
    rib: new THREE.MeshStandardMaterial({
      color: 0x2a2b30,
      roughness: 0.42,
      metalness: 0.8,
    }),
    frame: new THREE.MeshStandardMaterial({
      map: wallTex,
      bumpMap: wallBump,
      bumpScale: 0.03,
      color: 0x9a9ca4,
      roughness: 0.5,
      metalness: 0.8,
    }),
    strip: new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }),
    canister: new THREE.MeshStandardMaterial({
      color: 0x6a6c72,
      roughness: 0.28,
      metalness: 0.92,
    }),
    pipe: new THREE.MeshStandardMaterial({
      color: 0x55575d,
      roughness: 0.3,
      metalness: 0.9,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: 0x202227,
      roughness: 0.6,
      metalness: 0.4,
    }),
    armor: new THREE.MeshPhysicalMaterial({
      color: 0x0b0b0e,
      metalness: 0.55,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    }),
    suit: new THREE.MeshStandardMaterial({
      color: 0x0e0e11,
      roughness: 0.62,
      metalness: 0.2,
    }),
    capeOut: new THREE.MeshStandardMaterial({
      color: 0x0c0c0e,
      roughness: 0.78,
      metalness: 0.05,
      side: THREE.FrontSide,
    }),
    capeIn: new THREE.MeshStandardMaterial({
      color: 0x3a0709,
      roughness: 0.7,
      metalness: 0.05,
      side: THREE.BackSide,
    }),
    strap: new THREE.MeshStandardMaterial({
      color: 0x1d1a18,
      roughness: 0.55,
      metalness: 0.3,
    }),
    seam: new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }),
    hilt: new THREE.MeshStandardMaterial({
      color: 0x8a8d94,
      roughness: 0.3,
      metalness: 0.9,
    }),
    bladeCore: new THREE.MeshBasicMaterial({
      color: new THREE.Color(4, 2.6, 2.4),
      toneMapped: false,
    }),
    bladeGlow: new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.6, 0.08, 0.04),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    bladeHalo: new THREE.MeshBasicMaterial({
      color: new THREE.Color(1, 0.05, 0.02),
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    jacket: new THREE.MeshStandardMaterial({
      color: 0x9a968a,
      roughness: 0.85,
    }),
    vest: new THREE.MeshStandardMaterial({ color: 0x50574a, roughness: 0.8 }),
    pants: new THREE.MeshStandardMaterial({ color: 0x6b6a62, roughness: 0.85 }),
    helmetS: new THREE.MeshStandardMaterial({
      color: 0xc4c0b2,
      roughness: 0.5,
      metalness: 0.2,
    }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc29a7e, roughness: 0.75 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.7 }),
    gun: new THREE.MeshStandardMaterial({
      color: 0x26282c,
      roughness: 0.45,
      metalness: 0.6,
    }),
    lens: new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }),
    outline: new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.2, 0.08, 0.05),
      side: THREE.BackSide,
      toneMapped: false,
    }),
    card: new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }),
    bolt: new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.3, 5.0, 1.1),
      toneMapped: false,
    }),
    boltR: new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.2, 5.0, 1.4),
      toneMapped: false,
    }),
    boltGlow: new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.25, 1.5, 0.2),
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    ember: new THREE.MeshBasicMaterial({
      color: new THREE.Color(4, 1.2, 0.25),
      toneMapped: false,
    }),
    ship: new THREE.MeshStandardMaterial({
      color: 0xb7b0a2,
      roughness: 0.65,
      metalness: 0.35,
      fog: false,
    }),
    shipDark: new THREE.MeshStandardMaterial({
      color: 0x3d3f44,
      roughness: 0.6,
      metalness: 0.5,
      fog: false,
    }),
    engine: new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.5, 0.25, 0.08),
      toneMapped: false,
      fog: false,
    }),
  };

  /* ================= level ================= */
  const CW = 5.6,
    CH = 4.2,
    ZSTART = 5.5,
    CEND = -127,
    BZ1 = -143,
    BW = 14,
    BH = 8;
  const DOORS = [
    { z: -40, hp: 5 },
    { z: -82, hp: 7 },
    { z: -124, hp: 9 },
  ];
  const AIRLOCK = V3(6.3, 0, -134);
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
