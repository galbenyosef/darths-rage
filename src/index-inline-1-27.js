// index-inline-1 27 — camstate
// Lines 7275-7606 of readable/index-inline-1.pretty.js (statement-aligned).
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
      side = -0.95 + Math.sin(T * 0.16) * 0.18;
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
        target.x = clamp(target.x, -(DW / 2 - 0.3), DW / 2 - 0.3);
        target.y = Math.min(target.y, DH - 0.35);
      }
      if (Math.abs(camState.pos.z - d.z) < 0.5) {
        camState.pos.x = clamp(camState.pos.x, -(DW / 2 - 0.25), DW / 2 - 0.25);
        camState.pos.y = Math.min(camState.pos.y, DH - 0.25);
      }
    }
    // keep inside corridor
    const xl = (target.z > CEND ? CW / 2 : BW / 2) - 0.25;
    target.x = clamp(target.x, -xl, xl);
    target.z = Math.min(target.z, ZSTART - 0.3);
    target.y = Math.min(target.y, (target.z > CEND ? CH : BH) - 0.2);
    const held = p.grip
      ? V3(p.grip.pos.x, p.grip.lift + 1.45, p.grip.pos.z)
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
      .addScaledVector(forward(p.yaw, V3()), lookAhead);
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
  const camHeld = V3(); // a short, sharp jolt when the blade connects
  function applyCam() {
    camera.position.copy(camState.pos);
    const s = reduce ? shake * 0.3 : shake,
      k = (reduce ? 0.35 : 1) * hitKick * hitKick;
    camera.position.x +=
      (Math.random() - 0.5) * s * 0.25 + Math.sin(T * 61) * k * 0.07;
    camera.position.y +=
      (Math.random() - 0.5) * s * 0.25 + Math.sin(T * 47 + 1.3) * k * 0.06;
    camera.lookAt(camState.look);
    if (k > 0.001) {
      camera.rotateZ(Math.sin(T * 53) * k * 0.035);
      camera.rotateX(Math.sin(T * 41 + 0.7) * k * 0.018);
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
      target = V3(
        lerp(camState.pos.x, 1.4, e * 0.2) + 0,
        lerp(2.3, 1.6, e),
        p.pos.z + lerp(3.6, 4.6, e),
      );
      target.x = lerp(0.72, 1.5, e);
      look = V3(lerp(0, 0.3, e), lerp(1.55, 2.6, e), p.pos.z - 8);
    } else {
      const e = ease(clamp((t - 6) / 4, 0, 1));
      target = V3(
        lerp(1.5, 0.9, e),
        lerp(1.6, 1.35, e),
        p.pos.z + lerp(4.6, 3.4, e),
      );
      look = V3(
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

  /* ================= modes ================= */
  function updateDark(dt) {
    intro.t += dt;
    const t = intro.t;
    setPrompt(
      t > 0.6 ? (touchUI ? "Tap to ignite" : "Press Space to ignite") : null,
    );
    if (q.ignite && t > 0.6) {
      mode = "ignite";
      igniteT = 0;
      sfx.ignite();
      P.blade.visible = true;
      setPrompt(null);
    }
  }
  function updateIgnite(dt) {
    igniteT += dt;
    const t = igniteT;
    player.ignite = clamp(t / 0.4, 0, 1);
    P.blade.scale.y = Math.max(0.001, ease(player.ignite));
    const s = clamp((t - 0.15) / 0.6, 0, 1);
    M.seam.color.setRGB(2.2 * s, 0.12 * s, 0.06 * s);
    if (t > 0.15 && !intro.flash) {
      intro.flash = true;
      flashV = 1.2;
    }
    if (t > 0.8 && !intro.see) {
      intro.see = true;
      for (const so of soldiers) {
        if (so.pos.z > -36) {
          so.aware = true;
          so.st = "hold";
          so.cd = rnd(0.4, 1.4);
          so.fear = 0.15;
        }
      }
      speak(soldiers[1], "see", true);
    }
    if (t >= 2.7) {
      mode = "play";
      hud.hidden = false;
      intro.see = false;
      intro.flash = false;
    }
  }
  function updateEnding(dt) {
    ending.t += dt;
    const t = ending.t,
      p = player;
    // walk to the window
    const gz = BZ1 + 3.2;
    if (p.pos.z > gz) {
      p.vel = 2.0;
      p.pos.z = Math.max(gz, p.pos.z - 2.0 * dt);
      p.pos.x = damp(p.pos.x, 0, 1.2, dt);
      p.yaw = damp(p.yaw, 0, 2, dt);
      p.walkPh += dt * 5.6;
      p.stepAcc += dt * 2;
      if (p.stepAcc > 0.95) {
        p.stepAcc = 0;
        sfx.step();
      }
    } else p.vel = 0;
    bayLight.intensity = damp(bayLight.intensity, 0.9, 1, dt);
    // ship departure
    const st = Math.max(0, t - 1.2);
    const glow = clamp(t / 2, 0, 1);
    M.engine.color.setRGB(0.5 + 4 * glow, 0.25 + 2 * glow, 0.08 + 0.6 * glow);
    for (const e of engines) {
      if (e.userData.halo) {
        e.material.opacity = glow * 0.28;
        const s = 5 + glow * 3 + Math.sin(T * 23) * 0.2;
        e.scale.set(s, s * 0.7, 1);
        continue;
      }
      e.material.opacity = 0.3 + 0.6 * glow;
      const s =
        (e.userData.size
          ? (0.9 + glow * 1.1) * e.userData.size
          : 1.6 + glow * 2.4) +
        Math.sin(T * 40 + e.userData.k) * 0.1;
      e.scale.set(s, s, 1);
    }
    for (const m of shipGlowMats) m.emissiveIntensity = 0.6 + glow * 2.2;
    engineLight.position.copy(ship.position).add(V3(0, 0, 6));
    engineLight.intensity = glow * 4;
    shipLight.position.copy(ship.position).add(V3(-8, 10, -6));
    shipLight.intensity = 1.2;
    if (st > 0) {
      const d = 0.5 * 3.2 * st * st + st * 0.6;
      ship.position.set(SHIP0.x + d * 0.08, SHIP0.y - d * 0.12, SHIP0.z - d);
      ship.rotation.z = Math.min(0.12, st * 0.02);
    }
    if (A.ctx) {
      A.engGain.gain.setTargetAtTime(
        0.4 * glow * Math.max(0, 1 - st / 12),
        A.ctx.currentTime,
        0.2,
      );
      A.engF.frequency.setTargetAtTime(
        200 + glow * 300,
        A.ctx.currentTime,
        0.3,
      );
    }
    if (!ending.stage && t > 0.6) {
      ending.stage = 1;
      sfx.detach();
    }
    grade.uniforms.fade.value = clamp((t - 13.5) / 2.2, 0, 1);
    if (t > 16 && ending.stage < 2) {
      ending.stage = 2;
      showEnd();
    }
  }
  function die() {
    const p = player;
    mode = "dying";
    deathT = 0;
    hud.hidden = true;
    touchEl.hidden = true;
    setPrompt(null);
    if (p.grip) {
      const s = p.grip;
      p.grip = null;
      s.st = "down";
      s.downT = 2;
      s.kv = V3();
    }
    if (p.liftCrate) {
      p.liftCrate.state = "flying";
      p.liftCrate.v.set(0, 0, 0);
      p.liftCrate = null;
    }
    p.doorPull = null;
    p.atk = null;
    p.block = false;
    p.saber = null;
    p.vel = 0;
    sfx.gripStop();
    sfx.stressStop(true);
    sfx.saberStop(true);
    flashV = 0.8;
    hurtV = 1;
    shake = Math.max(shake, 0.6);
    hitKick = 1;
  }
  function updateDying(dt) {
    deathT += dt;
    const p = player;
    // the blade dies in his hand, the world slows and goes dark
    p.ignite = Math.max(0, 1 - deathT / 0.7);
    P.blade.scale.y = Math.max(0.001, p.ignite);
    if (deathT > 0.15 && !p.killedHum) {
      p.killedHum = true;
      stopRecHum();
      if (A.ctx) tone("sine", 180, 40, 0.7, 0.35);
    }
    grade.uniforms.fade.value = clamp((deathT - 0.6) / 1.4, 0, 1);
    if (deathT > 2.2 && $("dead").hidden) {
      mode = "over";
      $("dead").hidden = false;
      stopMusic();
    }
  }
  function showEnd() {
    mode = "over";
    hud.hidden = true;
    touchEl.hidden = true;
    setPrompt(null);
    $("sKills").textContent = stats.kills;
    $("sRefl").textContent = stats.reflected;
    $("sLift").textContent = stats.lifted;
    $("sDoors").textContent = stats.doors;
    const s = Math.round(stats.time);
    $("sTime").textContent =
      Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    $("end").hidden = false;
    $("againBtn").focus({ preventScroll: true });
    if (A.ctx) {
      A.humGain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.3);
      A.engGain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.3);
    }
  }

  /* ================= HUD ================= */
  const hpBar = $("hpBar"),
    gripBar = $("gripBar"),
    pushBar = $("pushBar"),
    cardVal = $("cardVal"),
    doorUI = $("doorui"),
    doorBar = $("doorBar");
  let lastCardTxt = "";
