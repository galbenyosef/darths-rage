// combat-helpers-c — combat helpers (part 3 of 3)
// Lines 5533-5616 of readable/index-inline-1.pretty.js (statement-aligned).
  function doorHit(d, point) {
    // the blade only scars a blast door now; it has to be torn out with the Force
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, rnd(0.6, 1.3), 0.03),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(4, 1.8, 0.5),
        toneMapped: false,
      }),
    );
    m.position.set(clamp(point.x, -0.6, 0.6), clamp(point.y, 0.4, 2.2), 0.13);
    m.rotation.z = rnd(-1, 1);
    d.slab.add(m);
    d.scars.push({ m, t: 0 });
    d.heat = Math.min(1, d.heat + 0.25);
    tmpV.set(m.position.x, point.y, d.z + 0.2);
    burst(tmpV, 24, "r", vec3(0, 0.3, 1), 5);
    smoke(tmpV, 1, 0.4);
    doorLight.position.set(m.position.x, point.y, d.z + 0.7);
    sfx.doorHit();
    shake = Math.max(shake, 0.25);
    hitKick = Math.max(hitKick, 0.6);
    hitStop = reduce ? 0.02 : 0.04;
    hintShown.doorCut = true;
  }
  function doorDown(d) {
    stats.doors++;
    const ps = secOf(player.pos.z);
    for (const s of soldiers) {
      if (s.alive && !s.gone && secOf(s.pos.z) === ps + 1) {
        s.fear += 0.35;
        if (s.st === "stare" || s.st === "wait" || s.st === "idle") {
          s.st = "hold";
        }
      }
    }
  }
  function ripDoor(d) {
    const p = player;
    d.state = "ripped";
    d.t = 0;
    d.pull = 1;
    d.rip = {
      side: Math.random() < 0.5 ? -1 : 1,
      mz: d.z + clamp((p.pos.z - d.z) * 0.4, 0.4, 1.7),
      hit: false,
      q0: d.pivot.quaternion.clone(),
    };
    d.slab.position.set(0, 0, 0);
    d.slab.rotation.set(0, 0, 0);
    sfx.doorRip();
    shake = Math.max(shake, 1.8);
    hitKick = 1;
    flashV = Math.max(flashV, 0.5);
    hitStop = reduce ? 0.03 : 0.1;
    for (let i = 0; i < 8; i++) {
      const x = i < 4 ? -DOOR_W / 2 : DOOR_W / 2;
      tmpV.set(x, rnd(0.2, DOOR_H - 0.2), d.z);
      burst(tmpV, 26, "r", vec3(-Math.sign(x) * 0.4, 0.2, 1), 7);
      smoke(tmpV, 2, 1.2);
    }
    tmpV.set(0, DOOR_H, d.z);
    burst(tmpV, 40, "w", vec3(0, -0.3, 1), 6);
    smoke(tmpV, 4, 1.4);
    doorDown(d);
  }
  function closeDoor(d) {
    d.state = "closing";
    d.t = 0;
    sfx.doorClose(panOf(tmpV.set(0, 2, d.z)));
    for (const s of soldiers) {
      if (!s.alive || s.gone) continue;
      if (Math.abs(s.pos.z - d.z) < 0.9) {
        s.pos.z = s.pos.z > d.z ? d.z + 0.9 : d.z - 0.9;
      }
      if (
        s.pos.z > d.z &&
        secOf(s.pos.z) === secOf(player.pos.z) &&
        s.pos.z - d.z < 14
      ) {
        speak(s, "trapped", true);
      }
    }
  }

