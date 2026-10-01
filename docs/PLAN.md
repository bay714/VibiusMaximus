# MaximusVibius — Build Plan

> Voice-first capture for AI vibe coding. Snap a piece of the screen, say what's
> wrong with it, and paste image + instructions into any AI chat. Fire saved
> prompts with one key.

MaximusVibius is a fork of [Handy](https://github.com/cjpais/Handy) (MIT), which
already provides offline speech-to-text (Whisper / Parakeet / **Canary**), global
hotkeys, a tray app, and paste-into-active-window on Windows/macOS/Linux. We add
three features on top. **Windows first**; nothing Windows-only leaks into shared
code without a `#[cfg]`.

Mockups: [`docs/mockups/workflow.html`](mockups/workflow.html) (open in a browser).

---

## 1. Features

| # | Feature | Trigger | Output |
|---|---|---|---|
| F1 | **Dictate** (Handy, unchanged) | hold `Ctrl+Space` | text typed into the focused app |
| F2 | **Snap & caption** — one element | `Alt+Shift+S`, drag a box, speak | image with caption band + caption text |
| F3 | **Multi-annotate** — many elements | same capture, then drop numbered pins and speak per pin | image with ①②③ badges + numbered note list |
| F4 | **Prompt macros** | user-assigned keys, e.g. `Alt+1`…`Alt+9` | saved prompt inserted at the cursor |

F2 and F3 are **one flow**, not two tools. Every capture opens the same editor.
If you add no pins, you get a single caption. Each pin adds a numbered note.
That keeps one hotkey, one window and one code path.

### Workflow (F2/F3)

1. `Alt+Shift+S`. The current monitor is grabbed instantly as a still frame, so
   hover states, open dropdowns and tooltips are kept. A full-screen window
   shows the frame dimmed.
2. Drag a region. The editor appears **in place**: the selection stays bright,
   a small toolbar sits above it and a caption bar sits below it.
3. Hold `Ctrl+Space` (the normal dictation key) and talk. The words land in the
   caption field. Or type.
4. Optional: press `P` (or pick the pin tool) and click elements. Each click
   drops a numbered pin and focuses that pin's note. Hold `Ctrl+Space` again
   to dictate the note. `B` draws a box, `A` an arrow.
5. `Enter` sends: the capture window closes, focus returns to the app you were
   in, and the image is pasted, then the text. `Shift+Enter` copies to the
   clipboard only. `Esc` cancels.

### Output format

Image: the cropped region, annotations, and a caption band at the bottom with
the caption and numbered notes printed in it. The image makes sense on its own.

Text (pasted after the image, because models read real text better than pixels):

```
[screenshot above]
Make the sign-up area mobile friendly.
1. Button should be full width below 640px, primary color.
2. Email input is misaligned with the button — same height (44px).
3. Remove the "No credit card" note on mobile.
```

**Clipboard limitation:** most chat apps take either an image or text from one
paste, not both. "Send" therefore does two pastes in a row: put the image on
the clipboard, press `Ctrl+V`, put the text on the clipboard, press `Ctrl+V`,
then restore whatever the user had before. "Copy only" puts the image on the
clipboard (the user can press `Shift+Enter` again for the text).

Optional setting, **Save captures to folder**. When on, each capture is also
written as a PNG and the file path is added to the text. This helps terminal
agents such as Claude Code, which accept image file paths.

### Workflow (F4)

Settings → **Macros**. Each macro has a name, a hotkey, a prompt body, and a
"press Enter after" toggle. Pressing the hotkey anywhere inserts the body at the
cursor, adding it to whatever you were already typing, through Handy's existing
paste pipeline, which also restores the clipboard. v1 is text only. Variables
(`{clipboard}`, `{date}`) and multi-step actions come later.

---

## 2. Lightweight by design

| Decision | Why |
|---|---|
| **No canvas library.** The annotation layer is a small custom SVG layer (box, arrow, pin), drawn to a `<canvas>` only on export. Excalidraw (~1 MB+ of JS) is dropped. | Only 3 shapes are needed. Target: capture window bundle < 150 KB gzipped. |
| **One extra webview, created on demand.** Region select and editor are the same window. It is destroyed about 60 s after closing (kept warm for repeat snaps). | Zero extra memory while idle. |
| **Frame served from memory** through a custom `capture://` URI scheme (raw BMP), not base64 over IPC and not a temp file. | A 4K RGBA frame is about 33 MB, which base64 IPC is too slow for. |
| **Small default speech model:** Canary 180M Flash Q4 (139 MB), with Parakeet V3 offered as the accuracy upgrade. Handy's idle model unloading stays on. | Small download, low RAM, fast on CPU. |
| **Screen capture via `xcap`** (Rust, Apache-2.0), one small crate. | No external screenshot app to install. |
| **Macros reuse Handy's shortcut and paste code.** No espanso. | No second process, no GPL dependency. |

Budgets to verify in Phase 0/5 (measure Handy's baseline first):
installer grows by ≤ 2 MB; idle RAM unchanged vs Handy; hotkey → frozen frame
visible in ≤ 150 ms; Enter → pasted in ≤ 300 ms.

---

## 3. Architecture

```
                 ┌───────────────────────── Rust (src-tauri) ─────────────────────────┐
 global hotkey ─▶│ shortcut/handler.rs ──▶ ACTION_MAP                                 │
                 │      "transcribe"   ─▶ TranscribeAction (Handy)                     │
                 │      "capture"      ─▶ vibe::capture::CaptureAction   ── NEW        │
                 │      "macro:<id>"   ─▶ vibe::macros::MacroAction       ── NEW        │
                 │                                                                     │
                 │ vibe/capture.rs   xcap grab → frame in memory → capture:// scheme    │
                 │                   remembers foreground HWND to return focus later    │
                 │ vibe/output.rs    image+text → clipboard → paste ×2 → restore        │
                 │ vibe/macros.rs    macro → utils::paste (Handy)                       │
                 │ actions.rs:~839   if capture window focused → emit "vibe://dictation"│
                 │                   instead of pasting (keeps the clipboard clean)    │
                 └────────────────────────────────────────────────────────────────────┘
                 ┌──────────────────────── Frontend (src) ─────────────────────────────┐
                 │ src/capture/      NEW window entry: select → annotate → export      │
                 │   Selector.tsx  Editor.tsx  Annotations.tsx (SVG)  exportPng.ts     │
                 │ src/components/settings/capture/  NEW: hotkey, send mode, folder    │
                 │ src/components/settings/macros/   NEW: list + editor                │
                 └─────────────────────────────────────────────────────────────────────┘
```

**Staying upstream-friendly.** New code lives in `src-tauri/src/vibe/` and
`src/capture/`. Changes to Handy's own files are limited to registering actions,
adding settings fields (with `#[serde(default)]`), one routing branch at the
paste call, sidebar entries, and a second Vite entry. That way
`git fetch upstream && git merge upstream/main` stays painless.

### Data model (added to `AppSettings`)

```rust
struct CaptureSettings {
    send_mode: SendMode,          // PasteImageThenText | CopyOnly
    include_text: bool,           // default true
    save_folder: Option<PathBuf>, // None = don't save
    caption_band: bool,           // burn caption into image, default true
}
struct Macro {
    id: String,          // binding id = "macro:<id>"
    name: String,
    body: String,
    press_enter: bool,
}
// hotkeys stay in Handy's `bindings` map, so the existing
// shortcut recorder UI, conflict checks and persistence all just work.
```

---

## 4. Phases

Each phase ends with something you can run and use.

### Phase 0: Toolchain, baseline, rebrand (½–1 day)
- Install: Rust (rustup, MSVC), VS 2022 Build Tools (C++ workload), CMake,
  Vulkan SDK, Bun. Download the Silero VAD model (see `AGENTS.md`).
- `bun run tauri dev` runs stock Handy on this machine. Record baseline RAM,
  installer size and startup time.
- Rebrand: `productName` → MaximusVibius, `identifier` → `com.bay714.maximusvibius`
  (so it can sit beside a real Handy install), icons, tray strings, README with
  Handy credit.
- **Turn off the updater** (it points at Handy's releases) until we publish our own.
- Default model → Canary 180M Flash.
- ✅ Done when: the renamed app dictates into Notepad on Windows.

### Phase 1: Capture and region select (1–2 days)
- `xcap` grab of the monitor under the cursor; frame served through `capture://frame`.
- Borderless, topmost, full-screen capture window. Dimmed frame, crosshair,
  drag to select, size label, `Esc` cancels. Per-monitor DPI handled.
- `capture` binding (`Alt+Shift+S`) in the Shortcuts settings.
- ✅ Done when: the hotkey selects a region and `Shift+Enter` copies the crop to the clipboard.

### Phase 2: Caption, dictation, send (2–3 days)
- Caption bar under the selection with a live "listening" state.
- Dictation routing: while the capture window has focus, transcripts go to it
  as events instead of being pasted.
- Export: canvas composite (crop + caption band) → PNG → clipboard.
- Send: restore focus to the stored window, paste the image, paste the text, restore the clipboard.
- ✅ Done when: snap a button → speak → `Enter` → image and text appear in Claude/ChatGPT/Cursor chat.

### Phase 3: Pins, boxes, arrows (1–2 days)
- SVG annotation layer, pin numbering, per-pin note list, undo, delete, re-number.
- Numbered list in the caption band and in the text output.
- ✅ Done when: three pins with three spoken notes produce the output format above.

### Phase 4: Prompt macros (1 day)
- `macro:` prefix dispatch in `shortcut/handler.rs` → `MacroAction`.
- Settings → Macros: list, add/edit/delete, hotkey recorder, "press Enter after".
- Ships with 3 starter macros (editable).
- ✅ Done when: `Alt+1` inserts a saved prompt into a half-typed chat message.

### Phase 5: Polish and package (1–2 days)
- Capture settings page, first-run tips, tray menu entries ("New capture", "Macros…").
- Save-to-folder option and path in text.
- Check the budgets; build a signed or unsigned MSI/NSIS installer from CI.
- ✅ Done when: a fresh Windows machine installs it and completes all four workflows.

**Total: roughly 7–11 working days.**

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Windows focus-stealing rules block `SetForegroundWindow` when returning focus | Store the HWND at hotkey time and use `AttachThreadInput` if needed. If it still fails, fall back to "copied, press Ctrl+V" with a toast. |
| Some chat apps reject image paste, or drop the second paste | Small delay between the two pastes (configurable). Per-app "Copy only" fallback. |
| Mixed-DPI multi-monitor setups shift the crop | Phase 1 tests 100%/150% across two monitors. Crop uses physical pixels from `xcap`. |
| Handy keystroke hooks (`rdev`) and our full-screen window fighting over `Esc` | The capture window handles keys itself while focused. Handy's cancel binding stays off during capture. |
| Upstream merge conflicts | Keep the changes to Handy's own files small (§3). Merge upstream every 2–4 weeks. |

## 6. Later (not v1)
- Browser extension: click a DOM element to attach its selector, outer HTML
  and page URL to the capture. Very strong context for coding agents.
- Macro steps (keys, delays, "start capture"), variables.
- macOS/Linux packaging (the code paths already exist through Handy and `xcap`).
