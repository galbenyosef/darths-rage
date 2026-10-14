// index-inline-1 24 — pos
// Lines 6380-6688 of readable/index-inline-1.pretty.js (statement-aligned).
  function updateSoldiers(dt) {
    const p = player,
      ps = secOf(p.pos.z);
    for (const s of soldiers) {
      if (s.gone) continue;
      s.speakCd -= dt;
      s.flinch = Math.max(0, s.flinch - dt);
      const far = Math.abs(s.pos.z - camera.position.z) > 48;
      s.root.visible = !far;
      if (!s.alive && s.kv) {
        const sp = s.kv.length();
        let nx = s.pos.x + s.kv.x * dt,
          nz = s.pos.z + s.kv.z * dt;
        for (const d of doors) {
          if (!doorBlocks(d)) continue;
          if (s.pos.z > d.z && nz < d.z + 0.6) nz = d.z + 0.6;
          if (s.pos.z < d.z && nz > d.z - 0.6) nz = d.z - 0.6;
        }
        const xl = nz > CEND ? CW / 2 - 0.45 : BW / 2 - 0.6;
        if (Math.abs(nx) > xl) {
          if (Math.abs(s.kv.x) > 1.5) {
            // slammed into the wall
            tmpV.set(Math.sign(nx) * (xl + 0.3), 1.0, nz);
            smoke(tmpV, 3, 0.8);
            burst(tmpV, 12, "w", V3(-Math.sign(nx), 0.5, 0), 3);
            sfx.crunch();
            shake = Math.max(shake, 0.45);
            hitKick = Math.max(hitKick, 0.5);
          }
          nx = Math.sign(nx) * xl;
          s.kv.x *= -0.3;
        }
        s.pos.x = doorFunnel(nx, nz, 0.25);
        s.pos.z = Math.min(nz, ZSTART - 0.8);
        s.kv.multiplyScalar(Math.exp(-2.6 * dt));
        if (sp > 2.2 && s.thrown)
          for (const o of soldiers) {
            if (
              o === s ||
              !o.alive ||
              o.gone ||
              o.st === "down" ||
              o.st === "gripped" ||
              s.thrown.has(o)
            )
              continue;
            if (Math.hypot(o.pos.x - s.pos.x, o.pos.z - s.pos.z) < 0.75) {
              s.thrown.add(o);
              knockDown(o, s.kv.clone().multiplyScalar(0.7));
            }
          }
        if (sp < 0.05) s.kv = null;
      }
      if (!s.alive) {
        s.deadT += dt;
        s.lift = Math.max(0, s.lift - dt * 4);
        const e = ease(clamp(s.deadT / 0.55, 0, 1));
        s.fall.rotation.x = TR.ready ? 0 : e * 1.42;
        s.root.position.y = s.lift;
        animSoldier(s, dt);
        continue;
      }
      if (s.st === "gripped") {
        s.root.position.y = s.lift;
        s.root.rotation.y = s.yaw;
        animSoldier(s, dt);
        continue;
      }
      if (s.lift > 0) s.lift = Math.max(0, s.lift - dt * 4);
      s.root.position.y = s.lift;
      const dx = p.pos.x - s.pos.x,
        dz = p.pos.z - s.pos.z,
        dist = Math.hypot(dx, dz);
      const ss = secOf(s.pos.z),
        open = pathOpen(s.pos.z, p.pos.z);
      if (!s.aware && p.ignite >= 1 && open && dist < 22) {
        s.aware = true;
        if (s.st === "idle") s.st = "hold";
        speak(s, "see");
      }
      if (s.aware && open && p.stepped)
        s.fear = Math.min(
          1.3,
          s.fear + dt * (dist < 10 ? ((10 - dist) / 10) * 0.2 : 0.006),
        );
      let mvz = 0,
        mvx = 0,
        speed = 0,
        face = true;
      const away = Math.sign(s.pos.z - p.pos.z) || -1;
      switch (s.st) {
        case "idle":
          break;
        case "hold":
          if (!s.hasCard && open && s.aware) {
            s.cd -= dt;
            if (s.cd <= 0 && dist < 20 && !(s.burst > 0)) {
              s.burst = 3 + ((Math.random() * 3) | 0);
              s.burstT = 0;
              s.cd = rnd(1.3, 2.4) + s.fear * 0.5;
            }
            if (s.burst > 0) {
              s.burstT -= dt;
              if (s.burstT <= 0) {
                fire(s);
                s.burst--;
                s.burstT = rnd(0.09, 0.14);
              }
            }
            if (Math.random() < dt * 0.18) speak(s, "calm");
          } else s.burst = 0;
          if (
            s.fear > 0.85 &&
            !s.hasCard &&
            dist < 2.4 &&
            Math.random() < dt * 2
          )
            breakDown(s);
          break;
        case "retreat":
        case "frozen":
          s.st = "hold";
          break;
        case "flee":
          mvz = away;
          speed = 4.3;
          face = false;
          s.stuckT = s.moving < 1.2 && s.fleeT > 0.4 ? (s.stuckT || 0) + dt : 0;
          s.fleeT = (s.fleeT || 0) + dt;
          if (
            (away < 0 && s.pos.z <= s.stopZ) ||
            (away > 0 && s.pos.z >= s.stopZ) ||
            s.stuckT > 0.5 ||
            (dist > 14 && s.fleeT > 1)
          ) {
            s.st = "cower";
            s.fleeT = 0;
          }
          break;
        case "cower":
          if (Math.random() < dt * 0.1) speak(s, "brk");
          s.cowT = (s.cowT || 0) + dt;
          if (dist > 6 && s.cowT > 2.5 && s.hasGun) {
            s.st = "hold";
            s.cowT = 0;
            s.cd = rnd(0.5, 1.5);
          }
          break;
        case "down": {
          face = false;
          s.downT -= dt;
          if (s.kv) {
            const nx = s.pos.x + s.kv.x * dt;
            let nz = s.pos.z + s.kv.z * dt;
            for (const d of doors) {
              if (!doorBlocks(d)) continue;
              if (s.pos.z > d.z && nz < d.z + 0.75) nz = d.z + 0.75;
              if (s.pos.z < d.z && nz > d.z - 0.75) nz = d.z - 0.75;
            }
            const xl = nz > CEND ? CW / 2 - 0.5 : BW / 2 - 0.6;
            s.pos.x = doorFunnel(clamp(nx, -xl, xl), nz, 0.25);
            s.pos.z = Math.min(nz, ZSTART - 1);
            s.kv.multiplyScalar(Math.exp(-3.2 * dt));
          }
          if (Math.random() < dt * 0.15) speak(s, "knocked");
          if (s.downT <= 0) {
            s.st = dist < 2.4 ? "cower" : "hold";
            s.cd = rnd(0.4, 1.2);
            s.kv = null;
          }
          break;
        }
        case "trapped":
          s.st = "hold";
          break;
        case "carry": {
          face = false;
          const g = s.goal;
          const gx = g.x - s.pos.x,
            gz = g.z - s.pos.z,
            gd = Math.hypot(gx, gz);
          if (gd < 0.5) {
            if (g.airlock) {
              if (s.hasCard) {
                s.hasCard = false;
                card.holder = null;
                card.aboard = true;
                cardMesh.visible = false;
              }
              s.gone = true;
              s.root.visible = false;
            } else {
              s.st = "stare";
            }
          } else {
            mvx = gx / gd;
            mvz = gz / gd;
            speed = 4;
          }
          break;
        }
        case "stare":
          face = false;
          s.yaw = Math.PI;
          if (ss <= ps) s.st = "hold";
          break;
        case "wait":
          face = false;
          s.yaw = Math.PI;
          if (ss <= ps) s.st = "hold";
          break;
      }
      // card logic
      if (s.hasCard) {
        s.holdT += dt;
        if (ss === 3 && s.st !== "carry") {
          s.st = "carry";
          s.goal = { x: AIRLOCK.x, z: AIRLOCK.z, airlock: true };
        } else if (ss > ps) {
          if (s.st !== "carry" && s.st !== "stare") s.st = "wait";
        } else if (
          s.st !== "carry" &&
          s.holdT > 0.45 &&
          (dist < 9.5 || s.fear > 0.95)
        ) {
          const ahead = nearestAhead(s.pos.z, ss, s);
          if (ahead && ahead.pos.z > s.pos.z - 14) {
            s.hasCard = false;
            s.cardHold.getWorldPosition(tmpV);
            launchCard(tmpV.clone(), s);
            speak(s, "pass", true);
          } else {
            const nd = doors.find((d) => d.z < s.pos.z && d.state === "open");
            s.st = "carry";
            s.goal = nd
              ? { x: rnd(-1, 1), z: nd.z - 3.2 }
              : { x: AIRLOCK.x, z: AIRLOCK.z, airlock: true };
            speak(s, "pass", true);
          }
        }
      } else if (s.st === "carry" && !s.goal.airlock) {
        /* runner without card keeps going */
      }
      if (ss === 3 && card.aboard && s.st !== "carry") {
        s.st = "carry";
        s.goal = { x: AIRLOCK.x, z: AIRLOCK.z, airlock: true };
      }
      // movement
      if (speed > 0) {
        let nx = s.pos.x + mvx * speed * dt,
          nz = s.pos.z + mvz * speed * dt;
        for (const d of doors) {
          if (!doorBlocks(d)) continue;
          if (s.pos.z > d.z && nz < d.z + 0.75) {
            nz = d.z + 0.75;
            if (s.st === "flee") {
              s.st = "cower";
              speak(s, "trapped", true);
            }
          }
          if (s.pos.z < d.z && nz > d.z - 0.75) nz = d.z - 0.75;
        }
        nz = Math.min(nz, ZSTART - 1);
        const xl = nz > CEND ? CW / 2 - 0.5 : BW / 2 - 0.6;
        nx = clamp(nx, -xl, xl);
        nx = doorFunnel(nx, nz, 0.3);
        if (s.st === "flee") nx = damp(nx, s.pos.x > 0 ? 1.6 : -1.6, 1, dt);
        s.moving = Math.hypot(nx - s.pos.x, nz - s.pos.z) / dt;
        s.pos.x = nx;
        s.pos.z = nz;
        s.ph += dt * speed * 3.2;
      } else s.moving = 0;
      // separation
      for (const o of soldiers) {
        if (o === s || !o.alive || o.gone) continue;
        const sx = s.pos.x - o.pos.x,
          sz = s.pos.z - o.pos.z,
          d2 = sx * sx + sz * sz;
        if (d2 < 0.36 && d2 > 1e-4) {
          const d = Math.sqrt(d2),
            push = (0.6 - d) * 0.5;
          s.pos.x += (sx / d) * push;
          s.pos.z += (sz / d) * push;
        }
      }
      if (dist < 0.9) {
        s.pos.x -= (dx / dist) * (0.9 - dist);
        s.pos.z -= (dz / dist) * (0.9 - dist);
      }
      s.pos.x = doorFunnel(s.pos.x, s.pos.z, 0.25);
      if (face) s.yaw = Math.atan2(-dx, -dz);
      else if (speed > 0 && s.st !== "trapped") s.yaw = Math.atan2(-mvx, -mvz);
      if (!TR.ready)
        s.fall.rotation.x = damp(
          s.fall.rotation.x,
          s.st === "down" ? 1.35 : 0,
          8,
          dt,
        );
      s.root.rotation.y =
        s.root.rotation.y +
        angWrap(s.yaw - s.root.rotation.y) * Math.min(1, dt * 10);
      // torch lens
      const lit = p.ignite >= 1 && s.st !== "cower";
      s.lens.material.color.setRGB(lit ? 2.5 : 0, lit ? 2.6 : 0, lit ? 3 : 0);
      animSoldier(s, dt);
    }
  }

