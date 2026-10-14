// index-inline-1 19 — pos
// Lines 4792-5026 of readable/index-inline-1.pretty.js (statement-aligned).
  const LINES = {
    whisper: [
      "Is the airlock sealed?",
      "...Did you hear that?",
      "Stay quiet. Stay quiet.",
    ],
    see: [
      "He's here.",
      "It's him.",
      "Oh no. No, no, no.",
      "I can't see him!",
      "Where is he?",
    ],
    calm: [
      "Hold the line!",
      "Keep firing!",
      "Don't stop shooting!",
      "Light him up!",
    ],
    retreat: [
      "Fall back!",
      "Back! Get back!",
      "It's not working!",
      "Nothing hurts him!",
    ],
    brk: [
      "Please...",
      "I can't... I can't...",
      "Run!",
      "Let me through!",
      "Don't look at it.",
      "Mother...",
      "Why won't he stop?",
    ],
    pass: [
      "Take it! Go!",
      "Pass it back!",
      "Keep it moving!",
      "Get it to the ship!",
    ],
    catch_: ["Got it!", "I've got it!", "Go, go!"],
    witness: [
      "Let him go!",
      "What is that?",
      "He's not even touching him.",
      "Oh god.",
    ],
    gripped: ["hk...", "c-can't...", "...", "ghh..."],
    dying: ["No—", "Wai—", "Ple—", "—"],
    trapped: [
      "Open the door!",
      "Don't leave us!",
      "Please! Open it!",
      "They locked us in...",
    ],
    seal: ["Seal it! Seal it now!", "Close the door!", "Shut it!"],
    knocked: ["Agh!", "Ugh...", "What was—", "My leg...", "I can't get up!"],
  };
  function speak(s, cat, force) {
    if (!force && s.speakCd > 0) return;
    if (s.pos.distanceTo(player.pos) > 30) return;
    s.speakCd = rnd(2.6, 4.6); // speech boxes removed
  }

  /* ================= combat helpers ================= */
  function forward(yaw, out) {
    return out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  }
  function chest(s, out) {
    return out.set(s.pos.x, s.pos.y + s.lift + 1.25, s.pos.z);
  }
  let lastShotT = -9;
  const SLOWMO_LEN = 0.6;
  const BOLT_SPEED = 62;
  function fire(s, wild) {
    if (!s.hasGun || !player.stepped || T - lastShotT < 0.045) return;
    lastShotT = T;
    const b = bolts.find((b) => !b.alive);
    if (!b) return;
    s.muzzle.getWorldPosition(tmpV);
    const tgt = tmpV2.set(player.pos.x, 1.45, player.pos.z);
    const spread = 0.24 + s.fear * 1.2 + (wild ? 1.6 : 0);
    tgt.x += rnd(-1, 1) * spread;
    tgt.y += rnd(-0.6, 0.8) * spread;
    tgt.z += rnd(-1, 1) * spread * 0.3;
    const dir = tgt.sub(tmpV).normalize();
    b.alive = true;
    b.own = "e";
    b.src = s;
    b.life = 1.6;
    b.g.position.copy(tmpV).addScaledVector(dir, 0.8);
    b.v.copy(dir).multiplyScalar(BOLT_SPEED);
    b.c.material = M.bolt;
    b.g.quaternion.setFromUnitVectors(UP, dir);
    b.g.visible = true;
    const f = flashes.find((f) => f.t <= 0) || flashes[0];
    f.l.position.copy(tmpV);
    f.t = 0.07;
    s.flinch = 0.12;
    sfx.blaster(panOf(tmpV), tmpV.distanceTo(player.pos));
  }
  function nearestAhead(z, sec, excl) {
    let best = null;
    for (const s of soldiers) {
      if (s === excl || !s.alive || s.gone || s.st === "gripped") continue;
      if (secOf(s.pos.z) !== sec) continue;
      if (s.pos.z < z - 2 && (!best || s.pos.z > best.pos.z)) best = s;
    }
    return best;
  }
  function nearestInSec(sec, z) {
    let best = null,
      bd = 1e9;
    for (const s of soldiers) {
      if (!s.alive || s.gone || s.st === "gripped") continue;
      if (secOf(s.pos.z) !== sec) continue;
      const d = Math.abs(s.pos.z - z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }
  function launchCard(from, fromSoldier) {
    const sec = secOf(from.z);
    let tgt = nearestAhead(from.z, sec, fromSoldier);
    if (!tgt) tgt = nearestInSec(sec + 1, from.z);
    card.holder = null;
    card.flight = { p0: from.clone(), to: tgt, t: 0 };
    const tp = tgt ? tgt.pos : AIRLOCK;
    const dist = from.distanceTo(tp);
    card.flight.dur = clamp(dist / 10, 0.35, 1.4);
    card.flight.h = 0.5 + dist * 0.04;
  }
  function dropCard(s) {
    if (!s.hasCard) return;
    s.hasCard = false;
    s.cardHold.getWorldPosition(tmpV);
    launchCard(tmpV.clone(), s);
    if (s.alive) speak(s, "pass", true);
  }
  function breakDown(s) {
    s.fear = 1.15;
    const r = Math.random();
    if (r < 0.55) {
      s.st = "flee";
      s.stuckT = 0;
      s.stopZ = s.pos.z + Math.sign(s.pos.z - player.pos.z || -1) * rnd(6, 11);
    } else s.st = "cower";
    speak(s, "brk", true);
  }
  function severArm(s, dirV) {
    const sh = s.arms[1].sh;
    sh.updateWorldMatrix(true, true);
    const g = new THREE.Group();
    sh.getWorldPosition(g.position);
    sh.getWorldQuaternion(g.quaternion);
    const inv = new THREE.Matrix4().copy(sh.matrixWorld).invert();
    sh.traverse((o) => {
      if (o.isMesh && o.material !== M.outline) {
        const c = new THREE.Mesh(o.geometry, o.material);
        c.castShadow = true;
        const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        m.decompose(c.position, c.quaternion, c.scale);
        g.add(c);
      }
    });
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.ember);
    g.add(e);
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xff6a20,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    sp.scale.set(0.5, 0.5, 1);
    g.add(sp);
    sh.visible = false;
    s.severed = true;
    s.hasGun = false;
    addDebris(
      g,
      dirV
        .clone()
        .multiplyScalar(rnd(2, 3.5))
        .add(V3(rnd(-1, 1), rnd(2, 3.5), rnd(-1, 1))),
      { m: e, sp, life: 1 },
    );
  }
  function sliceGun(s, dirV) {
    s.gun.updateWorldMatrix(true, true);
    for (let k = 0; k < 2; k++) {
      const g = new THREE.Group();
      s.gun.getWorldPosition(g.position);
      s.gun.getWorldQuaternion(g.quaternion);
      const c = new THREE.Mesh(G.gun, M.gun);
      c.scale.set(1, 0.5, 1);
      c.position.y = k ? -0.22 : -0.0;
      g.add(c);
      const e = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.012, 0.115),
        M.ember,
      );
      e.position.y = k ? -0.11 : -0.11;
      g.add(e);
      addDebris(
        g,
        dirV
          .clone()
          .multiplyScalar(rnd(1.5, 3))
          .add(V3(rnd(-1.5, 1.5), rnd(2, 4), rnd(-1, 1))),
        { m: e, sp: null, life: 1 },
      );
    }
    s.gun.visible = false;
    s.hasGun = false;
  }
  function dropGun(s) {
    if (!s.hasGun) return;
    s.gun.updateWorldMatrix(true, true);
    const g = new THREE.Group();
    s.gun.getWorldPosition(g.position);
    s.gun.getWorldQuaternion(g.quaternion);
    const c = new THREE.Mesh(G.gun, M.gun);
    c.position.y = -0.12;
    g.add(c);
    addDebris(g, V3(rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1)), null);
    s.gun.visible = false;
    s.hasGun = false;
  }
