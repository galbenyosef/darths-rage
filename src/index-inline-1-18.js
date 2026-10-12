// index-inline-1 18 — player
// Lines 4443-4791 of readable/index-inline-1.pretty.js (statement-aligned).
  let mode = "title",
    T = 0,
    hitStop = 0,
    slowMo = 0,
    lastSlowT = -9,
    shake = 0,
    lb = 0,
    flashV = 0,
    hurtV = 0;
  const player = {
    stepped: false,
    pushCd: 0,
    pos: V3(0, 0, 0),
    yaw: 0,
    vel: 0,
    walkPh: 0,
    stepAcc: 0,
    atk: null,
    block: false,
    blockPressT: -9,
    grip: null,
    gripT: 0,
    gripCd: 0,
    resolve: 100,
    health: 100,
    stagger: 0,
    ignite: 0,
    lunge: 0,
  };
  const stats = { kills: 0, reflected: 0, lifted: 0, doors: 0, time: 0 };
  const intro = { t: 0, stage: 0 };
  const ending = { t: 0, stage: 0 };
  let igniteT = -1,
    gripCand = null,
    doorCand = null,
    speeches = [],
    hintT = 0,
    hintShown = {};
  const key = {
    up: false,
    down: false,
    left: false,
    right: false,
    a: false,
    f: false,
  };
  const q = { swing: false, jab: false, ignite: false };
  const fwdV = V3(),
    rightV = V3(),
    tmpV = V3(),
    tmpV2 = V3();

  function resetGame() {
    player.pos.set(0, 0, 2);
    player.yaw = 0;
    player.stepped = false;
    player.swingQ = 0;
    player.pushCd = 0;
    player.vel = 0;
    player.atk = null;
    player.grip = null;
    player.liftCrate = null;
    player.saber = null;
    player.doorPull = null;
    player.gripCd = 0;
    player.health = 100;
    player.hurtT = 9;
    deathT = 0;
    $("dead").hidden = true;
    player.resolve = 100;
    player.stagger = 0;
    player.ignite = 0;
    player.block = false;
    Object.assign(stats, {
      kills: 0,
      reflected: 0,
      lifted: 0,
      doors: 0,
      time: 0,
    });
    intro.t = 0;
    intro.stage = 0;
    ending.t = 0;
    ending.stage = 0;
    igniteT = -1;
    speeches = [];
    hintShown = {};
    for (const d of doors) {
      d.hp = d.hpMax;
      d.state = "open";
      d.t = 0;
      d.heat = 0;
      d.pivot.position.set(0, DH + 0.05, d.z);
      d.pivot.rotation.set(0, 0, 0);
      d.slab.position.set(0, 0, 0);
      d.pull = 0;
      d.rip = null;
      d.crumple = -1;
      crumpleDoor(d, 0);
      for (const s of d.scars) d.slab.remove(s.m);
      d.scars = [];
      d.mat.emissive.setRGB(0, 0, 0);
    }
    soldiers.forEach((s, i) => {
      const [x, z] = SPAWN[i];
      s.pos.set(x, 0, z);
      Object.assign(s, {
        yaw: 0,
        st: "idle",
        fear: rnd(0, 0.12),
        cd: rnd(0.8, 2.2),
        alive: true,
        gone: false,
        hasCard: false,
        lift: 0,
        deadT: 0,
        aware: false,
        speakCd: 0,
        severed: false,
        holdT: 0,
        hasGun: true,
        goal: null,
        moving: 0,
        trem: 0,
        crouch: 0,
        gripT: 0,
      });
      s.root.visible = true;
      s.fall.rotation.set(0, 0, 0);
      s.body.position.set(0, 0, 0);
      s.body.rotation.set(0, 0, 0);
      s.arms[1].sh.visible = true;
      s.gun.visible = true;
      s.gun.scale.set(1, 1, 1);
      s.lens.material.color.setRGB(0, 0, 0);
      for (const o of s.outl) o.visible = false;
      s.highlight = false;
      if (s.T) {
        const T = s.T;
        T.dying = false;
        T.A.dead.stop();
        T.A.dead.play();
        T.A.dead.paused = true;
        for (const k in T.w) T.w[k] = k === "alert" ? 1 : 0;
        T.B.RightArm.scale.setScalar(1);
        for (const n of T.cuts) {
          const b = T.model.getObjectByName("mixamorig" + n);
          if (b) b.scale.setScalar(1);
        }
        T.cuts = [];
        for (const st of T.stumps) {
          scene.remove(st.m);
          scene.remove(st.sp);
        }
        T.stumps = [];
        T.base.clear();
        T.aimW = 0;
        T.flyDeath = false;
        T.holder.position.y = 0;
        if (T.A.fly) {
          T.A.fly.stop();
          T.A.fly.play();
          T.A.fly.paused = true;
          T.A.fly.time = 0;
        }
      }
    });
    for (const d of debris) scene.remove(d.g);
    debris.length = 0;
    for (const b of bolts) {
      b.alive = false;
      b.g.visible = false;
    }
    for (const s of sparks) s.life = 0;
    for (const s of smokes) {
      s.life = 0;
      s.sp.visible = false;
    }
    card.holder = soldiers[CARD_START];
    soldiers[CARD_START].hasCard = true;
    card.flight = null;
    card.aboard = false;
    cardMesh.visible = true;
    resetShip();
    resetCrates();
    crateHL.visible = false;
    P.blade.scale.y = 0.001;
    P.blade.visible = false;
    M.seam.color.setRGB(0, 0, 0);
    M.card.color.setRGB(0, 0, 0);
    cardGlow.material.opacity = 0;
    bladeLight.intensity = 0;
    hemi.intensity = 0;
    bayLight.intensity = 0;
    engineLight.intensity = 0;
    shipLight.intensity = 0;
    for (const t of torches) t.intensity = 0;
    trailSamples.length = 0;
    scene.fog.density = 0.05;
  }

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
      !$("dead").hidden &&
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
      if (!e.repeat) q.ignite = true;
      e.preventDefault();
      return;
    }
    if (e.code === "KeyS" && !e.repeat) {
      q.swing = true;
      e.preventDefault();
    }
    if (e.code === "KeyD" && !e.repeat) {
      q.jab = true;
      e.preventDefault();
    }
    const k = KEYS[e.code];
    if (k) {
      if (k === "a" && !key.a) player.blockPressT = T;
      key[k] = true;
      e.preventDefault();
    }
    if (e.code === "KeyM") {
      A.muted = !A.muted;
      if (A.master) A.master.gain.value = A.muted ? 0 : 0.9;
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
      if (mode === "dark") q.ignite = true;
      if (k === "swing") q.swing = true;
      else if (k === "jab") q.jab = true;
      else if (k === "block") {
        if (!key.a) player.blockPressT = T;
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
  $("app").addEventListener("pointerdown", () => {
    if (mode === "dark" && touchUI) q.ignite = true;
  });
  const hud = $("hud"),
    prompt = $("prompt"),
    touchEl = $("touch");
  function begin() {
    leaveTitle();
    audioInit();
    sfx.saberStop(true);
    sfx.stressStop(true);
    stopRecHum();
    stopMusic();
    resetGame();
    mode = "dark";
    $("title").hidden = true;
    $("end").hidden = true;
    $("dead").hidden = true;
    player.killedHum = false;
    hud.hidden = true;
    touchEl.hidden = !touchUI;
  }
  $("title").addEventListener("click", () => {
    if (mode === "title") begin();
  });
  $("dead").addEventListener("click", () => {
    if (mode === "over") begin();
  });
  $("againBtn").addEventListener("click", begin);
  function setPrompt(t) {
    if (t) {
      if (prompt.textContent !== t) prompt.textContent = t;
      prompt.classList.add("on");
    } else prompt.classList.remove("on");
  }

  /* ================= speech ================= */
