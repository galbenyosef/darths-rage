// level-c — level (part 3 of 3)
// Lines 956-1177 of readable/index-inline-1.pretty.js (statement-aligned).
  const doors = DOORS.map((d, i) => {
    // the bulkhead closes the whole corridor except a hatch-sized doorway in the middle
    const side = 2.9 - DOOR_W / 2,
      th = 0.3;
    for (const sx of [-1, 1]) {
      const w = texBox(side, CORRIDOR_H, th, materials.wall, side / 1.6, CORRIDOR_H / 2);
      w.position.set(sx * (DOOR_W / 2 + side / 2), CORRIDOR_H / 2, d.z);
      w.receiveShadow = true;
      w.castShadow = true;
      scene.add(w);
    }
    const top = texBox(DOOR_W, CORRIDOR_H - DOOR_H, th, materials.wall, DOOR_W / 1.6, (CORRIDOR_H - DOOR_H) / 2);
    top.position.set(0, DOOR_H + (CORRIDOR_H - DOOR_H) / 2, d.z);
    scene.add(top);
    // frame, pipes with clamps and round vents on the approach side
    for (const sx of [-1, 1]) {
      box(
        0.12,
        DOOR_H + 0.12,
        th + 0.14,
        materials.rib,
        sx * (DOOR_W / 2 + 0.06),
        (DOOR_H + 0.12) / 2,
        d.z,
      );
      const pp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, DOOR_H + 0.5, 10),
        materials.pipe,
      );
      pp.position.set(sx * (DOOR_W / 2 + 0.36), (DOOR_H + 0.5) / 2, d.z + 0.22);
      scene.add(pp);
      for (const y of [0.45, 1.3, 2.15]) {
        box(0.2, 0.14, 0.16, materials.rib, sx * (DOOR_W / 2 + 0.36), y, d.z + 0.22);
      }
      const vent = new THREE.Mesh(
        new THREE.CircleGeometry(0.3, 24),
        new THREE.MeshStandardMaterial({
          map: ventTex,
          roughness: 0.6,
          metalness: 0.6,
        }),
      );
      vent.position.set(sx * 1.85, 1.45, d.z + th / 2 + 0.01);
      scene.add(vent);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.31, 0.045, 8, 28),
        new THREE.MeshStandardMaterial({
          color: 0x4a1e1a,
          roughness: 0.5,
          metalness: 0.4,
        }),
      );
      ring.position.copy(vent.position);
      scene.add(ring);
      const rp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1.3, 8),
        new THREE.MeshStandardMaterial({
          color: 0x5a201b,
          roughness: 0.5,
          metalness: 0.4,
        }),
      );
      rp.position.set(sx * (DOOR_W / 2 + 0.95), 0.65, d.z + 0.2);
      scene.add(rp);
    }
    box(DOOR_W + 0.24, 0.12, th + 0.14, materials.rib, 0, DOOR_H + 0.06, d.z);
    const mat = new THREE.MeshStandardMaterial({
      map: doorTex,
      roughness: 0.5,
      metalness: 0.55,
      emissive: new THREE.Color(0, 0, 0),
    });
    const pivot = new THREE.Group();
    pivot.position.set(0, DOOR_H + 0.05, d.z);
    scene.add(pivot);
    const slab = new THREE.Group();
    pivot.add(slab);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_W - 0.04, DOOR_H - 0.02, 0.22, 16, 26, 2),
      mat,
    );
    body.position.set(0, DOOR_H / 2, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    slab.add(body);
    // locking wheel in the middle of the hatch
    const wheel = new THREE.Group();
    wheel.position.set(0, DOOR_H * 0.5, 0.13);
    slab.add(wheel);
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24), materials.rib));
    for (let k = 0; k < 3; k++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04), materials.rib);
      sp.rotation.z = (k * Math.PI) / 3;
      wheel.add(sp);
    }
    wheel.add(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12).rotateX(Math.PI / 2),
        materials.dark,
      ),
    );
    // dents, a fold and a twist it will be crumpled into as it is torn out
    const dents = [];
    for (let k = 0; k < 7; k++)
      dents.push({
        x: rnd(-0.6, 0.6),
        y: rnd(0.2, DOOR_H - 0.2),
        r: rnd(0.18, 0.42),
        dp: rnd(0.06, 0.16) * (k < 5 ? 1 : -1),
      });
    const fold = {
      a: rnd(-0.5, 0.5),
      y: rnd(DOOR_H * 0.55, DOOR_H * 0.8),
      side: Math.random() < 0.5 ? -1 : 1,
    };
    const jit = new Float32Array(body.geometry.attributes.position.count).map(
      () => rnd(-0.018, 0.018),
    );
    return {
      z: d.z,
      hpMax: d.hp,
      hp: d.hp,
      state: "open",
      t: 0,
      pivot,
      slab,
      mat,
      scars: [],
      heat: 0,
      idx: i,
      pull: 0,
      need: [2.4, 3.0, 3.6][i] || 3,
      rip: null,
      wheel,
      body,
      base: body.geometry.attributes.position.array.slice(),
      dents,
      fold,
      jit,
      crumple: 0,
    };
  });
  // everything has to squeeze through the doorway: within a metre of a bulkhead, sideways room narrows to the opening
  function doorFunnel(x, z, r) {
    for (const d of doors) {
      const dz = Math.abs(z - d.z);
      if (dz < 1.0) {
        const inner = Math.max(0.05, DOOR_W / 2 - r),
          k = Math.max(0, dz - 0.3) / 0.7,
          mx = inner + k * k * (3 - inner);
        x = clamp(x, -mx, mx);
      }
    }
    return x;
  }
  function bulkheadHit(x, y, r) {
    return Math.abs(x) > DOOR_W / 2 - r || y > DOOR_H - r;
  }
  function crumpleDoor(d, k) {
    if (Math.abs(k - d.crumple) < 0.004) return;
    d.crumple = k;
    const pos = d.body.geometry.attributes.position,
      b = d.base,
      a = pos.array;
    const hy = (DOOR_H - 0.02) / 2;
    for (let i = 0; i < a.length; i += 3) {
      const x = b[i],
        y = b[i + 1] + hy,
        z = b[i + 2]; // y measured up from the bottom of the hatch
      let dz = 0;
      for (const dn of d.dents) {
        const r2 = ((x - dn.x) ** 2 + (y - dn.y) ** 2) / (dn.r * dn.r);
        dz -= dn.dp * Math.exp(-r2);
      }
      dz +=
        0.11 * (Math.abs(Math.sin(x * 6.1 + y * 2.3)) - 0.5) +
        0.08 * (Math.abs(Math.sin(y * 7.3 - x * 3.2)) - 0.5) +
        0.05 * (Math.abs(Math.sin(x * 13 + y * 9)) - 0.5) +
        0.16 * ((y - hy) / hy) ** 2 +
        d.jit[(i / 3) | 0]; // sharp creases, bowed toward him
      // the top corner folds over along a slanted crease
      const crease = d.fold.y + d.fold.a * x,
        over = y - crease;
      let ny = y,
        nz = z;
      if (over > 0 && x * d.fold.side > -0.2) {
        const ang = 1.3 * Math.min(1, over / 0.6);
        ny = crease + over * Math.cos(ang);
        nz = z + over * Math.sin(ang);
      }
      const twist = 0.35 * x * (y / DOOR_H);
      a[i] = x * (1 - 0.06 * k * (y / DOOR_H));
      a[i + 1] = lerp(y, ny, k) - hy;
      a[i + 2] = z + k * (dz + twist * 0.6) + lerp(0, nz - z, k);
    }
    pos.needsUpdate = true;
    d.body.geometry.computeVertexNormals();
    if (d.wheel) {
      d.wheel.rotation.x = 0.5 * k;
      d.wheel.rotation.y = -0.3 * k;
      d.wheel.position.z = 0.13 + 0.06 * k;
      d.wheel.position.x = 0.08 * k;
    }
    d.mat.color.setScalar(1 - 0.35 * k);
  }
  function doorBlocks(d) {
    return d.state === "closed" || d.state === "closing";
  }
  function secOf(z) {
    let s = 0;
    for (const d of doors) if (z < d.z) s++;
    return s;
  }
  function pathOpen(z1, z2) {
    const a = Math.min(z1, z2),
      b = Math.max(z1, z2);
    for (const d of doors) {
      if (d.z > a && d.z < b && doorBlocks(d)) return false;
    }
    return true;
  }

