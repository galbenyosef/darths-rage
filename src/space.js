// space — space
// Lines 1178-1478 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= space ================= */
  const space = new THREE.Group();
  scene.add(space);
  (function buildSpace() {
    // deep-space backdrop: a teal nebula drawn per pixel on a sky sphere, so it stays sharp at any resolution
    const NOISE = `
    float h3(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
      return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fbm(vec3 p){float a=0.,s=.5;for(int i=0;i<7;i++){a+=vn(p)*s;p=p*2.03+vec3(1.7,9.2,3.1);s*=.5;}return a;}`;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(2900, 64, 48),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader:
          "varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader:
          NOISE +
          `
    varying vec3 vD;
    void main(){
      vec3 d=normalize(vD);
      // the nebula drifts in a broad diagonal band across the view out of the bay window
      vec3 bandN=normalize(vec3(0.42,1.0,0.18));float band=exp(-pow(dot(d,bandN)+0.08,2.)*7.);
      vec3 q=d*2.6;vec3 w=vec3(fbm(q+vec3(0,0,0)),fbm(q+vec3(5.2,1.3,2.8)),fbm(q+vec3(1.7,9.2,4.1)));
      float n=fbm(q*1.35+w*2.2);
      float wisp=fbm(q*4.2+w*3.0);
      float dens=smoothstep(.40,.78,n)*band;
      float fil=smoothstep(.52,.8,wisp)*dens;
      vec3 base=vec3(.001,.003,.006)+vec3(.0,.008,.012)*band*n;
      vec3 teal=vec3(.03,.30,.38),cyan=vec3(.25,.85,.95),deep=vec3(.02,.08,.16);
      vec3 col=base+deep*dens*1.4+teal*pow(dens,1.6)*1.1+cyan*fil*0.55;
      // dark dust lanes cut through it
      float dust=smoothstep(.5,.75,fbm(q*2.1+vec3(7.,3.,1.)));col*=1.-dust*.55*band;
      gl_FragColor=vec4(col*.55,1.);
    }`,
      }),
    );
    space.add(sky);
    // stars in three layers of brightness, a little brighter where the nebula is
    const layer = (n, size, bright, tint) => {
      const pos = new Float32Array(n * 3),
        col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = Math.random() * 2 - 1,
          th = Math.random() * Math.PI * 2,
          r = 2700,
          s2 = Math.sqrt(1 - u * u);
        pos[i * 3] = r * s2 * Math.cos(th);
        pos[i * 3 + 1] = r * u;
        pos[i * 3 + 2] = r * s2 * Math.sin(th);
        const k = bright * rnd(0.45, 1),
          c = Math.random();
        const t =
          c < 0.6
            ? [0.85, 0.93, 1]
            : c < 0.85
              ? [0.7, 0.95, 1]
              : [1, 0.92, 0.8];
        col[i * 3] = t[0] * k * tint;
        col[i * 3 + 1] = t[1] * k * tint;
        col[i * 3 + 2] = t[2] * k * tint;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      space.add(
        new THREE.Points(
          g,
          new THREE.PointsMaterial({
            size,
            sizeAttenuation: false,
            vertexColors: true,
            fog: false,
            depthWrite: false,
            toneMapped: false,
          }),
        ),
      );
    };
    layer(9000, 1.0, 0.75, 1);
    layer(2200, 1.6, 1.0, 1.2);
    layer(320, 2.4, 1.6, 1.6);
    // a few bright stars with a soft glow
    for (let i = 0; i < 26; i++) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: new THREE.Color(0.55, 0.9, 1).multiplyScalar(rnd(0.6, 1.4)),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
          transparent: true,
          toneMapped: false,
        }),
      );
      const th = rnd(-0.9, 0.9),
        ph = rnd(-0.35, 0.55);
      sp.position.set(
        Math.sin(th) * 2600 * Math.cos(ph),
        Math.sin(ph) * 2600,
        -Math.cos(th) * 2600 * Math.cos(ph),
      );
      const sc = rnd(18, 46);
      sp.scale.set(sc, sc, 1);
      space.add(sp);
    }
    // planets: lit from the upper right, with a cold blue rim
    const planetTex = (seed, dark) => {
      const W = 1024,
        H = 512,
        c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g2 = c.getContext("2d"),
        img = g2.createImageData(W, H);
      const perm = new Uint8Array(512);
      for (let i = 0; i < 256; i++) perm[i] = i;
      for (let i = 255; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }
      for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
      const hash = (x, y) => perm[(perm[x & 255] + (y & 255)) & 511] / 255;
      const vn = (x, y) => {
        const xi = Math.floor(x),
          yi = Math.floor(y),
          xf = x - xi,
          yf = y - yi,
          u = xf * xf * (3 - 2 * xf),
          v = yf * yf * (3 - 2 * yf);
        return lerp(
          lerp(hash(xi, yi), hash(xi + 1, yi), u),
          lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u),
          v,
        );
      };
      const fbm = (x, y) => {
        let a = 0,
          f = 1,
          s = 0.5;
        for (let o = 0; o < 6; o++) {
          a += vn(x * f + seed, y * f) * s;
          f *= 2;
          s *= 0.5;
        }
        return a;
      };
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const n = fbm(x / 90, y / 40),
            m = fbm(x / 26 + 9, y / 26),
            k = 0.55 * n + 0.45 * m;
          const v = dark ? lerp(40, 150, k) : lerp(70, 190, k);
          img.data[i] = v * 0.78;
          img.data[i + 1] = v * 0.9;
          img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
      g2.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.wrapS = THREE.RepeatWrapping;
      t.anisotropy = 8;
      return t;
    };
    const planetMat = (tex) =>
      new THREE.ShaderMaterial({
        fog: false,
        uniforms: {
          map: { value: tex },
          L: { value: new THREE.Vector3(0.8, 0.4, 0.65).normalize() },
        },
        vertexShader:
          "varying vec2 vU;varying vec3 vN;varying vec3 vV;void main(){vU=uv;vN=normalize(mat3(modelMatrix)*normal);vec4 wp=modelMatrix*vec4(position,1.);vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}",
        fragmentShader:
          "uniform sampler2D map;uniform vec3 L;varying vec2 vU;varying vec3 vN;varying vec3 vV;void main(){vec3 n=normalize(vN);float d=dot(n,L);float lit=smoothstep(-.08,.55,d);vec3 c=texture2D(map,vU).rgb;c=pow(c,vec3(2.2));vec3 col=c*lit*1.25+c*.015;float rim=pow(1.-max(dot(n,normalize(vV)),0.),3.);col+=vec3(.25,.6,.8)*rim*(.15+.85*smoothstep(-.3,.5,d))*.9;gl_FragColor=vec4(col,1.);}",
      });
    const big = new THREE.Mesh(
      new THREE.SphereGeometry(330, 96, 64),
      planetMat(planetTex(3, true)),
    );
    big.position.set(-1050, -170, -2000);
    big.rotation.set(0.3, 1.2, 0.15);
    space.add(big);
    const atm = new THREE.Mesh(
      new THREE.SphereGeometry(345, 96, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
        fog: false,
        vertexShader:
          "varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}",
        fragmentShader:
          "varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(vN,vV)),4.);gl_FragColor=vec4(vec3(.2,.55,.75)*f*1.2,f);}",
      }),
    );
    atm.position.copy(big.position);
    space.add(atm);
    for (const [r, x, y, z, sd] of [
      [42, 640, 90, -1950, 7],
      [16, -180, 420, -2300, 11],
      [11, -420, -120, -2250, 19],
    ]) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(r, 48, 32),
        planetMat(planetTex(sd, false)),
      );
      m.position.set(x, y, z);
      m.rotation.y = rnd(0, 6);
      space.add(m);
    }
  })();

  /* ---- courier ship ---- */
  const ship = new THREE.Group();
  scene.add(ship);
  const engines = [];
  (function buildShip() {
    const add = (w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      ship.add(m);
      return m;
    };
    add(3.4, 2.2, 11, materials.ship, 0, 0, -5.5);
    add(4.6, 1.2, 5, materials.ship, 0, -0.4, -2.5);
    add(1.2, 1.6, 6, materials.shipDark, 0, 1.6, -4);
    add(2.2, 1.2, 2.5, materials.ship, 0, 0.2, -12);
    add(1.4, 0.9, 7, materials.ship, -2.6, -0.2, -4);
    add(1.4, 0.9, 7, materials.ship, 2.6, -0.2, -4);
    add(5.6, 4.2, 1.8, materials.ship, 0, 0, 0.4);
    for (let i = 0; i < 26; i++)
      add(
        rnd(0.3, 1.2),
        rnd(0.2, 0.6),
        rnd(0.4, 2),
        Math.random() < 0.5 ? materials.shipDark : materials.ship,
        rnd(-2.2, 2.2),
        rnd(-1.3, 1.6),
        rnd(-11, -1),
      );
    const noz = new THREE.CylinderGeometry(0.55, 0.62, 1.3, 16, 1, true),
      disc = new THREE.CircleGeometry(0.5, 20);
    const grid = [
      [-1.85, 1.25],
      [-0.62, 1.3],
      [0.62, 1.3],
      [1.85, 1.25],
      [-1.25, 0],
      [0, 0.05],
      [1.25, 0],
      [-1.85, -1.2],
      [-0.62, -1.25],
      [0.62, -1.25],
      [1.85, -1.2],
    ];
    for (const [x, y] of grid) {
      const n = new THREE.Mesh(noz, materials.shipDark);
      n.rotation.x = Math.PI / 2;
      n.position.set(x, y, 1.6);
      ship.add(n);
      const d = new THREE.Mesh(disc, materials.engine);
      d.position.set(x, y, 1.9);
      ship.add(d);
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xff9a40,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          fog: false,
          toneMapped: false,
        }),
      );
      s.position.set(x, y, 2.2);
      s.scale.set(1.6, 1.6, 1);
      ship.add(s);
      engines.push(s);
    }
  })();
  const SHIP0 = vec3(0, 1.2, -162);
  function resetShip() {
    ship.position.copy(SHIP0);
    ship.rotation.set(0, 0, 0);
    ship.visible = true;
    materials.engine.color.setRGB(0.5, 0.25, 0.08);
    for (const e of engines) {
      e.material.opacity = e.userData.halo ? 0 : 0.35;
      e.scale.set(1.6, 1.6, 1);
    }
    for (const m of shipGlowMats) m.emissiveIntensity = 0.6;
  }

