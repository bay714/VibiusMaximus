# VibiusMaximus how-to video

An 82 s motion-graphic walkthrough with voiceover, music and UI sound effects, built with
[Remotion](https://www.remotion.dev) (React → MP4). This folder is its own project: nothing
here is part of the app build.

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
