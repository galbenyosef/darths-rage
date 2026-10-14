// loop — loop
// Lines 7705-7868 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= loop ================= */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    let w = dt;
    if (hitStop > 0) {
      hitStop -= dt;
      w = dt * 0.05;
    } else if (slowMo > 0) {
      slowMo -= dt;
      const u = Math.max(0, slowMo) / SLOWMO_LEN;
      w = dt * (u > 0.35 ? 0.14 : lerp(1, 0.14, u / 0.35));
    }
    shake = Math.max(0, shake - dt * 2.2);
    hitKick = Math.max(0, hitKick - dt * 3.2);
    flashV = Math.max(0, flashV - dt * 3);
    hurtV = Math.max(0, hurtV - dt * 2.5);
    let nearDoor = null;
    if (mode === "title") updateTitle(dt);
    if (mode === "dark") updateDark(dt);
    else if (mode === "ignite") {
      updateIgnite(dt);
      updateSoldiers(w);
      updateBolts(w);
    } else if (mode === "play") {
      stats.time += w;
      updatePlayer(w);
      updateSoldiers(w);
      updateCrates(w);
      updateCard(w);
      nearDoor = updateDoors(w);
      updateBolts(w);
      if (
        card.aboard &&
        (doors[2].state === "broken" || player.pos.z < -125.5)
      ) {
        mode = "ending";
        ending.t = 0;
        hud.hidden = true;
        setPrompt(null);
        for (const b of bolts) {
          b.alive = false;
          b.g.visible = false;
        }
      }
    } else if (mode === "ending") {
      updateEnding(dt);
      updateSoldiers(w);
      updateDoors(w);
    } else if (mode === "dying") {
      updateDying(dt);
      updateSoldiers(w * 0.3);
      updateBolts(w * 0.3);
      updateDoors(w * 0.3);
    }
    if (mode !== "over") {
      posePlayer(w);
      animateCape(w);
    }
    inputLatch.swing = inputLatch.jab = inputLatch.ignite = false;
    sevraneParts.root.position.copy(player.pos);
    sevraneParts.root.rotation.y = player.yaw;
    driveSevrane(w);
    space.visible = ship.visible = mode === "ending" || mode === "over";
    updateFx(w);
    updateLights(dt);
    updateCamera(dt);
    if (mode === "play") updateHUD(nearDoor);
    letterbox = damp(
      letterbox,
      (mode === "ignite" && igniteT < 2.4) ||
        mode === "ending" ||
        mode === "title"
        ? 0.1
        : 0,
      3,
      dt,
    );
    grade.uniforms.lb.value = letterbox;
    grade.uniforms.blk.value = cut.v;
    grade.uniforms.time.value = elapsed % 100;
    grade.uniforms.grain.value =
      0.035 *
      (mode === "dark"
        ? 0
        : Math.min(
            1,
            player.ignite + (mode === "over" || mode === "title" ? 1 : 0),
          ));
    grade.uniforms.flash.value = flashV;
    grade.uniforms.hurt.value = hurtV;
    grade.uniforms.aberr.value =
      (reduce ? 0.001 : 0.0015) +
      flashV * 0.006 +
      (player.grip && !reduce
        ? 0.003 + 0.004 * Math.min(1, player.gripT / 1.2)
        : 0) +
      (player.doorPull && !reduce ? 0.003 + 0.009 * player.doorPull.pull : 0);
    if (mode !== "ending" && mode !== "dying")
      grade.uniforms.fade.value = mode === "over" ? 1 : 0;
    // audio beds
    if (audioEngine.ctx) {
      const now2 = audioEngine.ctx.currentTime,
        bp = (elapsed % 4.6) / 4.6;
      let g = 0,
        f = 900;
      if (bp < 0.36) {
        g = Math.sin((bp / 0.36) * Math.PI) * 0.22;
        f = 1300;
      } else if (bp > 0.48 && bp < 0.9) {
        g = Math.sin(((bp - 0.48) / 0.42) * Math.PI) * 0.28;
        f = 650;
      }
      const breathOn = !(mode === "title" || mode === "over");
      if (!breathOn) g = 0;
      if (audioEngine.breathRec) {
        audioEngine.recGain.gain.setTargetAtTime(breathOn ? 0.85 : 0, now2, 0.4);
        g = 0;
      }
      audioEngine.breathGain.gain.setTargetAtTime(g, now2, 0.06);
      audioEngine.breathFilter.frequency.setTargetAtTime(f, now2, 0.1);
      const live = !(mode === "title" || mode === "over");
      const hum = live
        ? player.ignite *
          (0.1 + (player.atk ? 0.08 : 0) + (player.block ? 0.03 : 0))
        : 0;
      audioEngine.humGain.gain.setTargetAtTime(0, now2, 0.05);
      const rise =
        mode === "ignite" && audioEngine.ignBuf ? clamp((igniteT - 0.3) / 0.9, 0, 1) : 1;
      const rec =
        live && player.ignite > 0
          ? rise *
            (0.62 +
              (player.atk ? 0.25 : 0) +
              (player.block ? 0.1 : 0) +
              (player.grip ? 0.08 : 0))
          : 0;
      if (audioEngine.musicGain && audioEngine.musicSrc)
        audioEngine.musicGain.gain.setTargetAtTime(
          mode === "over" || mode === "dying"
            ? 0
            : 1.15 * (1 - cut.v * 0.3) * (player.doorPull ? 0.3 : 1),
          now2,
          mode === "over" ? 1.2 : 0.25,
        );
      if (audioEngine.recHumGain)
        audioEngine.recHumGain.gain.setTargetAtTime(
          rec * (1 - cut.v * 0.85),
          now2,
          cut.v ? 0.01 : live ? 0.06 : 0.4,
        );
    }
    if (mode !== "title") composer.render(dt);
    drawSubtitles();
  }
  engines.forEach((e, i) => (e.userData.k = i));
  resetGame();
  camState.pos.set(0.42, 2.05, 3.9);
  camState.look.set(0, 1.95, 1.2);
  applyCam();
  requestAnimationFrame(frame);
