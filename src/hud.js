// hud — HUD
// Lines 7599-7704 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= HUD ================= */
  const hpBar = byId("hpBar"),
    gripBar = byId("gripBar"),
    pushBar = byId("pushBar"),
    cardVal = byId("cardVal"),
    doorUI = byId("doorui"),
    doorBar = byId("doorBar");
  let lastCardTxt = "";
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
    const w = fxCanvas.width,
      h = fxCanvas.height;
    fctx.clearRect(0, 0, w, h);
    if (mode === "title" || mode === "over") return;
    fctx.textAlign = "center";
    fctx.font = `${Math.round(14 * pixelRatio)}px "Share Tech Mono", ui-monospace, monospace`;
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
      fctx.fillRect(x - tw / 2 - 6 * pixelRatio, y - 15 * pixelRatio, tw + 12 * pixelRatio, 21 * pixelRatio);
      fctx.fillStyle =
        sp.cat === "dying"
          ? `rgba(255,140,110,${a})`
          : `rgba(220,226,236,${a})`;
      fctx.fillText(sp.text, x, y);
    }
  }

