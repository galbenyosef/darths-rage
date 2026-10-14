// index-inline-1 28 — mode
// Lines 7607-7868 of readable/index-inline-1.pretty.js (statement-aligned).
  function updateHUD(nearDoor) {
    hpBar.style.transform = `scaleX(${clamp(player.health / 100, 0, 1)})`;
    hpBar.style.background = player.health < 30 ? "#ff3020" : "";
    pushBar.style.transform = `scaleX(${player.saber ? 0 : 1 - clamp(player.pushCd / PUSH_CD, 0, 1)})`;
    gripBar.style.transform = `scaleX(${player.liftCrate ? 1 : player.grip ? 1 - player.gripT / GRIP_MAX : 1 - clamp(player.gripCd / 1.6, 0, 1)})`;
    let txt;
    if (card.aboard) txt = "Aboard the courier";
    else if (!pathOpen(card.pos.z, player.pos.z)) txt = "Behind the blast door";
    else
      txt =
        Math.max(1, Math.round(card.pos.distanceTo(player.pos))) + " m ahead";
    if (txt !== lastCardTxt) {
      cardVal.textContent = txt;
      lastCardTxt = txt;
    }
    if (nearDoor) {
      doorUI.hidden = false;
      doorBar.style.transform = `scaleX(${1 - nearDoor.pull})`;
    } else doorUI.hidden = true;
    // hints
    let h = null;
    if (mode === "play") {
      if (!player.stepped)
        h =
          stats.time < 4
            ? "They are waiting for you. Take your time."
            : "Hold ↑ to walk. Nobody fires until you take a step.";
      else if (stats.time < 5) h = "Hold ↑ to walk. You never need to run.";
      else if (
        !hintShown.block &&
        bolts.some(
          (b) =>
            b.alive && b.own === "e" && b.g.position.distanceTo(player.pos) < 9,
        ) &&
        stats.time < 40
      )
        h = "Hold A to block. Tap it as a bolt arrives to send it back.";
      else if (!hintShown.swing && stats.time > 5 && stats.time < 30)
        h = "S to swing. D to throw your blade.";
      else if (
        hintShown.push &&
        !hintShown.finish &&
        soldiers.some(
          (x) => x.st === "down" && x.pos.distanceTo(player.pos) < 6,
        )
      )
        h = "They are down, not dead. Finish them.";
      else if (nearDoor && !hintShown.pull && nearDoor.pull < 0.05)
        h = hintShown.doorCut
          ? "Your blade won\u2019t cut it. Hold F to tear the door off its hinges."
          : "Face the door and hold F to tear it off its hinges.";
      else if (
        !hintShown.grip &&
        gripCand &&
        stats.kills >= 2 &&
        player.gripCd <= 0
      )
        h = "Hold F to lift the one marked in red. Let go to drop him.";
      else if (!hintShown.crate && crateCand && player.gripCd <= 0)
        h = "Hold F to lift the crate. Let go to hurl it at them.";
    }
    setPrompt(h);
  }
  function drawSubtitles() {
    const w = fx.width,
      h = fx.height;
    fctx.clearRect(0, 0, w, h);
    if (mode === "title" || mode === "over") return;
    fctx.textAlign = "center";
    fctx.font = `${Math.round(14 * PR)}px "Share Tech Mono", ui-monospace, monospace`;
    for (const sp of speeches) {
      const s = sp.s;
      tmpV.set(
        s.pos.x,
        s.lift + (s.alive ? 2.05 - (s.st === "cower" ? 0.5 : 0) : 0.6),
        s.pos.z,
      );
      const v = tmpV.project(camera);
      let x = (v.x * 0.5 + 0.5) * w,
        y = (-v.y * 0.5 + 0.5) * h;
      if (v.z > 1) {
        x = w - x;
        y = h * 0.6;
      }
      x = clamp(x, w * 0.08, w * 0.92);
      y = clamp(y, h * 0.16, h * 0.8);
      const a = Math.min(1, sp.t / 0.12) * Math.min(1, (sp.life - sp.t) / 0.4);
      fctx.fillStyle = "rgba(0,0,0," + 0.55 * a + ")";
      const tw = fctx.measureText(sp.text).width;
      fctx.fillRect(x - tw / 2 - 6 * PR, y - 15 * PR, tw + 12 * PR, 21 * PR);
      fctx.fillStyle =
        sp.cat === "dying"
          ? `rgba(255,140,110,${a})`
          : `rgba(220,226,236,${a})`;
      fctx.fillText(sp.text, x, y);
    }
  }

  /* ================= loop ================= */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    T += dt;
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
    q.swing = q.jab = q.ignite = false;
    P.root.position.copy(player.pos);
    P.root.rotation.y = player.yaw;
    driveSevrane(w);
    space.visible = ship.visible = mode === "ending" || mode === "over";
    updateFx(w);
    updateLights(dt);
    updateCamera(dt);
    if (mode === "play") updateHUD(nearDoor);
    lb = damp(
      lb,
      (mode === "ignite" && igniteT < 2.4) ||
        mode === "ending" ||
        mode === "title"
        ? 0.1
        : 0,
      3,
      dt,
    );
    grade.uniforms.lb.value = lb;
    grade.uniforms.blk.value = cut.v;
    grade.uniforms.time.value = T % 100;
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
    if (A.ctx) {
      const now2 = A.ctx.currentTime,
        bp = (T % 4.6) / 4.6;
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
      if (A.breathRec) {
        A.recGain.gain.setTargetAtTime(breathOn ? 0.85 : 0, now2, 0.4);
        g = 0;
      }
      A.breathGain.gain.setTargetAtTime(g, now2, 0.06);
      A.breathFilter.frequency.setTargetAtTime(f, now2, 0.1);
      const live = !(mode === "title" || mode === "over");
      const hum = live
        ? player.ignite *
          (0.1 + (player.atk ? 0.08 : 0) + (player.block ? 0.03 : 0))
        : 0;
      A.humGain.gain.setTargetAtTime(0, now2, 0.05);
      const rise =
        mode === "ignite" && A.ignBuf ? clamp((igniteT - 0.3) / 0.9, 0, 1) : 1;
      const rec =
        live && player.ignite > 0
          ? rise *
            (0.62 +
              (player.atk ? 0.25 : 0) +
              (player.block ? 0.1 : 0) +
              (player.grip ? 0.08 : 0))
          : 0;
      if (A.musicGain && A.musicSrc)
        A.musicGain.gain.setTargetAtTime(
          mode === "over" || mode === "dying"
            ? 0
            : 1.15 * (1 - cut.v * 0.3) * (player.doorPull ? 0.3 : 1),
          now2,
          mode === "over" ? 1.2 : 0.25,
        );
      if (A.recHumGain)
        A.recHumGain.gain.setTargetAtTime(
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
