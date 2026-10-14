// sevrane-a — Sevrane (part 1 of 3)
// Lines 1749-2092 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= Sevrane ================= */
  const seamMeshes = [];
  function seam(geo, x, y, z, parent, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, materials.seam);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    seamMeshes.push(m);
    return m;
  }
  function makeMesh(geo, mat, x, y, z, parent, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const sevraneParts = {};
  (function buildSevrane() {
    const root = new THREE.Group();
    scene.add(root);
    sevraneParts.root = root;
    const body = new THREE.Group();
    root.add(body);
    sevraneParts.body = body;
    const A = materials.armor,
      S = materials.suit;
    // hips & legs (on root)
    makeMesh(new THREE.BoxGeometry(0.44, 0.22, 0.28), A, 0, 1.02, 0, root);
    sevraneParts.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.12, 0.98, 0);
      root.add(hip);
      makeMesh(
        new THREE.CylinderGeometry(0.095, 0.08, 0.46, 10),
        S,
        0,
        -0.23,
        0,
        hip,
      );
      makeMesh(new THREE.BoxGeometry(0.16, 0.28, 0.06), A, 0, -0.2, -0.085, hip);
      const knee = new THREE.Group();
      knee.position.set(0, -0.46, 0);
      hip.add(knee);
      makeMesh(new THREE.SphereGeometry(0.075, 10, 8), A, 0, 0, -0.04, knee);
      makeMesh(
        new THREE.CylinderGeometry(0.08, 0.07, 0.42, 10),
        A,
        0,
        -0.22,
        0,
        knee,
      );
      seam(new THREE.BoxGeometry(0.012, 0.3, 0.012), 0, -0.2, -0.08, knee);
      makeMesh(new THREE.BoxGeometry(0.15, 0.1, 0.28), A, 0, -0.46, -0.04, knee);
      sevraneParts.legs.push({ hip, knee });
    }
    // torso
    makeMesh(new THREE.BoxGeometry(0.44, 0.32, 0.27), S, 0, 1.2, 0, body);
    for (let i = 0; i < 3; i++)
      makeMesh(
        new THREE.BoxGeometry(0.42, 0.085, 0.29),
        A,
        0,
        1.1 + i * 0.1,
        0,
        body,
      );
    makeMesh(new THREE.BoxGeometry(0.56, 0.42, 0.32), A, 0, 1.52, 0, body);
    makeMesh(new THREE.BoxGeometry(0.48, 0.36, 0.06), A, 0, 1.5, 0.16, body);
    seam(new THREE.BoxGeometry(0.012, 0.38, 0.012), 0, 1.5, 0.195, body);
    seam(new THREE.BoxGeometry(0.46, 0.012, 0.012), 0, 1.34, 0.17, body);
    seam(new THREE.BoxGeometry(0.42, 0.012, 0.012), 0, 1.37, -0.165, body);
    seam(new THREE.BoxGeometry(0.012, 0.3, 0.012), -0.12, 1.52, -0.165, body);
    seam(new THREE.BoxGeometry(0.012, 0.3, 0.012), 0.12, 1.52, -0.165, body);
    makeMesh(new THREE.CylinderGeometry(0.12, 0.15, 0.12, 14), A, 0, 1.77, 0, body);
    // pauldrons
    for (const s of [-1, 1]) {
      const pa = makeMesh(
        new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        A,
        s * 0.33,
        1.68,
        0,
        body,
      );
      pa.scale.set(1.15, 0.9, 1.1);
      const pb = makeMesh(
        new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        A,
        s * 0.36,
        1.6,
        0,
        body,
      );
      pb.scale.set(1.15, 0.7, 1.05);
      seam(
        new THREE.TorusGeometry(0.17, 0.006, 4, 24),
        s * 0.33,
        1.68,
        0,
        body,
        Math.PI / 2,
      );
    }
    // helmet
    const helm = new THREE.Group();
    helm.position.set(0, 1.98, 0);
    body.add(helm);
    sevraneParts.helm = helm;
    makeMesh(
      new THREE.SphereGeometry(0.155, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      A,
      0,
      0.02,
      0,
      helm,
    );
    makeMesh(
      new THREE.CylinderGeometry(0.157, 0.165, 0.17, 24),
      A,
      0,
      -0.065,
      0,
      helm,
    );
    makeMesh(new THREE.BoxGeometry(0.03, 0.02, 0.32), A, 0, 0.17, 0, helm).scale.set(
      1,
      1,
      1,
    );
    makeMesh(new THREE.BoxGeometry(0.26, 0.07, 0.08), S, 0, -0.08, -0.14, helm);
    seam(
      new THREE.TorusGeometry(0.158, 0.006, 4, 32),
      0,
      0.02,
      0,
      helm,
      Math.PI / 2,
    );
    seam(
      new THREE.TorusGeometry(0.157, 0.005, 4, 32, Math.PI),
      0,
      0.02,
      0,
      helm,
      0,
      Math.PI / 2,
    );
    seam(new THREE.BoxGeometry(0.18, 0.012, 0.012), 0, -0.06, -0.168, helm);
    // cape
    const cg = new THREE.PlaneGeometry(1.05, 1.72, 12, 20);
    const cp = cg.attributes.position;
    sevraneParts.capeRest = new Float32Array(cp.array.length);
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i),
        y = cp.getY(i);
      const t = (0.86 - y) / 1.72;
      const widen = 1 + t * 0.55;
      const xx = x * widen;
      const z =
        0.2 + 0.13 * (1 - Math.pow(clamp(x / 0.525, -1, 1), 2)) + t * 0.05;
      cp.setXYZ(i, xx, y + 0.86, z);
    }
    sevraneParts.capeRest.set(cp.array);
    cg.computeVertexNormals();
    const capeGroup = new THREE.Group();
    capeGroup.position.set(0, 0, 0);
    body.add(capeGroup);
    sevraneParts.capeO = makeMesh(cg, materials.capeOut, 0, 0, 0, capeGroup);
    sevraneParts.capeI = makeMesh(cg, materials.capeIn, 0, 0, 0, capeGroup, false);
    sevraneParts.capeGeo = cg;
    const cowl = makeMesh(
      new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      materials.capeOut,
      -0.28,
      1.7,
      0.06,
      body,
    );
    cowl.scale.set(1.25, 0.75, 1.25);
    // strap
    const strap = makeMesh(
      new THREE.BoxGeometry(0.06, 0.95, 0.02),
      materials.strap,
      0.08,
      1.38,
      0.37,
      body,
    );
    strap.rotation.z = -0.42;
    makeMesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.03, 14),
      A,
      0.24,
      1.7,
      0.36,
      body,
    ).rotation.x = Math.PI / 2;
    // arms
    const arm = (s) => {
      const sh = new THREE.Group();
      sh.position.set(s * 0.33, 1.62, 0);
      body.add(sh);
      makeMesh(new THREE.CylinderGeometry(0.075, 0.068, 0.3, 10), S, 0, -0.15, 0, sh);
      const el = new THREE.Group();
      el.position.set(0, -0.3, 0);
      sh.add(el);
      makeMesh(new THREE.SphereGeometry(0.068, 10, 8), A, 0, 0, 0, el);
      makeMesh(new THREE.CylinderGeometry(0.085, 0.07, 0.26, 10), A, 0, -0.14, 0, el);
      seam(
        new THREE.BoxGeometry(0.012, 0.22, 0.012),
        s * 0.06,
        -0.14,
        0.03,
        el,
      );
      const hand = new THREE.Group();
      hand.position.set(0, -0.29, 0);
      el.add(hand);
      makeMesh(new THREE.BoxGeometry(0.1, 0.11, 0.07), A, 0, -0.04, 0, hand);
      return { sh, el, hand };
    };
    sevraneParts.L = arm(-1);
    sevraneParts.R = arm(1);
    // blade in left hand
    const bp = new THREE.Group();
    bp.position.set(0, -0.05, 0);
    sevraneParts.L.hand.add(bp);
    sevraneParts.bladePivot = bp;
    makeMesh(
      new THREE.CylinderGeometry(0.026, 0.028, 0.28, 12),
      materials.hilt,
      0,
      0,
      0,
      bp,
      false,
    );
    makeMesh(
      new THREE.CylinderGeometry(0.034, 0.034, 0.04, 12),
      materials.dark,
      0,
      0.12,
      0,
      bp,
    );
    const blade = new THREE.Group();
    blade.position.set(0, 0.14, 0);
    bp.add(blade);
    sevraneParts.blade = blade;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 1.05, 8),
      materials.bladeCore,
    );
    core.position.y = 0.525;
    blade.add(core);
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 1.08, 10),
      materials.bladeGlow,
    );
    glow.position.y = 0.53;
    blade.add(glow);
    const halo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 1.12, 10),
      materials.bladeHalo,
    );
    halo.position.y = 0.53;
    blade.add(halo);
    sevraneParts.bladeTip = new THREE.Object3D();
    sevraneParts.bladeTip.position.y = 1.05;
    blade.add(sevraneParts.bladeTip);
    sevraneParts.bladeMid = new THREE.Object3D();
    sevraneParts.bladeMid.position.y = 0.5;
    blade.add(sevraneParts.bladeMid);
    blade.scale.y = 0.001;
    blade.visible = false;
    root.traverse((o) => {
      if (o.isMesh && o.material === materials.seam) o.castShadow = false;
    });
  })();

  /* ---- Sevrane: the artist model (GLB) ---- */
  const HIT_DMG = 2.5;
  let deathT = 0;
  const upAxis = vec3(0, 1, 0),
    GRIP_MAX = 3.5,
    PUSH_CD = 1.6,
    SABER_DIST = 6.5;
  // the three sword attacks S cycles through: the part of each clip used, its speed, when the blade can cut and when it whooshes (clip seconds)
  const ATTACKS = [
    {
      clip: "Attack01",
      from: 0.3,
      to: 2.55,
      speed: 1.35,
      wins: [
        [0.56, 0.88],
        [1.28, 1.64],
        [2.06, 2.38],
      ],
      snd: [0.48, 1.2, 1.98],
    },
    {
      clip: "Attack02",
      from: 0.55,
      to: 1.5,
      speed: 1.15,
      wins: [[0.86, 1.14]],
      snd: [0.8],
    },
    {
      clip: "Attack03",
      from: 0.3,
      to: 1.35,
      speed: 1.15,
      wins: [
        [0.4, 0.72],
        [0.96, 1.28],
      ],
      snd: [0.36, 0.9],
    },
  ];
  const SEV = { ready: false, walkW: 0, gripW: 0, armW: 0, bw: -2.1 };
  const bladeG = new THREE.Group();
  scene.add(bladeG);
  const HILT = {
    tip: vec3(-0.0842, 0.2168, 0.0325),
    pommel: vec3(0.0468, 0.0407, -0.1707),
  };
  HILT.axis = HILT.tip.clone().sub(HILT.pommel).normalize();
  HILT.mid = HILT.tip.clone().add(HILT.pommel).multiplyScalar(0.5);
  const identityQuat = new THREE.Quaternion(),
    scratchQuat = new THREE.Quaternion(),
    scratchQuat2 = new THREE.Quaternion(),
    scratchQuatParent = new THREE.Quaternion(),
    scratchVecA = vec3(),
    scratchVecB = vec3(),
    scratchVecD = vec3(),
    scratchVecE = vec3(),
    scratchBladeDir = vec3();
