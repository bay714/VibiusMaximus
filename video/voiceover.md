# VibiusMaximus how-to: voiceover

The voiceover is generated, not recorded: `src/audio/voiceover.json` holds every line and its
start time, and `bun run audio` reads it with a Microsoft neural voice (Andrew), cleans each
line up like a studio read (silence trim, high-pass, EQ, de-esser, compressor, -16 LUFS) and
measures it. Each line plays at a natural pace and must fit before the next one starts; the
build reports any line that's too long so the text can be tightened. The music ducks about
9 dB under the voice.

| Start | Scene | On-screen caption | Narration |
|---|---|---|---|
| 0:00.3 | 1 Hook | *(title card)* | Show it. Say it. Paste it. Meet VibiusMaximus. |
| 0:05.3 | 2 Dictate | Hold Ctrl+Space and talk — offline, in any app. | Hold Control Space and just talk. It runs offline, in any app, right where your cursor is. |
| 0:12.3 | 3 Capture | Press Alt+Shift+S. The screen freezes. Drag over what to change. | Alt Shift S freezes the screen. Drag over what to change. |
| 0:16.8 | 3 Capture | Draw on it. Alt+P drops numbered pins: speak a note for each. | Draw a box, then Alt P drops numbered pins. Say a note for each. |
| 0:22.4 | 3 Capture | Hold Ctrl+Space and say the overall request. | Hold Control Space for the main request. |
| 0:25.6 | 3 Capture | Ctrl+K ✨ turns rambling into a clean instruction. | Rambled? Control K turns it into a clean instruction. |
| 0:30.3 | 4 Send | Enter pastes the image, then the numbered text, into your chat. | Press Enter. The marked-up image goes into your chat, then the numbered notes. |
| 0:36.1 | 4 Send | Terminals get a file path for Claude Code. | Terminals get a file path instead, ready for Claude Code. |
| 0:40.3 | 5 Board | Alt+Shift+B: a board for screenshots, design options and notes. | Bigger ask? Alt Shift B opens a board for screenshots, design options and notes. |
| 0:46.4 | 5 Board | Ctrl+Enter sends all six images, labelled to match the prompt. | Control Enter sends all six images in order, labelled to match the prompt. |
| 0:52.3 | 6 Macros | Halfway through a message? Press Alt+2. | Mid-message? Press Alt 2, |
| 0:54.9 | 6 Macros | One key, your favourite prompts. | and a saved prompt lands right at your cursor. |
| 0:59.4 | 6 Macros | Got a wall of text back? Type your follow-up… | Got a wall of text back? Type your follow-up, |
| 1:05.7 | 6 Macros | …then Alt+4 asks for a concise summary. | then Alt 4 adds your summary prompt. One key, your favourite prompts. |
| 1:11.3 | 7 Outro | Lightweight: nothing runs until you need it. | Zero CPU when idle. Windows only when you use them. An eighteen megabyte installer. |
| 1:17.6 | 7 Outro | Show it. Say it. Paste it. | VibiusMaximus. Show it, say it, paste it. |

## Changing it

- **Edit a line:** change its text in `src/audio/voiceover.json`, run `bun run audio:vo`, then
  `bun run render`.
- **Different voice:** set `"voice"` in the same file (`edge-tts --list-voices` lists them).
- **Your own recording:** replace the files in `public/audio/vo/` (same names, one per line) and
  update the durations in `src/audio/manifest.json`.
- **Timing:** start times are absolute seconds. If a scene in `src/timeline.ts` gets longer,
  shift the later start times by the same amount.
