/* app.js — Sprite Forge Studio (emoticon → game extension, multi-character).
 * Loads real gpt-image-2 held-cel game sprites for robot + scientist (idle/run/
 * jump/dash/punch/guard/hit/hadouken/victory), plays them, shows the transparent
 * sprite sheet, and exports a real Unity bundle (.png + auto-slice .meta +
 * frames.json) as a store-only zip. "Generation" is simulated; sprites are real.
 * Zero dependencies.
 */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var els = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LOOP = { idle: 1, run: 1, dash: 1 };
  var SPECIAL = { hadouken: 1, dash: 1, guard: 1, hit: 1 };

  var DATA = null;
  var state = { char: null, action: null, fmt: "unity" };

  function hashHas(s) { return location.hash.toLowerCase().indexOf(s) >= 0; }

  fetch("data/game.json").then(function (r) { return r.json(); }).then(function (d) {
    DATA = d;
    state.char = d.characters.filter(function (c) { return hashHas(c.id); })[0] || d.characters[0];
    boot();
  }).catch(function (e) { $("#empty").innerHTML = "<div><h4>로드 실패</h4><p>" + e + "</p></div>"; });

  // deep-link: #demo auto-generates; add an action key (e.g. #demo-hadouken or
  // #demo-scientist-hadouken) to preselect that character/move for sharing.
  function boot() { buildChars(); wire(); if (hashHas("demo")) setTimeout(generate, 150); }

  function buildChars() {
    var grid = $("#charGrid"); grid.innerHTML = "";
    DATA.characters.forEach(function (ch) {
      var thumb = ch.actions[0].webp;
      var c = document.createElement("div");
      c.className = "char-card" + (ch.id === state.char.id ? " sel" : "");
      c.innerHTML = '<img src="' + thumb + '" alt="' + ch.ko + '"/><div class="cn">' + ch.ko +
        '</div><div class="ck">' + ch.name + ' · 최종</div>';
      c.addEventListener("click", function () {
        state.char = ch;
        els(".char-card").forEach(function (x) { x.classList.remove("sel"); });
        c.classList.add("sel");
        if ($("#result").style.display === "block") renderResult();
      });
      grid.appendChild(c);
    });
    (DATA.wip || []).forEach(function (w) {
      var d = document.createElement("div");
      d.className = "char-card wip";
      d.innerHTML = '<img src="' + w.thumb + '" alt="' + w.ko + '"/><div class="cn">' + w.ko +
        '</div><div class="ck">WIP</div><span class="wip-tag">곧</span>';
      d.title = "게임용 최종 공정 진행 중";
      grid.appendChild(d);
    });
  }

  var STEPS = [
    { t: "클린 레퍼런스 로드", log: "identity lock" },
    { t: "held-cel · 액션 16프레임 시트 생성", log: "body held · action part moves" },
    { t: "셀 분할 + 배경 투명화", log: "adaptive slice · flood-fill → alpha" },
    { t: "stabilize · 발 baseline·크기 정렬", log: "core-height normalize · foot plant" },
    { t: "투명 아틀라스 재패킹", log: "uniform 160px cells · row-major" },
    { t: "Unity .meta / frames.json 내보내기", log: "auto-slice rects · clips · sidecar json" }
  ];
  function generate() {
    $("#empty").style.display = "none"; $("#result").style.display = "none";
    var gen = $("#gen"); gen.classList.add("show");
    var bar = $("#genBar"), stepEl = $("#genStep"), logEl = $("#genLog");
    bar.style.width = "0%"; logEl.innerHTML = ""; $("#genBtn").disabled = true;
    var i = 0;
    (function tick() {
      if (i >= STEPS.length) {
        setTimeout(function () { gen.classList.remove("show"); renderResult(); $("#genBtn").disabled = false; $("#genBtn").textContent = "✦ 다시 생성"; }, 260);
        return;
      }
      var s = STEPS[i]; stepEl.textContent = s.t;
      var line = document.createElement("div"); line.textContent = "› " + s.log; logEl.appendChild(line);
      while (logEl.children.length > 4) logEl.removeChild(logEl.firstChild);
      bar.style.width = Math.round(((i + 1) / STEPS.length) * 100) + "%"; i++;
      setTimeout(tick, 240 + Math.random() * 180);
    })();
  }

  function renderResult() {
    var tabs = $("#actTabs"); tabs.innerHTML = "";
    state.char.actions.forEach(function (a, idx) {
      var t = document.createElement("div");
      t.className = "acttab" + (idx === 0 ? " on" : "") + (a.key === "hadouken" ? " hl" : "");
      t.textContent = a.label;
      t.addEventListener("click", function () {
        setAction(a);
        els(".acttab", tabs).forEach(function (x) { x.classList.remove("on"); });
        t.classList.add("on");
      });
      tabs.appendChild(t);
    });
    $("#result").style.display = "block";
    var pick = state.char.actions.filter(function (a) { return hashHas(a.key); })[0];
    if (pick) {
      setAction(pick);
      els(".acttab", tabs).forEach(function (x, i) { x.classList.toggle("on", state.char.actions[i].key === pick.key); });
    } else {
      setAction(state.char.actions[0]);
    }
  }

  function setAction(a) {
    state.action = a;
    $("#preview").src = a.webp;
    $("#pvName").textContent = state.char.ko;
    $("#pvLabel").textContent = a.label + "  ·  " + a.key + "  ·  " + a.frames + "f";
    $("#sheet").src = a.sheet;
    $("#sheetDims").textContent = a.cols + "×" + a.rows + " · " + a.cell + "px";
    updateExport();
  }

  /* ---------- Unity export ---------- */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function id() { return state.char.id; }
  function layout(a) {
    var arr = [];
    for (var f = 0; f < a.frames; f++) arr.push({ i: f, x: (f % a.cols) * a.cell, y: ((f / a.cols) | 0) * a.cell, w: a.cell, h: a.cell });
    return arr;
  }
  function framesJson(a) {
    return { meta: { app: "sprite-forge-studio", character: id(), action: a.key, cell: a.cell,
      grid: { cols: a.cols, rows: a.rows }, generated: "gpt-image-2 held-cel (real)" },
      frames: layout(a).map(function (c) { return { name: id() + "_" + a.key + "_" + pad(c.i), rect: { x: c.x, y: c.y, w: c.w, h: c.h } }; }),
      loop: !!LOOP[a.key] };
  }
  function guid(str) { var h = 0x811c9dc5, out = ""; for (var k = 0; k < 4; k++) { var v = h ^ (k * 0x9e3779b1); for (var i = 0; i < str.length; i++) { v ^= str.charCodeAt(i); v = (v * 16777619) >>> 0; } out += ("00000000" + v.toString(16)).slice(-8); } return out.slice(0, 32); }
  function fid(name) { var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return "21300000" + (h % 100000); }
  function unityMeta(a) {
    var sheetH = a.rows * a.cell, key = id() + "_" + a.key;
    var sprites = layout(a).map(function (c) {
      var nm = key + "_" + pad(c.i), ry = sheetH - c.y - c.h;
      return ["    - serializedVersion: 2", "      name: " + nm, "      rect:", "        serializedVersion: 2",
        "        x: " + c.x, "        y: " + ry, "        width: " + c.w, "        height: " + c.h,
        "      alignment: 7", "      pivot: {x: 0.5, y: 0}", "      internalID: " + fid(nm), "      spriteID: " + guid(nm)].join("\n");
    }).join("\n");
    return ["fileFormatVersion: 2", "guid: " + guid(key + ".png"), "TextureImporter:",
      "  serializedVersion: 12", "  textureType: 8", "  spriteMode: 2",
      "  spritePixelsToUnits: " + a.cell, "  filterMode: 0", "  textureCompression: 0",
      "  maxTextureSize: 4096", "  alphaIsTransparency: 1",
      "  spriteSheet:", "    serializedVersion: 2", "    sprites:", sprites, "  userData: sprite-forge-studio", ""].join("\n");
  }
  function readme(a) {
    var key = id() + "_" + a.key;
    return ["# " + key + " — sprite-forge-studio", "", "Real GPT Image 2 held-cel sprite. Transparent " + a.cell + "px uniform cells.", "",
      "## Unity", "1. Copy `" + key + ".png` + `.meta` into Assets/.",
      "2. Unity reads .meta → Sprite (Multiple), pre-sliced into " + a.frames + " frames.",
      "3. Select frames → drag onto a GameObject → AnimationClip. Loop on idle/run/dash.",
      "", "Filter=Point, Compression=None, PPU=" + a.cell + ", Pivot=Bottom."].join("\n");
  }
  function updateExport() {
    var a = state.action; if (!a) return;
    $("#exportCode").textContent = state.fmt === "unity" ? clip(unityMeta(a), 38) : JSON.stringify(framesJson(a), null, 2);
  }
  function clip(s, n) { var x = s.split("\n"); return x.length > n ? x.slice(0, n).join("\n") + "\n  … (+" + (x.length - n) + " lines)" : s; }

  /* ---------- downloads ---------- */
  function dl(blob, name) { var u = URL.createObjectURL(blob), el = document.createElement("a"); el.href = u; el.download = name; document.body.appendChild(el); el.click(); el.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1500); }
  function dlWebp() { var a = state.action; fetch(a.webp).then(function (r) { return r.blob(); }).then(function (b) { dl(b, id() + "_" + a.key + ".webp"); }); }
  function dlPng() { var a = state.action; fetch(a.sheet).then(function (r) { return r.blob(); }).then(function (b) { dl(b, id() + "_" + a.key + "_sheet.png"); }); }
  function dlZip() {
    var a = state.action, btn = $("#dlZip"), old = btn.textContent; btn.textContent = "번들 생성 중…"; btn.disabled = true;
    fetch(a.sheet).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      var key = id() + "_" + a.key;
      dl(zipStore([
        { name: key + ".png", data: new Uint8Array(buf) },
        { name: key + ".png.meta", data: unityMeta(a) },
        { name: "frames.json", data: JSON.stringify(framesJson(a), null, 2) },
        { name: "README.md", data: readme(a) }
      ]), "sprite-forge-" + key + ".zip");
      btn.textContent = old; btn.disabled = false;
    });
  }

  var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xffffffff; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function u16(n) { return [n & 255, (n >>> 8) & 255]; }
  function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
  function strU8(s) { return new TextEncoder().encode(s); }
  function zipStore(files) {
    var chunks = [], central = [], off = 0;
    files.forEach(function (f) {
      var data = typeof f.data === "string" ? strU8(f.data) : f.data, name = strU8(f.name), crc = crc32(data);
      var lh = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      var arr = new Uint8Array(lh.length + name.length + data.length);
      arr.set(lh, 0); arr.set(name, lh.length); arr.set(data, lh.length + name.length);
      chunks.push(arr); central.push({ name: name, crc: crc, size: data.length, off: off }); off += arr.length;
    });
    var cs = off;
    central.forEach(function (c) {
      var h = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(c.crc), u32(c.size), u32(c.size), u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.off));
      var arr = new Uint8Array(h.length + c.name.length); arr.set(h, 0); arr.set(c.name, h.length); chunks.push(arr); off += arr.length;
    });
    chunks.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(off - cs), u32(cs), u16(0))));
    return new Blob(chunks, { type: "application/zip" });
  }

  function wire() {
    $("#genBtn").addEventListener("click", generate);
    $("#dlWebp").addEventListener("click", dlWebp);
    $("#dlPng").addEventListener("click", dlPng);
    $("#dlZip").addEventListener("click", dlZip);
    els(".et").forEach(function (t) { t.addEventListener("click", function () { els(".et").forEach(function (x) { x.classList.remove("on"); }); t.classList.add("on"); state.fmt = t.getAttribute("data-fmt"); updateExport(); }); });
  }
})();
