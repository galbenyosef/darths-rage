// soldiers-d — soldiers (part 4 of 4)
// Lines 3432-3757 of readable/index-inline-1.pretty.js (statement-aligned).
  function animTrooper(s, dt) {
    const R = s.T,
      B = R.B,
      A = R.A,
      st = s.st;
    if (!s.root.visible) return;
    // which motion should be playing
    const w = { alert: 0, run: 0, walk: 0, dead: 0, cower: 0, fly: 0 };
    if (!s.alive && R.flyDeath && A.fly) {
      // dropped from the grip: finish the fall and lie still
      w.fly = 1;
      if (!R.dying) {
        R.dying = true;
        A.fly.paused = false;
        A.fly.timeScale = 1.15;
      }
      R.holder.position.y = damp(
        R.holder.position.y,
        A.fly.time > 0.5 ? 0.32 : 0,
        8,
        dt,
      );
    } else if (!s.alive) {
      w.dead = 1;
      if (!R.dying) {
        R.dying = true;
        A.dead.reset();
        A.dead.paused = false;
        A.dead.play();
        R.w.dead = 1;
        for (const k in R.w) if (k !== "dead") R.w[k] *= 0.3;
      }
    } else if (st === "down" && A.fly) {
      w.fly = 1;
      if (R.knock) {
        R.knock = false;
        A.fly.reset();
        A.fly.paused = false;
        A.fly.timeScale = 1.35;
        A.fly.time = 0;
      }
      R.holder.position.y = damp(
        R.holder.position.y,
        A.fly.time > 0.5 ? 0.32 : 0,
        8,
        dt,
      );
    } else if (st === "gripped" && A.fly) {
      // held in the air: rise slowly, then hang and twitch near the top of the lift
      w.fly = 1;
      const gt = player.gripT;
      R.flyT =
        gt < 1.1
          ? 0.2 * ease(Math.min(1, gt / 1.1))
          : 0.175 +
            0.022 * Math.sin(elapsed * 7.3 + s.ph) +
            0.01 * Math.sin(elapsed * 19 + s.ph);
      A.fly.paused = true;
      A.fly.time = R.flyT;
    } else if (st === "gripped") {
      w.run = 1;
      A.run.timeScale = 1.7;
    } else if (s.moving > 2.6) {
      w.run = 1;
      A.run.timeScale = clamp(s.moving / 4.2, 0.7, 1.3);
    } else if (s.moving > 0.2) {
      w.walk = 1;
      A.walk.timeScale = clamp(s.moving / 1.3, 0.6, 1.4);
    } else w.alert = 1;
    if (!w.fly)
      R.holder.position.y =
        R.crouchW > 0.01 ? R.crouchY : damp(R.holder.position.y, 0, 6, dt);
    for (const k in w) {
      if (!A[k]) continue;
      R.w[k] = damp(R.w[k], w[k], st === "down" ? 16 : 10, dt);
      A[k].setEffectiveWeight(R.w[k]);
    }
    for (const [b, q0] of R.base) b.quaternion.copy(q0);
    R.mixer.update(dt);
    for (const n of [
      "LeftArm",
      "LeftForeArm",
      "RightArm",
      "RightForeArm",
      "Spine",
      "Spine1",
      "Spine2",
      "Neck",
      "Head",
      "LeftUpLeg",
      "RightUpLeg",
      "LeftLeg",
      "RightLeg",
    ]) {
      const b = B[n];
      if (!R.base.has(b)) R.base.set(b, new THREE.Quaternion());
      R.base.get(b).copy(b.quaternion);
    }
    s.root.updateMatrixWorld(true);
    const fwd = forward(s.root.rotation.y, scratchTroopD);
    // cowering: drop into a tight crouch, hunched over, head down
    R.crouchW = 0;
    if (B.LeftLeg && B.LeftFoot && B.RightLeg && B.RightFoot) {
      if (
        R.crouchW < 0.01 &&
        !w.fly &&
        s.alive &&
        s.moving < 0.1 &&
        s.lift < 0.01
      ) {
        const fy =
          Math.min(
            B.LeftFoot.getWorldPosition(scratchTroopA).y,
            B.RightFoot.getWorldPosition(scratchTroopB).y,
          ) -
          R.holder.position.y -
          s.root.position.y;
        R.ankleY = R.ankleY < 0 ? fy : R.ankleY * 0.95 + fy * 0.05;
      }
      if (R.crouchW > 0.01) {
        const cw = R.crouchW;
        const lat = scratchTroopC
          .subVectors(
            B.LeftUpLeg.getWorldPosition(scratchTroopA),
            B.RightUpLeg.getWorldPosition(scratchTroopB),
          )
          .setY(0)
          .normalize();
        for (const sd of ["Left", "Right"]) {
          const sg = sd === "Left" ? 1 : -1;
          aimBone(
            B[sd + "UpLeg"],
            B[sd + "Leg"],
            vec3()
              .copy(fwd)
              .multiplyScalar(0.9)
              .add(vec3(0, -0.42, 0))
              .addScaledVector(lat, 0.22 * sg)
              .normalize(),
            cw,
          );
          aimBone(
            B[sd + "Leg"],
            B[sd + "Foot"],
            vec3()
              .copy(fwd)
              .multiplyScalar(-0.5)
              .add(vec3(0, -1, 0))
              .addScaledVector(lat, 0.05 * sg)
              .normalize(),
            cw,
          );
        }
        if (B.Spine && B.Spine2)
          aimBone(
            B.Spine,
            B.Spine2,
            vec3()
              .copy(fwd)
              .multiplyScalar(0.75)
              .add(vec3(0, 1, 0))
              .normalize(),
            cw,
          );
        if (B.Spine2 && B.Neck)
          aimBone(
            B.Spine2,
            B.Neck,
            vec3()
              .copy(fwd)
              .multiplyScalar(0.95)
              .add(vec3(0, 0.8, 0))
              .normalize(),
            cw,
          );
        if (B.Neck && B.Head)
          aimBone(
            B.Neck,
            B.Head,
            vec3()
              .copy(fwd)
              .multiplyScalar(1.1)
              .add(vec3(0, 0.45, 0))
              .normalize(),
            cw,
          );
        const fy =
          Math.min(
            B.LeftFoot.getWorldPosition(scratchTroopA).y,
            B.RightFoot.getWorldPosition(scratchTroopB).y,
          ) - s.root.position.y;
        R.crouchY -=
          (fy - (R.ankleY < 0 ? 0.08 : R.ankleY)) * Math.min(1, dt * 20);
        R.crouchY = clamp(R.crouchY, -1.2, 0);
      } else R.crouchY = 0;
    }
    // arms: aim the blaster, claw at the throat, cover the head or pound the door
    let mode = null;
    if (s.alive) {
      if (st === "gripped") mode = "throat";
      else if (s.hasGun && st === "hold" && s.aware) mode = "aim";
    }
    R.aimW = damp(
      R.aimW,
      mode ? (mode === "throat" && A.fly ? 0.65 : 1) : 0,
      9,
      dt,
    );
    if (R.aimW > 0.01 && mode) {
      const aw = R.aimW;
      if (mode === "aim") {
        B.RightArm.getWorldPosition(scratchTroopA);
        const tgt = scratchTroopB.set(player.pos.x, 1.45, player.pos.z);
        const tr = s.fear > 0.5 ? (s.fear - 0.5) * 0.12 : 0;
        tgt.x += Math.sin(elapsed * 37 + s.ph) * tr;
        tgt.y += Math.sin(elapsed * 29 + s.ph) * tr;
        const d = scratchTroopC.subVectors(tgt, scratchTroopA).normalize();
        aimBone(B.RightArm, B.RightForeArm, d, aw);
        aimBone(B.RightForeArm, B.RightHand, d, aw);
        B.RightHand.getWorldPosition(scratchTroopB);
        scratchTroopB.addScaledVector(d, 0.18);
        B.LeftArm.getWorldPosition(scratchTroopA);
        const d2 = vec3().subVectors(scratchTroopB, scratchTroopA).normalize();
        aimBone(B.LeftArm, B.LeftForeArm, d2, aw * 0.9);
        B.LeftForeArm.getWorldPosition(scratchTroopA);
        aimBone(
          B.LeftForeArm,
          B.LeftHand,
          vec3().subVectors(scratchTroopB, scratchTroopA).normalize(),
          aw * 0.9,
        );
      } else if (mode === "throat") {
        B.Neck.getWorldPosition(scratchTroopB);
        scratchTroopB.addScaledVector(fwd, 0.12);
        for (const side of ["Left", "Right"]) {
          B[side + "Arm"].getWorldPosition(scratchTroopA);
          const d = vec3()
            .subVectors(scratchTroopB, scratchTroopA)
            .normalize()
            .add(vec3(0, -0.6, 0))
            .normalize();
          aimBone(B[side + "Arm"], B[side + "ForeArm"], d, aw);
          B[side + "ForeArm"].getWorldPosition(scratchTroopA);
          aimBone(
            B[side + "ForeArm"],
            B[side + "Hand"],
            vec3().subVectors(scratchTroopB, scratchTroopA).normalize(),
            aw,
          );
        }
      } else if (mode === "cover") {
        B.Head.getWorldPosition(scratchTroopB);
        scratchTroopB.y += 0.12;
        scratchTroopB.addScaledVector(fwd, 0.05);
        for (const side of ["Left", "Right"]) {
          B[side + "Arm"].getWorldPosition(scratchTroopA);
          const d = vec3().subVectors(scratchTroopB, scratchTroopA).normalize();
          d.y = Math.max(d.y, 0.2);
          d.addScaledVector(fwd, 0.4).normalize();
          aimBone(B[side + "Arm"], B[side + "ForeArm"], d, aw);
          B[side + "ForeArm"].getWorldPosition(scratchTroopA);
          aimBone(
            B[side + "ForeArm"],
            B[side + "Hand"],
            vec3().subVectors(scratchTroopB, scratchTroopA).normalize(),
            aw,
          );
        }
      } else if (mode === "pound") {
        for (const side of ["Left", "Right"]) {
          const ph = side === "Left" ? 0 : 1.7;
          B[side + "Arm"].getWorldPosition(scratchTroopA);
          const d = vec3()
            .copy(fwd)
            .add(vec3(0, 0.45 + Math.sin(elapsed * 11 + s.ph + ph) * 0.45, 0))
            .normalize();
          aimBone(B[side + "Arm"], B[side + "ForeArm"], d, aw);
          aimBone(B[side + "ForeArm"], B[side + "Hand"], d, aw);
        }
      }
    }
    for (const n of R.cuts) {
      const b = R.model.getObjectByName("mixamorig" + n);
      if (b) {
        b.scale.setScalar(0.001);
        b.updateMatrixWorld(true);
      }
    }
    for (const st of R.stumps) {
      st.life = Math.max(0, st.life - dt * 0.22);
      st.bone.getWorldPosition(st.m.position);
      st.m.scale.setScalar(Math.max(0.01, st.life));
      st.sp.position.copy(st.m.position);
      st.sp.material.opacity = st.life * 0.9;
    }
    // gun in the right fist, pointing along the forearm
    if (s.gun.visible && s.hasGun) {
      B.RightForeArm.getWorldPosition(scratchTroopA);
      B.RightHand.getWorldPosition(scratchTroopB);
      const d = scratchTroopC.subVectors(scratchTroopB, scratchTroopA).normalize();
      s.gun.position.copy(scratchTroopB).addScaledVector(d, -0.04);
      s.gun.quaternion.setFromUnitVectors(vec3(0, -1, 0), d);
    }
    B.LeftHand.getWorldPosition(s.cardHold.position);
    B.Spine2.getWorldPosition(scratchTroopA);
    s.lens.position
      .copy(scratchTroopA)
      .addScaledVector(fwd, 0.2)
      .add(vec3(0, 0.12, 0))
      .addScaledVector(vec3(-fwd.z, 0, fwd.x), -0.1);
    s.lens.lookAt(scratchTroopB.copy(s.lens.position).add(fwd));
    R.hl = damp(R.hl, s.highlight ? 1 : 0, 12, dt);
    const h = R.hl * (0.7 + 0.3 * Math.sin(elapsed * 9));
    R.mat.emissive.setRGB(0.55 * h, 0.03 * h, 0.02 * h);
    for (const o of R.model.children)
      o.traverse((m) => {
        if (m.isMesh) m.castShadow = Math.abs(s.pos.z - player.pos.z) < 12;
      });
  }
  function animSoldier(s, dt) {
    if (trooperModel.ready && s.T) {
      animTrooper(s, dt);
      s.root.position.y = 0;
    } else poseSoldier(s, dt);
  }

