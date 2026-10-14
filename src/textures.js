// textures — textures
// Lines 108-386 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= textures ================= */
  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  function grime(g, w, h, n, a) {
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w,
        y = Math.random() * h,
        r = rnd(4, 40);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(20,18,16,${a * Math.random()})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  let seed = 1;
  const seededRandom = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const seededRange = (a, b) => a + seededRandom() * (b - a);
  function sharedTex(w, h, draw, rep) {
    // one drawing, used as colour, bump and roughness
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    draw(g, w, h);
    const mk = (srgb) => {
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (srgb) t.encoding = THREE.sRGBEncoding;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (rep) t.repeat.set(rep[0], rep[1]);
      return t;
    };
    return { map: mk(true), bump: mk(false), canvas: c };
  }
  function scratches(g, w, h, n) {
    for (let i = 0; i < n; i++) {
      const x = seededRange(0, w),
        y = seededRange(0, h),
        l = seededRange(6, 60),
        a = seededRange(-0.5, 0.5);
      g.strokeStyle = `rgba(150,150,155,${seededRange(0.04, 0.16)})`;
      g.lineWidth = seededRange(0.5, 1.6);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  }
  function stains(g, w, h, n, col) {
    for (let i = 0; i < n; i++) {
      const x = seededRange(0, w),
        y = seededRange(0, h),
        r = seededRange(8, 70);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col.replace("A", seededRange(0.15, 0.5).toFixed(2)));
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  const wallDraw = (g, w, h) => {
    seed = 7;
    g.fillStyle = "#232428";
    g.fillRect(0, 0, w, h);
    // big riveted plates with recessed seams and lit top-left edges
    const cols = [0, 0.5, 1],
      rows = [0, 0.18, 0.62, 1];
    for (let i = 0; i < cols.length - 1; i++)
      for (let j = 0; j < rows.length - 1; j++) {
        const x0 = cols[i] * w + 5,
          x1 = cols[i + 1] * w - 5,
          y0 = rows[j] * h + 5,
          y1 = rows[j + 1] * h - 5;
        const v = seededRange(30, 44) | 0;
        g.fillStyle = `rgb(${v},${v + 1},${v + 4})`;
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.fillStyle = "rgba(120,124,132,.35)";
        g.fillRect(x0, y0, x1 - x0, 2);
        g.fillRect(x0, y0, 2, y1 - y0);
        g.fillStyle = "rgba(0,0,0,.6)";
        g.fillRect(x0, y1 - 2, x1 - x0, 2);
        g.fillRect(x1 - 2, y0, 2, y1 - y0);
        g.fillStyle = "#5a5c62";
        for (let k = 0; k < 4; k++) {
          const bx = k % 2 ? x1 - 10 : x0 + 8,
            by = k < 2 ? y0 + 8 : y1 - 10;
          g.beginPath();
          g.arc(bx, by, 2.4, 0, Math.PI * 2);
          g.fill();
        }
      }
    // vent slats and a recessed hatch
    g.fillStyle = "#141518";
    for (let k = 0; k < 8; k++)
      g.fillRect(w * 0.56, h * 0.68 + k * 12, w * 0.36, 6);
    g.strokeStyle = "#121316";
    g.lineWidth = 4;
    g.strokeRect(w * 0.08, h * 0.24, w * 0.3, h * 0.32);
    g.fillStyle = "#2b2c31";
    g.fillRect(w * 0.08 + 6, h * 0.24 + 6, w * 0.3 - 12, h * 0.32 - 12);
    g.fillStyle = "#1a1b1e";
    g.fillRect(w * 0.2, h * 0.3, 10, h * 0.2);
    g.font = "bold 18px monospace";
    g.fillStyle = "rgba(120,30,28,.55)";
    g.fillText("AFT 0" + (seededRange(1, 9) | 0), w * 0.6, h * 0.12);
    scratches(g, w, h, 160);
    stains(g, w, h, 70, "rgba(8,6,5,A)");
    stains(g, w, h, 12, "rgba(60,22,14,A)");
  };
  const wallT = sharedTex(512, 512, wallDraw);
  const wallTex = wallT.map,
    wallBump = wallT.bump;
  const grateT = sharedTex(256, 256, (g, w, h) => {
    seed = 11;
    g.fillStyle = "#0d0e10";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3d3f45";
    for (let x = 0; x < w; x += 12) g.fillRect(x, 0, 5, h);
    g.fillStyle = "#2c2e33";
    for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 9);
    g.fillStyle = "rgba(160,160,165,.18)";
    for (let x = 0; x < w; x += 12) g.fillRect(x, 0, 1, h);
    scratches(g, w, h, 40);
    stains(g, w, h, 20, "rgba(0,0,0,A)");
  });
  const floorTex = sharedTex(256, 256, (g, w, h) => {
    seed = 13;
    g.fillStyle = "#26272b";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 128)
      for (let x = 0; x < w; x += 128) {
        g.fillStyle = "rgba(0,0,0,.7)";
        g.fillRect(x, y, 128, 3);
        g.fillRect(x, y, 3, 128);
      }
    g.fillStyle = "#34363b";
    for (let y = 10; y < h; y += 16)
      for (let x = 10; x < w; x += 16) {
        g.fillRect(x + ((y / 16) % 2 ? 4 : 0), y, 6, 2);
      }
    scratches(g, w, h, 80);
    stains(g, w, h, 30, "rgba(5,4,4,A)");
  }).map;
  const doorDraw = (g, w, h) => {
    g.fillStyle = "#7d828b";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#6a6f78";
    g.fillRect(20, 20, w - 40, h * 0.42);
    g.fillRect(20, h * 0.5, w - 40, h * 0.32);
    g.strokeStyle = "#3d4149";
    g.lineWidth = 5;
    g.strokeRect(20, 20, w - 40, h * 0.42);
    g.strokeRect(20, h * 0.5, w - 40, h * 0.32);
    for (let x = -h; x < w + h; x += 52) {
      g.fillStyle = "#b8902c";
      g.beginPath();
      g.moveTo(x, h * 0.86);
      g.lineTo(x + 26, h * 0.86);
      g.lineTo(x + 26 + h * 0.14, h);
      g.lineTo(x + h * 0.14, h);
      g.closePath();
      g.fill();
    }
    g.fillStyle = "#1e2024";
    for (let x = -h; x < w + h; x += 52) {
      g.beginPath();
      g.moveTo(x + 26, h * 0.86);
      g.lineTo(x + 52, h * 0.86);
      g.lineTo(x + 52 + h * 0.14, h);
      g.lineTo(x + 26 + h * 0.14, h);
      g.closePath();
      g.fill();
    }
    g.fillStyle = "#4a4e57";
    g.font = "bold 48px monospace";
    g.fillText("SEAL", w * 0.38, h * 0.7);
    grime(g, w, h, 60, 0.4);
  };
  const DOOR_W = 1.5,
    DOOR_H = 2.5; // the doorway in each bulkhead
  const hatchDraw = (g, w, h) => {
    g.fillStyle = "#5d6168";
    g.fillRect(0, 0, w, h);
    const rr = (x, y, ww, hh, r) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + ww, y, x + ww, y + hh, r);
      g.arcTo(x + ww, y + hh, x, y + hh, r);
      g.arcTo(x, y + hh, x, y, r);
      g.arcTo(x, y, x + ww, y, r);
      g.closePath();
    };
    rr(14, 14, w - 28, h - 28, 34);
    g.fillStyle = "#6c7078";
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = "#2e3137";
    g.stroke();
    rr(40, 40, w - 80, h - 80, 26);
    g.lineWidth = 3;
    g.strokeStyle = "#454950";
    g.stroke();
    g.fillStyle = "#3a3d43";
    g.fillRect(w / 2 - 3, 40, 6, h - 80);
    for (const cx of [w * 0.25, w * 0.75]) {
      rr(cx - 22, h * 0.22, 44, h * 0.56, 18);
      g.fillStyle = "#24262a";
      g.fill();
      g.strokeStyle = "#4d5158";
      g.lineWidth = 4;
      g.stroke();
      for (let y = h * 0.25; y < h * 0.76; y += 28) {
        g.fillStyle = "#565a61";
        g.fillRect(cx - 16, y, 32, 10);
      }
    }
    g.beginPath();
    g.arc(w / 2, h * 0.5, w * 0.17, 0, Math.PI * 2);
    g.fillStyle = "#50545b";
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = "#2c2f34";
    g.stroke();
    grime(g, w, h, 40, 0.35);
  };
  const doorTex = canvasTex(256, 512, hatchDraw);
  const ventTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#2a2c30";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#55595f";
    for (let x = 14; x < w - 10; x += 16) g.fillRect(x, 18, 7, h - 36);
    g.fillStyle = "#3a3d42";
    g.fillRect(0, h / 2 - 5, w, 10);
  });
  const glowTex = canvasTex(
    128,
    128,
    (g, w, h) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.25, "rgba(255,255,255,.45)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    },
    false,
  );
  const smokeTex = canvasTex(
    128,
    128,
    (g, w, h) => {
      for (let i = 0; i < 14; i++) {
        const x = rnd(40, 88),
          y = rnd(40, 88),
          r = rnd(18, 40);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, "rgba(255,255,255,.22)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      }
    },
    false,
  );

