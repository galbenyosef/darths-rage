// camera — camera
// Lines 7273-7413 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= camera ================= */
  const camState = { pos: vec3(0, 2, 6), look: vec3(0, 1.6, 0), fov: 60 };
  function updateCamera(dt) {
    const p = player;
    let side = 0.72,
      height = 2.3,
      dist = 3.6,
      lookAhead = 5,
      lookH = 1.55,
      ang = 0,
      fov = 60;
    if (mode === "dark" || mode === "ignite") {
      const t = mode === "ignite" ? clamp((igniteT - 0.9) / 1.8, 0, 1) : 0;
      const e = ease(t);
      ang = 0;
      dist = lerp(1.9, 3.6, e);
      height = lerp(2.05, 2.3, e);
      side = lerp(0.42, 0.72, e);
      lookAhead = lerp(0.8, 5, e);
      lookH = lerp(1.95, 1.55, e);
    }

    if (mode === "title") {
      dist = 4.3;
      height = 1.55;
      side = -0.95 + Math.sin(elapsed * 0.16) * 0.18;
      lookAhead = 6;
      lookH = 1.5;
      fov = 48;
    }
    if (mode === "ending") return endingCamera(dt);
    const yaw = p.yaw + ang;
    forward(yaw, fwdV);
    rightV.set(-fwdV.z, 0, fwdV.x);
    const target = tmpV
      .copy(p.pos)
      .addScaledVector(fwdV, -dist)
      .addScaledVector(rightV, side);
    target.y = height;
    for (const d of doors) {
      const cs = target.z - d.z,
        ps = p.pos.z - d.z;
      if (cs * ps < 0 || Math.abs(cs) < 0.6) {
        target.x = clamp(target.x, -(DOOR_W / 2 - 0.3), DOOR_W / 2 - 0.3);
        target.y = Math.min(target.y, DOOR_H - 0.35);
      }
      if (Math.abs(camState.pos.z - d.z) < 0.5) {
        camState.pos.x = clamp(camState.pos.x, -(DOOR_W / 2 - 0.25), DOOR_W / 2 - 0.25);
        camState.pos.y = Math.min(camState.pos.y, DOOR_H - 0.25);
      }
    }
    // keep inside corridor
    const xl = (target.z > CEND ? CORRIDOR_W / 2 : BAY_W / 2) - 0.25;
    target.x = clamp(target.x, -xl, xl);
    target.z = Math.min(target.z, ZSTART - 0.3);
    target.y = Math.min(target.y, (target.z > CEND ? CORRIDOR_H : BAY_H) - 0.2);
    const held = p.grip
      ? vec3(p.grip.pos.x, p.grip.lift + 1.45, p.grip.pos.z)
      : p.liftCrate
        ? p.liftCrate.pos.clone()
        : null;
    camZoom = damp(camZoom, held ? 1 : 0, held ? 0.55 : 3.2, dt);
    if (camZoom > 0.001) {
      target.addScaledVector(fwdV, 0.9 * camZoom);
      target.y = lerp(target.y, 1.9, camZoom * 0.5);
    }
    const look = tmpV2
      .copy(p.pos)
      .addScaledVector(forward(p.yaw, vec3()), lookAhead);
    look.y = lookH;
    if (held) {
      camHeld.copy(held);
    }
    if (camZoom > 0.001) look.lerp(camHeld, camZoom * 0.85);
    fov = lerp(fov, 34, camZoom);
    if (mode === "title") look.addScaledVector(rightV, -2.5);
    const k = mode === "ignite" ? 7 : 8;
    camState.pos.x = damp(camState.pos.x, target.x, k, dt);
    camState.pos.y = damp(camState.pos.y, target.y, k, dt);
    camState.pos.z = damp(camState.pos.z, target.z, k, dt);
    camState.look.x = damp(camState.look.x, look.x, k, dt);
    camState.look.y = damp(camState.look.y, look.y, k, dt);
    camState.look.z = damp(camState.look.z, look.z, k, dt);
    camState.fov = damp(camState.fov, fov, 4, dt);
    applyCam();
  }
  let hitKick = 0,
    camZoom = 0;
  const camHeld = vec3(); // a short, sharp jolt when the blade connects
  function applyCam() {
    camera.position.copy(camState.pos);
    const s = reduce ? shake * 0.3 : shake,
      k = (reduce ? 0.35 : 1) * hitKick * hitKick;
    camera.position.x +=
      (Math.random() - 0.5) * s * 0.25 + Math.sin(elapsed * 61) * k * 0.07;
    camera.position.y +=
      (Math.random() - 0.5) * s * 0.25 + Math.sin(elapsed * 47 + 1.3) * k * 0.06;
    camera.lookAt(camState.look);
    if (k > 0.001) {
      camera.rotateZ(Math.sin(elapsed * 53) * k * 0.035);
      camera.rotateX(Math.sin(elapsed * 41 + 0.7) * k * 0.018);
    }
    camera.fov = camState.fov;
    camera.updateProjectionMatrix();
  }
  function endingCamera(dt) {
    const t = ending.t,
      p = player;
    let target, look;
    if (t < 6) {
      const e = ease(clamp(t / 2.5, 0, 1));
      target = vec3(
        lerp(camState.pos.x, 1.4, e * 0.2) + 0,
        lerp(2.3, 1.6, e),
        p.pos.z + lerp(3.6, 4.6, e),
      );
      target.x = lerp(0.72, 1.5, e);
      look = vec3(lerp(0, 0.3, e), lerp(1.55, 2.6, e), p.pos.z - 8);
    } else {
      const e = ease(clamp((t - 6) / 4, 0, 1));
      target = vec3(
        lerp(1.5, 0.9, e),
        lerp(1.6, 1.35, e),
        p.pos.z + lerp(4.6, 3.4, e),
      );
      look = vec3(
        lerp(0.3, ship.position.x * 0.15, e),
        lerp(2.6, 2.9, e),
        p.pos.z - 20,
      );
    }
    camState.pos.x = damp(camState.pos.x, target.x, 2.5, dt);
    camState.pos.y = damp(camState.pos.y, target.y, 2.5, dt);
    camState.pos.z = damp(camState.pos.z, target.z, 2.5, dt);
    camState.look.x = damp(camState.look.x, look.x, 2.5, dt);
    camState.look.y = damp(camState.look.y, look.y, 2.5, dt);
    camState.look.z = damp(camState.look.z, look.z, 2.5, dt);
    camState.fov = damp(camState.fov, 48, 1.2, dt);
    applyCam();
  }

