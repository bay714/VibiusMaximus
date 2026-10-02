# VibiusMaximus how-to: voiceover script

Matches `src/timeline.ts` (70 s, 30 fps). Times are where each line should **start**; the
on-screen caption for that step appears at the same moment. Read at a relaxed pace (about
2.5 words per second); every line fits its slot with a little air.

Pronunciation: **VibiusMaximus** = "VIB-ee-us MAX-ih-mus", said as one word.

| Start | Scene | On-screen caption | Narration |
|---|---|---|---|
| 0:00 | 1 Hook | *(title card)* Show it. Say it. Paste it. | Show it. Say it. Paste it. This is VibiusMaximus: voice-first capture for AI vibe coding. |
| 0:05 | 2 Dictate | Hold Ctrl+Space and talk — offline, in any app. | Hold Control and Space and just talk. It runs offline, works in any app, and your words land where your cursor is. |
| 0:12 | 3 Capture | Press Alt+Shift+S. The screen freezes. Drag over what to change. | Press Alt, Shift and S. The screen freezes, so menus and hover states stay put. Drag over what you want to change. |
| 0:16.7 | 3 Capture | Draw on it. Alt+P drops numbered pins: speak a note for each. | Draw a box if you like, then press Alt and P to drop numbered pins, and say a note for each one. |
| 0:22.4 | 3 Capture | Hold Ctrl+Space and say the overall request. | Hold Control and Space to say what you want overall… |
| 0:25.5 | 3 Capture | Ctrl+K ✨ turns rambling into a clean instruction. | …and if you rambled, Control K turns it into a clean instruction. Control Z brings back what you said. |
| 0:30 | 4 Send | Enter pastes the image, then the numbered text, into your chat. | Press Enter. The annotated image goes into your chat first, then the numbered text, and your clipboard is put back. |
| 0:36.1 | 4 Send | Terminals get a file path for Claude Code. | In a terminal you get a file path plus the text instead, which is what Claude Code expects. |
| 0:40 | 5 Board | Alt+Shift+B: a board for screenshots, design options and notes. | For bigger asks, Alt Shift B opens a board. Add the current screen and five generated designs, with notes beside them. |
| 0:46.4 | 5 Board | Ctrl+Enter sends all six images, labelled to match the prompt. | Control Enter sends all six images in order, labelled to match the prompt. |
| 0:52 | 6 Macros | Halfway through a message? Press Alt+2. | Halfway through a message? Press Alt 2… |
| 0:54.9 | 6 Macros | One key, your favourite prompts. | …and a saved prompt lands at your cursor. One key, your favourite prompts. |
| 1:00 | 7 Outro | Lightweight: nothing runs until you need it. | And it stays out of your way: zero CPU when idle, windows that open only when you use them, and an 18-megabyte installer. |
| 1:05.6 | 7 Outro | Show it. Say it. Paste it. | VibiusMaximus. Show it. Say it. Paste it. |

## Adding the recording later

1. Record one take per row (or one continuous take) and export a WAV/MP3.
2. Put it in `video/public/voiceover.mp3`.
3. In `src/HowTo.tsx`, add `<Audio src={staticFile("voiceover.mp3")} />` (both from `remotion`)
   inside the root, then `bun run render`.

If a line runs long, lengthen that scene in `src/timeline.ts` rather than speeding up the read;
the scene cues are all relative to the scene start, so they move with it.
