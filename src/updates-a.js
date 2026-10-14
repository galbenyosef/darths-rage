// updates-a — updates (part 1 of 4)
// Lines 5948-6379 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= updates ================= */
  function updatePlayer(dt) {
    const p = player;
    if (p.gripCd > 0) p.gripCd -= dt;
    if (p.stagger > 0) p.stagger -= dt;
    p.hurtT = (p.hurtT || 0) + dt;
    if (p.hurtT > 1.5) p.resolve = Math.min(100, p.resolve + dt * 8);
    if (p.hurtT > 1.2) p.health = Math.min(100, p.health + dt * 14);
    if (p.health <= 0 && mode === "play") die();
    forward(p.yaw, fwdV);
    const canAct =
      !p.grip && !p.liftCrate && !p.doorPull && p.stagger <= 0 && p.ignite >= 1;
    const turn = (key.left ? 1 : 0) - (key.right ? 1 : 0);
    p.yaw +=
      turn *
      1.75 *
      dt *
      (p.doorPull ? 0.12 : p.grip ? 0.35 : p.liftCrate ? 0.6 : p.atk ? 0.4 : 1);
    forward(p.yaw, fwdV);
    rightV.set(-fwdV.z, 0, fwdV.x);
    const mv = (key.up ? 1 : 0) - (key.down ? 1 : 0);
    let sp = mv > 0 ? 2.15 : 1.4;
    if (p.block) sp *= 0.5;
    if (p.atk) sp *= p.atk.type === "swing" ? 0.75 : 0.4;
    if (p.stagger > 0) sp *= 0.6;
    if (p.liftCrate) sp *= 0.45;
    if (p.grip || p.doorPull) sp = 0;
    p.vel = mv * sp;
    let nx = p.pos.x + fwdV.x * p.vel * dt,
      nz = p.pos.z + fwdV.z * p.vel * dt;
    if (p.lunge > 0) {
      const l = Math.min(p.lunge, dt * 3);
      nx += fwdV.x * l;
      nz += fwdV.z * l;
      p.lunge -= l;
    }
    nz = Math.min(nz, ZSTART - 0.7);
    for (const d of doors) {
      if (doorBlocks(d) && p.pos.z >= d.z) nz = Math.max(nz, d.z + 0.85);
    }
    nz = Math.max(nz, BZ1 + 1.4);
    const xl = nz > CEND + 0.3 ? CORRIDOR_W / 2 - 0.5 : BAY_W / 2 - 0.6;
    nx = clamp(nx, -xl, xl);
    if (nz <= CEND + 0.3 && p.pos.z > CEND + 0.3 && Math.abs(nx) > CORRIDOR_W / 2 - 0.5)
      nz = CEND + 0.31;
    nx = doorFunnel(nx, nz, 0.32);
    p.pos.x = nx;
    p.pos.z = nz;
    if (mv > 0 && sp > 0 && p.ignite >= 1 && !p.stepped) {
      p.stepped = true;
      for (const s of soldiers)
        if (s.aware) s.cd = Math.min(s.cd, rnd(0.3, 1.2));
    }
    if (mv && sp > 0) {
      p.walkPh += dt * Math.abs(p.vel) * 2.8;
      p.stepAcc += dt * Math.abs(p.vel);
      if (p.stepAcc > 0.95) {
        p.stepAcc = 0;
        sfx.step();
        shake = Math.max(shake, reduce ? 0 : 0.06);
      }
    }
    // attacks
    if (inputLatch.swing && !p.grip && p.ignite >= 1)
      p.swingQ = Math.min(3, (p.swingQ || 0) + 1);
    if (p.swingQ > 0 && canAct && !p.atk && !p.saber) {
      p.swingQ--;
      if (SEV.ready && SEV.attacks) {
        let i = (SEV.atkI + 1) % ATTACKS.length;
        for (let k = 0; k < 3 && !SEV.attacks[i]; k++)
          i = (i + 1) % ATTACKS.length;
        SEV.atkI = i;
        const c = ATTACKS[i];
        const d = (c.to - c.from) / c.speed,
          nt = (t) => (t - c.from) / (c.to - c.from);
        p.atk = {
          type: "swing",
          anim: i,
          t: 0,
          dur: d,
          hit: new Set(),
          door: false,
          wins: c.wins.map((w) => [nt(w[0]), nt(w[1])]),
          w0: nt(c.wins[0][0]),
          w1: nt(c.wins[0][1]),
          snd: c.snd.map(nt),
          sndI: 0,
        };
      } else
        p.atk = {
          type: "swing",
          t: 0,
          dur: 0.6,
          hit: new Set(),
          door: false,
          w0: 0.43,
          w1: 0.62,
        };
      if (!p.atk.snd) sfx.swing();
      hintShown.swing = true;
    }
    if (p.pushCd > 0) p.pushCd -= dt;
    if (inputLatch.jab && canAct && !p.atk && !p.saber && p.pushCd <= 0) throwSaber();
    if (p.saber) updateSaber(dt);
    if (p.atk) {
      const a = p.atk;
      a.t += dt;
      const tt = a.t / a.dur;
      if (a.type === "push" && !a.fired && a.t >= 0.12) {
        a.fired = true;
        doPush();
      }
      if (a.snd && a.sndI < a.snd.length && tt >= a.snd[a.sndI]) {
        a.sndI++;
        sfx.swing();
      }
      const inWin = a.wins
        ? a.wins.some((w) => tt >= w[0] && tt <= w[1])
        : tt >= a.w0 && tt <= a.w1;
      if (inWin) {
        let best = null,
          bd = 9;
        for (const s of soldiers) {
          if (!s.alive || s.gone || a.hit.has(s) || s.lift > 0.6) continue;
          tmpV.copy(s.pos).sub(p.pos);
          const along = tmpV.dot(fwdV),
            lat = tmpV.dot(rightV);
          if (a.type === "swing") {
            if (
              along > 0.1 &&
              along < 2.9 &&
              Math.abs(Math.atan2(lat, along)) < 1.25 &&
              pathOpen(s.pos.z, p.pos.z)
            ) {
              a.hit.add(s);
              kill(
                s,
                "blade",
                tmpV.clone().setY(0).normalize(),
                bladeContact(s),
              );
            }
          } else if (
            along > 0.1 &&
            along < 3.2 &&
            Math.abs(Math.atan2(lat, along)) < 0.4 &&
            along < bd &&
            pathOpen(s.pos.z, p.pos.z)
          ) {
            bd = along;
            best = s;
          }
        }
        if (best) {
          a.hit.add(best);
          kill(best, "blade", fwdV.clone(), bladeContact(best));
        }
        if (!a.door) {
          for (const d of doors) {
            if (d.state !== "closed") continue;
            const dz = p.pos.z - d.z;
            if (dz > 0.4 && dz < 2.9 && fwdV.z < -0.55) {
              a.door = true;
              sevraneParts.bladeTip.getWorldPosition(tmpV);
              doorHit(d, tmpV.clone().setY(clamp(tmpV.y, 0.8, 3)));
              break;
            }
          }
        }
      }
      if (a.t >= a.dur) p.atk = null;
    }
    p.block =
      key.a &&
      !p.atk &&
      !p.saber &&
      !p.grip &&
      !p.liftCrate &&
      p.stagger <= 0 &&
      p.ignite >= 1;
    // grip
    gripCand = null;
    if (!p.grip && p.ignite >= 1) {
      let bd = 1e9;
      for (const s of soldiers) {
        if (!s.alive || s.gone || s.st === "gripped") continue;
        tmpV.copy(s.pos).sub(p.pos);
        const along = tmpV.dot(fwdV),
          lat = tmpV.dot(rightV);
        if (
          along > 0.8 &&
          along < 9 &&
          Math.abs(Math.atan2(lat, along)) < 0.55 &&
          pathOpen(s.pos.z, p.pos.z)
        ) {
          const sc = along + Math.abs(lat) * 2;
          if (sc < bd) {
            bd = sc;
            gripCand = s;
          }
        }
      }
    }
    // a closed blast door ahead can be torn off its hinges with the Force
    doorCand = null;
    if (!p.grip && p.ignite >= 1 && fwdV.z < -0.5 && Math.abs(p.pos.x) < 2.6) {
      for (const d of doors) {
        if (d.state !== "closed") continue;
        const dz = p.pos.z - d.z;
        if (dz > 0.6 && dz < 9.5) {
          doorCand = d;
          break;
        }
      }
    }
    if (
      doorCand &&
      gripCand &&
      p.pos.z - gripCand.pos.z < p.pos.z - doorCand.z - 0.5 &&
      !p.doorPull
    )
      doorCand = null;
    // crates: lift whichever is the better target, a crate or a guard
    crateCand = null;
    if (!p.grip && !p.liftCrate && !p.doorPull && p.ignite >= 1) {
      let cb = 1e9;
      for (const c of crates) {
        if (c.state !== "rest" || c.lost) continue;
        tmpV.copy(c.pos).sub(p.pos);
        const along = tmpV.dot(fwdV),
          lat = tmpV.dot(rightV);
        if (
          along > 0.6 &&
          along < 9 &&
          Math.abs(Math.atan2(lat, along)) < 0.7 &&
          pathOpen(c.pos.z, p.pos.z)
        ) {
          const sc = along + Math.abs(lat) * 1.2 - c.pos.y * 0.3;
          if (sc < cb) {
            cb = sc;
            crateCand = c;
          }
        }
      }
      if (crateCand && gripCand) {
        tmpV.copy(gripCand.pos).sub(p.pos);
        const sg = tmpV.dot(fwdV) + Math.abs(tmpV.dot(rightV)) * 2;
        if (sg < cb) crateCand = null;
        else gripCand = null;
      }
      if (doorCand) crateCand = null;
    }
    if (doorCand || p.doorPull) gripCand = null;
    if (
      key.f &&
      !p.grip &&
      !p.liftCrate &&
      !p.doorPull &&
      canAct &&
      !p.atk &&
      p.gripCd <= 0 &&
      crateCand
    ) {
      p.liftCrate = crateCand;
      crateCand.state = "held";
      p.gripT = 0;
      crateCand.av.set(rnd(-0.6, 0.6), rnd(0.6, 1.2), rnd(-0.5, 0.5));
      hintShown.crate = true;
      hintShown.grip = true;
      sfx.gripStart();
      crateCand = null;
    }
    if (p.liftCrate) {
      const c = p.liftCrate;
      p.gripT += dt;
      const e = ease(Math.min(1, p.gripT / 0.8));
      const tgt = tmpV.copy(p.pos).addScaledVector(fwdV, 2.3);
      tgt.y = lerp(crateHalf.hy, 1.8, e) + Math.sin(elapsed * 2.6) * 0.06;
      const tr = 0.012 + 0.02 * Math.min(1, p.gripT / 1.5);
      c.pos.x = damp(c.pos.x, tgt.x, 4, dt) + rnd(-tr, tr);
      c.pos.y = damp(c.pos.y, tgt.y, 5, dt) + rnd(-tr, tr);
      c.pos.z = damp(c.pos.z, tgt.z, 4, dt) + rnd(-tr, tr);
      scratchQuat.setFromAxisAngle(scratchVecE.copy(c.av).normalize(), c.av.length() * dt * 0.5);
      c.q.premultiply(scratchQuat);
      shake = Math.max(
        shake,
        (reduce ? 0.3 : 1) * (0.14 + 0.22 * Math.min(1, p.gripT / 1.2)),
      );
      if (!key.f || p.stagger > 0) {
        // hurl it down the corridor, steering toward the nearest guard ahead
        let aim = fwdV.clone();
        let best = null,
          bd = 1e9;
        for (const s of soldiers) {
          if (!s.alive || s.gone) continue;
          tmpV2.copy(s.pos).sub(c.pos).setY(0);
          const d = tmpV2.length();
          if (d < 1 || d > 26) continue;
          const a = tmpV2.normalize().dot(fwdV);
          if (a > 0.9 && pathOpen(s.pos.z, p.pos.z) && d < bd) {
            bd = d;
            best = s;
          }
        }
        if (best)
          aim = vec3(best.pos.x - c.pos.x, 0, best.pos.z - c.pos.z).normalize();
        const pw = p.stagger > 0 ? 0.3 : clamp(0.55 + p.gripT * 0.6, 0.55, 1);
        c.v.copy(aim).multiplyScalar(26 * pw);
        c.v.y = 0.9;
        c.av.set(rnd(-6, 6), rnd(-4, 4), rnd(-6, 6));
        c.state = "flying";
        c.out = false;
        c.hits = 0;
        p.liftCrate = null;
        p.gripCd = 0.45;
        sfx.gripStop();
        sfx.push();
        shake = Math.max(shake, 0.55);
        hitKick = Math.max(hitKick, 0.6);
        stats.lifted++;
      }
    }
    if (
      key.f &&
      !p.grip &&
      !p.doorPull &&
      canAct &&
      !p.atk &&
      p.gripCd <= 0 &&
      doorCand
    ) {
      p.doorPull = doorCand;
      p.doorPull.strainT = 0;
      hintShown.pull = true;
      sfx.gripStart();
      sfx.stressStart();
      gripCand = null;
    }
    if (p.doorPull) {
      const d = p.doorPull;
      if (!key.f || d.state !== "closed" || p.stagger > 0) {
        p.doorPull = null;
        p.gripCd = 0.35;
        sfx.gripStop();
        sfx.stressStop();
      } else {
        d.pull = Math.min(1, d.pull + dt / d.need);
        const k = d.pull;
        const v = reduce ? 0.35 : 1;
        shake = Math.max(shake, v * (0.55 + 1.15 * k));
        if (Math.random() < dt * (2.5 + 9 * k))
          hitKick = Math.max(hitKick, v * (0.45 + 0.55 * k));
        d.strainT -= dt;
        if (d.strainT <= 0) {
          d.strainT = rnd(0.18, 0.5) * (1.2 - k * 0.6);
          sfx.doorStrain(k);
          const x = Math.random() < 0.5 ? -DOOR_W / 2 : DOOR_W / 2;
          tmpV.set(x, rnd(0.3, DOOR_H - 0.2), d.z + 0.3);
          burst(
            tmpV,
            Math.round(6 + 20 * k),
            "r",
            vec3(-Math.sign(x) * 0.5, rnd(-0.2, 0.6), 0.8),
            3 + 4 * k,
          );
          if (Math.random() < 0.6) {
            tmpV.set(rnd(-DOOR_W / 2, DOOR_W / 2), DOOR_H, d.z + 0.3);
            smoke(tmpV, 1, 0.5 + 0.8 * k);
          }
        }
        d.heat = Math.max(d.heat, 0.15 + 0.5 * k);
        if (d.pull >= 1) {
          p.doorPull = null;
          p.gripCd = 0.8;
          sfx.gripStop();
          sfx.stressStop();
          ripDoor(d);
        }
      }
    }
    if (
      key.f &&
      !p.grip &&
      !p.doorPull &&
      canAct &&
      !p.atk &&
      p.gripCd <= 0 &&
      gripCand &&
      !doorCand
    ) {
      const s = gripCand;
      p.grip = s;
      p.gripT = 0;
      s.st = "gripped";
      hintShown.grip = true;
      if (s.hasCard) dropCard(s);
      dropGun(s);
      speak(s, "gripped", true);
      sfx.gripStart();
      for (const e of soldiers) {
        if (e !== s && e.alive && !e.gone && e.pos.distanceTo(s.pos) < 10) {
          e.fear += 0.45;
          if (Math.random() < 0.5) speak(e, "witness");
        }
      }
    }
    if (p.grip) {
      const s = p.grip;
      p.gripT += dt;
      s.lift = Math.min(1.45, ease(Math.min(1, p.gripT / 0.9)) * 1.45);
      s.yaw = Math.atan2(-(p.pos.x - s.pos.x), -(p.pos.z - s.pos.z));
      if (Math.random() < dt * 1.2) speak(s, "gripped");
      shake = Math.max(
        shake,
        (reduce ? 0.3 : 1) * (0.16 + 0.24 * Math.min(1, p.gripT / 1.2)),
      );
      if (p.gripT >= GRIP_MAX || !key.f) {
        p.grip = null;
        p.gripCd = 1.6;
        sfx.gripStop();
        stats.lifted++;
        kill(s, "grip");
      }
    }
    for (const s of soldiers) {
      const on =
        (s === gripCand && p.gripCd <= 0 && !p.grip && s.alive) || p.grip === s;
      s.highlight = on;
      for (const o of s.outl) o.visible = on && !trooperModel.ready;
    }
  }

