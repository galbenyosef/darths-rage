// index-inline-1 14 — pos
// Lines 3264-3431 of readable/index-inline-1.pretty.js (statement-aligned).
  function updateCrates(dt) {
    for (const c of crates) {
      if (c.lost) continue;
      if (c.state === "rest") {
        if (!crateSupported(c)) {
          c.state = "flying";
          c.v.set(0, 0, 0);
        } else continue;
      }
      if (c.state !== "flying") continue;
      const sp0 = c.v.length(),
        n = Math.max(1, Math.ceil((sp0 * dt) / 0.25)),
        sdt = dt / n;
      for (let k = 0; k < n && c.state === "flying"; k++) {
        const oz = c.pos.z;
        c.v.y -= 14 * sdt;
        c.pos.addScaledVector(c.v, sdt);
        if (c.av.lengthSq() > 1e-6) {
          _q.setFromAxisAngle(_e.copy(c.av).normalize(), c.av.length() * sdt);
          c.q.premultiply(_q);
        }
        const sp = c.v.length(),
          inBay = c.pos.z < CEND;
        // guards in the way are killed outright and thrown back
        if (sp > 4)
          for (const s of soldiers) {
            if (!s.alive || s.gone || s.st === "gripped") continue;
            const dx = s.pos.x - c.pos.x,
              dz = s.pos.z - c.pos.z;
            if (dx * dx + dz * dz < 0.8 && c.pos.y - CR.hy < s.lift + 1.85) {
              const dir = V3(c.v.x, 0, c.v.z).normalize();
              kill(s, "crate", dir);
              c.hits++;
              c.v.multiplyScalar(0.82);
              stats.crushed = (stats.crushed || 0) + 1;
            }
          }
        // walls
        const xl = (inBay ? BW / 2 : 2.4) - CR.hx;
        if (Math.abs(c.pos.x) > xl) {
          c.pos.x = Math.sign(c.pos.x) * xl;
          if (Math.abs(c.v.x) > 2)
            crateImpact(
              c.pos.clone().setX(Math.sign(c.pos.x) * (xl + CR.hx)),
              Math.min(1, Math.abs(c.v.x) / 14),
            );
          c.v.x *= -0.35;
          c.av.multiplyScalar(0.7);
        }
        // ceiling
        const yl = (inBay ? BH : CH) - CR.hy;
        if (c.pos.y > yl) {
          c.pos.y = yl;
          c.v.y *= -0.3;
        }
        // blast doors and the corridor's back wall
        for (const d of doors) {
          if (
            !doorBlocks(d) &&
            !bulkheadHit(c.pos.x, c.pos.y, Math.max(CR.hx, CR.hy) - 0.1)
          )
            continue;
          const lim = CR.hz + 0.2;
          if (oz > d.z && c.pos.z < d.z + lim) {
            c.pos.z = d.z + lim;
            if (c.v.z < -2) {
              crateImpact(
                V3(c.pos.x, c.pos.y, d.z + 0.2),
                Math.min(1, -c.v.z / 14),
              );
              doorHit(d, c.pos.clone().setZ(d.z));
            }
            c.v.z *= -0.3;
            c.av.multiplyScalar(0.6);
          } else if (oz < d.z && c.pos.z > d.z - lim) {
            c.pos.z = d.z - lim;
            c.v.z *= -0.3;
          }
        }
        if (c.pos.z > ZSTART - CR.hz) {
          c.pos.z = ZSTART - CR.hz;
          if (c.v.z > 2) crateImpact(c.pos.clone(), Math.min(1, c.v.z / 14));
          c.v.z *= -0.3;
        }
        // out through the open dock and away into space
        if (c.pos.z < BZ1 - 0.5 && c.pos.y > -0.2) {
          c.out = true;
        }
        if (c.out) {
          c.v.y += 14 * sdt * 0.98;
          if (c.pos.z < BZ1 - 60) {
            c.lost = true;
            c.state = "rest";
            break;
          }
          continue;
        }
        // floor
        if (c.pos.y < CR.hy) {
          c.pos.y = CR.hy;
          if (c.v.y < -3)
            crateImpact(
              c.pos.clone().setY(0.05),
              Math.min(1, -c.v.y / 12) * 0.6,
            );
          c.v.y = Math.abs(c.v.y) > 1.5 ? -c.v.y * 0.25 : 0;
          c.v.x *= 0.72;
          c.v.z *= 0.72;
          c.av.multiplyScalar(0.55);
        }
        if (c.pos.y <= CR.hy + 0.01) {
          c.v.x *= Math.exp(-5 * sdt);
          c.v.z *= Math.exp(-5 * sdt);
          if (c.v.length() < 0.35) {
            c.state = "rest";
            c.v.set(0, 0, 0);
            c.av.set(0, 0, 0);
            // settle flat on whichever face is down, keeping its heading
            const e = new THREE.Euler().setFromQuaternion(c.q, "YXZ");
            c.q.setFromAxisAngle(UP, e.y);
          }
        }
      }
    }
    // the player and the guards slide round crates resting against the walls instead of walking through them
    for (const c of crates) {
      if (c.state !== "rest" || c.lost || c.pos.y > CR.hy + 0.05) continue;
      const pushOut = (o, r) => {
        const dx = o.x - c.pos.x,
          dz = o.z - c.pos.z;
        if (Math.abs(dz) < CR.hz + r && Math.abs(dx) < CR.hx + r) {
          const tx = c.pos.x - Math.sign(c.pos.x || 1) * (CR.hx + r);
          if (c.pos.z < CEND) return;
          o.x = c.pos.x > 0 ? Math.min(o.x, tx) : Math.max(o.x, tx);
        }
      };
      pushOut(player.pos, 0.3);
      for (const s of soldiers) {
        if (s.alive && !s.gone && s.st !== "gripped") pushOut(s.pos, 0.3);
      }
    }
    // red outline on the crate F would lift
    const hc =
      player.liftCrate || (crateCand && player.gripCd <= 0 ? crateCand : null);
    crateHL.visible = !!hc && mode === "play";
    if (hc) {
      crateHL.position.copy(hc.pos);
      crateHL.quaternion.copy(hc.q);
      crateHL.material.opacity = 0.22 + 0.12 * Math.sin(T * 9);
    }
    syncCrates();
  }
  function crateBlocksBolt(bp) {
    for (const c of crates) {
      if (c.lost || c.state === "flying") continue;
      if (
        Math.abs(bp.x - c.pos.x) < CR.hx &&
        Math.abs(bp.y - c.pos.y) < CR.hy &&
        Math.abs(bp.z - c.pos.z) < CR.hz
      )
        return true;
    }
    return false;
  }
  const _ta = V3(),
    _tb = V3(),
    _tc = V3(),
    _td = V3();
