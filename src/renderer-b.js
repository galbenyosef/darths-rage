// renderer-b — renderer (part 2 of 2)
// Lines 42-107 of readable/index-inline-1.pretty.js (statement-aligned).
  const pixelRatio = Math.min(touchUI ? 1 : 1.5, window.devicePixelRatio || 1);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = !touchUI;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.05);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 4000);

  const rtOpts = renderer.capabilities.isWebGL2
    ? { type: THREE.HalfFloatType }
    : {};
  const composer = new THREE.EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(4, 4, rtOpts),
  );
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(
    new THREE.Vector2(4, 4),
    0.95,
    0.5,
    0.6,
  );
  composer.addPass(bloom);
  const grade = new THREE.ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      time: { value: 0 },
      flash: { value: 0 },
      aberr: { value: 0.0015 },
      fade: { value: 0 },
      grain: { value: 0.035 },
      lb: { value: 0 },
      hurt: { value: 0 },
      blk: { value: 0 },
    },
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `uniform sampler2D tDiffuse;uniform float time,flash,aberr,fade,grain,lb,hurt,blk;varying vec2 vUv;
  vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
  void main(){vec2 uv=vUv;vec2 d=uv-.5;vec3 c;
    c.r=texture2D(tDiffuse,uv+d*aberr).r;c.g=texture2D(tDiffuse,uv).g;c.b=texture2D(tDiffuse,uv-d*aberr).b;
    c*=1.+flash;c=aces(c*1.15);c=pow(c,vec3(1./2.2));
    c=mix(c,c*vec3(1.12,.94,.92),.35);
    float v=smoothstep(.95,.28,length(d*vec2(1.15,1.)));c*=mix(.35,1.,v);
    c+=vec3(hurt*.25,0.,0.)*(1.-v);
    float n=fract(sin(dot(uv*vec2(1234.5,987.6)+time,vec2(12.9898,78.233)))*43758.5453);c+=(n-.5)*grain;
    c*=1.-fade;c*=1.-blk;if(uv.y<lb||uv.y>1.-lb)c=vec3(0.);
    gl_FragColor=vec4(c,1.);}`,
  });
  composer.addPass(grade);

  function resize() {
    const w = innerWidth,
      h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w * pixelRatio, h * pixelRatio);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fxCanvas.width = Math.round(w * pixelRatio);
    fxCanvas.height = Math.round(h * pixelRatio);
  }
  addEventListener("resize", resize);
  resize();

