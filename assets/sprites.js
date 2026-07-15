/* sprite-forge-studio — procedural chibi sprite engine (the "pre-generated assets")
 * Zero dependencies. One source of truth (keyframe pose data) drives BOTH the
 * live animation preview AND the downloadable sprite sheet. Facing = right.
 * Coordinate cell is CELL x CELL, feet baseline near the bottom.
 */
(function (global) {
  "use strict";

  var CELL = 128;
  var D = Math.PI / 180;

  /* ---------- low-level drawing helpers ---------- */
  function capsule(ctx, x1, y1, x2, y2, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function disc(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function rrect(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  /* two-segment limb: returns end point */
  function limb(ctx, ox, oy, upLen, loLen, aUp, aLo, w, color) {
    var kx = ox + Math.sin(aUp) * upLen;
    var ky = oy + Math.cos(aUp) * upLen;
    var ex = kx + Math.sin(aUp + aLo) * loLen;
    var ey = ky + Math.cos(aUp + aLo) * loLen;
    capsule(ctx, ox, oy, kx, ky, w, color);
    capsule(ctx, kx, ky, ex, ey, w * 0.86, color);
    return { x: ex, y: ey, kx: kx, ky: ky };
  }

  /* ---------- palettes ---------- */
  var PAL = {
    doctor: { coat: "#f3f6fc", coatDk: "#d7deec", hair: "#20242c", skin: "#f6c9a4",
      skinDk: "#e2ad84", glass: "#2b3350", pants: "#39414f", shoe: "#242a36", accent: "#5b8cff" },
    developer: { vest: "#274a77", vestDk: "#1c3860", shirt: "#eef2f8", tie: "#e2544e",
      hair: "#181b23", skin: "#f2c39c", skinDk: "#dca97f", head: "#2a3040", pants: "#333a48",
      shoe: "#191c24", accent: "#5b8cff" },
    robot: { body: "#e2e8f4", bodyDk: "#b7c2d6", metal: "#8b96a8", visor: "#0f131b",
      eye: "#5b8cff", glow: "#5b8cff", accent: "#5b8cff" }
  };

  /* ---------- character renderers ---------- */
  function drawHumanoid(ctx, kind, P) {
    var p = PAL[kind];
    var cx = 64, ground = 120;
    var bob = P.bob || 0;
    var sqx = P.squashX == null ? 1 : P.squashX;
    var sqy = P.squashY == null ? 1 : P.squashY;

    ctx.save();
    ctx.translate(cx, ground);
    ctx.scale(sqx, sqy);
    ctx.translate(0, bob);

    var hipY = -30, hipX = 0;
    var shoulderY = hipY - 30;
    var headCY = shoulderY - 20 + (P.headBob || 0);
    var lean = (P.lean || 0) * D;

    // far leg (right, behind) — darker
    var legFar = kind === "doctor" ? p.pants : p.pants;
    var legNear = legFar;
    limb(ctx, hipX + 4, hipY, 15, 15, (P.legRU || 0) * D, (P.legRL || 0) * D, 8.5, shade(legFar, -14));
    // far arm
    ctx.save();
    ctx.translate(hipX, hipY);
    ctx.rotate(lean);
    var sh = shoulderY - hipY;
    limb(ctx, 8, sh + 2, 13, 12, (P.armRU || 0) * D, (P.armRL || 0) * D, 7.5,
      shade(kind === "doctor" ? p.coat : p.vest, -16));
    ctx.restore();

    // torso (leans from hip)
    ctx.save();
    ctx.translate(hipX, hipY);
    ctx.rotate(lean);
    if (kind === "doctor") {
      rrect(ctx, -13, shoulderY - hipY - 2, 26, 34, 8, p.coat);
      // lapel hint
      ctx.strokeStyle = p.coatDk; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, shoulderY - hipY); ctx.lineTo(0, 26); ctx.stroke();
    } else {
      rrect(ctx, -13, shoulderY - hipY - 2, 26, 34, 8, p.shirt);
      rrect(ctx, -12, shoulderY - hipY + 3, 24, 27, 7, p.vest);
      // tie
      ctx.fillStyle = p.tie;
      ctx.beginPath();
      ctx.moveTo(0, shoulderY - hipY + 2); ctx.lineTo(3.4, shoulderY - hipY + 8);
      ctx.lineTo(0, 24); ctx.lineTo(-3.4, shoulderY - hipY + 8); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // near leg (left, front)
    limb(ctx, hipX - 4, hipY, 15, 15, (P.legLU || 0) * D, (P.legLL || 0) * D, 9, legNear);
    // shoes
    drawShoe(ctx, hipX - 4, hipY, 15, 15, (P.legLU || 0) * D, (P.legLL || 0) * D, p.shoe);
    drawShoe(ctx, hipX + 4, hipY, 15, 15, (P.legRU || 0) * D, (P.legRL || 0) * D, shade(p.shoe, -10));

    // head group (tilts)
    ctx.save();
    ctx.translate(hipX, hipY);
    ctx.rotate(lean * 0.5);
    ctx.translate(0, headCY - hipY);
    ctx.rotate((P.headTilt || 0) * D);
    drawHead(ctx, kind, p);
    ctx.restore();

    // near arm (drawn over torso/head shoulder area)
    ctx.save();
    ctx.translate(hipX, hipY);
    ctx.rotate(lean);
    var handStyle = kind === "doctor" ? p.coat : p.vest;
    var near = limb(ctx, -8, shoulderY - hipY + 2, 13, 12, (P.armLU || 0) * D, (P.armLL || 0) * D, 8, handStyle);
    // hand
    disc(ctx, near.x, near.y, 4, p.skin);
    // held FX (attack items / energy handled in fx layer via P.hand)
    ctx.restore();

    ctx.restore();
    // effects in cell space
    if (P.fx) drawFx(ctx, P.fx, kind);
  }

  function drawShoe(ctx, ox, oy, up, lo, aUp, aLo, color) {
    var kx = ox + Math.sin(aUp) * up, ky = oy + Math.cos(aUp) * up;
    var ex = kx + Math.sin(aUp + aLo) * lo, ey = ky + Math.cos(aUp + aLo) * lo;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(aUp + aLo);
    rrect(ctx, -4, -3, 12, 6, 3, color);
    ctx.restore();
  }

  function drawHead(ctx, kind, p) {
    var r = 25;
    // face
    disc(ctx, 0, 0, r, p.skin);
    // cheek shade
    ctx.globalAlpha = 0.5; disc(ctx, 8, 6, 9, shade(p.skin, -10)); ctx.globalAlpha = 1;
    if (kind === "doctor") {
      // bowl hair
      ctx.fillStyle = p.hair;
      ctx.beginPath();
      ctx.arc(0, -3, r + 1.5, Math.PI * 1.02, Math.PI * 1.98);
      ctx.lineTo(r - 2, -2); ctx.lineTo(-r + 2, -2); ctx.closePath(); ctx.fill();
      rrect(ctx, -r - 1, -8, 2 * r + 2, 8, 3, p.hair);
      // round glasses
      ctx.strokeStyle = p.glass; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(-8, 2, 6.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(9, 2, 6.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1.5, 2); ctx.lineTo(2.5, 2); ctx.stroke();
      // eyes behind glasses
      disc(ctx, -8, 2, 2, "#20242c"); disc(ctx, 9, 2, 2, "#20242c");
    } else if (kind === "developer") {
      // spiky peaked hair
      ctx.fillStyle = p.hair;
      ctx.beginPath();
      ctx.moveTo(-r, 2);
      ctx.lineTo(-r + 1, -14);
      ctx.lineTo(-8, -6); ctx.lineTo(-2, -20); ctx.lineTo(6, -6);
      ctx.lineTo(14, -18); ctx.lineTo(r, -2); ctx.lineTo(r, 2);
      ctx.arc(0, -2, r, 0, Math.PI, false); ctx.closePath(); ctx.fill();
      // brows + eyes (determined)
      ctx.strokeStyle = "#20242c"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-13, -1); ctx.lineTo(-5, 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(13, -1); ctx.lineTo(5, 1); ctx.stroke();
      disc(ctx, -9, 4, 2, "#20242c"); disc(ctx, 9, 4, 2, "#20242c");
      // headset
      ctx.strokeStyle = p.head; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.arc(0, 0, r + 1, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      rrect(ctx, -r - 3, -3, 6, 12, 3, p.head);
      // mic
      ctx.strokeStyle = p.head; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-r + 1, 7); ctx.quadraticCurveTo(-8, 16, 2, 14); ctx.stroke();
      disc(ctx, 2, 14, 2, p.accent);
    }
    // mouth
    ctx.strokeStyle = shade(p.skin, -40); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 11, 4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }

  function drawRobot(ctx, P) {
    var p = PAL.robot;
    var cx = 64, ground = 116;
    var bob = P.bob || 0;
    ctx.save();
    ctx.translate(cx, ground);
    ctx.translate(0, bob);
    var lean = (P.lean || 0) * D;
    ctx.rotate(lean);

    // thruster glow (below body)
    var th = P.thruster == null ? 0.6 : P.thruster;
    if (th > 0) {
      var g = ctx.createLinearGradient(0, -6, 0, 18 + th * 20);
      g.addColorStop(0, hexA(p.glow, 0.55)); g.addColorStop(1, hexA(p.glow, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(9, -4);
      ctx.lineTo(4, 16 + th * 20); ctx.lineTo(-4, 16 + th * 20); ctx.closePath(); ctx.fill();
    }
    // far arm
    limb(ctx, 12, -34, 8, 8, (P.armRU || 20) * D, (P.armRL || 0) * D, 5, shade(p.body, -16));
    // body (rounded)
    rrect(ctx, -18, -50, 36, 40, 15, p.body);
    rrect(ctx, -18, -30, 36, 20, 12, shade(p.body, -8));
    // visor
    rrect(ctx, -14, -44, 28, 16, 9, p.visor);
    // eyes glow
    var blink = P.blink ? 0.15 : 1;
    ctx.save(); ctx.shadowColor = p.glow; ctx.shadowBlur = 8;
    disc(ctx, -6, -36, 3.2 * (0.5 + 0.5 * blink), p.eye);
    disc(ctx, 6, -36, 3.2 * (0.5 + 0.5 * blink), p.eye);
    ctx.restore();
    // chest light
    disc(ctx, 0, -20, 3, hexA(p.glow, 0.9));
    // antenna + propeller (spins)
    capsule(ctx, 0, -50, 0, -60, 2.4, p.metal);
    ctx.save();
    ctx.translate(0, -61);
    ctx.rotate((P.propeller || 0) * D);
    ctx.globalAlpha = 0.9;
    rrect(ctx, -16, -1.6, 32, 3.2, 1.6, p.metal);
    ctx.globalAlpha = 0.35;
    rrect(ctx, -16, -1.6, 32, 3.2, 1.6, p.accent);
    ctx.restore();
    disc(ctx, 0, -61, 2.4, p.accent);
    // near arm
    limb(ctx, -12, -34, 8, 8, (P.armLU || -20) * D, (P.armLL || 0) * D, 5.5, p.body);

    ctx.restore();
    if (P.fx) drawFx(ctx, P.fx, "robot");
  }

  /* ---------- action effects (attack / special) ---------- */
  function drawFx(ctx, fx, kind) {
    var pr = fx.p == null ? 0 : fx.p; // 0..1 progress
    var accent = "#5b8cff";
    if (fx.type === "energy" || fx.type === "special") {
      // charging → released energy ball flying right
      var startX = 78, endX = 118, y = 74;
      var x = startX + (endX - startX) * Math.max(0, (pr - 0.4) / 0.6);
      var grow = fx.type === "special" ? 1.4 : 1;
      var rad = (4 + pr * 9) * grow;
      var col = fx.type === "special" ? "#8f7bff" : accent;
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 16;
      var g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, col); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      // trailing streaks
      if (pr > 0.4) {
        ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x - 4, y); ctx.stroke();
      }
      ctx.restore();
    } else if (fx.type === "slash") {
      ctx.save();
      ctx.globalAlpha = 0.85 * Math.sin(pr * Math.PI);
      ctx.strokeStyle = "#eaf0ff"; ctx.lineWidth = 3.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(80, 70, 26, -0.9 + pr * 1.8, -0.2 + pr * 1.8); ctx.stroke();
      ctx.restore();
    } else if (fx.type === "laser") {
      if (pr > 0.45) {
        ctx.save(); ctx.shadowColor = accent; ctx.shadowBlur = 10;
        ctx.strokeStyle = hexA("#ff5c72", 0.9); ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(80, 70); ctx.lineTo(122, 66); ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* ---------- color utils ---------- */
  function shade(hex, amt) {
    var c = hex.replace("#", "");
    var n = parseInt(c, 16);
    var r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function hexA(hex, a) {
    var c = hex.replace("#", ""); var n = parseInt(c, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  /* ---------- keyframe data (facing right). angles in degrees ---------- */
  // Humanoid actions (shared by doctor + developer)
  var HUMAN = {
    idle: { fps: 6, loop: true, frames: [
      { bob: 0, armLU: 6, armRU: -6, legLU: 4, legRU: -4, headTilt: 0 },
      { bob: -1.5, armLU: 8, armRU: -8, legLU: 4, legRU: -4, headTilt: -1 },
      { bob: -2.5, armLU: 9, armRU: -9, legLU: 4, legRU: -4, headTilt: -1 },
      { bob: -1.5, armLU: 8, armRU: -8, legLU: 4, legRU: -4, headTilt: 0 }
    ]},
    walk: { fps: 10, loop: true, frames: [
      { bob: -1, lean: 4, armLU: 26, armRU: -26, legLU: -22, legLL: 6, legRU: 24, legRL: -18 },
      { bob: 1, lean: 4, armLU: 12, armRU: -12, legLU: -6, legLL: 2, legRU: 8, legRL: -6 },
      { bob: -1, lean: 4, armLU: -6, armRU: 6, legLU: 12, legLL: -8, legRU: -12, legRL: 4 },
      { bob: -1, lean: 4, armLU: -26, armRU: 26, legLU: 24, legLL: -18, legRU: -22, legRL: 6 },
      { bob: 1, lean: 4, armLU: -12, armRU: 12, legLU: 8, legLL: -6, legRU: -6, legRL: 2 },
      { bob: -1, lean: 4, armLU: 6, armRU: -6, legLU: -12, legLL: 4, legRU: 12, legRL: -8 }
    ]},
    run: { fps: 12, loop: true, frames: [
      { bob: -2, lean: 16, headTilt: 4, armLU: 52, armLL: -40, armRU: -52, armRL: -40, legLU: -40, legLL: 30, legRU: 44, legRL: -60 },
      { bob: 3, lean: 16, headTilt: 4, armLU: 20, armLL: -30, armRU: -20, armRL: -20, legLU: -6, legLL: 10, legRU: 10, legRL: -20 },
      { bob: -2, lean: 16, headTilt: 4, armLU: -52, armLL: -40, armRU: 52, armRL: -40, legLU: 44, legLL: -60, legRU: -40, legRL: 30 },
      { bob: 3, lean: 16, headTilt: 4, armLU: -20, armLL: -20, armRU: 20, armRL: -30, legLU: 10, legLL: -20, legRU: -6, legRL: 10 }
    ]},
    jump: { fps: 9, loop: false, frames: [
      { bob: 6, squashX: 1.12, squashY: 0.86, armLU: 20, armRU: -20, legLU: 22, legLL: -30, legRU: -22, legRL: -30 },
      { bob: -2, squashX: 0.96, squashY: 1.08, armLU: -30, armRU: 30, legLU: 8, legLL: -6, legRU: -8, legRL: -6 },
      { bob: -18, squashX: 0.94, squashY: 1.1, armLU: -60, armRU: 60, legLU: -14, legLL: 10, legRU: 14, legRL: 10 },
      { bob: -24, squashX: 1, squashY: 1, headTilt: 3, armLU: -70, armRU: 70, legLU: -6, legLL: 20, legRU: 6, legRL: 20 },
      { bob: -10, squashX: 1.02, squashY: 0.98, armLU: -30, armRU: 30, legLU: 10, legLL: -4, legRU: -10, legRL: -4 },
      { bob: 6, squashX: 1.16, squashY: 0.82, armLU: 24, armRU: -24, legLU: 24, legLL: -34, legRU: -24, legRL: -34 }
    ]},
    attack: { fps: 11, loop: false, frames: [
      { lean: -8, headTilt: -3, armLU: 40, armLL: -20, armRU: 30, legLU: -10, legRU: 14 },
      { lean: -14, headTilt: -5, armLU: 70, armLL: -50, armRU: 40, legLU: -14, legRU: 18, fx: { type: "energy", p: 0.15 } },
      { lean: 10, headTilt: 4, armLU: -50, armLL: -10, armRU: -20, legLU: 12, legRU: -10, fx: { type: "energy", p: 0.45 } },
      { lean: 14, headTilt: 5, armLU: -66, armLL: -6, armRU: -30, legLU: 16, legRU: -12, fx: { type: "energy", p: 0.7 } },
      { lean: 8, headTilt: 2, armLU: -40, armRU: -10, legLU: 8, legRU: -6, fx: { type: "energy", p: 0.9 } },
      { lean: 0, armLU: 6, armRU: -6, legLU: 4, legRU: -4 }
    ]},
    special: { fps: 12, loop: false, frames: [
      { lean: -10, headTilt: -4, armLU: 60, armLL: -70, armRU: 60, armRL: -70, legLU: -16, legRU: 20 },
      { lean: -16, headTilt: -6, armLU: 84, armLL: -84, armRU: 84, armRL: -84, legLU: -18, legRU: 22, fx: { type: "special", p: 0.2 } },
      { lean: -6, armLU: 40, armLL: -40, armRU: 40, armRL: -40, legLU: -6, legRU: 8, fx: { type: "special", p: 0.42 } },
      { lean: 16, headTilt: 6, armLU: -70, armLL: -10, armRU: -70, armRL: -10, legLU: 18, legRU: -14, fx: { type: "special", p: 0.66 } },
      { lean: 12, armLU: -50, armRU: -50, legLU: 12, legRU: -10, fx: { type: "special", p: 0.86 } },
      { lean: 0, armLU: 6, armRU: -6, legLU: 4, legRU: -4, fx: { type: "special", p: 1 } }
    ]}
  };

  // Robot actions (hovers; propeller spins; no legs)
  var ROBO = {
    idle: { fps: 6, loop: true, frames: [
      { bob: 0, propeller: 0, thruster: 0.5, armLU: -18, armRU: 18 },
      { bob: -3, propeller: 120, thruster: 0.7, armLU: -22, armRU: 22, blink: false },
      { bob: -4, propeller: 240, thruster: 0.6, armLU: -20, armRU: 20, blink: true },
      { bob: -2, propeller: 360, thruster: 0.6, armLU: -18, armRU: 18 }
    ]},
    walk: { fps: 10, loop: true, frames: [
      { bob: -2, lean: 8, propeller: 0, thruster: 0.8, armLU: -30, armRU: 10 },
      { bob: 0, lean: 8, propeller: 90, thruster: 0.7, armLU: -10, armRU: -10 },
      { bob: -2, lean: 8, propeller: 180, thruster: 0.8, armLU: 10, armRU: -30 },
      { bob: 0, lean: 8, propeller: 270, thruster: 0.7, armLU: -10, armRU: -10 }
    ]},
    run: { fps: 13, loop: true, frames: [
      { bob: -3, lean: 22, propeller: 0, thruster: 1, armLU: -46, armRU: -10 },
      { bob: 1, lean: 22, propeller: 140, thruster: 0.9, armLU: -10, armRU: -30 },
      { bob: -3, lean: 22, propeller: 280, thruster: 1, armLU: 10, armRU: -46 }
    ]},
    jump: { fps: 9, loop: false, frames: [
      { bob: 6, propeller: 0, thruster: 0.3, armLU: 20, armRU: -20 },
      { bob: -6, propeller: 160, thruster: 1.3, armLU: -30, armRU: 30 },
      { bob: -22, propeller: 320, thruster: 1.6, armLU: -50, armRU: 50 },
      { bob: -28, propeller: 480, thruster: 1.2, armLU: -40, armRU: 40 },
      { bob: -12, propeller: 600, thruster: 0.9, armLU: -20, armRU: 20 },
      { bob: 4, propeller: 720, thruster: 0.5, armLU: 16, armRU: -16 }
    ]},
    attack: { fps: 11, loop: false, frames: [
      { lean: -6, propeller: 0, thruster: 0.7, armLU: 30, armRU: 40 },
      { lean: -10, propeller: 120, thruster: 0.8, armLU: 40, armRU: 60, fx: { type: "laser", p: 0.2 } },
      { lean: 6, propeller: 240, thruster: 0.9, armLU: -20, armRU: 70, fx: { type: "laser", p: 0.55 } },
      { lean: 8, propeller: 360, thruster: 0.9, armLU: -10, armRU: 60, fx: { type: "laser", p: 0.8 } },
      { lean: 0, propeller: 480, thruster: 0.6, armLU: -18, armRU: 18 }
    ]},
    special: { fps: 12, loop: false, frames: [
      { lean: -8, propeller: 0, thruster: 0.9, armLU: 50, armRU: 50 },
      { lean: -12, propeller: 160, thruster: 1.1, armLU: 70, armRU: 70, fx: { type: "special", p: 0.2 } },
      { lean: -4, propeller: 320, thruster: 1, armLU: 30, armRU: 30, fx: { type: "special", p: 0.45 } },
      { lean: 12, propeller: 480, thruster: 1.2, armLU: -40, armRU: -40, fx: { type: "special", p: 0.7 } },
      { lean: 6, propeller: 600, thruster: 0.8, armLU: -20, armRU: -20, fx: { type: "special", p: 0.9 } },
      { lean: 0, propeller: 720, thruster: 0.6, armLU: -18, armRU: 18, fx: { type: "special", p: 1 } }
    ]}
  };

  var CHARS = {
    doctor: { id: "doctor", name: "Dr. Park", ko: "박사", kind: "doctor", actions: HUMAN,
      blurb: "The lab-coat professor. Round glasses, boundless theories." },
    developer: { id: "developer", name: "Dev", ko: "개발자", kind: "developer", actions: HUMAN,
      blurb: "Headset on, controller in hand. Ships at 3am." },
    robot: { id: "robot", name: "Bot", ko: "로봇", kind: "robot", actions: ROBO,
      blurb: "Hovering helper. Propeller, blue glow, zero legs." }
  };

  var ACTIONS = [
    { id: "idle", ko: "대기", label: "Idle", desc: "held-cel breathing loop" },
    { id: "walk", ko: "걷기", label: "Walk", desc: "8-frame locomotion cycle" },
    { id: "run", ko: "달리기", label: "Run", desc: "lean-forward sprint" },
    { id: "jump", ko: "점프", label: "Jump", desc: "anticipation → apex → land" },
    { id: "attack", ko: "공격", label: "Attack", desc: "windup → strike" },
    { id: "special", ko: "필살기", label: "Special", desc: "custom prompt · e.g. 파동권 / fireball" }
  ];

  /* ---------- pose interpolation ---------- */
  var FIELDS = ["bob", "headBob", "lean", "headTilt", "armLU", "armLL", "armRU", "armRL",
    "legLU", "legLL", "legRU", "legRL", "squashX", "squashY", "propeller", "thruster"];

  function lerpPose(a, b, t) {
    var o = {};
    for (var i = 0; i < FIELDS.length; i++) {
      var f = FIELDS[i];
      var av = a[f] == null ? (f === "squashX" || f === "squashY" ? 1 : 0) : a[f];
      var bv = b[f] == null ? (f === "squashX" || f === "squashY" ? 1 : 0) : b[f];
      o[f] = av + (bv - av) * t;
    }
    o.blink = t < 0.5 ? a.blink : b.blink;
    // fx: take nearest with progress interpolated
    if (a.fx || b.fx) {
      var base = (b.fx || a.fx);
      var ap = a.fx ? a.fx.p : 0, bp = b.fx ? b.fx.p : (a.fx ? a.fx.p : 0);
      o.fx = { type: base.type, p: ap + (bp - ap) * t };
    }
    return o;
  }

  function poseAt(action, frameFloat) {
    var fr = action.frames, n = fr.length;
    if (action.loop) {
      var i = Math.floor(frameFloat) % n;
      var t = frameFloat - Math.floor(frameFloat);
      return lerpPose(fr[i], fr[(i + 1) % n], t);
    } else {
      if (frameFloat >= n - 1) return fr[n - 1];
      var j = Math.floor(frameFloat);
      return lerpPose(fr[j], fr[j + 1], frameFloat - j);
    }
  }

  /* ---------- public draw ---------- */
  // Draw one (possibly interpolated) frame of char/action into ctx at cell origin.
  function drawFrame(ctx, charId, actionId, frameFloat, opts) {
    opts = opts || {};
    var ch = CHARS[charId];
    var act = ch.actions[actionId];
    var pose = poseAt(act, frameFloat);
    ctx.save();
    if (opts.scale) { ctx.scale(opts.scale, opts.scale); }
    if (ch.kind === "robot") drawRobot(ctx, pose);
    else drawHumanoid(ctx, ch.kind, pose);
    ctx.restore();
  }

  // Render a full sprite sheet (discrete keyframes) for given char+actions.
  // Returns {canvas, cols, rows, cell, layout:[{action,frame,x,y}...]}
  function renderSheet(charId, actionIds, cell) {
    cell = cell || CELL;
    var ch = CHARS[charId];
    var rows = actionIds.length;
    var cols = 0;
    for (var i = 0; i < actionIds.length; i++) cols = Math.max(cols, ch.actions[actionIds[i]].frames.length);
    var cv = document.createElement("canvas");
    cv.width = cols * cell; cv.height = rows * cell;
    var ctx = cv.getContext("2d");
    var layout = [];
    for (var r = 0; r < rows; r++) {
      var act = ch.actions[actionIds[r]];
      for (var f = 0; f < act.frames.length; f++) {
        ctx.save();
        ctx.translate(f * cell, r * cell);
        ctx.scale(cell / CELL, cell / CELL);
        if (ch.kind === "robot") drawRobot(ctx, act.frames[f]);
        else drawHumanoid(ctx, ch.kind, act.frames[f]);
        ctx.restore();
        layout.push({ action: actionIds[r], frame: f, x: f * cell, y: r * cell, w: cell, h: cell });
      }
    }
    return { canvas: cv, cols: cols, rows: rows, cell: cell, layout: layout, actions: actionIds };
  }

  global.SF = {
    CELL: CELL, CHARS: CHARS, ACTIONS: ACTIONS,
    drawFrame: drawFrame, renderSheet: renderSheet, poseAt: poseAt
  };
})(window);
