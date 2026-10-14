// index-inline-1 09 — three
// Lines 1768-2114 of readable/index-inline-1.pretty.js (statement-aligned).
  (function buildSevrane() {
    const root = new THREE.Group();
    scene.add(root);
    P.root = root;
    const body = new THREE.Group();
    root.add(body);
    P.body = body;
    const A = M.armor,
      S = M.suit;
    // hips & legs (on root)
    mk(new THREE.BoxGeometry(0.44, 0.22, 0.28), A, 0, 1.02, 0, root);
    P.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.12, 0.98, 0);
      root.add(hip);
      mk(
        new THREE.CylinderGeometry(0.095, 0.08, 0.46, 10),
        S,
        0,
        -0.23,
        0,
        hip,
      );
      mk(new THREE.BoxGeometry(0.16, 0.28, 0.06), A, 0, -0.2, -0.085, hip);
      const knee = new THREE.Group();
      knee.position.set(0, -0.46, 0);
      hip.add(knee);
      mk(new THREE.SphereGeometry(0.075, 10, 8), A, 0, 0, -0.04, knee);
      mk(
        new THREE.CylinderGeometry(0.08, 0.07, 0.42, 10),
        A,
        0,
        -0.22,
        0,
        knee,
      );
      seam(new THREE.BoxGeometry(0.012, 0.3, 0.012), 0, -0.2, -0.08, knee);
      mk(new THREE.BoxGeometry(0.15, 0.1, 0.28), A, 0, -0.46, -0.04, knee);
      P.legs.push({ hip, knee });
    }
    // torso
    mk(new THREE.BoxGeometry(0.44, 0.32, 0.27), S, 0, 1.2, 0, body);
    for (let i = 0; i < 3; i++)
      mk(
        new THREE.BoxGeometry(0.42, 0.085, 0.29),
        A,
        0,
        1.1 + i * 0.1,
        0,
        body,
      );
    mk(new THREE.BoxGeometry(0.56, 0.42, 0.32), A, 0, 1.52, 0, body);
    mk(new THREE.BoxGeometry(0.48, 0.36, 0.06), A, 0, 1.5, 0.16, body);
    seam(new THREE.BoxGeometry(0.012, 0.38, 0.012), 0, 1.5, 0.195, body);
    seam(new THREE.BoxGeometry(0.46, 0.012, 0.012), 0, 1.34, 0.17, body);
    seam(new THREE.BoxGeometry(0.42, 0.012, 0.012), 0, 1.37, -0.165, body);
    seam(new THREE.BoxGeometry(0.012, 0.3, 0.012), -0.12, 1.52, -0.165, body);
    seam(new THREE.BoxGeometry(0.012, 0.3, 0.012), 0.12, 1.52, -0.165, body);
    mk(new THREE.CylinderGeometry(0.12, 0.15, 0.12, 14), A, 0, 1.77, 0, body);
    // pauldrons
    for (const s of [-1, 1]) {
      const pa = mk(
        new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        A,
        s * 0.33,
        1.68,
        0,
        body,
      );
      pa.scale.set(1.15, 0.9, 1.1);
      const pb = mk(
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
    P.helm = helm;
    mk(
      new THREE.SphereGeometry(0.155, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      A,
      0,
      0.02,
      0,
      helm,
    );
    mk(
      new THREE.CylinderGeometry(0.157, 0.165, 0.17, 24),
      A,
      0,
      -0.065,
      0,
      helm,
    );
    mk(new THREE.BoxGeometry(0.03, 0.02, 0.32), A, 0, 0.17, 0, helm).scale.set(
      1,
      1,
      1,
    );
    mk(new THREE.BoxGeometry(0.26, 0.07, 0.08), S, 0, -0.08, -0.14, helm);
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
    P.capeRest = new Float32Array(cp.array.length);
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
    P.capeRest.set(cp.array);
    cg.computeVertexNormals();
    const capeGroup = new THREE.Group();
    capeGroup.position.set(0, 0, 0);
    body.add(capeGroup);
    P.capeO = mk(cg, M.capeOut, 0, 0, 0, capeGroup);
    P.capeI = mk(cg, M.capeIn, 0, 0, 0, capeGroup, false);
    P.capeGeo = cg;
    const cowl = mk(
      new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      M.capeOut,
      -0.28,
      1.7,
      0.06,
      body,
    );
    cowl.scale.set(1.25, 0.75, 1.25);
    // strap
    const strap = mk(
      new THREE.BoxGeometry(0.06, 0.95, 0.02),
      M.strap,
      0.08,
      1.38,
      0.37,
      body,
    );
    strap.rotation.z = -0.42;
    mk(
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
      mk(new THREE.CylinderGeometry(0.075, 0.068, 0.3, 10), S, 0, -0.15, 0, sh);
      const el = new THREE.Group();
      el.position.set(0, -0.3, 0);
      sh.add(el);
      mk(new THREE.SphereGeometry(0.068, 10, 8), A, 0, 0, 0, el);
      mk(new THREE.CylinderGeometry(0.085, 0.07, 0.26, 10), A, 0, -0.14, 0, el);
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
      mk(new THREE.BoxGeometry(0.1, 0.11, 0.07), A, 0, -0.04, 0, hand);
      return { sh, el, hand };
    };
    P.L = arm(-1);
    P.R = arm(1);
    // blade in left hand
    const bp = new THREE.Group();
    bp.position.set(0, -0.05, 0);
    P.L.hand.add(bp);
    P.bladePivot = bp;
    mk(
      new THREE.CylinderGeometry(0.026, 0.028, 0.28, 12),
      M.hilt,
      0,
      0,
      0,
      bp,
      false,
    );
    mk(
      new THREE.CylinderGeometry(0.034, 0.034, 0.04, 12),
      M.dark,
      0,
      0.12,
      0,
      bp,
    );
    const blade = new THREE.Group();
    blade.position.set(0, 0.14, 0);
    bp.add(blade);
    P.blade = blade;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 1.05, 8),
      M.bladeCore,
    );
    core.position.y = 0.525;
    blade.add(core);
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 1.08, 10),
      M.bladeGlow,
    );
    glow.position.y = 0.53;
    blade.add(glow);
    const halo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 1.12, 10),
      M.bladeHalo,
    );
    halo.position.y = 0.53;
    blade.add(halo);
    P.bladeTip = new THREE.Object3D();
    P.bladeTip.position.y = 1.05;
    blade.add(P.bladeTip);
    P.bladeMid = new THREE.Object3D();
    P.bladeMid.position.y = 0.5;
    blade.add(P.bladeMid);
    blade.scale.y = 0.001;
    blade.visible = false;
    root.traverse((o) => {
      if (o.isMesh && o.material === M.seam) o.castShadow = false;
    });
  })();

  /* ---- Sevrane: the artist model (GLB) ---- */
  const HIT_DMG = 2.5;
  let deathT = 0;
  const UP = V3(0, 1, 0),
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
    tip: V3(-0.0842, 0.2168, 0.0325),
    pommel: V3(0.0468, 0.0407, -0.1707),
  };
  HILT.axis = HILT.tip.clone().sub(HILT.pommel).normalize();
  HILT.mid = HILT.tip.clone().add(HILT.pommel).multiplyScalar(0.5);
  const QI = new THREE.Quaternion(),
    _q = new THREE.Quaternion(),
    _q2 = new THREE.Quaternion(),
    _qp = new THREE.Quaternion(),
    _a = V3(),
    _b = V3(),
    _d = V3(),
    _e = V3(),
    _c2 = V3();
  function worldRotate(bone, q) {
    bone.getWorldQuaternion(_q2);
    const pq = _qp.copy(QI);
    if (bone.parent) bone.parent.getWorldQuaternion(pq);
    _q2.premultiply(q);
    bone.quaternion.copy(pq.invert().multiply(_q2));
    bone.updateMatrixWorld(true);
  }
  function aimBone(bone, child, dir, w) {
    if (w <= 0.001) return;
    bone.getWorldPosition(_a);
    child.getWorldPosition(_b);
    _d.subVectors(_b, _a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(_d, dir);
    if (w < 1) q.slerp(QI, 1 - w);
    worldRotate(bone, q);
  }
  function rotY(v, a) {
    const c = Math.cos(a),
      s = Math.sin(a);
    return v.set(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
  }
