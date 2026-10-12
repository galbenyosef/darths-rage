// index-inline-1 16 — connect
// Lines 3780-4117 of readable/index-inline-1.pretty.js (statement-aligned).
  const stGeo = new THREE.BufferGeometry(),
    stPos = new Float32Array(SPN * 6),
    stCol = new Float32Array(SPN * 6);
  stGeo.setAttribute("position", new THREE.BufferAttribute(stPos, 3));
  stGeo.setAttribute("color", new THREE.BufferAttribute(stCol, 3));
  const sparkStreaks = new THREE.LineSegments(
    stGeo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sparkStreaks.frustumCulled = false;
  scene.add(sparkStreaks);
  // short bright flashes where bolts strike
  const flashes2 = [];
  for (let i = 0; i < 16; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    sp.visible = false;
    scene.add(sp);
    flashes2.push({ sp, t: 0, max: 0.1, s: 0.5 });
  }
  let fl2I = 0;
  function impactFlash(p, col, size = 0.6, life = 0.12) {
    const f = flashes2[fl2I];
    fl2I = (fl2I + 1) % flashes2.length;
    f.sp.position.copy(p);
    f.sp.material.color.setRGB(col[0], col[1], col[2]);
    f.t = f.max = life;
    f.s = size;
    f.sp.visible = true;
  }
  const sparks = [];
  for (let i = 0; i < SPN; i++) {
    sparks.push({ p: V3(0, -99, 0), v: V3(), life: 0, max: 1, c: [1, 1, 1] });
  }
  let spI = 0;
  function burst(p, n, kind, dir, spd = 6) {
    const c =
      kind === "b"
        ? [0.7, 2.8, 0.6]
        : kind === "w"
          ? [1.6, 1.6, 1.8]
          : kind === "y"
            ? [3.2, 2.4, 1.1]
            : [3, 1.3, 0.35];
    for (let i = 0; i < n; i++) {
      const s = sparks[spI];
      spI = (spI + 1) % SPN;
      s.p.copy(p);
      s.v
        .set(rnd(-1, 1), rnd(-0.3, 1.2), rnd(-1, 1))
        .normalize()
        .multiplyScalar(rnd(0.45, 1.15) * spd);
      if (dir) s.v.addScaledVector(dir, spd * 0.6);
      s.life = s.max = rnd(0.25, 0.7);
      s.c = c;
    }
  }
  const smokes = [];
  for (let i = 0; i < 36; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: smokeTex,
        color: 0x2a1c1c,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    sp.visible = false;
    scene.add(sp);
    smokes.push({ sp, v: V3(), life: 0, max: 1, s: 0.5 });
  }
  let smI = 0;
  function smoke(p, n, scale = 0.6) {
    for (let i = 0; i < n; i++) {
      const s = smokes[smI];
      smI = (smI + 1) % smokes.length;
      s.sp.position
        .copy(p)
        .add(V3(rnd(-0.15, 0.15), rnd(-0.1, 0.2), rnd(-0.15, 0.15)));
      s.v.set(rnd(-0.2, 0.2), rnd(0.25, 0.6), rnd(-0.2, 0.2));
      s.life = s.max = rnd(1.4, 2.6);
      s.s = scale * rnd(0.7, 1.3);
      s.sp.visible = true;
    }
  }
  const debris = [];
  function addDebris(group, vel, ember) {
    scene.add(group);
    debris.push({
      g: group,
      v: vel,
      av: V3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)),
      rest: false,
      ember,
      t: 0,
    });
    if (debris.length > 40) {
      const d = debris.shift();
      scene.remove(d.g);
    }
  }

  /* ---- bolts ---- */
  const bolts = [];
  const boltGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6),
    boltGlowGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.65, 8);
  for (let i = 0; i < 72; i++) {
    const g = new THREE.Group();
    const c = new THREE.Mesh(boltGeo, M.bolt);
    const gl = new THREE.Mesh(boltGlowGeo, M.boltGlow);
    g.add(c, gl);
    g.visible = false;
    scene.add(g);
    bolts.push({ g, c, v: V3(), alive: false, own: "e", src: null, life: 0 });
  }

  /* ================= audio ================= */
  const A = { ctx: null, master: null, muted: false };
  function audioInit() {
    if (A.ctx) {
      if (A.ctx.state === "suspended") A.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      A.ctx = new AC();
    } catch (e) {
      return;
    }
    const c = A.ctx;
    A.master = c.createGain();
    A.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    A.master.connect(comp);
    comp.connect(c.destination);
    const len = c.sampleRate * 2,
      buf = c.createBuffer(1, len, c.sampleRate),
      d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noise = buf;
    A.humGain = c.createGain();
    A.humGain.gain.value = 0;
    const hf = c.createBiquadFilter();
    hf.type = "lowpass";
    hf.frequency.value = 520;
    hf.Q.value = 5;
    A.humBase = [58, 58.8, 116];
    A.humOsc = A.humBase.map((f, i) => {
      const o = c.createOscillator();
      o.type = i < 2 ? "sawtooth" : "sine";
      o.frequency.value = f;
      o.connect(hf);
      o.start();
      return o;
    });
    hf.connect(A.humGain);
    A.humGain.connect(A.master);
    A.breathGain = c.createGain();
    A.breathGain.gain.value = 0;
    const nb = c.createBufferSource();
    nb.buffer = buf;
    nb.loop = true;
    A.breathFilter = c.createBiquadFilter();
    A.breathFilter.type = "bandpass";
    A.breathFilter.frequency.value = 900;
    A.breathFilter.Q.value = 1.8;
    const pk = c.createBiquadFilter();
    pk.type = "peaking";
    pk.frequency.value = 1700;
    pk.Q.value = 6;
    pk.gain.value = 9;
    nb.connect(A.breathFilter);
    A.breathFilter.connect(pk);
    pk.connect(A.breathGain);
    A.breathGain.connect(A.master);
    nb.start();
    A.gripGain = c.createGain();
    A.gripGain.gain.value = 0;
    const gn = c.createBufferSource();
    gn.buffer = buf;
    gn.loop = true;
    const gf = c.createBiquadFilter();
    gf.type = "lowpass";
    gf.frequency.value = 150;
    gn.connect(gf);
    gf.connect(A.gripGain);
    gn.start();
    A.gripGain.connect(A.master);
    // (no background drone: the blade recording is the only hum)
    // Sevrane's recorded breathing, looped (falls back to the generated breath until it loads)
    A.recGain = c.createGain();
    A.recGain.gain.value = 0;
    A.recGain.connect(A.master);
    fetch("breathing.mp3")
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((b) => new Promise((res, rej) => c.decodeAudioData(b, res, rej)))
      .then((buf) => {
        const src = c.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.loopStart = 0.03;
        src.loopEnd = buf.duration - 0.03;
        src.connect(A.recGain);
        src.start(0, 0.03);
        A.breathRec = true;
      })
      .catch((e) =>
        console.warn(
          "breathing recording unavailable, using the generated breath",
          e,
        ),
      );
    A.recHumGain = c.createGain();
    A.recHumGain.gain.value = 0;
    A.recHumGain.connect(A.master);
    const load = (u) =>
      fetch(u)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((b) => new Promise((res, rej) => c.decodeAudioData(b, res, rej)));
    A.musicGain = c.createGain();
    A.musicGain.gain.value = 0;
    A.musicGain.connect(A.master);
    load("music.mp3")
      .then((b) => {
        A.musicBuf = b;
        if (player.ignite > 0 && !A.musicSrc) startMusic();
      })
      .catch((e) => console.warn("music unavailable", e));
    load("ignition.mp3")
      .then((b) => {
        A.ignBuf = b;
      })
      .catch((e) => console.warn("ignition recording unavailable", e));
    load("stress.mp3")
      .then((b) => {
        A.stressBuf = b;
      })
      .catch((e) => console.warn("metal stress sound unavailable", e));
    load("spin.mp3")
      .then((b) => {
        A.spinBuf = b;
      })
      .catch((e) => console.warn("spin sound unavailable", e));
    Promise.all(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) =>
        load("deflect" + i + ".mp3").catch(() => null),
      ),
    ).then((b) => {
      b = b.filter(Boolean);
      if (b.length) A.defBufs = b;
    });
    load("blaster.mp3")
      .then((b) => {
        A.gunBuf = b;
      })
      .catch((e) => console.warn("blaster recording unavailable", e));
    Promise.all(
      Array.from({ length: 22 }, (_, i) =>
        load("swing" + i + ".mp3").catch(() => null),
      ),
    )
      .then((b) => {
        b = b.filter(Boolean);
        if (b.length) A.swingBufs = b;
      })
      .catch((e) => console.warn("swing recordings unavailable", e));
    Promise.all([load("hum_start.mp3"), load("hum_loop.mp3")])
      .then(([st, lp]) => {
        A.humStartBuf = st;
        A.humLoopBuf = lp;
        A.humRec = true;
        if (player.ignite > 0 && !A.humLoopSrc) startRecHum(true);
      })
      .catch((e) =>
        console.warn(
          "blade hum recording unavailable, using the generated hum",
          e,
        ),
      );
    A.engGain = c.createGain();
    A.engGain.gain.value = 0;
    const en = c.createBufferSource();
    en.buffer = buf;
    en.loop = true;
    A.engF = c.createBiquadFilter();
    A.engF.type = "lowpass";
    A.engF.frequency.value = 200;
    en.connect(A.engF);
    A.engF.connect(A.engGain);
    A.engGain.connect(A.master);
    en.start();
  }
  function out(p) {
    const c = A.ctx;
    if (c.createStereoPanner) {
      const pn = c.createStereoPanner();
      pn.pan.value = clamp(p || 0, -1, 1);
      pn.connect(A.master);
      return pn;
    }
    return A.master;
  }
  function env(g, t, att, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(type, f0, f1, dur, peak, p) {
    if (!A.ctx) return;
    const c = A.ctx,
      t = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.006, peak, dur);
    o.connect(g);
    g.connect(out(p));
    o.start(t);
    o.stop(t + dur + 0.05);
  }
