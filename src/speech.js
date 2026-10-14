// speech — speech
// Lines 4791-4855 of readable/index-inline-1.pretty.js (statement-aligned).
  /* ================= speech ================= */
  const LINES = {
    whisper: [
      "Is the airlock sealed?",
      "...Did you hear that?",
      "Stay quiet. Stay quiet.",
    ],
    see: [
      "He's here.",
      "It's him.",
      "Oh no. No, no, no.",
      "I can't see him!",
      "Where is he?",
    ],
    calm: [
      "Hold the line!",
      "Keep firing!",
      "Don't stop shooting!",
      "Light him up!",
    ],
    retreat: [
      "Fall back!",
      "Back! Get back!",
      "It's not working!",
      "Nothing hurts him!",
    ],
    brk: [
      "Please...",
      "I can't... I can't...",
      "Run!",
      "Let me through!",
      "Don't look at it.",
      "Mother...",
      "Why won't he stop?",
    ],
    pass: [
      "Take it! Go!",
      "Pass it back!",
      "Keep it moving!",
      "Get it to the ship!",
    ],
    catch_: ["Got it!", "I've got it!", "Go, go!"],
    witness: [
      "Let him go!",
      "What is that?",
      "He's not even touching him.",
      "Oh god.",
    ],
    gripped: ["hk...", "c-can't...", "...", "ghh..."],
    dying: ["No—", "Wai—", "Ple—", "—"],
    trapped: [
      "Open the door!",
      "Don't leave us!",
      "Please! Open it!",
      "They locked us in...",
    ],
    seal: ["Seal it! Seal it now!", "Close the door!", "Shut it!"],
    knocked: ["Agh!", "Ugh...", "What was—", "My leg...", "I can't get up!"],
  };
  function speak(s, cat, force) {
    if (!force && s.speakCd > 0) return;
    if (s.pos.distanceTo(player.pos) > 30) return;
    s.speakCd = rnd(2.6, 4.6); // speech boxes removed
  }

