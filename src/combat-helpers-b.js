// combat-helpers-b — combat helpers (part 2 of 3)
// Lines 5186-5532 of readable/index-inline-1.pretty.js (statement-aligned).
  function kill(s, how, dirV, hitPt, forceCut) {
    if (!s.alive) return;
    const wasDown = s.st === "down";
    if (wasDown && s.T) s.T.flyDeath = true;
    if (s.hasCard) dropCard(s);
    if (player.grip === s) {
      player.grip = null;
      player.gripCd = 3;
      sfx.gripStop();
    }
    s.alive = false;
    s.st = "dead";
    s.deadT = 0;
    stats.kills++;
    speak(s, "dying", true);
    for (const o of s.outl) o.visible = false;
    s.highlight = false;
    s.lens.material.color.setRGB(0, 0, 0);
    chest(s, tmpV);
    const away = dirV || tmpV2.copy(s.pos).sub(player.pos).setY(0).normalize();
    if (how === "blade") {
      if (elapsed - lastSlowT > 1.1 && !reduce) {
        slowMo = SLOWMO_LEN;
        lastSlowT = elapsed;
      } else hitStop = reduce ? 0.03 : 0.06;
      shake = Math.max(shake, 0.5);
      flashV = 0.6;
      hitKick = 1;
      const r = Math.random();
      let cut = false;
      if (trooperModel.ready && s.T && trooperModel.limbs) {
        // vary the outcome: cut in half, head off, or whatever the blade actually caught
        const pickCut = () => {
          const q = Math.random();
          if (q < 0.28) return "Spine";
          if (q < 0.52) return "Neck";
          const at = !wasDown && hitPt ? limbAt(s, hitPt) : null;
          return (
            at ||
            pick([
              "RightArm",
              "LeftArm",
              "RightForeArm",
              "LeftForeArm",
              "RightUpLeg",
              "LeftUpLeg",
              "RightLeg",
              "LeftLeg",
            ])
          );
        };
        let c = forceCut || pickCut();
        if (!forceCut && c === trooperModel.lastCut) c = pickCut();
        trooperModel.lastCut = c;
        cut = severLimb(s, c, away);
        if (cut && (c === "Neck" || c === "Spine"))
          speeches = speeches.filter((x) => x.s !== s);
        if (c === "Spine" && cut) {
          burst(tmpV.copy(s.pos).setY(1.0), 50, "r", away, 6);
          smoke(tmpV, 4, 0.9);
        }
        if (!cut) {
          if (s.hasGun && Math.random() < 0.5) sliceGun(s, away);
          else dropGun(s);
        }
      } else if (r < 0.62) severArm(s, away);
      else if (r < 0.88 && s.hasGun) sliceGun(s, away);
      else dropGun(s);
      burst(tmpV, 40, "r", away, 7);
      smoke(tmpV, 4, 0.7);
      sfx.cut(panOf(tmpV));
    } else if (how === "bolt") {
      burst(tmpV, 16, "b", away, 5);
      dropGun(s);
      sfx.boltHit(panOf(tmpV));
    } else if (how === "grip") {
      sfx.crunch();
      shake = Math.max(shake, 0.9);
      flashV = Math.max(flashV, 0.35);
      hitKick = Math.max(hitKick, 0.8);
      dropGun(s);
      if (s.T) s.T.flyDeath = true;
      const th = tmpV2.copy(s.pos).sub(player.pos).setY(0);
      if (th.lengthSq() < 1e-4) forward(player.yaw, th);
      const r = Math.random(),
        ang = r < 0.4 ? rnd(-0.25, 0.25) : (r < 0.7 ? 1 : -1) * rnd(0.75, 1.2); // straight back, or flung off to the left or right
      s.kv = rotY(th.clone().normalize(), ang).multiplyScalar(rnd(5.5, 6.5));
      s.thrown = new Set();
    } else if (how === "crate") {
      sfx.crunch();
      shake = Math.max(shake, 0.75);
      flashV = Math.max(flashV, 0.3);
      hitKick = Math.max(hitKick, 0.8);
      dropGun(s);
      if (s.T) s.T.flyDeath = true;
      burst(tmpV, 22, "w", away, 5);
      smoke(tmpV, 3, 0.8);
      s.kv = away.clone().setY(0).normalize().multiplyScalar(rnd(6.5, 8.5));
      s.thrown = new Set();
    }
    for (const e of soldiers) {
      if (e !== s && e.alive && !e.gone && e.pos.distanceTo(s.pos) < 9) {
        e.fear += 0.3;
        if (Math.random() < 0.35) speak(e, "brk");
      }
    }
  }
  const pushRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.8, 56),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.1, 1.2, 1.5),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  pushRing.visible = false;
  scene.add(pushRing);
  const pushFx = { t: -1, origin: vec3(), dir: vec3() };
  function doPush() {
    const p = player;
    forward(p.yaw, fwdV);
    rightV.set(-fwdV.z, 0, fwdV.x);
    shake = Math.max(shake, 0.75);
    flashV = Math.max(flashV, 0.3);
    sfx.push();
    pushFx.t = 0;
    pushFx.origin.copy(p.pos).addScaledVector(fwdV, 0.9).setY(1.35);
    pushFx.dir.copy(fwdV);
    pushRing.visible = true;
    let n = 0;
    for (const s of soldiers) {
      if (!s.alive || s.gone || s.st === "gripped") continue;
      tmpV.copy(s.pos).sub(p.pos);
      const along = tmpV.dot(fwdV),
        lat = tmpV.dot(rightV);
      if (
        along > 0.3 &&
        along < 8.5 &&
        Math.abs(Math.atan2(lat, along)) < 0.62 &&
        pathOpen(s.pos.z, p.pos.z)
      ) {
        const k = 1 - along / 9;
        knockDown(
          s,
          tmpV
            .clone()
            .setY(0)
            .normalize()
            .multiplyScalar(3.5 + 6 * k),
        );
        n++;
      }
    }
    for (const b of bolts) {
      if (!b.alive) continue;
      tmpV.copy(b.g.position).sub(p.pos);
      const along = tmpV.dot(fwdV);
      if (
        along > 0 &&
        along < 9 &&
        Math.abs(tmpV.dot(rightV)) < along * 0.8 + 0.6
      ) {
        b.v
          .copy(fwdV)
          .multiplyScalar(60)
          .add(vec3(rnd(-12, 12), rnd(2, 9), rnd(-2, 2)));
        b.own = "x";
        b.g.quaternion.setFromUnitVectors(upAxis, tmpV2.copy(b.v).normalize());
      }
    }
    for (let i = 0; i < 6; i++)
      smoke(
        tmpV
          .copy(p.pos)
          .addScaledVector(fwdV, 1.4 + i * 1.15)
          .setY(0.25),
        2,
        0.9,
      );
    if (n)
      for (const e of soldiers)
        if (
          e.alive &&
          !e.gone &&
          e.st !== "down" &&
          e.pos.distanceTo(p.pos) < 16
        ) {
          e.fear += 0.25;
          if (Math.random() < 0.3) speak(e, "witness");
        }
  }
  function knockDown(s, vel) {
    if (s.hasCard) dropCard(s);
    if (s.hasGun && Math.random() < 0.6) dropGun(s);
    s.st = "down";
    s.downT = rnd(3.5, 5.5);
    s.kv = vel.clone();
    s.fear = 1.25;
    s.aware = true;
    s.moving = 0;
    if (s.T) s.T.knock = true;
    speak(s, "knocked", true);
  }
  /* ---- thrown blade: spins out ahead like a boomerang, cuts through anyone in its path, then returns to his hand ---- */
  function throwSaber() {
    const p = player;
    forward(p.yaw, fwdV);
    rightV.set(-fwdV.z, 0, fwdV.x);
    sevraneParts.bladeMid.getWorldPosition(tmpV);
    p.saber = {
      t: 0,
      phase: "out",
      start: vec3(tmpV.x, 1.3, tmpV.z),
      pos: vec3(tmpV.x, 1.3, tmpV.z),
      fwd: fwdV.clone(),
      right: rightV.clone(),
      spin: 0,
      hit: new Set(),
      curve: Math.random() < 0.5 ? -1 : 1,
      speed: 0,
      axis: vec3(0, 1, 0)
        .applyAxisAngle(fwdV.clone(), rnd(-0.3, 0.3))
        .normalize(),
    };
    p.pushCd = PUSH_CD;
    p.swingQ = 0;
    sfx.saberOut();
    hintShown.push = true;
    hintShown.swing = true;
    shake = Math.max(shake, 0.25);
    hitKick = Math.max(hitKick, 0.3);
  }
  function updateSaber(dt) {
    const p = player,
      sb = p.saber;
    sb.t += dt;
    sb.spin += dt * 24;
    const prev = sb.pos.clone();
    if (sb.phase === "out") {
      const T1 = 0.42,
        u = Math.min(1, sb.t / T1),
        e = 1 - (1 - u) * (1 - u);
      sb.pos
        .copy(sb.start)
        .addScaledVector(sb.fwd, SABER_DIST * e)
        .addScaledVector(sb.right, sb.curve * Math.sin(Math.PI * u) * 0.9);
      sb.pos.y = 1.3 + Math.sin(Math.PI * u) * 0.15;
      for (const d of doors) {
        if (!doorBlocks(d) && !bulkheadHit(sb.pos.x, sb.pos.y, 0.15)) continue;
        if (sb.start.z > d.z && sb.pos.z < d.z + 0.45) {
          sb.pos.z = d.z + 0.45;
          doorHit(d, sb.pos.clone().setZ(d.z));
          sb.phase = "back";
          sb.speed = 8;
        }
      }
      if (u >= 1 && sb.phase === "out") {
        sb.phase = "back";
        sb.speed = 4;
      }
    } else {
      const hand = SEV.ready
        ? SEV.B.RightHand.getWorldPosition(vec3())
        : vec3(p.pos.x, 1.2, p.pos.z);
      const to = hand.sub(sb.pos);
      const L = to.length();
      sb.speed = Math.min(22, sb.speed + dt * 40);
      if (L < 0.4 || sb.t > 3) {
        p.saber = null;
        sfx.saberStop();
        sfx.clank();
        shake = Math.max(shake, 0.2);
        hitKick = Math.max(hitKick, 0.35);
        return;
      }
      sb.pos.addScaledVector(to.normalize(), Math.min(L, sb.speed * dt));
    }
    const xl = (sb.pos.z > CEND ? CORRIDOR_W / 2 : BAY_W / 2) - 0.55;
    sb.pos.x = clamp(sb.pos.x, -xl, xl);
    // anyone the spinning blade passes through is cut in half
    for (let k = 1; k <= 3; k++) {
      const pt = prev.clone().lerp(sb.pos, k / 3);
      for (const s of soldiers) {
        if (!s.alive || s.gone || s.st === "gripped" || sb.hit.has(s)) continue;
        const dx = s.pos.x - pt.x,
          dz = s.pos.z - pt.z;
        if (
          dx * dx + dz * dz < 0.62 &&
          pt.y > s.lift + 0.3 &&
          pt.y < s.lift + 1.9
        ) {
          sb.hit.add(s);
          kill(s, "blade", vec3(dx, 0, dz).normalize(), pt.clone(), "Spine");
        }
      }
    }
  }
  function hurt(b) {
    const p = player;
    if (mode !== "play") return;
    p.health -= HIT_DMG;
    p.hurtT = 0;
    p.resolve -= 7;
    if (p.health <= 0) {
      p.health = 0;
      die();
    }
    {
      const hp = b.g.position.clone();
      const dx = hp.x - p.pos.x,
        dz = hp.z - p.pos.z,
        dl = Math.hypot(dx, dz) || 1;
      hp.x = p.pos.x + (dx / dl) * 0.32;
      hp.z = p.pos.z + (dz / dl) * 0.32;
      hp.y = clamp(hp.y, 0.7, 1.9);
      const back = b.v.clone().normalize().negate();
      impactFlash(hp, [1.2, 4, 1.1], 0.55, 0.1);
      impactFlash(hp, [3, 3, 2.4], 0.22, 0.06);
      burst(hp, 22, "b", back, 5);
      smoke(hp, 1, 0.35);
    }
    sfx.clank();
    shake = Math.max(shake, 0.18);
    hurtV = 0.7;
    if (p.resolve <= 0) {
      p.stagger = 0.5;
      p.resolve = 60;
      if (p.doorPull) {
        p.doorPull = null;
        sfx.gripStop();
        sfx.stressStop();
      }
      if (p.grip) {
        const s = p.grip;
        p.grip = null;
        p.gripCd = 1.6;
        sfx.gripStop();
        stats.lifted++;
        kill(s, "grip");
      }
      p.atk = null;
    }
  }
