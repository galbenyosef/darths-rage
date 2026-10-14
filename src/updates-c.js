// updates-c — updates (part 3 of 4)
// Lines 6689-6997 of readable/index-inline-1.pretty.js (statement-aligned).
  function updateCard(dt) {
    if (card.aboard) {
      cardMesh.visible = false;
      cardGlow.material.opacity = 0;
      return;
    }
    if (card.holder) {
      const h = card.holder;
      if (!h.alive || h.gone) {
        if (h.hasCard) dropCard(h);
      } else {
        h.cardHold.getWorldPosition(card.pos);
      }
    } else if (card.flight) {
      const f = card.flight;
      f.t += dt;
      const pr = Math.min(1, f.t / f.dur);
      const tp = f.to
        ? tmpV.copy(f.to.pos).setY(1.1 + f.to.lift)
        : tmpV.copy(AIRLOCK).setY(1.2);
      card.pos.lerpVectors(f.p0, tp, pr);
      card.pos.y += Math.sin(pr * Math.PI) * f.h;
      if (pr >= 1) {
        card.flight = null;
        if (f.to && f.to.alive && !f.to.gone && f.to.st !== "gripped") {
          card.holder = f.to;
          f.to.hasCard = true;
          f.to.holdT = 0;
          speak(f.to, "catch_", true);
          if (["cower", "frozen", "trapped", "idle"].includes(f.to.st))
            f.to.st = "hold";
        } else if (!f.to) {
          card.aboard = true;
        } else launchCard(card.pos.clone(), null);
      }
    }
    cardMesh.position.copy(card.pos);
    cardMesh.rotation.y = elapsed * (card.flight ? 12 : 0) + player.yaw;
    cardGlow.position.copy(card.pos);
    const on = player.ignite >= 1 ? 1 : 0;
    materials.card.color.setRGB(on * 3, on * 1.6, on * 0.4);
    cardGlow.material.opacity = on * 0.8;
    // door closing behind the card
    for (const d of doors) {
      if (
        d.state === "open" &&
        card.pos.z < d.z - 1.1 &&
        player.pos.z > d.z + 1.3
      ) {
        closeDoor(d);
        const sealer = nearestInSec(secOf(d.z - 1), d.z);
        if (sealer) speak(sealer, "seal", true);
      }
    }
  }

  const scratchDoorQuat1 = new THREE.Quaternion(),
    scratchDoorQuat2 = new THREE.Quaternion(),
    scratchDoorQuat3 = new THREE.Quaternion(),
    scratchDoorAxis = new THREE.Vector3();
  function updateDoors(dt) {
    let near = null;
    for (const d of doors) {
      if (d.state === "closing") {
        d.t += dt;
        const e = Math.min(1, d.t / 0.38);
        d.pivot.position.y = lerp(DOOR_H + 0.05, 0, e * e);
        if (e >= 1) {
          d.state = "closed";
          d.pivot.position.y = 0;
          tmpV.set(0, 0.2, d.z + 0.3);
          burst(tmpV, 30, "w", vec3(0, 0.5, 1), 4);
          smoke(tmpV, 4, 1);
          shake = Math.max(shake, 0.45);
        }
      } else if (d.state === "falling") {
        d.t += dt;
        const e = Math.min(1, d.t / 0.9);
        d.pivot.rotation.x = (-Math.PI / 2) * e * e;
        d.pivot.position.y = 0;
        if (e >= 1) {
          d.state = "broken";
          d.pivot.rotation.x = -Math.PI / 2;
          tmpV.set(0, 0.2, d.z - 1.8);
          burst(tmpV, 50, "r", upAxis, 5);
          smoke(tmpV, 6, 1.4);
          shake = Math.max(shake, 0.6);
        }
      }
      if (d.state === "closed") {
        if (player.doorPull !== d) d.pull = Math.max(0, d.pull - dt * 0.12);
        const k = d.pull,
          j = player.doorPull === d ? 0.015 + 0.07 * k * k : 0;
        crumpleDoor(d, 0.32 * k * k);
        d.slab.position.set(
          rnd(-1, 1) * j,
          Math.max(0, rnd(-0.2, 1) * j * 1.5),
          rnd(-1, 1) * j * 0.6 + k * k * 0.22,
        );
        d.pivot.rotation.x = damp(
          d.pivot.rotation.x,
          player.doorPull === d ? k * k * 0.08 + rnd(-1, 1) * j * 0.4 : 0,
          12,
          dt,
        );
        if (player.doorPull === d && d.wheel)
          d.wheel.rotation.z +=
            dt * (1.5 + 9 * k) * (Math.sin(elapsed * 3) > -0.2 ? 1 : -0.6);
      } else if (d.state === "ripped") {
        const r = d.rip;
        d.t += dt;
        const t = d.t;
        crumpleDoor(d, Math.min(1, 0.32 + t / 0.35));
        const qMid = scratchDoorQuat1.setFromAxisAngle(scratchDoorAxis.set(1, 0, 0), 0.55);
        const qEnd = scratchDoorQuat2.setFromAxisAngle(
          scratchDoorAxis.set(0, 1, 0),
          (r.side * Math.PI) / 2,
        );
        qEnd.premultiply(
          scratchDoorQuat3.setFromAxisAngle(scratchDoorAxis.set(0, 0, 1), -r.side * 0.16),
        );
        if (t < 0.28) {
          const e = ease(t / 0.28);
          d.pivot.position.set(
            rnd(-0.05, 0.05),
            lerp(0, 0.7, e),
            lerp(d.z, r.mz, e),
          );
          d.pivot.quaternion.copy(r.q0).slerp(qMid, e);
        } else {
          const e = Math.min(1, (t - 0.28) / 0.42),
            ee = e * e;
          d.pivot.position.set(
            lerp(0, r.side * 1.95, ee),
            lerp(0.7, 0, ee) + Math.sin(e * Math.PI) * 0.5,
            lerp(r.mz, d.z + 1.7, ee),
          );
          d.pivot.quaternion.copy(qMid).slerp(qEnd, ee);
          if (e >= 1 && !r.hit) {
            r.hit = true;
            d.state = "broken";
            sfx.doorBreak();
            sfx.crunch();
            shake = Math.max(shake, reduce ? 0.4 : 1.3);
            hitKick = 1;
            for (let i = 0; i < 5; i++) {
              tmpV.set(r.side * 2.2, rnd(0.3, 2.3), d.z + rnd(1, 2.5));
              burst(tmpV, 22, "r", vec3(-r.side, 0.4, 0), 5);
              smoke(tmpV, 2, 1.2);
            }
            tmpV.set(r.side * 1.7, 0.2, d.z + 1.7);
            burst(tmpV, 30, "w", upAxis, 4);
            smoke(tmpV, 5, 1.5);
          }
        }
      }
      for (const sc of d.scars) {
        sc.t += dt;
        const k = Math.exp(-sc.t * 0.6);
        sc.m.material.color.setRGB(
          0.35 + 3.6 * k,
          0.03 + 1.7 * k,
          0.01 + 0.5 * k,
        );
      }
      d.heat = Math.max(0, d.heat - dt * 0.25);
      d.mat.emissive.setRGB(d.heat * 0.5, d.heat * 0.12, 0);
      if (
        d.state === "closed" &&
        player.pos.z - d.z < 9.5 &&
        player.pos.z > d.z
      )
        near = d;
    }
    doorLight.intensity = damp(
      doorLight.intensity,
      Math.max(...doors.map((d) => d.heat)) * 5,
      6,
      dt,
    );
    return near;
  }

  function updateBolts(dt) {
    const p = player;
    forward(p.yaw, fwdV);
    for (const b of bolts) {
      if (!b.alive) continue;
      const nSub = Math.max(1, Math.ceil((b.v.length() * dt) / 0.3)),
        sdt = dt / nSub;
      for (let sub = 0; sub < nSub && b.alive; sub++) {
        const oz = b.g.position.z;
        b.g.position.addScaledVector(b.v, sdt);
        b.life -= sdt;
        const bp = b.g.position;
        let dead = b.life <= 0;
        const inBay = bp.z < CEND;
        const xl = inBay ? BAY_W / 2 : CORRIDOR_W / 2,
          yl = inBay ? BAY_H : CORRIDOR_H;
        if (
          !dead &&
          (Math.abs(bp.x) > xl ||
            bp.y < 0 ||
            bp.y > yl ||
            bp.z > ZSTART ||
            bp.z < BZ1)
        ) {
          dead = true;
          burst(bp, 8, b.own === "p" ? "r" : "b", null, 3);
        }
        if (!dead)
          for (const d of doors) {
            if (
              doorBlocks(d) &&
              ((oz > d.z && bp.z <= d.z) || (oz < d.z && bp.z >= d.z))
            ) {
              dead = true;
              burst(bp, 10, "b", null, 3);
              break;
            }
          }
        if (!dead)
          for (const d of doors) {
            if (
              ((oz > d.z && bp.z <= d.z) || (oz < d.z && bp.z >= d.z)) &&
              bulkheadHit(bp.x, bp.y, 0)
            ) {
              dead = true;
              burst(bp, 10, "b", null, 3);
              break;
            }
          }
        if (!dead && crateBlocksBolt(bp)) {
          dead = true;
          burst(bp, 10, "b", null, 3);
        }
        if (!dead && b.own === "e" && mode === "play") {
          const hx = bp.x - p.pos.x,
            hz = bp.z - p.pos.z;
          if (hx * hx + hz * hz < 0.3 && bp.y > 0.2 && bp.y < 2.15) {
            const vd = b.v.clone().setY(0).normalize();
            const facing = vd.dot(fwdV) < -0.2;
            const a = p.atk,
              inAtk = a && a.t / a.dur > 0.25 && a.t / a.dur < 0.7;
            if ((p.block || inAtk) && facing && p.stagger <= 0 && !p.grip) {
              sevraneParts.bladeMid.getWorldPosition(tmpV);
              bp.copy(tmpV);
              impactFlash(bp, [2.4, 3.6, 1.4], 0.7, 0.1);
              const perfect = inAtk || elapsed - p.blockPressT < 0.32;
              if (perfect && b.src && b.src.alive && !b.src.gone) {
                chest(b.src, tmpV2);
                b.v.copy(tmpV2.sub(bp)).normalize().multiplyScalar(70);
                b.own = "p";
                b.c.material = materials.boltR;
                stats.reflected++;
                sfx.reflect();
                burst(bp, 24, "r", null, 5);
                flashV = 0.25;
              } else {
                b.v
                  .copy(fwdV)
                  .multiplyScalar(rnd(0.3, 1))
                  .addScaledVector(rightV, rnd(-1.4, 1.4))
                  .add(vec3(0, rnd(-0.3, 0.9), 0))
                  .normalize()
                  .multiplyScalar(60);
                b.own = "x";
                sfx.deflect();
                burst(bp, 14, "r", null, 4);
              }
              b.g.quaternion.setFromUnitVectors(upAxis, tmpV.copy(b.v).normalize());
              hintShown.block = true;
              if (!p.atk) {
                SEV.twLeft = Math.min(
                  4 * Math.PI,
                  (SEV.twLeft || 0) + 2 * Math.PI,
                );
                if (!(SEV.twW > 0.05)) SEV.twDir = Math.random() < 0.5 ? -1 : 1;
              }
            } else {
              dead = true;
              hurt(b);
            }
          }
        }
        if (!dead && b.own === "p") {
          for (const s of soldiers) {
            if (!s.alive || s.gone) continue;
            const hx = bp.x - s.pos.x,
              hz = bp.z - s.pos.z;
            if (
              hx * hx + hz * hz < 0.18 &&
              bp.y > s.lift + 0.1 &&
              bp.y < s.lift + 1.85
            ) {
              dead = true;
              kill(s, "bolt", b.v.clone().setY(0).normalize());
              break;
            }
          }
        }
        if (dead) {
          b.alive = false;
          b.g.visible = false;
        }
      }
    }
  }

