# Sprite Forge Studio

Interactive **demo** of an AI sprite-sheet generator: pick a character → choose actions
(idle / walk / run / jump / attack / custom special) → "generate" → play the animation preview
→ inspect the sprite sheet → download a real Unity / Godot / Phaser bundle.

**Live:** https://sylvanus4.github.io/sprite-forge-studio/

## What's simulated vs real

- **Simulated:** the "AI generation" step. The animation frames are procedurally drawn
  in-browser from keyframe pose data (the pre-made assets), not produced by a model call.
- **Real:** the sprite sheet PNG and the export bundle are genuinely generated client-side —
  `canvas → PNG` plus a Unity auto-slice `.png.meta`, `frames.json`, Aseprite / TexturePacker
  JSON, and per-action `.anim` stubs, packed into a `.zip` with a dependency-free store writer.
  Drop the PNG + `.meta` into a Unity `Assets/` folder and the frames import pre-sliced.

## Stack

100% client-side static site. Zero dependencies, zero build step, system fonts only,
dark-first with a `prefers-color-scheme` light fallback — the sylvanus4 web-tool house style.

```
index.html            markup + panels
assets/style.css       design tokens (no hardcoded colors)
assets/sprites.js      canvas chibi engine + keyframe pose data (pure)
assets/export.js       frames.json / Unity .meta / Aseprite / TexturePacker + store-zip (pure)
assets/app.js          DOM wiring + simulated-generation state machine + preview loop
```

## Local run

Any static server, e.g. `python3 -m http.server` then open the folder. No backend.

## Behind the demo

The real pipeline reuses a held-cel prompt + frame-stabilization approach (fixing the
frame-to-frame jitter) and a uniform-cell atlas repacker, then exports Unity/multi-engine
metadata. This page shows that flow interactively.

MIT © [@sylvanus4](https://github.com/sylvanus4)
