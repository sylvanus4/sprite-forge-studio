/* app.js — DOM wiring + simulated-generation state machine + preview loop.
 * Pure rendering/data lives in sprites.js; export/zip in export.js. This file
 * only touches the DOM and orchestrates. No dependencies.
 */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var els = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var state = {
    char: "doctor",
    actions: ["idle", "walk", "run", "jump", "attack", "special"],
    cell: 128, fps: 10, loop: true, onion: false, playing: true,
    previewAction: "walk", sheet: null, exportFmt: "unity"
  };

  /* ---------- Step 1: character cards ---------- */
  function buildChars() {
    var grid = $("#charGrid");
    grid.innerHTML = "";
    Object.keys(SF.CHARS).forEach(function (id) {
      var ch = SF.CHARS[id];
      var card = document.createElement("div");
      card.className = "char-card" + (id === state.char ? " sel" : "");
      card.innerHTML = '<canvas width="96" height="96"></canvas>' +
        '<div class="cn">' + ch.ko + '</div><div class="ck">' + ch.name + '</div>';
      grid.appendChild(card);
      var cv = card.querySelector("canvas");
      drawStatic(cv, id, "idle", 1.2);
      card.addEventListener("click", function () {
        state.char = id;
        els(".char-card").forEach(function (c, i) { c.classList.toggle("sel", Object.keys(SF.CHARS)[i] === id); });
      });
    });
  }
  function drawStatic(cv, charId, action, frame) {
    var ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save(); ctx.scale(cv.width / SF.CELL, cv.height / SF.CELL);
    SF.drawFrame(ctx, charId, action, frame, {});
    ctx.restore();
  }

  /* ---------- Step 2: action chips ---------- */
  function buildActions() {
    var wrap = $("#actChips"); wrap.innerHTML = "";
    SF.ACTIONS.forEach(function (a) {
      var on = state.actions.indexOf(a.id) >= 0;
      var chip = document.createElement("div");
      chip.className = "chip" + (on ? " on" : "");
      chip.innerHTML = '<span class="dot"></span>' + a.label + ' <span class="kk">' + a.ko + '</span>';
      chip.addEventListener("click", function () {
        var i = state.actions.indexOf(a.id);
        if (i >= 0) { if (state.actions.length > 1) state.actions.splice(i, 1); }
        else state.actions.push(a.id);
        chip.classList.toggle("on", state.actions.indexOf(a.id) >= 0);
      });
      wrap.appendChild(chip);
    });
  }

  /* ---------- Generation (simulated) ---------- */
  var GEN_STEPS = [
    { t: "레퍼런스 분석 · 캐릭터 파츠 추출", log: "detect: head / torso / limbs · palette locked" },
    { t: "GPT Image 2 · 액션 프레임 시트 생성", log: "prompt → grid render (held-cel spec)" },
    { t: "held-cel · 몸통 고정, 파트 모션", log: "body copied · only named part animates" },
    { t: "셀 슬라이스 + 배경 투명화", log: "adaptive gutter snap · corner flood-fill → alpha" },
    { t: "stabilize · 발 baseline·크기 정렬", log: "core-height normalize · foot plant · center" },
    { t: "아틀라스 재패킹 (균일 셀)", log: "repack → uniform grid · pivot = bottom" },
    { t: "Unity .meta / frames.json 내보내기", log: "auto-slice rects · clips · sidecar json" }
  ];
  function generate() {
    var order = ["idle", "walk", "run", "jump", "attack", "special"];
    state.actions.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    state.cell = parseInt($("#cell").value, 10);
    $("#empty").style.display = "none";
    $("#result").style.display = "none";
    var gen = $("#gen"); gen.classList.add("show");
    var bar = $("#genBar"), stepEl = $("#genStep"), logEl = $("#genLog");
    bar.style.width = "0%"; logEl.innerHTML = "";
    $("#genBtn").disabled = true;
    var i = 0;
    function tick() {
      if (i >= GEN_STEPS.length) {
        setTimeout(function () { gen.classList.remove("show"); renderResult(); $("#genBtn").disabled = false; }, 260);
        return;
      }
      var s = GEN_STEPS[i];
      stepEl.textContent = s.t;
      var line = document.createElement("div");
      line.textContent = "› " + s.log;
      logEl.appendChild(line);
      while (logEl.children.length > 4) logEl.removeChild(logEl.firstChild);
      bar.style.width = Math.round(((i + 1) / GEN_STEPS.length) * 100) + "%";
      i++;
      setTimeout(tick, 300 + Math.random() * 220);
    }
    tick();
  }

  /* ---------- Result render ---------- */
  function renderResult() {
    // sprite sheet
    state.sheet = SF.renderSheet(state.char, state.actions, state.cell);
    var sc = $("#sheet");
    sc.width = state.sheet.canvas.width; sc.height = state.sheet.canvas.height;
    sc.getContext("2d").drawImage(state.sheet.canvas, 0, 0);
    $("#sheetDims").textContent = state.sheet.cols + "×" + state.sheet.rows + " · " + state.cell + "px";

    // action tabs
    var tabs = $("#actTabs"); tabs.innerHTML = "";
    if (state.actions.indexOf(state.previewAction) < 0) state.previewAction = state.actions[0];
    state.actions.forEach(function (a) {
      var meta = SF.ACTIONS.filter(function (x) { return x.id === a; })[0];
      var t = document.createElement("div");
      t.className = "acttab" + (a === state.previewAction ? " on" : "");
      t.textContent = meta.label + " · " + meta.ko;
      t.addEventListener("click", function () {
        state.previewAction = a; frameF = 0; holdT = 0;
        els(".acttab", tabs).forEach(function (x) { x.classList.remove("on"); });
        t.classList.add("on"); updatePvName();
      });
      tabs.appendChild(t);
    });

    $("#result").style.display = "block";
    updatePvName(); updateExport();
    frameF = 0; holdT = 0; state.playing = true; setPlayIcon();
  }
  function updatePvName() {
    var m = SF.ACTIONS.filter(function (x) { return x.id === state.previewAction; })[0];
    var name = state.previewAction === "special" ? ($("#customPrompt").value || "Special") : (m.label + " · " + m.ko);
    $("#pvName").textContent = name;
  }

  /* ---------- Preview animation loop ---------- */
  var frameF = 0, holdT = 0, last = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!last) last = ts;
    var dt = (ts - last) / 1000; last = ts;
    if ($("#result").style.display === "none") return;
    var ch = SF.CHARS[state.char];
    if (!ch) return;
    var act = ch.actions[state.previewAction];
    if (state.playing) {
      if (act.loop) {
        frameF += dt * state.fps;
      } else {
        if (holdT > 0) { holdT -= dt; if (holdT <= 0) { frameF = 0; } }
        else {
          frameF += dt * state.fps;
          if (frameF >= act.frames.length - 1) { frameF = act.frames.length - 1; if (state.loop) holdT = 0.5; }
        }
      }
    }
    var cv = $("#preview"), ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    var sc = cv.width / SF.CELL;
    if (state.onion && (act.loop || frameF > 0.2)) {
      ctx.save(); ctx.globalAlpha = 0.22; ctx.scale(sc, sc);
      SF.drawFrame(ctx, state.char, state.previewAction, Math.max(0, frameF - 1), {});
      ctx.restore();
    }
    ctx.save(); ctx.scale(sc, sc);
    SF.drawFrame(ctx, state.char, state.previewAction, frameF, {});
    ctx.restore();
  }

  /* ---------- Export code panel ---------- */
  function updateExport() {
    if (!state.sheet) return;
    var code, fmt = state.exportFmt, ch = state.char;
    if (fmt === "unity") code = clip(SFExport.unityMeta(state.sheet, ch), 46);
    else if (fmt === "frames") code = JSON.stringify(SFExport.framesJson(state.sheet, ch), null, 2);
    else code = JSON.stringify(SFExport.asepriteJson(state.sheet, ch), null, 2);
    $("#exportCode").textContent = code;
  }
  function clip(s, n) { var a = s.split("\n"); return a.length > n ? a.slice(0, n).join("\n") + "\n  … (" + (a.length - n) + " more lines)" : s; }

  /* ---------- Downloads ---------- */
  function downloadPng() {
    if (!state.sheet) return;
    state.sheet.canvas.toBlob(function (b) { SFExport.download(b, state.char + "_sheet.png"); });
  }
  function downloadZip() {
    if (!state.sheet) return;
    var btn = $("#dlZip"), old = btn.textContent; btn.textContent = "번들 생성 중…"; btn.disabled = true;
    state.sheet.canvas.toBlob(function (b) {
      b.arrayBuffer().then(function (buf) {
        var fps = state.fps;
        var blob = SFExport.buildBundle(state.sheet, state.char, fps, new Uint8Array(buf));
        SFExport.download(blob, "sprite-forge-" + state.char + ".zip");
        btn.textContent = old; btn.disabled = false;
      });
    });
  }

  /* ---------- controls ---------- */
  function setPlayIcon() {
    $("#playBtn").innerHTML = state.playing
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  }
  function wire() {
    $("#genBtn").addEventListener("click", generate);
    $("#playBtn").addEventListener("click", function () { state.playing = !state.playing; setPlayIcon(); });
    $("#loopBtn").addEventListener("click", function () { state.loop = !state.loop; this.classList.toggle("on", state.loop); });
    $("#onionBtn").addEventListener("click", function () { state.onion = !state.onion; this.classList.toggle("on", state.onion); });
    $("#fps").addEventListener("input", function () { state.fps = +this.value; $("#fpsVal").textContent = this.value; });
    $("#loopBtn").classList.add("on");
    els(".et").forEach(function (t) {
      t.addEventListener("click", function () {
        els(".et").forEach(function (x) { x.classList.remove("on"); });
        t.classList.add("on"); state.exportFmt = t.getAttribute("data-fmt"); updateExport();
      });
    });
    $("#customPrompt").addEventListener("input", function () { if (state.previewAction === "special") updatePvName(); });
    $("#dlPng").addEventListener("click", downloadPng);
    $("#dlZip").addEventListener("click", downloadZip);
  }

  /* ---------- boot ---------- */
  buildChars(); buildActions(); wire(); requestAnimationFrame(loop);
  if (location.hash === "#demo") setTimeout(generate, 150);
})();
