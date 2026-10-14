// index-inline-1 20 — three
// Lines 5027-5307 of readable/index-inline-1.pretty.js (statement-aligned).
  function severLimb(s, name, dirV) {
    const R = s.T,
      tris = TR.limbs && TR.limbs[name];
    if (!R || !R.skin || !tris || !tris.length) return false;
    const sk = R.skin;
    s.root.updateMatrixWorld(true);
    sk.skeleton.update();
    const rb = R.model.getObjectByName("mixamorig" + name);
    const joint = V3();
    rb.getWorldPosition(joint);
    const uv = sk.geometry.attributes.uv,
      src = sk.geometry.attributes.position,
      pos = new Float32Array(tris.length * 3),
      uvs = new Float32Array(tris.length * 2),
      v = V3();
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
      M.ember,
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
        .add(V3(rnd(-0.8, 0.8), up, rnd(-0.8, 0.8))),
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
      M.ember,
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
        const c = new THREE.Mesh(G.gun, M.gun);
        c.position.y = -0.12;
        gg.add(c);
        addDebris(
          gg,
          dirV
            .clone()
            .multiplyScalar(2)
            .add(V3(0, 2.5, 0)),
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
    const a = V3(),
      b = V3();
    P.blade.getWorldPosition(a);
    P.bladeTip.getWorldPosition(b);
    let best = null,
      bd = 1e9;
    for (let i = 0; i <= 10; i++) {
      const q = V3().lerpVectors(a, b, i / 10);
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
      right = V3(Math.cos(s.root.rotation.y), 0, -Math.sin(s.root.rotation.y));
    const lat = (hit.x - s.pos.x) * right.x + (hit.z - s.pos.z) * right.z;
    const side = lat >= 0 ? "Right" : "Left";
    const sh = V3(),
      hp = V3(),
      kn = V3();
    B.RightArm.getWorldPosition(sh);
    B.Hips.getWorldPosition(hp);
    (B[side + "UpLeg"] || B.Hips).getWorldPosition(kn);
    const kneeY = hp.y * 0.5;
    if (y >= sh.y - 0.06) return Math.abs(lat) > 0.1 ? side + "Arm" : null; // head and neck height: cut down, nothing comes off
    if (y > hp.y) return Math.abs(lat) > 0.17 ? side + "ForeArm" : null; // torso unless the blade caught a hanging arm
    return y < kneeY ? side + "Leg" : side + "UpLeg";
  }
  function kill(s, how, dirV, hitPt, forceCut) {
    if (!s.alive) return;
    const wasDown = s.st === "down";
    if (wasDown && s.T) s.T.flyDeath = true;
    if (s.hasCard) dropCard(s);
    if (player.grip === s) {
      player.grip = null;
      player.gripCd = 3;
      sfx.gripStop();
    }
    s.alive = false;
    s.st = "dead";
    s.deadT = 0;
    stats.kills++;
    speak(s, "dying", true);
    for (const o of s.outl) o.visible = false;
    s.highlight = false;
    s.lens.material.color.setRGB(0, 0, 0);
    chest(s, tmpV);
    const away = dirV || tmpV2.copy(s.pos).sub(player.pos).setY(0).normalize();
    if (how === "blade") {
      if (T - lastSlowT > 1.1 && !reduce) {
        slowMo = SLOWMO_LEN;
        lastSlowT = T;
      } else hitStop = reduce ? 0.03 : 0.06;
      shake = Math.max(shake, 0.5);
      flashV = 0.6;
      hitKick = 1;
      const r = Math.random();
      let cut = false;
      if (TR.ready && s.T && TR.limbs) {
        // vary the outcome: cut in half, head off, or whatever the blade actually caught
        const pickCut = () => {
          const q = Math.random();
          if (q < 0.28) return "Spine";
          if (q < 0.52) return "Neck";
          const at = !wasDown && hitPt ? limbAt(s, hitPt) : null;
          return (
            at ||
            pick([
              "RightArm",
              "LeftArm",
              "RightForeArm",
              "LeftForeArm",
              "RightUpLeg",
              "LeftUpLeg",
              "RightLeg",
              "LeftLeg",
            ])
          );
        };
        let c = forceCut || pickCut();
        if (!forceCut && c === TR.lastCut) c = pickCut();
        TR.lastCut = c;
        cut = severLimb(s, c, away);
        if (cut && (c === "Neck" || c === "Spine"))
          speeches = speeches.filter((x) => x.s !== s);
        if (c === "Spine" && cut) {
          burst(tmpV.copy(s.pos).setY(1.0), 50, "r", away, 6);
          smoke(tmpV, 4, 0.9);
        }
        if (!cut) {
          if (s.hasGun && Math.random() < 0.5) sliceGun(s, away);
          else dropGun(s);
        }
      } else if (r < 0.62) severArm(s, away);
      else if (r < 0.88 && s.hasGun) sliceGun(s, away);
      else dropGun(s);
      burst(tmpV, 40, "r", away, 7);
      smoke(tmpV, 4, 0.7);
      sfx.cut(panOf(tmpV));
    } else if (how === "bolt") {
      burst(tmpV, 16, "b", away, 5);
      dropGun(s);
      sfx.boltHit(panOf(tmpV));
    } else if (how === "grip") {
      sfx.crunch();
      shake = Math.max(shake, 0.9);
      flashV = Math.max(flashV, 0.35);
      hitKick = Math.max(hitKick, 0.8);
      dropGun(s);
      if (s.T) s.T.flyDeath = true;
      const th = tmpV2.copy(s.pos).sub(player.pos).setY(0);
      if (th.lengthSq() < 1e-4) forward(player.yaw, th);
      const r = Math.random(),
        ang = r < 0.4 ? rnd(-0.25, 0.25) : (r < 0.7 ? 1 : -1) * rnd(0.75, 1.2); // straight back, or flung off to the left or right
      s.kv = rotY(th.clone().normalize(), ang).multiplyScalar(rnd(5.5, 6.5));
      s.thrown = new Set();
    } else if (how === "crate") {
      sfx.crunch();
      shake = Math.max(shake, 0.75);
      flashV = Math.max(flashV, 0.3);
      hitKick = Math.max(hitKick, 0.8);
      dropGun(s);
      if (s.T) s.T.flyDeath = true;
      burst(tmpV, 22, "w", away, 5);
      smoke(tmpV, 3, 0.8);
      s.kv = away.clone().setY(0).normalize().multiplyScalar(rnd(6.5, 8.5));
      s.thrown = new Set();
    }
    for (const e of soldiers) {
      if (e !== s && e.alive && !e.gone && e.pos.distanceTo(s.pos) < 9) {
        e.fear += 0.3;
        if (Math.random() < 0.35) speak(e, "brk");
      }
    }
  }
  const pushRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.8, 56),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.1, 1.2, 1.5),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  pushRing.visible = false;
  scene.add(pushRing);
  const pushFx = { t: -1, origin: V3(), dir: V3() };
