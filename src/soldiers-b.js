// soldiers-b — soldiers (part 2 of 4)
// Lines 2837-3177 of readable/index-inline-1.pretty.js (statement-aligned).
  function setupTroopers(gltf) {
    if (!THREE.SkeletonUtils) throw new Error("skeleton tools missing");
    const src = gltf.scene;
    src.updateMatrixWorld(true);
    const hb = src.getObjectByName("mixamorigHead");
    if (!hb) throw new Error("trooper rig not recognised");
    const hp = vec3();
    hb.getWorldPosition(hp);
    const sc = 1.56 / Math.max(0.5, hp.y);
    const clip = (n) => gltf.animations.find((c) => c.name === n);
    const cowerClip = clip("Dead")
      ? THREE.AnimationUtils.subclip(
          clip("Dead"),
          "Cower",
          Math.round(1.05 * 30),
          Math.round(1.1 * 30),
          30,
        )
      : null;
    soldiers.forEach((s, i) => {
      const model = THREE.SkeletonUtils.clone(src);
      const holder = new THREE.Group();
      holder.rotation.y = Math.PI;
      const k = sc * rnd(0.95, 1.05);
      holder.scale.setScalar(k);
      holder.add(model);
      let mat = null,
        skin = null;
      model.traverse((o) => {
        if (o.isMesh) {
          if (o.isSkinnedMesh) skin = o;
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false;
          const m = o.material;
          mat = new THREE.MeshStandardMaterial({
            map: m.map,
            normalMap: m.normalMap,
            roughnessMap: m.roughnessMap,
            metalnessMap: m.metalnessMap,
            metalness: Math.min(m.metalness, 1),
            roughness: m.roughness,
            emissive: new THREE.Color(0, 0, 0),
          });
          if (m.normalScale) mat.normalScale.copy(m.normalScale);
          const v = rnd(0.86, 1.04);
          mat.color.setRGB(v, v, v * rnd(0.97, 1.03));
          o.material = mat;
        }
      });
      const B = {};
      for (const n of trooperBones) B[n] = model.getObjectByName("mixamorig" + n);
      const mixer = new THREE.AnimationMixer(model);
      const act = (c) => {
        const a = mixer.clipAction(c);
        a.play();
        a.setEffectiveWeight(0);
        return a;
      };
      const A = {
        alert: act(clip("Alert")),
        run: act(clip("Running")),
        walk: act(clip("Walking")),
        dead: act(clip("Dead")),
      };
      if (cowerClip) A.cower = act(cowerClip);
      if (clip("BeHit_FlyUp")) {
        A.fly = act(clip("BeHit_FlyUp"));
        A.fly.setLoop(THREE.LoopOnce, 1);
        A.fly.clampWhenFinished = true;
        A.fly.paused = true;
      }
      A.dead.setLoop(THREE.LoopOnce, 1);
      A.dead.clampWhenFinished = true;
      A.dead.paused = true;
      A.alert.time = rnd(0, 4);
      A.alert.timeScale = rnd(0.8, 1.1);
      s.T = {
        model,
        holder,
        mixer,
        A,
        B,
        mat,
        skin,
        cuts: [],
        stumps: [],
        w: { alert: 1, run: 0, walk: 0, dead: 0, cower: 0, fly: 0 },
        aimW: 0,
        crouchW: 0,
        crouchY: 0,
        ankleY: -1,
        base: new Map(),
        dying: false,
        hl: 0,
        flyDeath: false,
        flyT: 0,
      };
      s.body.visible = false;
      s.root.add(holder);
      // gun, card hand and chest torch now follow the model's bones in world space
      scene.attach(s.gun);
      scene.attach(s.cardHold);
      scene.attach(s.lens);
    });
    // limb pieces: triangles whose vertices are mostly driven by one limb's bones
    const s0 = soldiers[0].T.skin;
    if (s0)
      try {
        const g = s0.geometry,
          si = g.attributes.skinIndex,
          sw = g.attributes.skinWeight,
          idx = g.index,
          bones = s0.skeleton.bones;
        const comp = (at, v, k) =>
          k === 0
            ? at.getX(v)
            : k === 1
              ? at.getY(v)
              : k === 2
                ? at.getZ(v)
                : at.getW(v);
        const dom = new Int16Array(si.count);
        for (let v = 0; v < si.count; v++) {
          let bw = -1,
            bi = 0;
          for (let k = 0; k < 4; k++) {
            const w = comp(sw, v, k);
            if (w > bw) {
              bw = w;
              bi = comp(si, v, k);
            }
          }
          dom[v] = bi;
        }
        trooperModel.limbs = {};
        for (const name of [
          "RightArm",
          "RightForeArm",
          "LeftArm",
          "LeftForeArm",
          "RightUpLeg",
          "RightLeg",
          "LeftUpLeg",
          "LeftLeg",
          "Spine",
          "Neck",
        ]) {
          const rb = soldiers[0].T.model.getObjectByName("mixamorig" + name);
          if (!rb) continue;
          const set = new Set();
          rb.traverse((b) => {
            const i = bones.indexOf(b);
            if (i >= 0) set.add(i);
          });
          const tris = [];
          const n = idx ? idx.count : si.count;
          for (let t = 0; t < n; t += 3) {
            const a = idx ? idx.getX(t) : t,
              b = idx ? idx.getX(t + 1) : t + 1,
              c = idx ? idx.getX(t + 2) : t + 2;
            if (set.has(dom[a]) && set.has(dom[b]) && set.has(dom[c]))
              tris.push(a, b, c);
          }
          trooperModel.limbs[name] = new Uint32Array(tris);
        }
      } catch (e) {
        console.warn("limb split unavailable", e);
        trooperModel.limbs = null;
      }
    trooperModel.ready = true;
  }
  (async () => {
    try {
      if (THREE.GLTFLoader) setupTroopers(await fetchModel("trooper"));
    } catch (e) {
      console.warn("Trooper model failed to load; using stand-ins", e);
    }
  })();
  // the courier: the user's armored starship model replaces the stand-in hull; its engine bank glows as it leaves
  const shipGlowMats = [];
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
  const crateHalf = { hx: 0.5, hy: 0.43, hz: 0.42 };
  const crates = [];
  let crateCand = null;
  function makeCrate(x, y, z, yaw) {
    const c = {
      home: { x, y, z, yaw },
      pos: vec3(x, y, z),
      q: new THREE.Quaternion().setFromAxisAngle(upAxis, yaw),
      v: vec3(),
      av: vec3(),
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
        makeCrate(x, crateHalf.hy, z, rnd(-0.22, 0.22));
        if (Math.random() < 0.25)
          makeCrate(
            x + rnd(-0.05, 0.05),
            3 * crateHalf.hy + 0.005,
            z + rnd(-0.06, 0.06),
            rnd(-0.45, 0.45),
          );
      }
    }
    for (const [x, z, st] of [
      [-(BAY_W / 2 - 1.1), CEND - 3.0, 1],
      [BAY_W / 2 - 1.1, CEND - 4.6, 0],
      [BAY_W / 2 - 2.3, BZ1 + 4.2, 0],
    ]) {
      makeCrate(x, crateHalf.hy, z, rnd(-0.3, 0.3));
      if (st)
        makeCrate(x + rnd(-0.06, 0.06), 3 * crateHalf.hy + 0.005, z, rnd(-0.5, 0.5));
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
  const scratchMatrix = new THREE.Matrix4(),
    scratchMatrix2 = new THREE.Matrix4(),
    unitScale = vec3(1, 1, 1);
  function syncCrates() {
    for (const c of crates) {
      scratchMatrix.compose(c.pos, c.q, c.lost ? vec3(0.0001, 0.0001, 0.0001) : unitScale);
      for (const p of crateParts) {
        scratchMatrix2.multiplyMatrices(scratchMatrix, p.base);
        p.mesh.setMatrixAt(c.idx, scratchMatrix2);
      }
    }
    for (const p of crateParts) p.mesh.instanceMatrix.needsUpdate = true;
  }
