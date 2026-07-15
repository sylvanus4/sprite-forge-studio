/* export.js — turn a rendered sheet into real, downloadable engine assets.
 * Zero dependencies: canonical frames.json, Aseprite JSON, TexturePacker JSON,
 * Unity .png.meta (auto-slice), best-effort .anim/.controller, and a store-only
 * .zip writer (no compression, pure JS). The sprite sheet + .meta genuinely
 * import into Unity via Grid-by-cell slicing.
 */
(function (global) {
  "use strict";

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  /* ---------- canonical frames.json ---------- */
  function framesJson(sheet, charId) {
    var frames = sheet.layout.map(function (c) {
      return { name: charId + "_" + c.action + "_" + pad(c.frame),
        action: c.action, index: c.frame,
        rect: { x: c.x, y: c.y, w: c.w, h: c.h } };
    });
    var anims = {};
    sheet.actions.forEach(function (a) {
      anims[a] = { frames: frames.filter(function (f) { return f.action === a; }).map(function (f) { return f.name; }),
        loop: (a === "idle" || a === "walk" || a === "run") };
    });
    return { meta: { app: "sprite-forge-studio", character: charId, cell: sheet.cell,
      grid: { cols: sheet.cols, rows: sheet.rows }, generated: "simulated" },
      frames: frames, animations: anims };
  }

  /* ---------- Aseprite JSON (array) ---------- */
  function asepriteJson(sheet, charId) {
    var frames = sheet.layout.map(function (c) {
      return { filename: charId + "_" + c.action + "_" + pad(c.frame),
        frame: { x: c.x, y: c.y, w: c.w, h: c.h }, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: c.w, h: c.h },
        sourceSize: { w: c.w, h: c.h }, duration: 100 };
    });
    var tags = sheet.actions.map(function (a) {
      var idxs = sheet.layout.map(function (c, i) { return c.action === a ? i : -1; }).filter(function (i) { return i >= 0; });
      return { name: a, from: idxs[0], to: idxs[idxs.length - 1], direction: "forward" };
    });
    return { frames: frames, meta: { app: "sprite-forge-studio", version: "1.0",
      image: charId + "_sheet.png", format: "RGBA8888",
      size: { w: sheet.cols * sheet.cell, h: sheet.rows * sheet.cell }, scale: "1",
      frameTags: tags } };
  }

  /* ---------- TexturePacker hash JSON ---------- */
  function texturePackerJson(sheet, charId) {
    var frames = {};
    sheet.layout.forEach(function (c) {
      frames[charId + "_" + c.action + "_" + pad(c.frame) + ".png"] = {
        frame: { x: c.x, y: c.y, w: c.w, h: c.h }, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: c.w, h: c.h }, sourceSize: { w: c.w, h: c.h } };
    });
    return { frames: frames, meta: { app: "sprite-forge-studio", image: charId + "_sheet.png",
      format: "RGBA8888", size: { w: sheet.cols * sheet.cell, h: sheet.rows * sheet.cell }, scale: "1" } };
  }

  /* ---------- Unity .png.meta (auto-slice via spriteSheet rects) ---------- */
  // Deterministic 32-hex guid from a string (FNV-ish; fine for demo import).
  function guid(str) {
    var h = 0x811c9dc5, out = "";
    for (var k = 0; k < 4; k++) {
      var v = h ^ (k * 0x9e3779b1);
      for (var i = 0; i < str.length; i++) { v ^= str.charCodeAt(i); v = (v * 16777619) >>> 0; }
      out += ("00000000" + v.toString(16)).slice(-8);
    }
    return out.slice(0, 32);
  }
  function fileID(name) {
    var h = 0; for (var i = 0; i < name.length; i++) { h = (h * 31 + name.charCodeAt(i)) >>> 0; }
    return "21300000" + (h % 100000); // stable sprite sub-asset id
  }

  function unityMeta(sheet, charId) {
    var sheetH = sheet.rows * sheet.cell;
    var sprites = sheet.layout.map(function (c) {
      var nm = charId + "_" + c.action + "_" + pad(c.frame);
      // Unity rect origin is bottom-left
      var ry = sheetH - c.y - c.h;
      return [
        "    - serializedVersion: 2",
        "      name: " + nm,
        "      rect:",
        "        serializedVersion: 2",
        "        x: " + c.x, "        y: " + ry,
        "        width: " + c.w, "        height: " + c.h,
        "      alignment: 7",
        "      pivot: {x: 0.5, y: 0}",
        "      border: {x: 0, y: 0, z: 0, w: 0}",
        "      outline: []",
        "      internalID: " + fileID(nm),
        "      spriteID: " + guid(nm),
        "      vertices: []", "      indices: ", "      edges: []", "      weights: []"
      ].join("\n");
    }).join("\n");
    var nameIDs = sheet.layout.map(function (c) {
      var nm = charId + "_" + c.action + "_" + pad(c.frame);
      return "  - first:\n      213: " + fileID(nm) + "\n    second: " + nm;
    }).join("\n");
    return [
      "fileFormatVersion: 2",
      "guid: " + guid(charId + "_sheet.png"),
      "TextureImporter:",
      "  serializedVersion: 12",
      "  textureType: 8",              // Sprite
      "  spriteMode: 2",               // Multiple
      "  spritePixelsToUnits: " + sheet.cell,
      "  filterMode: 0",               // Point (crisp pixels)
      "  textureCompression: 0",       // None
      "  maxTextureSize: 4096",
      "  alphaIsTransparency: 1",
      "  spriteSheet:",
      "    serializedVersion: 2",
      "    sprites:",
      sprites,
      "    nameFileIdTable:",
      nameIDs,
      "  userData: sprite-forge-studio (simulated)",
      "  assetBundleName:", ""
    ].join("\n");
  }

  /* ---------- best-effort Unity .anim clip ---------- */
  function unityAnim(sheet, charId, action, fps) {
    var frames = sheet.layout.filter(function (c) { return c.action === action; });
    var loop = (action === "idle" || action === "walk" || action === "run") ? 1 : 0;
    var keys = frames.map(function (c, i) {
      var nm = charId + "_" + c.action + "_" + pad(c.frame);
      return [
        "        - time: " + (i / fps).toFixed(4),
        "          value: {fileID: " + fileID(nm) + ", guid: " + guid(charId + "_sheet.png") + ", type: 3}"
      ].join("\n");
    }).join("\n");
    return [
      "%YAML 1.1", "%TAG !u! tag:unity3d.com,2011:", "--- !u!74 &7400000",
      "AnimationClip:", "  m_Name: " + charId + "_" + action,
      "  serializedVersion: 6", "  m_Legacy: 0", "  m_SampleRate: " + fps,
      "  m_PPtrCurves:", "  - curve:", keys,
      "    attribute: m_Sprite", "    path: ", "    classID: 212",
      "  m_AnimationClipSettings:", "    m_LoopTime: " + loop, ""
    ].join("\n");
  }

  function unityController(charId, actions) {
    return [
      "%YAML 1.1", "%TAG !u! tag:unity3d.com,2011:",
      "# Animator controller stub — states: " + actions.join(", "),
      "# In Unity: create an Animator Controller, drag each " + charId + "_<action>.anim as a state.",
      "--- !u!91 &9100000", "AnimatorController:",
      "  m_Name: " + charId + "_controller",
      "  m_AnimatorParameters: []",
      "  # states auto-wired from clips on import in a full build", ""
    ].join("\n");
  }

  function readme(charId, actions, cell) {
    return [
      "# " + charId + " sprite sheet — sprite-forge-studio",
      "",
      "> Demo bundle. The *animation frames* were procedurally simulated in-browser,",
      "> but the sheet + slicing metadata are real and import cleanly.",
      "",
      "## Contents",
      "- `" + charId + "_sheet.png` — transparent sprite sheet, uniform " + cell + "x" + cell + " cells",
      "- `" + charId + "_sheet.png.meta` — Unity auto-slice metadata (drop the PNG in, sprites appear pre-sliced)",
      "- `frames.json` — canonical frame rects + per-action clips (engine-agnostic)",
      "- `aseprite.json` / `texturepacker.json` — for Godot / Phaser / GameMaker importers",
      "- `unity/*.anim`, `unity/*.controller` — clip stubs per action",
      "",
      "## Unity import (frictionless path)",
      "1. Copy `" + charId + "_sheet.png` **and** `" + charId + "_sheet.png.meta` into `Assets/`.",
      "2. Unity reads the .meta → Texture Type = Sprite (Multiple), already sliced into named frames.",
      "3. Select the frames for one action in the Project window → drag onto a GameObject → Unity",
      "   auto-creates an AnimationClip + Animator. Set Loop on idle/walk/run.",
      "",
      "Recommended import settings (already in the .meta): Filter = Point, Compression = None,",
      "Pixels-Per-Unit = " + cell + ", Pivot = Bottom.",
      "",
      "Actions: " + actions.join(", ")
    ].join("\n");
  }

  /* ---------- store-only ZIP (no deps) ---------- */
  var CRC = (function () {
    var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t;
  })();
  function crc32(u8) { var c = 0xffffffff; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function strToU8(s) { return new TextEncoder().encode(s); }
  function u16(n) { return [n & 255, (n >>> 8) & 255]; }
  function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }

  function zipStore(files) {
    var chunks = [], central = [], offset = 0;
    files.forEach(function (f) {
      var data = typeof f.data === "string" ? strToU8(f.data) : f.data;
      var name = strToU8(f.name);
      var crc = crc32(data);
      var local = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      var lh = new Uint8Array(local.length + name.length + data.length);
      lh.set(local, 0); lh.set(name, local.length); lh.set(data, local.length + name.length);
      chunks.push(lh);
      central.push({ name: name, crc: crc, size: data.length, offset: offset });
      offset += lh.length;
    });
    var cdir = [], cstart = offset;
    central.forEach(function (c) {
      var h = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(c.crc), u32(c.size), u32(c.size), u16(c.name.length), u16(0), u16(0), u16(0), u16(0),
        u32(0), u32(c.offset));
      var ch = new Uint8Array(h.length + c.name.length);
      ch.set(h, 0); ch.set(c.name, h.length); cdir.push(ch); offset += ch.length;
    });
    var cdirSize = offset - cstart;
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0),
      u16(central.length), u16(central.length), u32(cdirSize), u32(cstart), u16(0)));
    return new Blob(chunks.concat(cdir, [end]), { type: "application/zip" });
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  // Build the full engine bundle blob from a rendered sheet.
  function buildBundle(sheet, charId, fps, pngU8) {
    var files = [
      { name: charId + "_sheet.png", data: pngU8 },
      { name: charId + "_sheet.png.meta", data: unityMeta(sheet, charId) },
      { name: "frames.json", data: JSON.stringify(framesJson(sheet, charId), null, 2) },
      { name: "aseprite.json", data: JSON.stringify(asepriteJson(sheet, charId), null, 2) },
      { name: "texturepacker.json", data: JSON.stringify(texturePackerJson(sheet, charId), null, 2) },
      { name: "unity/" + charId + "_controller.controller", data: unityController(charId, sheet.actions) },
      { name: "README.md", data: readme(charId, sheet.actions, sheet.cell) }
    ];
    sheet.actions.forEach(function (a) {
      files.push({ name: "unity/" + charId + "_" + a + ".anim", data: unityAnim(sheet, charId, a, fps) });
    });
    return zipStore(files);
  }

  global.SFExport = {
    framesJson: framesJson, asepriteJson: asepriteJson, texturePackerJson: texturePackerJson,
    unityMeta: unityMeta, unityAnim: unityAnim, unityController: unityController,
    zipStore: zipStore, download: download, buildBundle: buildBundle
  };
})(window);
