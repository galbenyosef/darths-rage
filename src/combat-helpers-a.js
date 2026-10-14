// combat-helpers-a — combat helpers (part 1 of 3)
// Lines 4856-5185 of readable/index-inline-1.pretty.js (statement-aligned).
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
    if (!s.hasGun || !player.stepped || elapsed - lastShotT < 0.045) return;
    lastShotT = elapsed;
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
    b.c.material = materials.bolt;
    b.g.quaternion.setFromUnitVectors(upAxis, dir);
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
      if (o.isMesh && o.material !== materials.outline) {
        const c = new THREE.Mesh(o.geometry, o.material);
        c.castShadow = true;
        const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        m.decompose(c.position, c.quaternion, c.scale);
        g.add(c);
      }
    });
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), materials.ember);
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
        .add(vec3(rnd(-1, 1), rnd(2, 3.5), rnd(-1, 1))),
      { m: e, sp, life: 1 },
    );
  }
  function sliceGun(s, dirV) {
    s.gun.updateWorldMatrix(true, true);
    for (let k = 0; k < 2; k++) {
      const g = new THREE.Group();
      s.gun.getWorldPosition(g.position);
      s.gun.getWorldQuaternion(g.quaternion);
      const c = new THREE.Mesh(soldierGeo.gun, materials.gun);
      c.scale.set(1, 0.5, 1);
      c.position.y = k ? -0.22 : -0.0;
      g.add(c);
      const e = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.012, 0.115),
        materials.ember,
      );
      e.position.y = k ? -0.11 : -0.11;
      g.add(e);
      addDebris(
        g,
        dirV
          .clone()
          .multiplyScalar(rnd(1.5, 3))
          .add(vec3(rnd(-1.5, 1.5), rnd(2, 4), rnd(-1, 1))),
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
    const c = new THREE.Mesh(soldierGeo.gun, materials.gun);
    c.position.y = -0.12;
    g.add(c);
    addDebris(g, vec3(rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1)), null);
    s.gun.visible = false;
    s.hasGun = false;
  }
  function severLimb(s, name, dirV) {
    const R = s.T,
      tris = trooperModel.limbs && trooperModel.limbs[name];
    if (!R || !R.skin || !tris || !tris.length) return false;
    const sk = R.skin;
    s.root.updateMatrixWorld(true);
    sk.skeleton.update();
    const rb = R.model.getObjectByName("mixamorig" + name);
    const joint = vec3();
    rb.getWorldPosition(joint);
    const uv = sk.geometry.attributes.uv,
      src = sk.geometry.attributes.position,
      pos = new Float32Array(tris.length * 3),
      uvs = new Float32Array(tris.length * 2),
      v = vec3();
    for (let i = 0; i < tris.length; i++) {
      v.fromBufferAttribute(src, tris[i]);
      sk.boneTransform(tris[i], v);
      v.applyMatrix4(sk.matrixWorld).sub(joint);
      pos.set([v.x, v.y, v.z], i * 3);
      if (uv) uvs.set([uv.getX(tris[i]), uv.getY(tris[i])], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    if (uv) g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    if (!g.boundingSphere || !(g.boundingSphere.radius < 1.2)) {
      g.dispose();
      return false;
    } // never spawn a broken piece
    const piece = new THREE.Group();
    piece.position.copy(joint);
    const lm = R.mat.clone();
    lm.emissive.setRGB(0, 0, 0);
    lm.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(g, lm);
    mesh.castShadow = true;
    piece.add(mesh);
    const big = name === "Spine" ? 2.2 : name === "Neck" ? 1.4 : 1;
    const e = new THREE.Mesh(
      new THREE.SphereGeometry(0.055 * big, 8, 6),
      materials.ember,
    );
    e.scale.set(1, name === "Spine" ? 0.35 : 1, 1);
    piece.add(e);
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
    sp.scale.set(0.45, 0.45, 1);
    piece.add(sp);
    const leg = /Leg$/.test(name);
    const up =
        name === "Neck"
          ? rnd(2.8, 4)
          : name === "Spine"
            ? rnd(0.8, 1.6)
            : leg
              ? rnd(0.5, 1.5)
              : rnd(2, 3.5),
      fw = name === "Spine" ? rnd(0.8, 1.6) : rnd(1.5, 3);
    addDebris(
      piece,
      dirV
        .clone()
        .multiplyScalar(fw)
        .add(vec3(rnd(-0.8, 0.8), up, rnd(-0.8, 0.8))),
      { m: e, sp, life: 1 },
    );
    if (name === "Spine") {
      const dd = debris[debris.length - 1];
      if (dd) dd.av.multiplyScalar(0.35);
    }
    R.cuts.push(name);
    // seared stump on the body
    const sm = new THREE.Mesh(
      new THREE.SphereGeometry(0.06 * big, 8, 6),
      materials.ember,
    );
    const ss = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xff6a20,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    ss.scale.set(0.5, 0.5, 1);
    scene.add(sm);
    scene.add(ss);
    R.stumps.push({ bone: rb, m: sm, sp: ss, life: 1 });
    if (/^(Right(Arm|ForeArm)|Spine)$/.test(name)) {
      if (s.hasGun) {
        s.gun.visible = false;
        s.hasGun = false;
        const gg = new THREE.Group();
        s.gun.getWorldPosition(gg.position);
        s.gun.getWorldQuaternion(gg.quaternion);
        const c = new THREE.Mesh(soldierGeo.gun, materials.gun);
        c.position.y = -0.12;
        gg.add(c);
        addDebris(
          gg,
          dirV
            .clone()
            .multiplyScalar(2)
            .add(vec3(0, 2.5, 0)),
          null,
        );
      }
      s.severed = true;
    }
    return true;
  }
  // where along the body did the blade connect?
  function bladeContact(s) {
    // the point on the blade closest to the soldier's body axis
    const a = vec3(),
      b = vec3();
    sevraneParts.blade.getWorldPosition(a);
    sevraneParts.bladeTip.getWorldPosition(b);
    let best = null,
      bd = 1e9;
    for (let i = 0; i <= 10; i++) {
      const q = vec3().lerpVectors(a, b, i / 10);
      const d = Math.hypot(q.x - s.pos.x, q.z - s.pos.z);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  }
  function limbAt(s, hit) {
    const B = s.T.B,
      y = hit.y,
      right = vec3(Math.cos(s.root.rotation.y), 0, -Math.sin(s.root.rotation.y));
    const lat = (hit.x - s.pos.x) * right.x + (hit.z - s.pos.z) * right.z;
    const side = lat >= 0 ? "Right" : "Left";
    const sh = vec3(),
      hp = vec3(),
      kn = vec3();
    B.RightArm.getWorldPosition(sh);
    B.Hips.getWorldPosition(hp);
    (B[side + "UpLeg"] || B.Hips).getWorldPosition(kn);
    const kneeY = hp.y * 0.5;
    if (y >= sh.y - 0.06) return Math.abs(lat) > 0.1 ? side + "Arm" : null; // head and neck height: cut down, nothing comes off
    if (y > hp.y) return Math.abs(lat) > 0.17 ? side + "ForeArm" : null; // torso unless the blade caught a hanging arm
    return y < kneeY ? side + "Leg" : side + "UpLeg";
  }
