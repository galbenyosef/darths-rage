// modes — modes
// Lines 7414-7598 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= modes ================= */
  function updateDark(dt) {
    intro.t += dt;
    const t = intro.t;
    setPrompt(
      t > 0.6 ? (touchUI ? "Tap to ignite" : "Press Space to ignite") : null,
    );
    if (inputLatch.ignite && t > 0.6) {
      mode = "ignite";
      igniteT = 0;
      sfx.ignite();
      sevraneParts.blade.visible = true;
      setPrompt(null);
    }
  }
  function updateIgnite(dt) {
    igniteT += dt;
    const t = igniteT;
    player.ignite = clamp(t / 0.4, 0, 1);
    sevraneParts.blade.scale.y = Math.max(0.001, ease(player.ignite));
    const s = clamp((t - 0.15) / 0.6, 0, 1);
    materials.seam.color.setRGB(2.2 * s, 0.12 * s, 0.06 * s);
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
    materials.engine.color.setRGB(0.5 + 4 * glow, 0.25 + 2 * glow, 0.08 + 0.6 * glow);
    for (const e of engines) {
      if (e.userData.halo) {
        e.material.opacity = glow * 0.28;
        const s = 5 + glow * 3 + Math.sin(elapsed * 23) * 0.2;
        e.scale.set(s, s * 0.7, 1);
        continue;
      }
      e.material.opacity = 0.3 + 0.6 * glow;
      const s =
        (e.userData.size
          ? (0.9 + glow * 1.1) * e.userData.size
          : 1.6 + glow * 2.4) +
        Math.sin(elapsed * 40 + e.userData.k) * 0.1;
      e.scale.set(s, s, 1);
    }
    for (const m of shipGlowMats) m.emissiveIntensity = 0.6 + glow * 2.2;
    engineLight.position.copy(ship.position).add(vec3(0, 0, 6));
    engineLight.intensity = glow * 4;
    shipLight.position.copy(ship.position).add(vec3(-8, 10, -6));
    shipLight.intensity = 1.2;
    if (st > 0) {
      const d = 0.5 * 3.2 * st * st + st * 0.6;
      ship.position.set(SHIP0.x + d * 0.08, SHIP0.y - d * 0.12, SHIP0.z - d);
      ship.rotation.z = Math.min(0.12, st * 0.02);
    }
    if (audioEngine.ctx) {
      audioEngine.engGain.gain.setTargetAtTime(
        0.4 * glow * Math.max(0, 1 - st / 12),
        audioEngine.ctx.currentTime,
        0.2,
      );
      audioEngine.engF.frequency.setTargetAtTime(
        200 + glow * 300,
        audioEngine.ctx.currentTime,
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
      s.kv = vec3();
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
    sevraneParts.blade.scale.y = Math.max(0.001, p.ignite);
    if (deathT > 0.15 && !p.killedHum) {
      p.killedHum = true;
      stopRecHum();
      if (audioEngine.ctx) tone("sine", 180, 40, 0.7, 0.35);
    }
    grade.uniforms.fade.value = clamp((deathT - 0.6) / 1.4, 0, 1);
    if (deathT > 2.2 && byId("dead").hidden) {
      mode = "over";
      byId("dead").hidden = false;
      stopMusic();
    }
  }
  function showEnd() {
    mode = "over";
    hud.hidden = true;
    touchEl.hidden = true;
    setPrompt(null);
    byId("sKills").textContent = stats.kills;
    byId("sRefl").textContent = stats.reflected;
    byId("sLift").textContent = stats.lifted;
    byId("sDoors").textContent = stats.doors;
    const s = Math.round(stats.time);
    byId("sTime").textContent =
      Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    byId("end").hidden = false;
    byId("againBtn").focus({ preventScroll: true });
    if (audioEngine.ctx) {
      audioEngine.humGain.gain.setTargetAtTime(0, audioEngine.ctx.currentTime, 0.3);
      audioEngine.engGain.gain.setTargetAtTime(0, audioEngine.ctx.currentTime, 0.3);
    }
  }

