// level-b — level (part 2 of 3)
// Lines 591-955 of readable/index-inline-1.pretty.js (statement-aligned).
  (function buildLevel() {
    const L = ZSTART - CEND,
      zc = (ZSTART + CEND) / 2;
    // cross-section (x,y) for one side; mirrored for the other
    const SEC = {
      lowA: [2.35, 0],
      lowB: [2.8, 0.75],
      wallTop: [2.8, 3.0],
      ceil: [1.85, CORRIDOR_H],
    };
    const fl = texBox(CORRIDOR_W, 0.2, L, materials.floor, 1.4, L / 4);
    fl.position.set(0, -0.1, zc);
    fl.receiveShadow = true;
    scene.add(fl);
    const gr = texBox(2.7, 0.02, L, materials.grate, 2.2, L / 1.3);
    gr.position.set(0, 0.012, zc);
    gr.receiveShadow = true;
    scene.add(gr);
    for (const sx of [-1, 1]) {
      const ln = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.02, L),
        new THREE.MeshStandardMaterial({
          color: 0x6d6f75,
          roughness: 0.4,
          metalness: 0.6,
        }),
      );
      ln.position.set(sx * 1.38, 0.016, zc);
      scene.add(ln);
    }
    const ce = texBox(3.8, 0.2, L, materials.wall, 1.2, L / 3);
    ce.position.set(0, CORRIDOR_H + 0.1, zc);
    ce.receiveShadow = true;
    scene.add(ce);
    const slab = (a, b, th, mat, s, rx, ry) => {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        len = Math.hypot(dx, dy);
      const m = texBox(len, th, L, mat, rx || len / 2, ry || L / 4);
      // inward normal on the +x side is (-dy,dx)/len; push the slab outward so its inner face sits on the section line
      const nx = -dy / len,
        ny = dx / len;
      m.position.set(
        s * ((a[0] + b[0]) / 2 - (nx * th) / 2),
        (a[1] + b[1]) / 2 - (ny * th) / 2,
        zc,
      );
      m.rotation.z = s * Math.atan2(dy, dx);
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    for (const sx of [-1, 1]) {
      slab(SEC.lowA, SEC.lowB, 0.12, materials.wall, sx, 0.6, L / 4);
      const w = texBox(
        0.12,
        SEC.wallTop[1] - SEC.lowB[1],
        L,
        materials.wall,
        L / 4.2,
        1,
      );
      w.position.set(
        sx * (SEC.wallTop[0] + 0.06),
        (SEC.wallTop[1] + SEC.lowB[1]) / 2,
        zc,
      );
      w.receiveShadow = true;
      scene.add(w);
      slab(SEC.wallTop, SEC.ceil, 0.12, materials.wall, sx, 0.8, L / 4);
      // pipe bundle along the upper chamfer
      const ux = SEC.ceil[0] - SEC.wallTop[0],
        uy = SEC.ceil[1] - SEC.wallTop[1],
        ul = Math.hypot(ux, uy),
        inx = -uy / ul,
        iny = ux / ul; // inward normal (for the +x side)
      [
        [0.2, 0.13],
        [0.45, 0.09],
        [0.66, 0.11],
        [0.84, 0.06],
      ].forEach(([t, r]) => {
        const px = SEC.wallTop[0] + ux * t + inx * (r + 0.04),
          py = SEC.wallTop[1] + uy * t + iny * (r + 0.04);
        const pp = new THREE.Mesh(
          new THREE.CylinderGeometry(r, r, L, 12),
          materials.pipe,
        );
        pp.rotation.x = Math.PI / 2;
        pp.position.set(sx * px, py, zc);
        pp.castShadow = false;
        pp.receiveShadow = true;
        scene.add(pp);
      });
      // conduit along the lower wall
      const cd = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, L, 8),
        materials.pipe,
      );
      cd.rotation.x = Math.PI / 2;
      cd.position.set(sx * 2.66, 0.95, zc);
      scene.add(cd);
    }
    box(CORRIDOR_W, CORRIDOR_H, 0.3, materials.wall, 0, CORRIDOR_H / 2, ZSTART + 0.15);
    // structural frames every 4 m, skipping the door frames
    const frZ = [];
    for (let z = 3; z > CEND + 1.5; z -= 4) {
      if (DOORS.some((d) => Math.abs(d.z - z) < 2.2)) continue;
      frZ.push(z);
    }
    const segs = [];
    for (const sx of [-1, 1]) {
      segs.push(
        [SEC.lowA, SEC.lowB, sx],
        [SEC.lowB, SEC.wallTop, sx],
        [SEC.wallTop, SEC.ceil, sx],
      );
    }
    segs.push([[-SEC.ceil[0], CORRIDOR_H], [SEC.ceil[0], CORRIDOR_H], 1]);
    const mtx = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      pos = vec3(),
      scl = vec3(1, 1, 1);
    const stripIdx = [];
    segs.forEach(([a, b, sx], si) => {
      const ax = sx * a[0],
        ay = a[1],
        bx = sx * b[0],
        by = b[1],
        dx = bx - ax,
        dy = by - ay,
        len = Math.hypot(dx, dy);
      // inset the beam toward the corridor centre
      let nx = -dy / len,
        ny = dx / len;
      if ((nx * (ax + bx)) / 2 + ny * ((ay + by) / 2 - CORRIDOR_H / 2) > 0) {
        nx = -nx;
        ny = -ny;
      }
      const th = 0.3,
        dep = 0.5;
      const geo = new THREE.BoxGeometry(len + 0.12, th, dep);
      const im = new THREE.InstancedMesh(geo, materials.frame, frZ.length);
      im.receiveShadow = true;
      frZ.forEach((z, i) => {
        pos.set(
          (ax + bx) / 2 + (nx * th) / 2,
          (ay + by) / 2 + (ny * th) / 2,
          z,
        );
        q.setFromAxisAngle(vec3(0, 0, 1), Math.atan2(dy, dx));
        mtx.compose(pos, q, scl);
        im.setMatrixAt(i, mtx);
      });
      scene.add(im);
      if (si === 2 || si === 5) stripIdx.push({ ax, ay, bx, by, nx, ny, len });
    });
    // red strip lights on the upper corners of each frame, red tell-tales on the walls
    const strip = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.06, 0.1),
      materials.strip,
      frZ.length * 2 + frZ.length,
    );
    let k = 0;
    frZ.forEach((z, i) => {
      for (const st of stripIdx) {
        pos.set(
          (st.ax + st.bx) / 2 + st.nx * 0.33,
          (st.ay + st.by) / 2 + st.ny * 0.33,
          z + 0.05,
        );
        q.setFromAxisAngle(
          vec3(0, 0, 1),
          Math.atan2(st.by - st.ay, st.bx - st.ax),
        );
        scl.set(st.len * 0.7, 1, 1);
        mtx.compose(pos, q, scl);
        strip.setMatrixAt(k++, mtx);
      }
      const sx = i % 2 ? 1 : -1;
      pos.set(sx * 2.72, 2.05, z - 1.4);
      q.identity();
      scl.set(0.13, 3.2, 0.6);
      mtx.compose(pos, q, scl);
      strip.setMatrixAt(k++, mtx);
      scl.set(1, 1, 1);
    });
    strip.count = k;
    scene.add(strip);
    window.__STRIPZ = frZ.slice();
    // canisters stacked along the lower chamfers between frames, and machinery units
    const can = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.2, 0.2, 1.3, 16),
      materials.canister,
      frZ.length * 4,
    );
    let c = 0;
    const capG = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.08, 16),
      materials.rib,
      frZ.length * 8,
    );
    let cc = 0;
    frZ.forEach((z) => {
      for (const sx of [-1, 1]) {
        if (Math.random() < 0.25) continue;
        for (const [x, y] of [
          [2.42, 0.32],
          [2.62, 0.68],
        ]) {
          pos.set(sx * x, y, z - 2);
          q.setFromAxisAngle(vec3(1, 0, 0), Math.PI / 2);
          scl.set(1, 1, 1);
          mtx.compose(pos, q, scl);
          can.setMatrixAt(c++, mtx);
          for (const e of [-0.62, 0.62]) {
            pos.set(sx * x, y, z - 2 + e);
            mtx.compose(pos, q, scl);
            capG.setMatrixAt(cc++, mtx);
          }
        }
      }
    });
    can.count = c;
    capG.count = cc;
    can.receiveShadow = true;
    scene.add(can, capG);
    const unit = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.45, 1.3, 1.5),
      materials.wall,
      60,
    );
    let u = 0;
    for (let z = -6; z > CEND + 3; z -= seededRange(9, 15)) {
      if (DOORS.some((d) => Math.abs(d.z - z) < 2.5)) continue;
      const sx = seededRandom() < 0.5 ? -1 : 1;
      pos.set(sx * 2.55, 1.55, z);
      q.identity();
      mtx.compose(pos, q, scl);
      unit.setMatrixAt(u++, mtx);
    }
    unit.count = u;
    unit.receiveShadow = true;
    scene.add(unit);
    // fixtures between frames (the flickering ceiling lights)
    const ribZ = frZ.filter((_, i) => i % 2 === 0);
    const fix = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.4, 0.08, 0.4),
      materials.dark,
      ribZ.length,
    );
    ribZ.forEach((z, i) => {
      mtx.makeTranslation(0, CORRIDOR_H - 0.04, z - 2);
      fix.setMatrixAt(i, mtx);
    });
    scene.add(fix);
    window.__FIXZ = ribZ.map((z) => z - 2);
    // bay
    const bz = (CEND + BZ1) / 2,
      bl = CEND - BZ1;
    const bf = texBox(BAY_W, 0.2, bl, materials.floor, 4, bl / 4);
    bf.position.set(0, -0.1, bz);
    bf.receiveShadow = true;
    scene.add(bf);
    const bc = texBox(BAY_W, 0.2, bl, materials.wall, 3, bl / 4);
    bc.position.set(0, BAY_H + 0.1, bz);
    scene.add(bc);
    for (const s of [-1, 1]) {
      const w = texBox(0.3, BAY_H, bl, materials.wall, bl / 4.6, 2);
      w.position.set(s * (BAY_W / 2 + 0.15), BAY_H / 2, bz);
      w.receiveShadow = true;
      scene.add(w);
      const ew = texBox((BAY_W - CORRIDOR_W) / 2, BAY_H, 0.3, materials.wall, 1.5, 2);
      ew.position.set(s * (CORRIDOR_W / 2 + (BAY_W - CORRIDOR_W) / 4), BAY_H / 2, CEND);
      scene.add(ew);
    }
    box(CORRIDOR_W, BAY_H - CORRIDOR_H, 0.3, materials.wall, 0, CORRIDOR_H + (BAY_H - CORRIDOR_H) / 2, CEND);
    // open dock mouth: the bay ends in a full-width opening onto space, held by a faint containment field
    const hdr = 0.9,
      fr = 0.4;
    box(BAY_W, hdr, 0.7, materials.dark, 0, BAY_H - hdr / 2, BZ1);
    box(BAY_W, 0.28, 0.8, materials.rib, 0, BAY_H - hdr - 0.14, BZ1);
    for (const s of [-1, 1]) {
      box(fr, BAY_H, 0.8, materials.rib, s * (BAY_W / 2 - fr / 2), BAY_H / 2, BZ1);
      box(
        0.12,
        BAY_H - hdr - 0.3,
        0.12,
        materials.dark,
        s * (BAY_W / 2 - fr - 0.08),
        (BAY_H - hdr - 0.3) / 2,
        BZ1 + 0.3,
      );
    }
    const lip = texBox(BAY_W, 0.22, 1.6, materials.floor, 3, 0.5);
    lip.position.set(0, -0.11, BZ1 - 0.8);
    lip.receiveShadow = true;
    scene.add(lip);
    box(BAY_W, 0.5, 0.3, materials.dark, 0, -0.36, BZ1 - 1.6);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.35, 1.3, 1.7),
      toneMapped: false,
    });
    for (const z of [BZ1 - 1.55, BZ1 + 0.05]) {
      const e = new THREE.Mesh(
        new THREE.BoxGeometry(BAY_W - 0.9, 0.03, 0.06),
        edgeMat,
      );
      e.position.set(0, 0.015, z);
      scene.add(e);
    }
    for (let i = 0; i < 9; i++) {
      const e = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.06, 0.05),
        edgeMat,
      );
      e.position.set(
        -BAY_W / 2 + 0.9 + (i * (BAY_W - 1.8)) / 8,
        BAY_H - hdr - 0.32,
        BZ1 + 0.42,
      );
      scene.add(e);
    }
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, BAY_H - hdr - 0.4, 0.04),
        edgeMat,
      );
      e.position.set(
        s * (BAY_W / 2 - fr - 0.02),
        (BAY_H - hdr - 0.4) / 2,
        BZ1 + 0.42,
      );
      scene.add(e);
    }
    const ff = new THREE.Mesh(
      new THREE.PlaneGeometry(BAY_W - 2 * fr, BAY_H - hdr),
      new THREE.MeshBasicMaterial({
        color: 0x0b2a3a,
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    ff.position.set(0, (BAY_H - hdr) / 2, BZ1 + 0.02);
    scene.add(ff);
    // airlock recess
    box(0.2, 3.2, 2.4, materials.rib, BAY_W / 2 - 0.05, 1.6, AIRLOCK.z);
    box(0.1, 2.8, 1.8, materials.dark, BAY_W / 2 - 0.12, 1.4, AIRLOCK.z);
    for (let i = 0; i < 4; i++) {
      box(
        0.3,
        0.25,
        rnd(1, 3),
        materials.dark,
        -BAY_W / 2 + 0.4,
        rnd(0.2, 2.5),
        rnd(BZ1 + 2, CEND - 2),
      );
    }
  })();

  /* ---- doors ---- */
