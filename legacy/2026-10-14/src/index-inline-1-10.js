// index-inline-1 10 — three
// Lines 2115-2379 of readable/index-inline-1.pretty.js (statement-aligned).
  function armDir(a, b, out) {
    return out.set(
      Math.cos(a) * Math.sin(b),
      -Math.cos(a) * Math.cos(b),
      -Math.sin(a),
    );
  }
  function setupSevrane(gltf) {
    const model = gltf.scene;
    const holder = new THREE.Group();
    holder.rotation.y = Math.PI;
    holder.add(model);
    const box = new THREE.Box3().setFromObject(model);
    holder.scale.setScalar(2.08 / Math.max(0.5, box.max.y - box.min.y));
    const env = (() => {
      const es = new THREE.Scene();
      es.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(10, 6, 10),
          new THREE.MeshBasicMaterial({
            color: 0x050303,
            side: THREE.BackSide,
          }),
        ),
      );
      const pnl = (c, x, y, z, ry) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(2.5, 3),
          new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }),
        );
        m.position.set(x, y, z);
        m.rotation.y = ry;
        es.add(m);
      };
      pnl(new THREE.Color(2.2, 0.12, 0.06), -3, 1, 1, Math.PI / 2);
      pnl(new THREE.Color(0.9, 0.05, 0.03), 3, 0.5, -1, -Math.PI / 2);
      pnl(new THREE.Color(0.35, 0.4, 0.55), 0, 2.9, -3, 0);
      const pm = new THREE.PMREMGenerator(renderer);
      const t = pm.fromScene(es, 0.04).texture;
      pm.dispose();
      return t;
    })();
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        const m = o.material;
        const pm = new THREE.MeshStandardMaterial({
          map: m.map,
          normalMap: m.normalMap,
          roughnessMap: m.roughnessMap,
          metalnessMap: m.metalnessMap,
          emissiveMap: m.emissiveMap,
          emissive: new THREE.Color(0, 0, 0),
          metalness: m.metalness,
          roughness: Math.max(m.roughness, 0.85),
          envMap: env,
          envMapIntensity: 0,
          side: THREE.DoubleSide,
        });
        if (m.normalScale) pm.normalScale.copy(m.normalScale);
        o.material = pm;
        SEV.mat = pm;
      }
    });
    const find = (n) =>
      model.getObjectByName("mixamorig" + n) ||
      model.getObjectByName("mixamorig:" + n) ||
      model.getObjectByName(n);
    const B = {};
    for (const n of [
      "Hips",
      "Spine1",
      "Spine2",
      "Head",
      "LeftArm",
      "LeftForeArm",
      "LeftHand",
      "LeftHandMiddle1",
      "RightArm",
      "RightForeArm",
      "RightHand",
      "RightHandMiddle1",
      "LeftFoot",
      "RightFoot",
      "LeftUpLeg",
      "RightUpLeg",
    ])
      B[n] = find(n);
    if (Object.values(B).some((b) => !b)) {
      console.warn("Sevrane rig incomplete");
      return;
    }
    SEV.B = B;
    SEV.model = model;
    SEV.holder = holder;
    const mixer = new THREE.AnimationMixer(model);
    SEV.mixer = mixer;
    const clip = (n) => gltf.animations.find((c) => c.name === n);
    const walk = clip("Walking") || gltf.animations[0];
    // choose the most planted frame of the walk for standing still
    const probe = mixer.clipAction(walk);
    probe.play();
    let best = 0,
      bd = 1e9;
    for (let i = 0; i < 40; i++) {
      const t = (walk.duration * i) / 40;
      probe.time = t;
      mixer.update(0);
      model.updateMatrixWorld(true);
      B.LeftFoot.getWorldPosition(_a);
      B.RightFoot.getWorldPosition(_b);
      const d = Math.hypot(_a.x - _b.x, _a.z - _b.z);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    probe.stop();
    SEV.walk = mixer.clipAction(walk);
    SEV.walk.play();
    const idleClip = walk.clone();
    idleClip.name = "Idle";
    SEV.idle = mixer.clipAction(idleClip);
    SEV.idle.play();
    SEV.idle.time = best;
    SEV.idle.timeScale = 0;
    SEV.walk.setEffectiveWeight(0);
    SEV.idle.setEffectiveWeight(1);
    SEV.attacks = ATTACKS.map((a) => {
      const c = clip(a.clip);
      if (!c) return null;
      const act = mixer.clipAction(c);
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
      act.play();
      act.paused = true;
      act.setEffectiveWeight(0);
      return act;
    });
    if (SEV.attacks.every((a) => !a)) SEV.attacks = null;
    SEV.atkI = -1;
    SEV.skill = null;
    SEV.skillW = 0;
    SEV.fsign = 1;
    SEV.hipsXZ = [B.Hips.position.x, B.Hips.position.z];
    // procedural Sevrane becomes invisible scaffolding; the blade moves to the model's left hand
    for (const c of [...P.root.children]) c.visible = false;
    P.root.add(holder);
    const hilt = new THREE.Group();
    bladeG.add(hilt); // the hilt modelled into his fist was removed; this one travels with the blade
    hilt.add(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.028, 0.28, 12),
        M.hilt,
      ),
    );
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.034, 0.04, 12),
      M.dark,
    );
    cap.position.y = 0.12;
    hilt.add(cap);
    bladeG.add(P.blade);
    P.blade.position.set(0, 0.14, 0);
    P.blade.rotation.set(0, 0, 0);
    SEV.ready = true;
  }
  function modelFail(e) {
    console.warn("Sevrane model failed to load", e);
    const n = $("modelNote");
    if (n) {
      n.hidden = false;
      n.textContent =
        "Sevrane's model didn't load, so a stand-in is showing. Reload the page to try again.";
    }
  }
  async function fetchModel(prefix) {
    const [jr, br] = await Promise.all([
      fetch(prefix + "-model.json"),
      fetch(prefix + "-geometry.json"),
    ]);
    if (!jr.ok || !br.ok)
      throw new Error(
        prefix + " files unavailable (" + jr.status + "/" + br.status + ")",
      );
    const jsonTxt = await jr.text(),
      b64 = (await br.json()).b64;
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const enc = new TextEncoder();
    let jb = enc.encode(jsonTxt);
    const jl = Math.ceil(jb.length / 4) * 4,
      bl = Math.ceil(bin.length / 4) * 4;
    const total = 12 + 8 + jl + 8 + bl,
      ab = new ArrayBuffer(total),
      dv = new DataView(ab),
      u8 = new Uint8Array(ab);
    dv.setUint32(0, 0x46546c67, true);
    dv.setUint32(4, 2, true);
    dv.setUint32(8, total, true);
    dv.setUint32(12, jl, true);
    dv.setUint32(16, 0x4e4f534a, true);
    u8.fill(0x20, 20, 20 + jl);
    u8.set(jb, 20);
    const bo = 20 + jl;
    dv.setUint32(bo, bl, true);
    dv.setUint32(bo + 4, 0x004e4942, true);
    u8.set(bin, bo + 8);
    return new Promise((res, rej) =>
      new THREE.GLTFLoader().parse(ab, "./", res, rej),
    );
  }
  async function loadSevrane() {
    if (!THREE.GLTFLoader) return modelFail("loader missing");
    try {
      const [jr, br] = await Promise.all([
        fetch("sevrane-model.json"),
        fetch("sevrane-geometry.json"),
      ]);
      if (!jr.ok || !br.ok)
        throw new Error(
          "model files unavailable (" + jr.status + "/" + br.status + ")",
        );
      const jsonTxt = await jr.text(),
        b64 = (await br.json()).b64;
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      // assemble a binary glTF in memory: header, JSON chunk, BIN chunk
      const enc = new TextEncoder();
      let jb = enc.encode(jsonTxt);
      const jl = Math.ceil(jb.length / 4) * 4,
        bl = Math.ceil(bin.length / 4) * 4;
      const total = 12 + 8 + jl + 8 + bl,
        ab = new ArrayBuffer(total),
        dv = new DataView(ab),
        u8 = new Uint8Array(ab);
      dv.setUint32(0, 0x46546c67, true);
      dv.setUint32(4, 2, true);
      dv.setUint32(8, total, true);
      dv.setUint32(12, jl, true);
      dv.setUint32(16, 0x4e4f534a, true);
      u8.fill(0x20, 20, 20 + jl);
      u8.set(jb, 20);
      const bo = 20 + jl;
      dv.setUint32(bo, bl, true);
      dv.setUint32(bo + 4, 0x004e4942, true);
      u8.set(bin, bo + 8);
      new THREE.GLTFLoader().parse(
        ab,
        "./",
        (g) => {
          try {
            setupSevrane(g);
            if (!SEV.ready) modelFail("rig not recognised");
          } catch (e) {
            modelFail(e);
          }
        },
        modelFail,
      );
    } catch (e) {
      modelFail(e);
    }
  }
  loadSevrane();
