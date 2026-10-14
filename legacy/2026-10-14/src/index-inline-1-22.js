// index-inline-1 22 — lerp
// Lines 5623-5948 of readable/index-inline-1.pretty.js (statement-aligned).
  function poseSoldier(s, dt) {
    const st = s.st,
      ph = s.ph,
      k = 14;
    let thL = 0,
      thR = 0,
      knL = 0,
      knR = 0,
      shLx = 0.1,
      shLz = 0.08,
      shRx = 0.1,
      shRz = -0.08,
      elL = 0.15,
      elR = 0.15,
      hx = 0,
      crouch = 0,
      lean = 0;
    const trem =
      s.alive && s.fear > 0.5
        ? (s.fear - 0.5) * 0.12 * Math.sin(T * 40 + ph)
        : 0;
    if (!s.alive) {
      shLx = 0.4;
      shLz = 0.6;
      shRx = 0.4;
      shRz = -0.6;
      knL = -0.5;
      knR = -0.2;
      thL = 0.3;
      elL = 0.3;
      elR = 0.3;
      hx = 0.4;
    } else if (st === "gripped") {
      thL = Math.sin(T * 13 + ph) * 0.6;
      thR = Math.sin(T * 13 + ph + 2) * 0.6;
      knL = -0.4 - Math.abs(Math.sin(T * 9)) * 0.6;
      knR = -0.4 - Math.abs(Math.cos(T * 9)) * 0.6;
      shLx = 2.0;
      shLz = 0.75;
      shRx = 2.0;
      shRz = -0.75;
      elL = 1.9;
      elR = 1.9;
      hx = 0.45;
    } else if (st === "cower") {
      crouch = 0.48;
      thL = 1.7;
      thR = 1.5;
      knL = -2.3;
      knR = -2.2;
      shLx = 2.6;
      shLz = 0.4;
      shRx = 2.6;
      shRz = -0.4;
      elL = 1.5;
      elR = 1.5;
      hx = -0.5;
      lean = -0.45;
    } else if (s.moving > 2) {
      const r = Math.sin(ph);
      thL = r * 0.85;
      thR = -r * 0.85;
      knL = -Math.max(0, -r) * 1.1 - 0.15;
      knR = -Math.max(0, r) * 1.1 - 0.15;
      shLx = -r * 0.8;
      shRx = r * 0.8;
      elL = 0.9;
      elR = 0.9;
      lean = -0.2;
      if (s.hasCard) {
        shLx = 0.9;
        elL = 1.2;
      }
    } else if (st === "trapped") {
      const h = Math.sin(T * 11 + ph);
      shRx = 2.5 + h * 0.45;
      shLx = 2.2 - h * 0.4;
      elL = 0.35;
      elR = 0.35;
      shRz = -0.2;
      shLz = 0.2;
    } else if (st === "stare" || st === "wait" || st === "idle") {
      shLx = 0.15;
      shRx = 0.15;
      elL = 0.2;
      elR = 0.2;
      if (s.hasCard) {
        shLx = 0.7;
        elL = 1.1;
      }
      hx = st === "stare" ? -0.05 : 0;
    } else {
      // aiming
      chest(s, tmpV);
      const dy = 1.4 - (tmpV.y + 0.2),
        dz = Math.hypot(player.pos.x - s.pos.x, player.pos.z - s.pos.z);
      const pitch = Math.atan2(dy, dz);
      shRx = 1.5 + pitch + (st === "frozen" ? -0.5 : 0) + trem * 3;
      shRz = 0.05;
      elR = 0.05;
      shLx = 1.25 + pitch;
      shLz = 0.55;
      elL = 0.6;
      if (s.hasCard) {
        shLx = 0.8;
        shLz = 0.1;
        elL = 1.2;
      }
      if (!s.hasGun || s.severed) {
        shRx = 0.3;
        shLx = 2.2;
        shLz = 0.3;
        elL = 1.2;
      }
      if (s.moving > 0.2) {
        const r = Math.sin(ph);
        thL = r * 0.35;
        thR = -r * 0.35;
        knL = -Math.max(0, -r) * 0.5;
        knR = -Math.max(0, r) * 0.5;
      }
      shRx -= s.flinch * 3;
    }
    s.body.position.y = damp(s.body.position.y, -crouch, 10, dt);
    s.body.rotation.x = damp(s.body.rotation.x, lean + trem, 10, dt);
    setRot(s.legs[0].hip, thL, 0, 0, k, dt);
    setRot(s.legs[1].hip, thR, 0, 0, k, dt);
    setRot(s.legs[0].knee, knL, 0, 0, k, dt);
    setRot(s.legs[1].knee, knR, 0, 0, k, dt);
    setRot(s.arms[0].sh, shLx, 0, shLz, k, dt);
    setRot(s.arms[1].sh, shRx, 0, shRz, k, dt);
    setRot(s.arms[0].el, elL, 0, 0, k, dt);
    setRot(s.arms[1].el, elR, 0, 0, k, dt);
    setRot(s.head, hx + trem, 0, 0, k, dt);
  }

  function posePlayer(dt) {
    const p = player,
      k = 16;
    let shLx = 0.38,
      shLz = -0.12,
      elL = 0.5,
      bladeW = -2.1,
      bladeZ = 0,
      shRx = 0.08,
      shRz = 0.1,
      elR = 0.2,
      twist = 0,
      lean = 0,
      bob = 0;
    let thL = 0,
      thR = 0,
      knL = 0,
      knR = 0;
    if (p.vel !== 0) {
      const r = Math.sin(p.walkPh);
      thL = r * 0.38;
      thR = -r * 0.38;
      knL = -Math.max(0, -r) * 0.55 - 0.05;
      knR = -Math.max(0, r) * 0.55 - 0.05;
      bob = -Math.abs(Math.cos(p.walkPh)) * 0.035;
      shRx = -r * 0.18 + 0.08;
    }
    if (p.ignite <= 0) {
      shLx = 0.1;
      elL = 0.15;
      bladeW = -0.3;
    }
    if (mode === "title") {
      shLx = 0.12;
      shLz = -0.3;
      elL = 0.18;
      bladeW = -2.72;
      bladeZ = -0.32;
      shRx = 0.04;
      shRz = 0.08;
      elR = 0.12;
    }
    const a = p.atk;
    if (a && a.type === "swing") {
      const t = a.t / a.dur;
      if (t < 0.42) {
        const e = ease(t / 0.42);
        shLx = lerp(0.38, 2.85, e);
        shLz = lerp(-0.12, -0.55, e);
        elL = lerp(0.5, 0.75, e);
        bladeW = lerp(-2.1, 0.85, e);
        twist = lerp(0, 0.5, e);
      } else if (t < 0.66) {
        const e = Math.pow((t - 0.42) / 0.24, 0.8);
        shLx = lerp(2.85, 0.8, e);
        shLz = lerp(-0.55, 0.85, e);
        elL = lerp(0.75, 0.08, e);
        bladeW = lerp(0.85, -2.3, e);
        twist = lerp(0.5, -0.55, e);
        bladeZ = lerp(0, 0.6, e);
        lean = -0.12 * e;
      } else {
        const e = ease((t - 0.66) / 0.34);
        shLx = lerp(0.8, 0.38, e);
        shLz = lerp(0.85, -0.12, e);
        elL = lerp(0.08, 0.5, e);
        bladeW = lerp(-2.3, -2.1, e);
        twist = lerp(-0.55, 0, e);
        bladeZ = lerp(0.6, 0, e);
        lean = lerp(-0.12, 0, e);
      }
    } else if (a && a.type === "jab") {
      const t = a.t / a.dur;
      if (t < 0.28) {
        const e = ease(t / 0.28);
        shLx = lerp(0.38, 0.15, e);
        elL = lerp(0.5, 1.55, e);
        bladeW = -1.57;
        twist = lerp(0, 0.25, e);
      } else if (t < 0.52) {
        const e = Math.pow((t - 0.28) / 0.24, 0.6);
        shLx = lerp(0.15, 1.52, e);
        elL = lerp(1.55, 0.04, e);
        bladeW = -1.57;
        twist = lerp(0.25, -0.15, e);
        lean = -0.22 * e;
        shLz = lerp(-0.12, 0.18, e);
      } else {
        const e = ease((t - 0.52) / 0.48);
        shLx = lerp(1.52, 0.38, e);
        elL = lerp(0.04, 0.5, e);
        bladeW = lerp(-1.57, -2.1, e);
        twist = lerp(-0.15, 0, e);
        lean = lerp(-0.22, 0, e);
        shLz = lerp(0.18, -0.12, e);
      }
    } else if (p.block) {
      shLx = 1.05;
      shLz = 0.62;
      elL = 1.05;
      bladeW = -0.15 + Math.sin(T * 7) * 0.03;
      bladeZ = -0.5;
      twist = -0.1;
    }
    if (p.grip || p.liftCrate) {
      shRx = 1.5;
      shRz = -0.06;
      elR = 0.06 + Math.min(0.3, p.gripT * 0.12);
      lean = -0.04;
    } else if (p.doorPull) {
      shRx = 1.45;
      shRz = -0.06;
      elR = 0.1 + p.doorPull.pull * 0.5;
      lean = 0.06 + p.doorPull.pull * 0.14;
    } else if (gripCand && key.f === false && p.gripCd <= 0) {
      /* idle */
    }
    if (p.saber) {
      const t = p.saber.t;
      if (p.saber.phase === "out" && t < 0.3) {
        const e = ease(t / 0.3);
        shLx = lerp(0.9, 1.45, e);
        shLz = lerp(-0.6, -0.05, e);
        elL = lerp(0.9, 0.1, e);
        twist = lerp(-0.3, 0.15, e);
      } else {
        shLx = 1.15;
        shLz = -0.25;
        elL = 0.35;
        twist = 0;
      }
    }
    if (p.stagger > 0) {
      lean = 0.25;
      shLx = 0.6;
      shLz = -0.5;
      shRx = 0.6;
      shRz = 0.5;
      bladeW = -1.6;
    }
    setRot(P.L.sh, shLx, 0, shLz, k, dt);
    setRot(P.L.el, elL, 0, 0, k, dt);
    setRot(P.R.sh, shRx, 0, shRz, k, dt);
    setRot(P.R.el, elR, 0, 0, k, dt);
    const rel = bladeW - (P.L.sh.rotation.x + P.L.el.rotation.x);
    P.bladePivot.rotation.x = rel;
    P.bladePivot.rotation.z = damp(P.bladePivot.rotation.z, bladeZ, k, dt);
    P.body.rotation.y = damp(P.body.rotation.y, twist, 12, dt);
    P.body.rotation.x = damp(P.body.rotation.x, lean, 10, dt);
    P.body.position.y = damp(P.body.position.y, bob, 14, dt);
    setRot(P.legs[0].hip, thL, 0, 0, k, dt);
    setRot(P.legs[1].hip, thR, 0, 0, k, dt);
    setRot(P.legs[0].knee, knL, 0, 0, k, dt);
    setRot(P.legs[1].knee, knR, 0, 0, k, dt);
  }
  function animateCape(dt) {
    if (SEV.ready) return;
    const p = player,
      pos = P.capeGeo.attributes.position,
      rest = P.capeRest;
    const sp = Math.abs(p.vel) / 2.1,
      fl = p.atk
        ? Math.sin(clamp(p.atk.t / p.atk.dur, 0, 1) * Math.PI) *
          (p.atk.type === "swing" ? 0.35 : 0.15)
        : 0;
    const tw = P.body.rotation.y;
    for (let i = 0; i < pos.count; i++) {
      const x = rest[i * 3],
        y = rest[i * 3 + 1],
        z = rest[i * 3 + 2];
      const t = clamp((1.7 - y) / 1.72, 0, 1),
        t2 = t * t;
      const wave =
        Math.sin(T * 1.7 + y * 2.4 + x * 1.5) * 0.035 +
        Math.sin(T * 2.9 + y * 4) * 0.015;
      pos.setXYZ(
        i,
        x + t * 0.04 * Math.sin(T * 1.2 + y * 3) + t2 * tw * 0.25,
        y + t2 * sp * 0.04,
        z +
          t2 * (sp * 0.32 + fl) +
          t * wave +
          t2 * Math.abs(P.body.rotation.x) * 0.4,
      );
    }
    pos.needsUpdate = true;
    P.capeGeo.computeVertexNormals();
  }

  /* ================= updates ================= */
