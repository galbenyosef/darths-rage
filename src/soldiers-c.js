// soldiers-c — soldiers (part 3 of 4)
// Lines 3178-3431 of readable/index-inline-1.pretty.js (statement-aligned).
  buildCrateParts([
    {
      geo: new THREE.BoxGeometry(crateHalf.hx * 2, crateHalf.hy * 2, crateHalf.hz * 2),
      mat: new THREE.MeshStandardMaterial({
        color: 0x2a2d33,
        roughness: 0.6,
        metalness: 0.6,
      }),
      base: new THREE.Matrix4(),
    },
  ]);
  (async () => {
    try {
      if (!THREE.GLTFLoader) return;
      const g = await fetchModel("crate");
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene),
        sz = box.getSize(vec3()),
        ctr = box.getCenter(vec3());
      const norm = new THREE.Matrix4()
        .makeScale((2 * crateHalf.hx) / sz.x, (2 * crateHalf.hy) / sz.y, (2 * crateHalf.hz) / sz.z)
        .multiply(new THREE.Matrix4().makeTranslation(-ctr.x, -ctr.y, -ctr.z));
      const list = [];
      g.scene.traverse((o) => {
        if (o.isMesh)
          list.push({
            geo: o.geometry,
            mat: o.material,
            base: new THREE.Matrix4().multiplyMatrices(norm, o.matrixWorld),
          });
      });
      if (list.length) buildCrateParts(list);
    } catch (e) {
      console.warn("Crate model failed to load; using plain boxes", e);
    }
  })();
  const crateHL = new THREE.Mesh(
    new THREE.BoxGeometry(crateHalf.hx * 2 + 0.14, crateHalf.hy * 2 + 0.14, crateHalf.hz * 2 + 0.14),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.6, 0.08, 0.04),
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  crateHL.visible = false;
  scene.add(crateHL);
  function resetCrates() {
    for (const c of crates) {
      c.pos.set(c.home.x, c.home.y, c.home.z);
      c.q.setFromAxisAngle(upAxis, c.home.yaw);
      c.v.set(0, 0, 0);
      c.av.set(0, 0, 0);
      c.state = "rest";
      c.lost = false;
      c.hits = 0;
    }
    syncCrates();
  }
  function crateImpact(p, k) {
    burst(p, Math.round(10 + 24 * k), "y", null, 3 + 4 * k);
    smoke(p, Math.round(1 + 3 * k), 0.5 + 0.6 * k);
    if (k > 0.25) {
      sfx.crunch();
    } else sfx.clank();
    if (p.distanceTo(player.pos) < 14) {
      shake = Math.max(shake, 0.15 + 0.5 * k);
      hitKick = Math.max(hitKick, 0.3 + 0.5 * k);
    }
  }
  function crateSupported(c) {
    if (c.pos.y <= crateHalf.hy + 0.02) return true;
    for (const o of crates) {
      if (o === c || o.state !== "rest" || o.lost) continue;
      if (
        Math.abs(o.pos.x - c.pos.x) < crateHalf.hx * 1.4 &&
        Math.abs(o.pos.z - c.pos.z) < crateHalf.hz * 1.4 &&
        o.pos.y < c.pos.y - crateHalf.hy
      )
        return true;
    }
    return false;
  }
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
          scratchQuat.setFromAxisAngle(scratchVecE.copy(c.av).normalize(), c.av.length() * sdt);
          c.q.premultiply(scratchQuat);
        }
        const sp = c.v.length(),
          inBay = c.pos.z < CEND;
        // guards in the way are killed outright and thrown back
        if (sp > 4)
          for (const s of soldiers) {
            if (!s.alive || s.gone || s.st === "gripped") continue;
            const dx = s.pos.x - c.pos.x,
              dz = s.pos.z - c.pos.z;
            if (dx * dx + dz * dz < 0.8 && c.pos.y - crateHalf.hy < s.lift + 1.85) {
              const dir = vec3(c.v.x, 0, c.v.z).normalize();
              kill(s, "crate", dir);
              c.hits++;
              c.v.multiplyScalar(0.82);
              stats.crushed = (stats.crushed || 0) + 1;
            }
          }
        // walls
        const xl = (inBay ? BAY_W / 2 : 2.4) - crateHalf.hx;
        if (Math.abs(c.pos.x) > xl) {
          c.pos.x = Math.sign(c.pos.x) * xl;
          if (Math.abs(c.v.x) > 2)
            crateImpact(
              c.pos.clone().setX(Math.sign(c.pos.x) * (xl + crateHalf.hx)),
              Math.min(1, Math.abs(c.v.x) / 14),
            );
          c.v.x *= -0.35;
          c.av.multiplyScalar(0.7);
        }
        // ceiling
        const yl = (inBay ? BAY_H : CORRIDOR_H) - crateHalf.hy;
        if (c.pos.y > yl) {
          c.pos.y = yl;
          c.v.y *= -0.3;
        }
        // blast doors and the corridor's back wall
        for (const d of doors) {
          if (
            !doorBlocks(d) &&
            !bulkheadHit(c.pos.x, c.pos.y, Math.max(crateHalf.hx, crateHalf.hy) - 0.1)
          )
            continue;
          const lim = crateHalf.hz + 0.2;
          if (oz > d.z && c.pos.z < d.z + lim) {
            c.pos.z = d.z + lim;
            if (c.v.z < -2) {
              crateImpact(
                vec3(c.pos.x, c.pos.y, d.z + 0.2),
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
        if (c.pos.z > ZSTART - crateHalf.hz) {
          c.pos.z = ZSTART - crateHalf.hz;
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
        if (c.pos.y < crateHalf.hy) {
          c.pos.y = crateHalf.hy;
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
        if (c.pos.y <= crateHalf.hy + 0.01) {
          c.v.x *= Math.exp(-5 * sdt);
          c.v.z *= Math.exp(-5 * sdt);
          if (c.v.length() < 0.35) {
            c.state = "rest";
            c.v.set(0, 0, 0);
            c.av.set(0, 0, 0);
            // settle flat on whichever face is down, keeping its heading
            const e = new THREE.Euler().setFromQuaternion(c.q, "YXZ");
            c.q.setFromAxisAngle(upAxis, e.y);
          }
        }
      }
    }
    // the player and the guards slide round crates resting against the walls instead of walking through them
    for (const c of crates) {
      if (c.state !== "rest" || c.lost || c.pos.y > crateHalf.hy + 0.05) continue;
      const pushOut = (o, r) => {
        const dx = o.x - c.pos.x,
          dz = o.z - c.pos.z;
        if (Math.abs(dz) < crateHalf.hz + r && Math.abs(dx) < crateHalf.hx + r) {
          const tx = c.pos.x - Math.sign(c.pos.x || 1) * (crateHalf.hx + r);
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
      crateHL.material.opacity = 0.22 + 0.12 * Math.sin(elapsed * 9);
    }
    syncCrates();
  }
  function crateBlocksBolt(bp) {
    for (const c of crates) {
      if (c.lost || c.state === "flying") continue;
      if (
        Math.abs(bp.x - c.pos.x) < crateHalf.hx &&
        Math.abs(bp.y - c.pos.y) < crateHalf.hy &&
        Math.abs(bp.z - c.pos.z) < crateHalf.hz
      )
        return true;
    }
    return false;
  }
  const scratchTroopA = vec3(),
    scratchTroopB = vec3(),
    scratchTroopC = vec3(),
    scratchTroopD = vec3();
