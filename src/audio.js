// audio — audio
// Lines 3911-4227 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= audio ================= */
  const audioEngine = { ctx: null, master: null, muted: false };
  function audioInit() {
    if (audioEngine.ctx) {
      if (audioEngine.ctx.state === "suspended") audioEngine.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      audioEngine.ctx = new AC();
    } catch (e) {
      return;
    }
    const c = audioEngine.ctx;
    audioEngine.master = c.createGain();
    audioEngine.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    audioEngine.master.connect(comp);
    comp.connect(c.destination);
    const len = c.sampleRate * 2,
      buf = c.createBuffer(1, len, c.sampleRate),
      d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    audioEngine.noise = buf;
    audioEngine.humGain = c.createGain();
    audioEngine.humGain.gain.value = 0;
    const hf = c.createBiquadFilter();
    hf.type = "lowpass";
    hf.frequency.value = 520;
    hf.Q.value = 5;
    audioEngine.humBase = [58, 58.8, 116];
    audioEngine.humOsc = audioEngine.humBase.map((f, i) => {
      const o = c.createOscillator();
      o.type = i < 2 ? "sawtooth" : "sine";
      o.frequency.value = f;
      o.connect(hf);
      o.start();
      return o;
    });
    hf.connect(audioEngine.humGain);
    audioEngine.humGain.connect(audioEngine.master);
    audioEngine.breathGain = c.createGain();
    audioEngine.breathGain.gain.value = 0;
    const nb = c.createBufferSource();
    nb.buffer = buf;
    nb.loop = true;
    audioEngine.breathFilter = c.createBiquadFilter();
    audioEngine.breathFilter.type = "bandpass";
    audioEngine.breathFilter.frequency.value = 900;
    audioEngine.breathFilter.Q.value = 1.8;
    const pk = c.createBiquadFilter();
    pk.type = "peaking";
    pk.frequency.value = 1700;
    pk.Q.value = 6;
    pk.gain.value = 9;
    nb.connect(audioEngine.breathFilter);
    audioEngine.breathFilter.connect(pk);
    pk.connect(audioEngine.breathGain);
    audioEngine.breathGain.connect(audioEngine.master);
    nb.start();
    audioEngine.gripGain = c.createGain();
    audioEngine.gripGain.gain.value = 0;
    const gn = c.createBufferSource();
    gn.buffer = buf;
    gn.loop = true;
    const gf = c.createBiquadFilter();
    gf.type = "lowpass";
    gf.frequency.value = 150;
    gn.connect(gf);
    gf.connect(audioEngine.gripGain);
    gn.start();
    audioEngine.gripGain.connect(audioEngine.master);
    // (no background drone: the blade recording is the only hum)
    // Sevrane's recorded breathing, looped (falls back to the generated breath until it loads)
    audioEngine.recGain = c.createGain();
    audioEngine.recGain.gain.value = 0;
    audioEngine.recGain.connect(audioEngine.master);
    fetch("breathing.mp3")
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((b) => new Promise((res, rej) => c.decodeAudioData(b, res, rej)))
      .then((buf) => {
        const src = c.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.loopStart = 0.03;
        src.loopEnd = buf.duration - 0.03;
        src.connect(audioEngine.recGain);
        src.start(0, 0.03);
        audioEngine.breathRec = true;
      })
      .catch((e) =>
        console.warn(
          "breathing recording unavailable, using the generated breath",
          e,
        ),
      );
    audioEngine.recHumGain = c.createGain();
    audioEngine.recHumGain.gain.value = 0;
    audioEngine.recHumGain.connect(audioEngine.master);
    const load = (u) =>
      fetch(u)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((b) => new Promise((res, rej) => c.decodeAudioData(b, res, rej)));
    audioEngine.musicGain = c.createGain();
    audioEngine.musicGain.gain.value = 0;
    audioEngine.musicGain.connect(audioEngine.master);
    load("music.mp3")
      .then((b) => {
        audioEngine.musicBuf = b;
        if (player.ignite > 0 && !audioEngine.musicSrc) startMusic();
      })
      .catch((e) => console.warn("music unavailable", e));
    load("ignition.mp3")
      .then((b) => {
        audioEngine.ignBuf = b;
      })
      .catch((e) => console.warn("ignition recording unavailable", e));
    load("stress.mp3")
      .then((b) => {
        audioEngine.stressBuf = b;
      })
      .catch((e) => console.warn("metal stress sound unavailable", e));
    load("spin.mp3")
      .then((b) => {
        audioEngine.spinBuf = b;
      })
      .catch((e) => console.warn("spin sound unavailable", e));
    Promise.all(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) =>
        load("deflect" + i + ".mp3").catch(() => null),
      ),
    ).then((b) => {
      b = b.filter(Boolean);
      if (b.length) audioEngine.defBufs = b;
    });
    load("blaster.mp3")
      .then((b) => {
        audioEngine.gunBuf = b;
      })
      .catch((e) => console.warn("blaster recording unavailable", e));
    Promise.all(
      Array.from({ length: 22 }, (_, i) =>
        load("swing" + i + ".mp3").catch(() => null),
      ),
    )
      .then((b) => {
        b = b.filter(Boolean);
        if (b.length) audioEngine.swingBufs = b;
      })
      .catch((e) => console.warn("swing recordings unavailable", e));
    Promise.all([load("hum_start.mp3"), load("hum_loop.mp3")])
      .then(([st, lp]) => {
        audioEngine.humStartBuf = st;
        audioEngine.humLoopBuf = lp;
        audioEngine.humRec = true;
        if (player.ignite > 0 && !audioEngine.humLoopSrc) startRecHum(true);
      })
      .catch((e) =>
        console.warn(
          "blade hum recording unavailable, using the generated hum",
          e,
        ),
      );
    audioEngine.engGain = c.createGain();
    audioEngine.engGain.gain.value = 0;
    const en = c.createBufferSource();
    en.buffer = buf;
    en.loop = true;
    audioEngine.engF = c.createBiquadFilter();
    audioEngine.engF.type = "lowpass";
    audioEngine.engF.frequency.value = 200;
    en.connect(audioEngine.engF);
    audioEngine.engF.connect(audioEngine.engGain);
    audioEngine.engGain.connect(audioEngine.master);
    en.start();
  }
  function out(p) {
    const c = audioEngine.ctx;
    if (c.createStereoPanner) {
      const pn = c.createStereoPanner();
      pn.pan.value = clamp(p || 0, -1, 1);
      pn.connect(audioEngine.master);
      return pn;
    }
    return audioEngine.master;
  }
  function env(g, t, att, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(type, f0, f1, dur, peak, p) {
    if (!audioEngine.ctx) return;
    const c = audioEngine.ctx,
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
  function noise(ft, f0, f1, q, dur, peak, p, att) {
    if (!audioEngine.ctx) return;
    const c = audioEngine.ctx,
      t = c.currentTime,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = audioEngine.noise;
    f.type = ft;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q;
    env(g, t, att || 0.005, peak, dur);
    s.connect(f);
    f.connect(g);
    g.connect(out(p));
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }
  let lastDef = -1;
  function playDeflect(rate, gain) {
    if (!audioEngine.ctx || !audioEngine.defBufs) return false;
    let i = (Math.random() * audioEngine.defBufs.length) | 0;
    if (i === lastDef) i = (i + 1) % audioEngine.defBufs.length;
    lastDef = i;
    const c = audioEngine.ctx,
      src = c.createBufferSource(),
      g = c.createGain();
    src.buffer = audioEngine.defBufs[i];
    src.playbackRate.value = rate;
    g.gain.value = gain;
    src.connect(g);
    g.connect(audioEngine.master);
    src.start();
    return true;
  }
  const HUM_LOOP = [0.1, 57.25]; // loop points inside hum_loop.mp3 (padded either side so the seam stays clean)
  function startRecHum(skipOpening) {
    const c = audioEngine.ctx;
    if (!c || !audioEngine.humRec) return;
    stopRecHum();
    const t = c.currentTime + 0.02;
    let at = t;
    if (!skipOpening) {
      const st = c.createBufferSource();
      st.buffer = audioEngine.humStartBuf;
      st.connect(audioEngine.recHumGain);
      st.start(t);
      audioEngine.humStartSrc = st;
      at = t + audioEngine.humStartBuf.duration;
    }
    const lp = c.createBufferSource();
    lp.buffer = audioEngine.humLoopBuf;
    lp.loop = true;
    lp.loopStart = HUM_LOOP[0];
    lp.loopEnd = HUM_LOOP[1];
    lp.connect(audioEngine.recHumGain);
    lp.start(at, HUM_LOOP[0]);
    audioEngine.humLoopSrc = lp;
  }
  function startMusic() {
    const c = audioEngine.ctx;
    if (!c || !audioEngine.musicBuf) return;
    stopMusic();
    const src = c.createBufferSource();
    src.buffer = audioEngine.musicBuf;
    src.loop = true;
    src.connect(audioEngine.musicGain);
    src.start();
    audioEngine.musicSrc = src;
    audioEngine.musicGain.gain.cancelScheduledValues(c.currentTime);
    audioEngine.musicGain.gain.setValueAtTime(0.0001, c.currentTime);
  }
  function stopMusic() {
    if (audioEngine.musicSrc) {
      try {
        audioEngine.musicSrc.stop();
      } catch (e) {}
      audioEngine.musicSrc = null;
    }
  }
  function stopRecHum() {
    for (const k of ["humStartSrc", "humLoopSrc"]) {
      if (audioEngine[k]) {
        try {
          audioEngine[k].stop();
        } catch (e) {}
        audioEngine[k] = null;
      }
    }
  }
  function humBend(k) {
    if (!audioEngine.ctx) return;
    const t = audioEngine.ctx.currentTime;
    if (audioEngine.humLoopSrc) {
      const r = audioEngine.humLoopSrc.playbackRate;
      r.cancelScheduledValues(t);
      r.setTargetAtTime(1 + (k - 1) * 0.6, t, 0.03);
      r.setTargetAtTime(1, t + 0.18, 0.1);
    }
    audioEngine.humOsc.forEach((o, i) => {
      o.frequency.cancelScheduledValues(t);
      o.frequency.setTargetAtTime(audioEngine.humBase[i] * k, t, 0.03);
      o.frequency.setTargetAtTime(audioEngine.humBase[i], t + 0.18, 0.08);
    });
  }
  function panOf(p) {
    const v = p.clone().project(camera);
    return clamp(v.x, -1, 1) * 0.8;
  }
