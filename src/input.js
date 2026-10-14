// input — input
// Lines 4644-4790 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= input ================= */
  const KEYS = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    KeyA: "a",
    KeyF: "f",
  };
  addEventListener("keydown", (e) => {
    if (
      mode === "title" &&
      !e.repeat &&
      ![
        "ShiftLeft",
        "ShiftRight",
        "ControlLeft",
        "ControlRight",
        "AltLeft",
        "AltRight",
        "MetaLeft",
        "MetaRight",
        "Tab",
      ].includes(e.code)
    ) {
      e.preventDefault();
      begin();
      return;
    }
    if (
      mode === "over" &&
      !byId("dead").hidden &&
      !e.repeat &&
      ![
        "ShiftLeft",
        "ShiftRight",
        "ControlLeft",
        "ControlRight",
        "AltLeft",
        "AltRight",
        "MetaLeft",
        "MetaRight",
        "Tab",
      ].includes(e.code)
    ) {
      e.preventDefault();
      begin();
      return;
    }
    if (mode === "title" || mode === "over" || mode === "dying") return;
    if (e.code === "Space") {
      if (!e.repeat) inputLatch.ignite = true;
      e.preventDefault();
      return;
    }
    if (e.code === "KeyS" && !e.repeat) {
      inputLatch.swing = true;
      e.preventDefault();
    }
    if (e.code === "KeyD" && !e.repeat) {
      inputLatch.jab = true;
      e.preventDefault();
    }
    const k = KEYS[e.code];
    if (k) {
      if (k === "a" && !key.a) player.blockPressT = elapsed;
      key[k] = true;
      e.preventDefault();
    }
    if (e.code === "KeyM") {
      audioEngine.muted = !audioEngine.muted;
      if (audioEngine.master) audioEngine.master.gain.value = audioEngine.muted ? 0 : 0.9;
    }
  });
  addEventListener("keyup", (e) => {
    const k = KEYS[e.code];
    if (k) key[k] = false;
  });
  addEventListener("blur", () => {
    for (const k in key) key[k] = false;
  });
  document.querySelectorAll(".touch button").forEach((b) => {
    const k = b.dataset.k;
    const down = (e) => {
      e.preventDefault();
      b.classList.add("on");
      audioInit();
      if (mode === "dark") inputLatch.ignite = true;
      if (k === "swing") inputLatch.swing = true;
      else if (k === "jab") inputLatch.jab = true;
      else if (k === "block") {
        if (!key.a) player.blockPressT = elapsed;
        key.a = true;
      } else if (k === "grip") key.f = true;
      else key[k] = true;
      try {
        b.setPointerCapture(e.pointerId);
      } catch (_) {}
    };
    const up = () => {
      b.classList.remove("on");
      if (k === "block") key.a = false;
      else if (k === "grip") key.f = false;
      else if (k in key) key[k] = false;
    };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("lostpointercapture", up);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
  });
  byId("app").addEventListener("pointerdown", () => {
    if (mode === "dark" && touchUI) inputLatch.ignite = true;
  });
  const hud = byId("hud"),
    prompt = byId("prompt"),
    touchEl = byId("touch");
  function begin() {
    leaveTitle();
    audioInit();
    sfx.saberStop(true);
    sfx.stressStop(true);
    stopRecHum();
    stopMusic();
    resetGame();
    mode = "dark";
    byId("title").hidden = true;
    byId("end").hidden = true;
    byId("dead").hidden = true;
    player.killedHum = false;
    hud.hidden = true;
    touchEl.hidden = !touchUI;
  }
  byId("title").addEventListener("click", () => {
    if (mode === "title") begin();
  });
  byId("dead").addEventListener("click", () => {
    if (mode === "over") begin();
  });
  byId("againBtn").addEventListener("click", begin);
  function setPrompt(t) {
    if (t) {
      if (prompt.textContent !== t) prompt.textContent = t;
      prompt.classList.add("on");
    } else prompt.classList.remove("on");
  }

