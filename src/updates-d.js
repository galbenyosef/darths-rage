// updates-d — updates (part 4 of 4)
// Lines 6998-7272 of readable/index-inline-1.pretty.js (statement-aligned).
  function updateFx(dt) {
    for (let i = 0; i < SPN; i++) {
      const s = sparks[i];
      if (s.life > 0) {
        s.life -= dt;
        s.v.y -= 9 * dt;
        s.p.addScaledVector(s.v, dt);
        if (s.p.y < 0.02) {
          s.p.y = 0.02;
          s.v.y *= -0.35;
          s.v.x *= 0.6;
          s.v.z *= 0.6;
        }
        const k = Math.max(0, s.life / s.max);
        spPos[i * 3] = s.p.x;
        spPos[i * 3 + 1] = s.p.y;
        spPos[i * 3 + 2] = s.p.z;
        spCol[i * 3] = s.c[0] * k;
        spCol[i * 3 + 1] = s.c[1] * k;
        spCol[i * 3 + 2] = s.c[2] * k;
        const j = i * 6,
          tl = 0.045;
        stPos[j] = s.p.x;
        stPos[j + 1] = s.p.y;
        stPos[j + 2] = s.p.z;
        stPos[j + 3] = s.p.x - s.v.x * tl;
        stPos[j + 4] = s.p.y - s.v.y * tl;
        stPos[j + 5] = s.p.z - s.v.z * tl;
        stCol[j] = s.c[0] * k;
        stCol[j + 1] = s.c[1] * k;
        stCol[j + 2] = s.c[2] * k;
        stCol[j + 3] = stCol[j + 4] = stCol[j + 5] = 0;
      } else {
        spPos[i * 3 + 1] = -99;
        spCol[i * 3] = spCol[i * 3 + 1] = spCol[i * 3 + 2] = 0;
        const j = i * 6;
        stPos[j + 1] = stPos[j + 4] = -99;
        stCol[j] = stCol[j + 1] = stCol[j + 2] = 0;
      }
    }
    stGeo.attributes.position.needsUpdate = true;
    stGeo.attributes.color.needsUpdate = true;
    for (const f of flashes2) {
      if (f.t <= 0) continue;
      f.t -= dt;
      const k = Math.max(0, f.t / f.max);
      f.sp.material.opacity = k;
      const sc = f.s * (1.4 - 0.6 * k);
      f.sp.scale.set(sc, sc, 1);
      if (f.t <= 0) f.sp.visible = false;
    }
    spGeo.attributes.position.needsUpdate = true;
    spGeo.attributes.color.needsUpdate = true;
    for (const s of smokes) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.sp.position.addScaledVector(s.v, dt);
      const k = s.life / s.max;
      s.sp.material.opacity = 0.55 * k * Math.min(1, (s.max - s.life) * 4);
      const sc = s.s * (1 + (1 - k) * 2.2);
      s.sp.scale.set(sc, sc, 1);
      if (s.life <= 0) s.sp.visible = false;
    }
    for (const d of debris) {
      d.t += dt;
      if (d.ember) {
        d.ember.life = Math.max(0, d.ember.life - dt * 0.3);
        const k = d.ember.life;
        d.ember.m.scale.setScalar(Math.max(0.01, k));
        if (d.ember.sp) d.ember.sp.material.opacity = k;
        if (k > 0.4 && Math.random() < dt * 2) {
          d.g.getWorldPosition(tmpV);
          smoke(tmpV, 1, 0.3);
        }
      }
      if (d.rest) continue;
      d.v.y -= 9.8 * dt;
      d.g.position.addScaledVector(d.v, dt);
      d.g.rotation.x += d.av.x * dt;
      d.g.rotation.y += d.av.y * dt;
      d.g.rotation.z += d.av.z * dt;
      if (d.g.position.y < 0.08) {
        d.g.position.y = 0.08;
        d.v.y *= -0.3;
        d.v.x *= 0.55;
        d.v.z *= 0.55;
        d.av.multiplyScalar(0.5);
        if (Math.abs(d.v.y) < 0.6) {
          d.rest = true;
        }
      }
      const xl = d.g.position.z < CEND ? BAY_W / 2 - 0.2 : CORRIDOR_W / 2 - 0.2;
      if (Math.abs(d.g.position.x) > xl) {
        d.g.position.x = Math.sign(d.g.position.x) * xl;
        d.v.x *= -0.4;
      }
    }
    for (const f of flashes) {
      f.t -= dt;
      f.l.intensity = f.t > 0 ? 3.5 : 0;
    }
    if (pushFx.t >= 0) {
      pushFx.t += dt;
      const k = pushFx.t / 0.5;
      if (k >= 1) {
        pushFx.t = -1;
        pushRing.visible = false;
      } else {
        pushRing.position
          .copy(pushFx.origin)
          .addScaledVector(pushFx.dir, k * 7);
        pushRing.lookAt(tmpV.copy(pushRing.position).add(pushFx.dir));
        const sc = 1 + k * 3.5;
        pushRing.scale.set(sc, sc, 1);
        pushRing.material.opacity = 0.55 * (1 - k);
      }
    }
    speeches.forEach((s) => (s.t += dt));
    speeches = speeches.filter((s) => s.t < s.life);
    // trail
    const a = player.atk;
    if (a && player.ignite >= 1) {
      sevraneParts.bladeTip.getWorldPosition(tmpV);
      sevraneParts.blade.getWorldPosition(tmpV2);
      trailSamples.unshift({ b: tmpV2.clone(), t: tmpV.clone(), life: 1 });
    }
    for (const s of trailSamples) s.life -= dt * 6;
    while (
      trailSamples.length > TRAIL_N ||
      (trailSamples.length && trailSamples[trailSamples.length - 1].life <= 0)
    )
      trailSamples.pop();
    for (let i = 0; i < TRAIL_N; i++) {
      const s = trailSamples[Math.min(i, trailSamples.length - 1)];
      if (!s) {
        for (let k = 0; k < 6; k++) {
          trailPos[i * 6 + k] = 0;
          trailCol[i * 6 + k] = 0;
        }
        continue;
      }
      const k =
        Math.max(0, s.life) *
        (1 - i / TRAIL_N) *
        (i < trailSamples.length ? 1 : 0);
      trailPos.set([s.b.x, s.b.y, s.b.z, s.t.x, s.t.y, s.t.z], i * 6);
      trailCol.set(
        [0.9 * k, 0.04 * k, 0.02 * k, 1.6 * k, 0.15 * k, 0.06 * k],
        i * 6,
      );
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
  }

  const titleRim = new THREE.PointLight(0xff1a0a, 0, 14, 2);
  scene.add(titleRim);
  const titleBack = new THREE.PointLight(0xff2010, 0, 9, 2);
  scene.add(titleBack);
  const titleFog = [];
  for (let i = 0; i < 22; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: smokeTex,
        color: new THREE.Color(1, 0.1, 0.05),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
        toneMapped: false,
      }),
    );
    sp.visible = false;
    scene.add(sp);
    titleFog.push({
      sp,
      a: Math.random() * 6.28,
      r: rnd(0.3, 2.6),
      y: rnd(0.15, 1.1),
      s: rnd(1.6, 3.2),
      sp0: rnd(0.04, 0.12) * (Math.random() < 0.5 ? -1 : 1),
      ph: Math.random() * 6.28,
      z: rnd(-2.5, 1.2),
    });
  }
  function updateTitle(dt) {
    const p = player;
    p.pos.set(0, 0, -0.6);
    p.yaw = 0;
    p.vel = 0;
    p.atk = null;
    p.block = false;
    p.grip = null;
    p.ignite = 1;
    sevraneParts.blade.visible = true;
    sevraneParts.blade.scale.y = 1;
    cardMesh.visible = false;
    for (const s of soldiers) s.root.visible = false;
    for (const f of titleFog) {
      f.a += f.sp0 * dt;
      f.sp.visible = true;
      f.sp.position.set(
        p.pos.x + Math.cos(f.a) * f.r,
        f.y + Math.sin(elapsed * 0.4 + f.ph) * 0.08,
        p.pos.z + f.z + Math.sin(f.a) * 0.6,
      );
      const sc = f.s * (1 + 0.08 * Math.sin(elapsed * 0.3 + f.ph));
      f.sp.scale.set(sc * 1.6, sc * 0.7, 1);
      f.sp.material.opacity =
        (0.09 + 0.04 * Math.sin(elapsed * 0.7 + f.ph)) * (reduce ? 0.8 : 1);
    }
    titleRim.position.set(0, 1.9, p.pos.z - 3.2);
    titleRim.intensity = 9 + Math.sin(elapsed * 1.7) * 0.6;
    titleBack.position.set(0, 0.5, p.pos.z - 1.2);
    titleBack.intensity = 3.5;
  }
  function leaveTitle() {
    for (const f of titleFog) f.sp.visible = false;
    titleRim.intensity = 0;
    titleBack.intensity = 0;
  }
  function updateLights(dt) {
    const p = player;
    updateElectrics(dt);
    updatePowerCut(dt);
    sevraneParts.bladeMid.getWorldPosition(tmpV);
    const fl = 0.92 + Math.random() * 0.08;
    bladeLight.position.copy(tmpV);
    bladeLight.intensity = p.ignite * 3.1 * fl;
    hemi.intensity = p.ignite * (mode === "title" ? 0.12 : 0.55);
    // torches: nearest aware lit soldiers
    const cands = soldiers
      .filter(
        (s) =>
          s.alive && !s.gone && s.aware && s.st !== "cower" && s.root.visible,
      )
      .sort(
        (a, b) =>
          a.pos.distanceToSquared(p.pos) - b.pos.distanceToSquared(p.pos),
      );
    torches.forEach((t, i) => {
      const s = cands[i];
      if (!s || p.ignite < 1) {
        t.intensity = 0;
        return;
      }
      s.lens.getWorldPosition(t.position);
      const wob = s.fear * 0.35;
      const tx = p.pos.x + Math.sin(elapsed * 9 + s.ph) * wob,
        ty = 1.4 + Math.sin(elapsed * 7.3 + s.ph) * wob * 0.6,
        tz = p.pos.z;
      if (s.st === "flee" || s.st === "carry") {
        forward(s.root.rotation.y, tmpV2);
        t.target.position.set(
          t.position.x + tmpV2.x * 5,
          0.3,
          t.position.z + tmpV2.z * 5,
        );
      } else if (s.st === "trapped") {
        t.target.position.set(
          t.position.x + Math.sin(elapsed * 13) * 0.6,
          1.5,
          t.position.z - 4,
        );
      } else if (s.st === "gripped") {
        t.target.position.set(
          t.position.x + Math.sin(elapsed * 17) * 3,
          Math.cos(elapsed * 11) * 2 + 2,
          t.position.z + Math.cos(elapsed * 13) * 3,
        );
      } else t.target.position.set(tx, ty, tz);
      t.intensity = 2.4 * (Math.random() < 0.015 ? 0.2 : 1);
    });
  }

