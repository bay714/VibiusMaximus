# Vibius Maximus how-to video

## Legion (current)

A ~201 s how-to in the app's Legion look, framed as a Roman legate briefing his Commander. A
briefing first says what the app is for (speech-to-text, screen capture and prompt macros for
vibe coding) and credits the open source it's built on (Handy, Excalidraw, xcap); setup shows the first-run download of Canary 180M Flash; then seven chapters
("orders") cover dictation, capture, send, Alt+C/Alt+V, the board and saved boards, prompt
macros and the Hotkeys page. It shows v1.0.4 behaviour and shortcuts, including the five starter
macros in workflow order: Research, Summarize, Plan, Scope, Execute on Alt+1 to Alt+5.

**Watch it:** [`vibiusmaximus-legion.mp4`](vibiusmaximus-legion.mp4).

```bash
bun run storyboard      # out/storyboard/*.png + sheet.png: the key frames the video follows
bun run render:legion   # out/vibiusmaximus-legion.mp4
bun run audio:legion    # rebuild its voiceover, martial music bed and Roman sound effects
```

- `src/storyboard/`: the storyboard (static key frames, also the source of the look: palette,
  Marcellus, shield, windows, keycaps).
- `src/legion/`: the video. `timeline.ts` has the scene lengths, `audio/voiceover.json` the
  narration and its start times, `scenes/` one file per chapter, `pieces.tsx` the animatable app
  mock-ups, `kit.tsx` captions, keycast, cursor and sound cues.
- `audio/legion.py`: voice (edge-tts, a deep British voice with a short stone-hall room), the
  music and the sound effects, written to `public/audio/legion/`. The music's dip under the voice
  is baked into `music.mp3` from `manifest.json`, so rebuild the music after changing the voice.

## Original (v1.0.1)

An 82 s motion-graphic walkthrough with voiceover, music and UI sound effects, built with
[Remotion](https://www.remotion.dev) (React → MP4). This folder is its own project: nothing
here is part of the app build.

**Watch it:** [`vibiusmaximus-how-to.mp4`](vibiusmaximus-how-to.mp4) (the latest render, committed for
convenience; `bun run render` writes a fresh one to `out/`).

```bash
cd video
bun install
bun run studio    # live preview in the browser
bun run stills    # out/stills/scene1-hook.png, scene3-capture.png, scene5-board.png
bun run render    # out/vibiusmaximus-how-to.mp4 (1920×1080, 30 fps, H.264 + AAC)
```

The generated audio is committed in `public/audio/`, so rendering needs only Bun. To rebuild it
(Python 3.11+):

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r audio/requirements.txt
bun run audio        # voiceover (needs internet), music and sound effects
bun run audio:vo     # just the voiceover, after editing src/audio/voiceover.json
```

- `src/timeline.ts`: scene lengths. `voiceover.md` explains the narration and how to change it.
- `src/scenes/`: one file per scene. Cue frames inside a scene are scene-relative.
- `src/components/`: reusable pieces (Keycap/KeyCombo, Window, ChatWindow/ChatComposer,
  Pin, Waveform, Selection, Cursor, Toast, Sfx, AcmePage, OptionTile, Wordmark).
- `audio/build.py`: voiceover (Microsoft neural voice via edge-tts, then a studio-style
  clean-up chain), the music bed and the sound effects, all synthesised (no samples or
  licensed tracks). To use a licensed track instead, replace `public/audio/music.mp3`.
- Captions use `{Ctrl+Space}` for inline keycaps and `*word*` for violet emphasis.

Remotion is free for individuals and companies of up to 3 people; larger companies need a
[company licence](https://www.remotion.dev/license).
