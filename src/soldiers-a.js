// soldiers-a — soldiers (part 1 of 4)
// Lines 2631-2836 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= soldiers ================= */
  const soldierGeo = {
    thigh: new THREE.CylinderGeometry(0.075, 0.065, 0.44, 8),
    shin: new THREE.CylinderGeometry(0.062, 0.055, 0.42, 8),
    boot: new THREE.BoxGeometry(0.12, 0.1, 0.24),
    torso: new THREE.BoxGeometry(0.4, 0.52, 0.24),
    vest: new THREE.BoxGeometry(0.43, 0.32, 0.27),
    helm: new THREE.SphereGeometry(
      0.15,
      14,
      10,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.6,
    ),
    face: new THREE.SphereGeometry(0.11, 12, 10),
    upper: new THREE.CylinderGeometry(0.058, 0.052, 0.28, 8),
    fore: new THREE.CylinderGeometry(0.05, 0.045, 0.26, 8),
    hand: new THREE.BoxGeometry(0.07, 0.08, 0.06),
    gun: new THREE.BoxGeometry(0.07, 0.44, 0.11),
    barrel: new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8),
    lens: new THREE.CircleGeometry(0.035, 10),
    card: new THREE.BoxGeometry(0.12, 0.17, 0.012),
  };
  const soldiers = [];
  function addPart(geo, mat, x, y, z, parent, outline = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    if (outline) {
      const o = new THREE.Mesh(geo, materials.outline);
      o.scale.setScalar(1.12);
      o.visible = false;
      m.add(o);
      return [m, o];
    }
    return [m, null];
  }
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
      push(addPart(soldierGeo.thigh, materials.pants, 0, -0.22, 0, hip));
      const knee = new THREE.Group();
      knee.position.set(0, -0.44, 0);
      hip.add(knee);
      push(addPart(soldierGeo.shin, materials.pants, 0, -0.21, 0, knee));
      addPart(soldierGeo.boot, materials.boot, 0, -0.42, -0.04, knee, false);
      legs.push({ hip, knee });
    }
    push(addPart(soldierGeo.torso, materials.jacket, 0, 1.18, 0, body));
    push(addPart(soldierGeo.vest, materials.vest, 0, 1.24, 0, body));
    const head = new THREE.Group();
    head.position.set(0, 1.5, 0);
    body.add(head);
    push(addPart(soldierGeo.helm, materials.helmetS, 0, 0.1, 0.01, head));
    addPart(soldierGeo.face, materials.skin, 0, 0.06, -0.02, head, false);
    const lens = new THREE.Mesh(soldierGeo.lens, materials.lens.clone());
    lens.position.set(-0.13, 1.3, -0.135);
    lens.rotation.y = Math.PI;
    body.add(lens);
    const arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.25, 1.4, 0);
      body.add(sh);
      push(addPart(soldierGeo.upper, materials.jacket, 0, -0.14, 0, sh));
      const el = new THREE.Group();
      el.position.set(0, -0.28, 0);
      sh.add(el);
      push(addPart(soldierGeo.fore, materials.jacket, 0, -0.13, 0, el));
      addPart(soldierGeo.hand, materials.skin, 0, -0.29, 0, el, false);
      arms.push({ sh, el });
    }
    const gun = new THREE.Group();
    gun.position.set(0, -0.3, -0.02);
    arms[1].el.add(gun);
    addPart(soldierGeo.gun, materials.gun, 0, -0.12, -0.02, gun, false);
    const br = addPart(soldierGeo.barrel, materials.gun, 0, -0.42, -0.02, gun, false)[0];
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
  const cardMesh = new THREE.Mesh(soldierGeo.card, materials.card);
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
  const card = { holder: null, flight: null, pos: vec3(0, 1, 0), aboard: false };

  /* ---- crew: the artist trooper model, shared by every soldier ---- */
  const trooperModel = { ready: false };
  const trooperBones = [
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
