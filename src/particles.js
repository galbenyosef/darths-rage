// particles — particles
// Lines 3758-3910 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= particles ================= */
  const SPN = 700;
  const spGeo = new THREE.BufferGeometry(),
    spPos = new Float32Array(SPN * 3),
    spCol = new Float32Array(SPN * 3);
  spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
  spGeo.setAttribute("color", new THREE.BufferAttribute(spCol, 3));
  const sparkPts = new THREE.Points(
    spGeo,
    new THREE.PointsMaterial({
      size: 0.045,
      map: glowTex,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sparkPts.frustumCulled = false;
  scene.add(sparkPts);
  // each spark also draws a thin glowing streak behind it, like a hot fleck moving fast
  const stGeo = new THREE.BufferGeometry(),
    stPos = new Float32Array(SPN * 6),
    stCol = new Float32Array(SPN * 6);
  stGeo.setAttribute("position", new THREE.BufferAttribute(stPos, 3));
  stGeo.setAttribute("color", new THREE.BufferAttribute(stCol, 3));
  const sparkStreaks = new THREE.LineSegments(
    stGeo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sparkStreaks.frustumCulled = false;
  scene.add(sparkStreaks);
  // short bright flashes where bolts strike
  const flashes2 = [];
  for (let i = 0; i < 16; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    sp.visible = false;
    scene.add(sp);
    flashes2.push({ sp, t: 0, max: 0.1, s: 0.5 });
  }
  let fl2I = 0;
  function impactFlash(p, col, size = 0.6, life = 0.12) {
    const f = flashes2[fl2I];
    fl2I = (fl2I + 1) % flashes2.length;
    f.sp.position.copy(p);
    f.sp.material.color.setRGB(col[0], col[1], col[2]);
    f.t = f.max = life;
    f.s = size;
    f.sp.visible = true;
  }
  const sparks = [];
  for (let i = 0; i < SPN; i++) {
    sparks.push({ p: vec3(0, -99, 0), v: vec3(), life: 0, max: 1, c: [1, 1, 1] });
  }
  let spI = 0;
  function burst(p, n, kind, dir, spd = 6) {
    const c =
      kind === "b"
        ? [0.7, 2.8, 0.6]
        : kind === "w"
          ? [1.6, 1.6, 1.8]
          : kind === "y"
            ? [3.2, 2.4, 1.1]
            : [3, 1.3, 0.35];
    for (let i = 0; i < n; i++) {
      const s = sparks[spI];
      spI = (spI + 1) % SPN;
      s.p.copy(p);
      s.v
        .set(rnd(-1, 1), rnd(-0.3, 1.2), rnd(-1, 1))
        .normalize()
        .multiplyScalar(rnd(0.45, 1.15) * spd);
      if (dir) s.v.addScaledVector(dir, spd * 0.6);
      s.life = s.max = rnd(0.25, 0.7);
      s.c = c;
    }
  }
  const smokes = [];
  for (let i = 0; i < 36; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: smokeTex,
        color: 0x2a1c1c,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    sp.visible = false;
    scene.add(sp);
    smokes.push({ sp, v: vec3(), life: 0, max: 1, s: 0.5 });
  }
  let smI = 0;
  function smoke(p, n, scale = 0.6) {
    for (let i = 0; i < n; i++) {
      const s = smokes[smI];
      smI = (smI + 1) % smokes.length;
      s.sp.position
        .copy(p)
        .add(vec3(rnd(-0.15, 0.15), rnd(-0.1, 0.2), rnd(-0.15, 0.15)));
      s.v.set(rnd(-0.2, 0.2), rnd(0.25, 0.6), rnd(-0.2, 0.2));
      s.life = s.max = rnd(1.4, 2.6);
      s.s = scale * rnd(0.7, 1.3);
      s.sp.visible = true;
    }
  }
  const debris = [];
  function addDebris(group, vel, ember) {
    scene.add(group);
    debris.push({
      g: group,
      v: vel,
      av: vec3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)),
      rest: false,
      ember,
      t: 0,
    });
    if (debris.length > 40) {
      const d = debris.shift();
      scene.remove(d.g);
    }
  }

  /* ---- bolts ---- */
  const bolts = [];
  const boltGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6),
    boltGlowGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.65, 8);
  for (let i = 0; i < 72; i++) {
    const g = new THREE.Group();
    const c = new THREE.Mesh(boltGeo, materials.bolt);
    const gl = new THREE.Mesh(boltGlowGeo, materials.boltGlow);
    g.add(c, gl);
    g.visible = false;
    scene.add(g);
    bolts.push({ g, c, v: vec3(), alive: false, own: "e", src: null, life: 0 });
  }

