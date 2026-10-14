// index-inline-1 11 — sev
// Lines 2380-2671 of readable/index-inline-1.pretty.js (statement-aligned).
  function driveSevrane(dt) {
    if (!SEV.ready) return;
    const p = player,
      B = SEV.B;
    const moving = Math.abs(p.vel) > 0.05;
    SEV.walkW = damp(SEV.walkW, moving ? 1 : 0, 7, dt);
    const sa =
      p.atk && p.atk.type === "swing" && SEV.attacks && p.atk.anim != null;
    if (sa && !p.atk.started) {
      p.atk.started = true;
      const cfg = ATTACKS[p.atk.anim];
      if (SEV.skill && SEV.skill !== SEV.attacks[p.atk.anim])
        SEV.skill.setEffectiveWeight(0);
      SEV.skill = SEV.attacks[p.atk.anim];
      SEV.skill.reset();
      SEV.skill.paused = false;
      SEV.skill.time = cfg.from;
      SEV.skill.timeScale = cfg.speed;
      // remember how the blade sits in the fist right now, so it stays locked to the hand through the animation
      B.RightHand.getWorldQuaternion(_q2);
      SEV.bladeLocal = V3(0, 1, 0)
        .applyQuaternion(bladeG.quaternion)
        .applyQuaternion(_q2.clone().invert());
    }
    SEV.skillW = damp(SEV.skillW, sa ? 1 : 0, sa ? 18 : 9, dt);
    if (SEV.attacks)
      for (const a of SEV.attacks)
        if (a && a !== SEV.skill) a.setEffectiveWeight(0);
    if (SEV.skill) {
      SEV.skill.setEffectiveWeight(SEV.skillW);
      if (!sa && SEV.skillW < 0.01) SEV.skill.paused = true;
    }
    const base = 1 - SEV.skillW;
    SEV.walk.setEffectiveWeight(SEV.walkW * base);
    SEV.idle.setEffectiveWeight((1 - SEV.walkW) * base);
    SEV.walk.timeScale =
      (p.vel >= 0 ? 1 : -1) * clamp(Math.abs(p.vel) / 1.55, 0.55, 1.6);
    // the mixer only rewrites a bone when its animated value changes, so put back the
    // animated pose of every bone we adjust before updating, or adjustments pile up
    if (SEV.base) for (const [b, q0] of SEV.base) b.quaternion.copy(q0);
    if (SEV.hipsPos) B.Hips.position.copy(SEV.hipsPos);
    SEV.mixer.update(dt);
    if (!SEV.base) SEV.base = new Map();
    if (!SEV.hipsPos) SEV.hipsPos = new THREE.Vector3();
    SEV.hipsPos.copy(B.Hips.position);
    for (const k of [
      "Hips",
      "Spine1",
      "Spine2",
      "LeftArm",
      "LeftForeArm",
      "LeftHand",
      "RightArm",
      "RightForeArm",
      "RightHand",
    ]) {
      const b = B[k];
      if (!SEV.base.has(b)) SEV.base.set(b, new THREE.Quaternion());
      SEV.base.get(b).copy(b.quaternion);
    }
    P.root.updateMatrixWorld(true);
    {
      // which way are the hips facing? (perpendicular to the line between the thighs)
      B.LeftUpLeg.getWorldPosition(_a);
      B.RightUpLeg.getWorldPosition(_b);
      const lx = _b.x - _a.x,
        lz = _b.z - _a.z;
      let fx = -lz,
        fz = lx;
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl;
      fz /= fl;
      const wx = -Math.sin(p.yaw),
        wz = -Math.cos(p.yaw);
      if (SEV.skillW < 0.02) SEV.fsign = fx * wx + fz * wz >= 0 ? 1 : -1;
      if (SEV.skillW > 0.01) {
        fx *= SEV.fsign;
        fz *= SEV.fsign;
        const delta = angWrap(Math.atan2(wx, wz) - Math.atan2(fx, fz));
        worldRotate(B.Hips, _q.setFromAxisAngle(UP, delta * SEV.skillW));
        B.Hips.position.x = lerp(B.Hips.position.x, SEV.hipsXZ[0], SEV.skillW);
        B.Hips.position.z = lerp(B.Hips.position.z, SEV.hipsXZ[1], SEV.skillW);
        B.Hips.updateMatrixWorld(true);
      }
    }
    const yaw = p.yaw + P.body.rotation.y;
    // breathing, torso twist and lean
    _e.set(0, 1, 0);
    worldRotate(
      B.Spine1,
      _q.setFromAxisAngle(_e, P.body.rotation.y * 0.6 * (1 - SEV.skillW)),
    );
    _e.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    worldRotate(
      B.Spine2,
      _q.setFromAxisAngle(
        _e,
        (1 - SEV.skillW) * P.body.rotation.x * 0.8 +
          Math.sin(T * 1.37) * 0.015 * (1 - SEV.walkW),
      ),
    );
    // blade arm (left): follow the combat pose once the blade is lit
    SEV.armW = damp(SEV.armW, p.ignite > 0 && !sa ? 1 : 0, sa ? 20 : 8, dt);
    const shx = P.L.sh.rotation.x,
      shz = P.L.sh.rotation.z,
      elx = P.L.el.rotation.x;
    // the blade is in his right hand: the combat pose is mirrored across his body
    const mx = (v) => {
      v.x = -v.x;
      return v;
    };
    const d1 = rotY(mx(armDir(shx, shz, V3())), yaw),
      d2 = rotY(mx(armDir(shx + elx, shz, V3())), yaw);
    aimBone(B.RightArm, B.RightForeArm, d1, SEV.armW);
    aimBone(B.RightForeArm, B.RightHand, d2, SEV.armW);
    aimBone(B.RightHand, B.RightHandMiddle1, d2, SEV.armW * 0.8);
    // grip arm (right): reach toward the victim's throat
    const pushing = p.atk && p.atk.type === "push" && p.atk.t < 0.38;
    SEV.gripW = damp(
      SEV.gripW,
      p.grip || p.liftCrate || p.doorPull || pushing ? 1 : 0,
      pushing ? 24 : 6,
      dt,
    );
    if (SEV.gripW > 0.01) {
      const s = p.grip;
      const dp = p.doorPull,
        lc = p.liftCrate;
      const tgt = s
        ? _e.set(s.pos.x, s.lift + 1.5, s.pos.z)
        : lc
          ? _e.copy(lc.pos)
          : dp
            ? _e.set(
                Math.sin(T * 37) * 0.12 * dp.pull,
                1.9 + Math.sin(T * 29) * 0.1 * dp.pull,
                dp.z,
              )
            : _e.copy(p.pos).addScaledVector(forward(p.yaw, V3()), 3).setY(1.6);
      B.LeftArm.getWorldPosition(_a);
      const dir = V3().subVectors(tgt, _a).normalize();
      aimBone(B.LeftArm, B.LeftForeArm, dir, SEV.gripW);
      aimBone(B.LeftForeArm, B.LeftHand, dir, SEV.gripW);
      const up = V3(0, 1, 0);
      const palm = V3().copy(dir).lerp(up, 0.35).normalize();
      aimBone(B.LeftHand, B.LeftHandMiddle1, palm, SEV.gripW * 0.9);
    }
    // blade sits in the left fist
    const bw = shx + elx + P.bladePivot.rotation.x,
      bz = P.bladePivot.rotation.z;
    const bd = rotY(
      V3(0, Math.cos(bw), Math.sin(bw)).applyAxisAngle(V3(0, 0, 1), -bz),
      yaw,
    ).normalize();
    // turn the fist so the hilt it holds points where the blade should (outside the attack animations, which already hold it right)
    const hw = SEV.armW * (1 - SEV.skillW);
    if (hw > 0.01 && !p.saber) {
      B.RightHand.getWorldQuaternion(_q2);
      const cur = _c2.copy(HILT.axis).applyQuaternion(_q2).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(cur, bd);
      if (hw < 1) q.slerp(QI, 1 - hw);
      worldRotate(B.RightHand, q);
    }
    // the blade always grows straight out of the hilt in his fist
    B.RightHand.updateMatrixWorld(true);
    B.RightHand.getWorldQuaternion(_q2);
    bd.copy(HILT.axis).applyQuaternion(_q2).normalize();
    const hiltMid = HILT.mid.clone().applyMatrix4(B.RightHand.matrixWorld);
    B.RightForeArm.getWorldPosition(_a);
    B.RightHand.getWorldPosition(_b);
    const fa = _d.subVectors(_b, _a).normalize();
    if (p.saber) {
      const sb = p.saber;
      _q.setFromAxisAngle(sb.axis, sb.spin).multiply(
        _q2.setFromAxisAngle(_e.set(1, 0, 0), Math.PI / 2),
      );
      bladeG.quaternion.copy(_q);
      bladeG.position
        .copy(sb.pos)
        .addScaledVector(_e.set(0, 1, 0).applyQuaternion(_q), -0.6);
      bladeG.visible = true;
      SEV.twLeft = 0;
    } else {
      bladeG.position.copy(hiltMid);
      // deflection flourish: a fast wrist twirl, the blade fanning a full circle around the forearm
      if (SEV.twLeft > 0 && p.atk) SEV.twLeft = 0;
      SEV.twW = damp(
        SEV.twW || 0,
        SEV.twLeft > 0.9 ? 1 : 0,
        SEV.twLeft > 0.9 ? 30 : 14,
        dt,
      );
      if (SEV.twLeft > 0) {
        const st = Math.min(SEV.twLeft, (dt * 2 * Math.PI) / 0.26);
        SEV.twLeft -= st;
        SEV.twAng = (SEV.twAng || 0) + st;
      }
      if (SEV.twW > 0.01 || SEV.twLeft > 0) {
        const perp = _c2.copy(bd).addScaledVector(fa, -bd.dot(fa));
        if (perp.lengthSq() < 1e-4)
          perp.set(0, 1, 0).addScaledVector(fa, -fa.y);
        perp.normalize();
        bd.lerp(perp, SEV.twW)
          .normalize()
          .applyAxisAngle(fa, (SEV.twDir || 1) * (SEV.twAng || 0));
      }
      if (!(SEV.twLeft > 0)) SEV.twAng = 0;
      bladeG.quaternion.setFromUnitVectors(UP, bd);
      bladeG.visible = p.ignite > 0;
    }
    if (SEV.mat) {
      const g = p.ignite * (0.85 + 0.15 * Math.sin(T * 2.3));
      if (SEV.mat.emissiveMap)
        SEV.mat.emissive.setRGB(2.6 * g, 0.16 * g, 0.08 * g);
      SEV.mat.envMapIntensity = 0.18 * p.ignite;
    }
  }

  /* ---- blade trail ---- */
  const TRAIL_N = 16;
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(TRAIL_N * 2 * 3),
    trailCol = new Float32Array(TRAIL_N * 2 * 3);
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
  {
    const idx = [];
    for (let i = 0; i < TRAIL_N - 1; i++) {
      const a = i * 2,
        b = a + 1,
        c = a + 2,
        d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    trailGeo.setIndex(idx);
  }
  const trail = new THREE.Mesh(
    trailGeo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  trail.frustumCulled = false;
  scene.add(trail);
  const trailSamples = [];

  /* ================= soldiers ================= */
  const G = {
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
      const o = new THREE.Mesh(geo, M.outline);
      o.scale.setScalar(1.12);
      o.visible = false;
      m.add(o);
      return [m, o];
    }
    return [m, null];
  }
