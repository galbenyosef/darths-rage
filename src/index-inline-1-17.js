// index-inline-1 17 — src
// Lines 4118-4227 of readable/index-inline-1.pretty.js (statement-aligned).
  function noise(ft, f0, f1, q, dur, peak, p, att) {
    if (!A.ctx) return;
    const c = A.ctx,
      t = c.currentTime,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = A.noise;
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
    if (!A.ctx || !A.defBufs) return false;
    let i = (Math.random() * A.defBufs.length) | 0;
    if (i === lastDef) i = (i + 1) % A.defBufs.length;
    lastDef = i;
    const c = A.ctx,
      src = c.createBufferSource(),
      g = c.createGain();
    src.buffer = A.defBufs[i];
    src.playbackRate.value = rate;
    g.gain.value = gain;
    src.connect(g);
    g.connect(A.master);
    src.start();
    return true;
  }
  const HUM_LOOP = [0.1, 57.25]; // loop points inside hum_loop.mp3 (padded either side so the seam stays clean)
  function startRecHum(skipOpening) {
    const c = A.ctx;
    if (!c || !A.humRec) return;
    stopRecHum();
    const t = c.currentTime + 0.02;
    let at = t;
    if (!skipOpening) {
      const st = c.createBufferSource();
      st.buffer = A.humStartBuf;
      st.connect(A.recHumGain);
      st.start(t);
      A.humStartSrc = st;
      at = t + A.humStartBuf.duration;
    }
    const lp = c.createBufferSource();
    lp.buffer = A.humLoopBuf;
    lp.loop = true;
    lp.loopStart = HUM_LOOP[0];
    lp.loopEnd = HUM_LOOP[1];
    lp.connect(A.recHumGain);
    lp.start(at, HUM_LOOP[0]);
    A.humLoopSrc = lp;
  }
  function startMusic() {
    const c = A.ctx;
    if (!c || !A.musicBuf) return;
    stopMusic();
    const src = c.createBufferSource();
    src.buffer = A.musicBuf;
    src.loop = true;
    src.connect(A.musicGain);
    src.start();
    A.musicSrc = src;
    A.musicGain.gain.cancelScheduledValues(c.currentTime);
    A.musicGain.gain.setValueAtTime(0.0001, c.currentTime);
  }
  function stopMusic() {
    if (A.musicSrc) {
      try {
        A.musicSrc.stop();
      } catch (e) {}
      A.musicSrc = null;
    }
  }
  function stopRecHum() {
    for (const k of ["humStartSrc", "humLoopSrc"]) {
      if (A[k]) {
        try {
          A[k].stop();
        } catch (e) {}
        A[k] = null;
      }
    }
  }
  function humBend(k) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    if (A.humLoopSrc) {
      const r = A.humLoopSrc.playbackRate;
      r.cancelScheduledValues(t);
      r.setTargetAtTime(1 + (k - 1) * 0.6, t, 0.03);
      r.setTargetAtTime(1, t + 0.18, 0.1);
    }
    A.humOsc.forEach((o, i) => {
      o.frequency.cancelScheduledValues(t);
      o.frequency.setTargetAtTime(A.humBase[i] * k, t, 0.03);
      o.frequency.setTargetAtTime(A.humBase[i], t + 0.18, 0.08);
    });
  }
  function panOf(p) {
    const v = p.clone().project(camera);
    return clamp(v.x, -1, 1) * 0.8;
  }
