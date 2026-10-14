// renderer-a — renderer (part 1 of 2)
// Lines 27-31 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= renderer ================= */
  const glCanvas = byId("gl"),
    fxCanvas = byId("fx"),
    fctx = fxCanvas.getContext("2d");
  let renderer;
