// index-inline-1 08 — three
// Lines 1525-1767 of readable/index-inline-1.pretty.js (statement-aligned).
  for (let z = -7; z > CEND + 3; z -= rnd(7, 11)) {
    if (DOORS.some((d) => Math.abs(d.z - z) < 2)) continue;
    const ceil = Math.random() < 0.45,
      side = Math.random() < 0.5 ? -1 : 1;
    const pos = ceil
      ? V3(rnd(-1.6, 1.6), CH - 0.12, z)
      : V3(side * (CW / 2 - 0.08), rnd(2.0, 2.85), z);
    const n = ceil ? V3(0, -1, 0) : V3(-side, 0, 0);
    const e = { pos, n, t: rnd(0.5, 3), fizz: 0, cable: null };
    if (ceil) {
      const g = new THREE.Group();
      g.position.set(pos.x, CH, pos.z);
      const len = rnd(0.4, 0.9);
      const c = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, len, 5),
        M.dark,
      );
      c.position.y = -len / 2;
      g.add(c);
      scene.add(g);
      e.cable = g;
      e.len = len;
      pos.y = CH - len;
    }
    SPK.push(e);
  }
  const sparkLight = new THREE.PointLight(0xffd59a, 0, 7, 2);
  scene.add(sparkLight);
  let sparkLightT = 0;
  const cut = { next: rnd(5, 9), seq: [], t: 0, v: 0 };
  function powerCut(strength) {
    // queue 1-4 black flickers, each a fraction of a second
    if (cut.seq.length) return;
    let t = 0;
    const n = 1 + ((Math.random() * 3.2) | 0);
    for (let i = 0; i < n; i++) {
      const off = rnd(0.04, i === n - 1 ? 0.22 : 0.12);
      cut.seq.push([t, t + off]);
      t += off + rnd(0.04, 0.14);
    }
    cut.t = 0;
    cut.strength = strength;
    sfx.zap(0, true);
  }
  function updatePowerCut(dt) {
    const live = mode === "play" && player.stepped;
    if (live) {
      cut.next -= dt;
      if (cut.next <= 0) {
        powerCut(1);
        cut.next = rnd(7, 16);
      }
    }
    let v = 0;
    if (cut.seq.length) {
      cut.t += dt;
      for (const [a, b] of cut.seq) if (cut.t >= a && cut.t < b) v = 1;
      if (cut.t > cut.seq[cut.seq.length - 1][1]) {
        cut.seq = [];
      }
    }
    cut.v = v * (cut.strength || 1) * (reduce ? 0.6 : 1);
  }
  const STRIPZ = window.__STRIPZ || [];
  delete window.__STRIPZ;
  const redLights = [0, 1].map(() => {
    const l = new THREE.PointLight(0xff2a14, 0, 8, 2);
    scene.add(l);
    return l;
  });
  const corridorEnv = (() => {
    const es = new THREE.Scene();
    es.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(10, 6, 10),
        new THREE.MeshBasicMaterial({ color: 0x040202, side: THREE.BackSide }),
      ),
    );
    for (const [c, x, y, z, ry] of [
      [new THREE.Color(1.6, 0.1, 0.05), -3, 2, 0, Math.PI / 2],
      [new THREE.Color(1.6, 0.1, 0.05), 3, 2, 0, -Math.PI / 2],
      [new THREE.Color(0.5, 0.55, 0.7), 0, 2.9, -4, 0],
    ]) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 4),
        new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }),
      );
      m.position.set(x, y, z);
      m.rotation.y = ry;
      es.add(m);
    }
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(es, 0.04).texture;
    pm.dispose();
    return t;
  })();
  const ENVMATS = [
    M.wall,
    M.floor,
    M.grate,
    M.frame,
    M.canister,
    M.pipe,
    M.rib,
  ];
  for (const m of ENVMATS) {
    m.envMap = corridorEnv;
    m.envMapIntensity = 0;
    m.needsUpdate = true;
  }
  const fogRed = new THREE.Color(0x140303),
    fogBlack = new THREE.Color(0x000000);
  function updateElectrics(dt) {
    const p = player,
      live = p.ignite >= 1 && mode !== "title";
    const pw =
      (mode === "title" ? 0.3 : p.ignite) *
      (1 - (typeof cut !== "undefined" ? cut.v : 0));
    const fl = 0.9 + 0.1 * Math.sin(T * 31) * Math.sin(T * 7.7);
    M.strip.color.setRGB(3.2 * pw * fl, 0.18 * pw * fl, 0.08 * pw * fl);
    for (const m of ENVMATS) m.envMapIntensity = 0.55 * pw;
    scene.fog.color.copy(fogBlack).lerp(fogRed, pw);
    const near = STRIPZ.filter((z) => z < p.pos.z + 2).sort(
      (a, b) => Math.abs(a - p.pos.z) - Math.abs(b - p.pos.z),
    );
    redLights.forEach((l, i) => {
      const z = near[i];
      if (z === undefined || pw <= 0) {
        l.intensity = 0;
        return;
      }
      l.position.set(i % 2 ? 1.6 : -1.6, 3.4, z);
      l.intensity = 1.6 * pw * fl;
    });
    // ceiling fixtures stutter on and off; the three nearest lit ones cast real light
    const col = new THREE.Color();
    FIX.forEach((f, i) => {
      let v = 0;
      if (live && f.kind !== "dead") {
        f.t -= dt;
        if (f.kind === "steady") v = 0.35 + 0.05 * Math.sin(T * 50 + i);
        else {
          if (f.t <= 0) {
            f.on = !f.on && Math.random() < 0.7;
            f.t = f.on ? rnd(0.03, 0.35) : rnd(0.08, 1.8);
            f.lvl = rnd(0.5, 1);
          }
          v = f.on ? f.lvl * (Math.random() < 0.15 ? 0.4 : 1) : 0;
        }
      }
      f.v = v;
      col.setRGB(2.2 * v, 2.4 * v, 2.8 * v);
      fixPanel.setColorAt(i, col);
    });
    fixPanel.instanceColor.needsUpdate = true;
    const lit = FIX.filter(
      (f) => f.v > 0.05 && Math.abs(f.z - p.pos.z) < 20,
    ).sort((a, b) => Math.abs(a.z - p.pos.z) - Math.abs(b.z - p.pos.z));
    fixLights.forEach((l, i) => {
      const f = lit[i];
      if (!f) {
        l.intensity = 0;
        return;
      }
      l.position.set(0, CH - 0.4, f.z);
      l.intensity = 1.6 * f.v;
    });
    // exposed cables spit sparks
    if (live)
      for (const e of SPK) {
        const d = Math.abs(e.pos.z - p.pos.z);
        if (d > 26) continue;
        if (e.cable) {
          e.cable.rotation.z = Math.sin(T * 1.3 + e.pos.z) * 0.12;
          e.cable.rotation.x = Math.cos(T * 1.1 + e.pos.z) * 0.1;
        }
        e.t -= dt;
        if (e.fizz > 0) {
          e.fizz -= dt;
          if (Math.random() < dt * 25) burst(e.pos, 3, "y", e.n, 2.5);
        }
        if (e.t <= 0) {
          e.t = rnd(0.8, 4);
          const big = Math.random() < 0.45;
          burst(e.pos, big ? rnd(30, 50) : rnd(10, 18), "y", e.n, big ? 6 : 4);
          if (big) {
            smoke(e.pos, 2, 0.4);
            e.fizz = rnd(0.2, 0.7);
          }
          if (d < 18) {
            sparkLight.position.copy(e.pos).addScaledVector(e.n, 0.3);
            sparkLightT = big ? 0.09 : 0.05;
            sfx.zap(panOf(e.pos), big);
          }
          if (
            big &&
            d < 7 &&
            mode === "play" &&
            player.stepped &&
            Math.random() < 0.45
          ) {
            powerCut(1);
            cut.next = Math.max(cut.next, rnd(5, 9));
          }
        }
      }
    sparkLightT -= dt;
    sparkLight.intensity = sparkLightT > 0 ? 3 + Math.random() * 3 : 0;
  }
  const flashes = [0, 1].map(() => {
    const l = new THREE.PointLight(0x6dff7a, 0, 10, 2);
    scene.add(l);
    return { l, t: 0 };
  });
  const doorLight = new THREE.PointLight(0xff6a20, 0, 7, 2);
  scene.add(doorLight);
  const bayLight = new THREE.PointLight(0x9fb8ff, 0, 26, 1.6);
  bayLight.position.set(0, 4, BZ1 + 3);
  scene.add(bayLight);
  const engineLight = new THREE.PointLight(0xff9040, 0, 40, 1.5);
  scene.add(engineLight);
  const shipLight = new THREE.PointLight(0xbfd0ff, 0, 30, 1.2);
  scene.add(shipLight);

  /* ================= Sevrane ================= */
  const seamMeshes = [];
  function seam(geo, x, y, z, parent, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, M.seam);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    seamMeshes.push(m);
    return m;
  }
  function mk(geo, mat, x, y, z, parent, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const P = {};
