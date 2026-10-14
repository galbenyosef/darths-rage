// index-inline-1 12 — three
// Lines 2672-3017 of readable/index-inline-1.pretty.js (statement-aligned).
  function makeSoldier(x, z) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    scene.add(root);
    const fall = new THREE.Group();
    root.add(fall);
    const body = new THREE.Group();
    fall.add(body);
    const outl = [];
    const push = (r) => {
      if (r[1]) outl.push(r[1]);
      return r[0];
    };
    const legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.1, 0.9, 0);
      body.add(hip);
      push(addPart(G.thigh, M.pants, 0, -0.22, 0, hip));
      const knee = new THREE.Group();
      knee.position.set(0, -0.44, 0);
      hip.add(knee);
      push(addPart(G.shin, M.pants, 0, -0.21, 0, knee));
      addPart(G.boot, M.boot, 0, -0.42, -0.04, knee, false);
      legs.push({ hip, knee });
    }
    push(addPart(G.torso, M.jacket, 0, 1.18, 0, body));
    push(addPart(G.vest, M.vest, 0, 1.24, 0, body));
    const head = new THREE.Group();
    head.position.set(0, 1.5, 0);
    body.add(head);
    push(addPart(G.helm, M.helmetS, 0, 0.1, 0.01, head));
    addPart(G.face, M.skin, 0, 0.06, -0.02, head, false);
    const lens = new THREE.Mesh(G.lens, M.lens.clone());
    lens.position.set(-0.13, 1.3, -0.135);
    lens.rotation.y = Math.PI;
    body.add(lens);
    const arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.25, 1.4, 0);
      body.add(sh);
      push(addPart(G.upper, M.jacket, 0, -0.14, 0, sh));
      const el = new THREE.Group();
      el.position.set(0, -0.28, 0);
      sh.add(el);
      push(addPart(G.fore, M.jacket, 0, -0.13, 0, el));
      addPart(G.hand, M.skin, 0, -0.29, 0, el, false);
      arms.push({ sh, el });
    }
    const gun = new THREE.Group();
    gun.position.set(0, -0.3, -0.02);
    arms[1].el.add(gun);
    addPart(G.gun, M.gun, 0, -0.12, -0.02, gun, false);
    const br = addPart(G.barrel, M.gun, 0, -0.42, -0.02, gun, false)[0];
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, -0.52, -0.02);
    gun.add(muzzle);
    const cardHold = new THREE.Object3D();
    cardHold.position.set(0, -0.32, -0.03);
    arms[0].el.add(cardHold);
    const s = {
      root,
      fall,
      body,
      legs,
      head,
      arms,
      gun,
      muzzle,
      lens,
      outl,
      cardHold,
      pos: root.position,
      yaw: 0,
      st: "idle",
      fear: rnd(0, 0.12),
      cd: rnd(0.8, 2.2),
      alive: true,
      gone: false,
      hasCard: false,
      lift: 0,
      deadT: 0,
      aware: false,
      ph: Math.random() * 6,
      speakCd: 0,
      severed: false,
      holdT: 0,
      stopZ: 0,
      hasGun: true,
      goal: null,
      moving: 0,
      trem: 0,
      crouch: 0,
      gripT: 0,
      flinch: 0,
    };
    soldiers.push(s);
    return s;
  }
  const SPAWN = [];
  {
    // a squad per section, staggered across the corridor; two waiting by the courier's airlock
    const squads = [
      [-12, -35, 8],
      [-46, -77, 9],
      [-88, -119, 10],
    ];
    const lanes = [-1.6, 0.9, -0.5, 1.7, -1.2, 0.3, 1.3, -1.8, 0.6, -0.2];
    let li = 0;
    for (const [z0, z1, n] of squads)
      for (let i = 0; i < n; i++) {
        SPAWN.push([
          lanes[li++ % lanes.length],
          lerp(z0, z1, i / (n - 1)) + (((i * 7) % 3) - 1) * 0.6,
        ]);
      }
    SPAWN.push([3.2, -129.5], [4.6, -131]);
  }
  const CARD_START = SPAWN.reduce(
    (b, v, i) => (Math.abs(v[1] + 21) < Math.abs(SPAWN[b][1] + 21) ? i : b),
    0,
  );
  for (const [x, z] of SPAWN) makeSoldier(x, z);

  /* ---- card ---- */
  const cardMesh = new THREE.Mesh(G.card, M.card);
  scene.add(cardMesh);
  const cardGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffa23a,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0,
      toneMapped: false,
    }),
  );
  cardGlow.scale.set(0.5, 0.5, 1);
  scene.add(cardGlow);
  const card = { holder: null, flight: null, pos: V3(0, 1, 0), aboard: false };

  /* ---- crew: the artist trooper model, shared by every soldier ---- */
  const TR = { ready: false };
  const TRB = [
    "Hips",
    "Spine",
    "Spine1",
    "Spine2",
    "Neck",
    "Head",
    "LeftLeg",
    "RightLeg",
    "LeftFoot",
    "RightFoot",
    "LeftArm",
    "LeftForeArm",
    "LeftHand",
    "RightArm",
    "RightForeArm",
    "RightHand",
    "LeftUpLeg",
    "RightUpLeg",
  ];
  function setupTroopers(gltf) {
    if (!THREE.SkeletonUtils) throw new Error("skeleton tools missing");
    const src = gltf.scene;
    src.updateMatrixWorld(true);
    const hb = src.getObjectByName("mixamorigHead");
    if (!hb) throw new Error("trooper rig not recognised");
    const hp = V3();
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
      for (const n of TRB) B[n] = model.getObjectByName("mixamorig" + n);
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
        TR.limbs = {};
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
          TR.limbs[name] = new Uint32Array(tris);
        }
      } catch (e) {
        console.warn("limb split unavailable", e);
        TR.limbs = null;
      }
    TR.ready = true;
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
