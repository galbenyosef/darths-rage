// index-inline-1 13 — three
// Lines 3018-3263 of readable/index-inline-1.pretty.js (statement-aligned).
  (async () => {
    try {
      if (!THREE.GLTFLoader) return;
      const g = await fetchModel("courier");
      const outer = new THREE.Group(),
        inner = g.scene;
      inner.rotation.x = -Math.PI / 2;
      outer.rotation.y = -Math.PI / 2;
      outer.add(inner);
      outer.scale.setScalar(0.75);
      outer.position.set(0, 0.9, -5.15);
      inner.traverse((o) => {
        if (!o.isMesh) return;
        o.material.fog = false;
        o.frustumCulled = false;
        if (/cyan|core|blue/.test(o.material.name || "")) {
          o.material.emissiveIntensity = 0.6;
          shipGlowMats.push(o.material);
        }
      });
      for (const c of [...ship.children]) ship.remove(c);
      engines.length = 0;
      ship.add(outer);
      const noz = [
        [-1.8, -1.15, 1],
        [0, -1.15, 1],
        [1.8, -1.15, 1],
        [-1.75, 0.6, 1],
        [0, 0.6, 1],
        [1.75, 0.6, 1],
        [-1.9, -0.6, 0.8],
        [-0.65, -0.6, 0.8],
        [0.65, -0.6, 0.8],
        [1.9, -0.6, 0.8],
      ];
      noz.forEach(([y, z, k], i) => {
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTex,
            color: new THREE.Color(0.35, 0.85, 1),
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            fog: false,
            toneMapped: false,
          }),
        );
        sp.position.set(9.7, y, z);
        sp.userData.k = i;
        sp.userData.size = k;
        inner.add(sp);
        engines.push(sp);
      });
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: new THREE.Color(0.2, 0.6, 1),
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          fog: false,
          toneMapped: false,
          opacity: 0,
        }),
      );
      halo.position.set(10.5, 0, -0.25);
      halo.userData.k = 99;
      halo.userData.halo = true;
      inner.add(halo);
      engines.push(halo);
      engineLight.color.setRGB(0.4, 0.8, 1);
    } catch (e) {
      console.warn(
        "Courier model failed to load; keeping the stand-in ship",
        e,
      );
    }
  })();

  /* ---- cargo crates: scattered along the walls, can be lifted with F and hurled ---- */
  const CR = { hx: 0.5, hy: 0.43, hz: 0.42 };
  const crates = [];
  let crateCand = null;
  function makeCrate(x, y, z, yaw) {
    const c = {
      home: { x, y, z, yaw },
      pos: V3(x, y, z),
      q: new THREE.Quaternion().setFromAxisAngle(UP, yaw),
      v: V3(),
      av: V3(),
      state: "rest",
      hits: 0,
      idx: crates.length,
      lost: false,
    };
    crates.push(c);
    return c;
  }
  (function placeCrates() {
    const secs = [
      [ZSTART - 4.5, DOORS[0].z + 11],
      [DOORS[0].z - 3.5, DOORS[1].z + 11],
      [DOORS[1].z - 3.5, DOORS[2].z + 11],
    ];
    for (const [z0, z1] of secs) {
      const used = { "-1": [], 1: [] };
      let n = 0;
      for (let t = 0; t < 80 && n < 3; t++) {
        const side = Math.random() < 0.5 ? -1 : 1,
          z = rnd(z1, z0);
        if (used[side].some((u) => Math.abs(u - z) < 1.7)) continue;
        used[side].push(z);
        n++;
        const x = side * rnd(1.8, 1.86);
        makeCrate(x, CR.hy, z, rnd(-0.22, 0.22));
        if (Math.random() < 0.25)
          makeCrate(
            x + rnd(-0.05, 0.05),
            3 * CR.hy + 0.005,
            z + rnd(-0.06, 0.06),
            rnd(-0.45, 0.45),
          );
      }
    }
    for (const [x, z, st] of [
      [-(BW / 2 - 1.1), CEND - 3.0, 1],
      [BW / 2 - 1.1, CEND - 4.6, 0],
      [BW / 2 - 2.3, BZ1 + 4.2, 0],
    ]) {
      makeCrate(x, CR.hy, z, rnd(-0.3, 0.3));
      if (st)
        makeCrate(x + rnd(-0.06, 0.06), 3 * CR.hy + 0.005, z, rnd(-0.5, 0.5));
    }
  })();
  let crateParts = [];
  function buildCrateParts(list) {
    for (const p of crateParts) scene.remove(p.mesh);
    crateParts = list.map(({ geo, mat, base }) => {
      const m = new THREE.InstancedMesh(geo, mat, crates.length);
      m.castShadow = !touchUI;
      m.receiveShadow = true;
      m.frustumCulled = false;
      scene.add(m);
      return { mesh: m, base };
    });
    syncCrates();
  }
  const _cm = new THREE.Matrix4(),
    _cm2 = new THREE.Matrix4(),
    _one = V3(1, 1, 1);
  function syncCrates() {
    for (const c of crates) {
      _cm.compose(c.pos, c.q, c.lost ? V3(0.0001, 0.0001, 0.0001) : _one);
      for (const p of crateParts) {
        _cm2.multiplyMatrices(_cm, p.base);
        p.mesh.setMatrixAt(c.idx, _cm2);
      }
    }
    for (const p of crateParts) p.mesh.instanceMatrix.needsUpdate = true;
  }
  buildCrateParts([
    {
      geo: new THREE.BoxGeometry(CR.hx * 2, CR.hy * 2, CR.hz * 2),
      mat: new THREE.MeshStandardMaterial({
        color: 0x2a2d33,
        roughness: 0.6,
        metalness: 0.6,
      }),
      base: new THREE.Matrix4(),
    },
  ]);
  (async () => {
    try {
      if (!THREE.GLTFLoader) return;
      const g = await fetchModel("crate");
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene),
        sz = box.getSize(V3()),
        ctr = box.getCenter(V3());
      const norm = new THREE.Matrix4()
        .makeScale((2 * CR.hx) / sz.x, (2 * CR.hy) / sz.y, (2 * CR.hz) / sz.z)
        .multiply(new THREE.Matrix4().makeTranslation(-ctr.x, -ctr.y, -ctr.z));
      const list = [];
      g.scene.traverse((o) => {
        if (o.isMesh)
          list.push({
            geo: o.geometry,
            mat: o.material,
            base: new THREE.Matrix4().multiplyMatrices(norm, o.matrixWorld),
          });
      });
      if (list.length) buildCrateParts(list);
    } catch (e) {
      console.warn("Crate model failed to load; using plain boxes", e);
    }
  })();
  const crateHL = new THREE.Mesh(
    new THREE.BoxGeometry(CR.hx * 2 + 0.14, CR.hy * 2 + 0.14, CR.hz * 2 + 0.14),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.6, 0.08, 0.04),
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  crateHL.visible = false;
  scene.add(crateHL);
  function resetCrates() {
    for (const c of crates) {
      c.pos.set(c.home.x, c.home.y, c.home.z);
      c.q.setFromAxisAngle(UP, c.home.yaw);
      c.v.set(0, 0, 0);
      c.av.set(0, 0, 0);
      c.state = "rest";
      c.lost = false;
      c.hits = 0;
    }
    syncCrates();
  }
  function crateImpact(p, k) {
    burst(p, Math.round(10 + 24 * k), "y", null, 3 + 4 * k);
    smoke(p, Math.round(1 + 3 * k), 0.5 + 0.6 * k);
    if (k > 0.25) {
      sfx.crunch();
    } else sfx.clank();
    if (p.distanceTo(player.pos) < 14) {
      shake = Math.max(shake, 0.15 + 0.5 * k);
      hitKick = Math.max(hitKick, 0.3 + 0.5 * k);
    }
  }
  function crateSupported(c) {
    if (c.pos.y <= CR.hy + 0.02) return true;
    for (const o of crates) {
      if (o === c || o.state !== "rest" || o.lost) continue;
      if (
        Math.abs(o.pos.x - c.pos.x) < CR.hx * 1.4 &&
        Math.abs(o.pos.z - c.pos.z) < CR.hz * 1.4 &&
        o.pos.y < c.pos.y - CR.hy
      )
        return true;
    }
    return false;
  }
