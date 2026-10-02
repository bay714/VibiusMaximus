# VibiusMaximus how-to video

A ~70 s motion-graphic walkthrough, built with [Remotion](https://www.remotion.dev) (React → MP4).
This folder is its own project: nothing here is part of the app build.

```bash
cd video
bun install
bun run studio    # live preview in the browser
bun run stills    # out/stills/scene1-hook.png, scene3-capture.png, scene5-board.png
bun run render    # out/vibiusmaximus-how-to.mp4 (1920×1080, 30 fps, H.264)
```

- `src/timeline.ts`: scene lengths. `voiceover.md` has the matching narration script.
- `src/scenes/`: one file per scene. Cue frames inside a scene are scene-relative.
- `src/components/`: reusable pieces (Keycap/KeyCombo, Window, ChatWindow/ChatComposer,
  Pin, Waveform, Selection, Cursor, Toast, AcmePage, OptionTile, Wordmark).
- Captions use `{Ctrl+Space}` for inline keycaps and `*word*` for violet emphasis.

Remotion is free for individuals and companies of up to 3 people; larger companies need a
[company licence](https://www.remotion.dev/license).
