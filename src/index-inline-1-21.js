// index-inline-1 21 — pos
// Lines 5308-5622 of readable/index-inline-1.pretty.js (statement-aligned).
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
          .add(V3(rnd(-12, 12), rnd(2, 9), rnd(-2, 2)));
        b.own = "x";
        b.g.quaternion.setFromUnitVectors(UP, tmpV2.copy(b.v).normalize());
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
    P.bladeMid.getWorldPosition(tmpV);
    p.saber = {
      t: 0,
      phase: "out",
      start: V3(tmpV.x, 1.3, tmpV.z),
      pos: V3(tmpV.x, 1.3, tmpV.z),
      fwd: fwdV.clone(),
      right: rightV.clone(),
      spin: 0,
      hit: new Set(),
      curve: Math.random() < 0.5 ? -1 : 1,
      speed: 0,
      axis: V3(0, 1, 0)
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
        ? SEV.B.RightHand.getWorldPosition(V3())
        : V3(p.pos.x, 1.2, p.pos.z);
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
    const xl = (sb.pos.z > CEND ? CW / 2 : BW / 2) - 0.55;
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
          kill(s, "blade", V3(dx, 0, dz).normalize(), pt.clone(), "Spine");
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
  function doorHit(d, point) {
    // the blade only scars a blast door now; it has to be torn out with the Force
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, rnd(0.6, 1.3), 0.03),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(4, 1.8, 0.5),
        toneMapped: false,
      }),
    );
    m.position.set(clamp(point.x, -0.6, 0.6), clamp(point.y, 0.4, 2.2), 0.13);
    m.rotation.z = rnd(-1, 1);
    d.slab.add(m);
    d.scars.push({ m, t: 0 });
    d.heat = Math.min(1, d.heat + 0.25);
    tmpV.set(m.position.x, point.y, d.z + 0.2);
    burst(tmpV, 24, "r", V3(0, 0.3, 1), 5);
    smoke(tmpV, 1, 0.4);
    doorLight.position.set(m.position.x, point.y, d.z + 0.7);
    sfx.doorHit();
    shake = Math.max(shake, 0.25);
    hitKick = Math.max(hitKick, 0.6);
    hitStop = reduce ? 0.02 : 0.04;
    hintShown.doorCut = true;
  }
  function doorDown(d) {
    stats.doors++;
    const ps = secOf(player.pos.z);
    for (const s of soldiers) {
      if (s.alive && !s.gone && secOf(s.pos.z) === ps + 1) {
        s.fear += 0.35;
        if (s.st === "stare" || s.st === "wait" || s.st === "idle") {
          s.st = "hold";
        }
      }
    }
  }
  function ripDoor(d) {
    const p = player;
    d.state = "ripped";
    d.t = 0;
    d.pull = 1;
    d.rip = {
      side: Math.random() < 0.5 ? -1 : 1,
      mz: d.z + clamp((p.pos.z - d.z) * 0.4, 0.4, 1.7),
      hit: false,
      q0: d.pivot.quaternion.clone(),
    };
    d.slab.position.set(0, 0, 0);
    d.slab.rotation.set(0, 0, 0);
    sfx.doorRip();
    shake = Math.max(shake, 1.8);
    hitKick = 1;
    flashV = Math.max(flashV, 0.5);
    hitStop = reduce ? 0.03 : 0.1;
    for (let i = 0; i < 8; i++) {
      const x = i < 4 ? -DW / 2 : DW / 2;
      tmpV.set(x, rnd(0.2, DH - 0.2), d.z);
      burst(tmpV, 26, "r", V3(-Math.sign(x) * 0.4, 0.2, 1), 7);
      smoke(tmpV, 2, 1.2);
    }
    tmpV.set(0, DH, d.z);
    burst(tmpV, 40, "w", V3(0, -0.3, 1), 6);
    smoke(tmpV, 4, 1.4);
    doorDown(d);
  }
  function closeDoor(d) {
    d.state = "closing";
    d.t = 0;
    sfx.doorClose(panOf(tmpV.set(0, 2, d.z)));
    for (const s of soldiers) {
      if (!s.alive || s.gone) continue;
      if (Math.abs(s.pos.z - d.z) < 0.9) {
        s.pos.z = s.pos.z > d.z ? d.z + 0.9 : d.z - 0.9;
      }
      if (
        s.pos.z > d.z &&
        secOf(s.pos.z) === secOf(player.pos.z) &&
        s.pos.z - d.z < 14
      ) {
        speak(s, "trapped", true);
      }
    }
  }

  /* ================= poses ================= */
  function setRot(o, x, y, z, k, dt) {
    o.rotation.x = damp(o.rotation.x, x, k, dt);
    o.rotation.y = damp(o.rotation.y, y, k, dt);
    o.rotation.z = damp(o.rotation.z, z, k, dt);
  }
