# MaximusVibius — Full Build Plan

> Voice-first capture for AI vibe coding. Snap part of the screen, say what to
> change, and paste the image and instructions into any AI chat or terminal.
> Fire saved prompts with one key.

MaximusVibius is a fork of [Handy](https://github.com/cjpais/Handy) (MIT, Tauri 2:
Rust + React/TypeScript). Handy already provides offline speech-to-text
(Whisper, Parakeet, **Canary** and others), global hotkeys, AI post-processing,
custom vocabulary, history, a tray app, and paste-into-the-active-app. This plan
adds the capture editor, prompt macros, and the glue that makes them one
workflow. **Windows first**; anything Windows-only sits behind `#[cfg(windows)]`
so macOS/Linux stay possible.

Mockups: [`docs/mockups/README.md`](mockups/README.md) (screenshots) and [`docs/mockups/workflow.html`](mockups/workflow.html) (live, open in a browser).

## Priorities

**Phase 1: build now.** This is the core loop: capture → annotate → speak → paste, plus macros.
| In | Notes |
|---|---|
| Rebrand, CPU-only build, Canary 180M default | No Vulkan SDK needed. Smaller and lighter. |
| F2 Capture, F3 Editor (box, arrow, pin), F4 Voice in editor | All new code. |
| F5 AI cleanup | Reuses Handy's post-processing. Mostly UI. |
| F6 Send with paste profiles, F7 Auto-submit | New paste sequence. The submit key comes from Handy. |
| F8 Prompt macros | Reuses Handy's hotkeys and paste. |
| F9 Starter developer vocabulary | One list added to Handy's custom words. |
| Tray: *New capture* | One menu item. |

**Phase 2: later.** F10 Capture history, F11 Board, project vocabulary import,
onboarding practice step, tray Macros submenu, CI installer, and our own updater.

**What's already done by Handy:** dictation, speech models, hotkey recording,
paste/clipboard handling, AI post-processing, custom words, auto-submit,
settings storage, tray, and the dictation history.
**What's new code:** the capture window, the annotation editor, the image +
text paste sequence, paste profiles, macros, and (Phase 2) the board.

**Time:** Phase 1 is about 1–2 days of build work, plus your hands-on testing
on Windows. The first compile takes roughly 15–30 minutes, and later ones are
incremental.

**Contents:** 1 Features · 2 Hotkeys · 3 Architecture · 4 Data model ·
5 Pipelines · 6 Settings & UI · 7 Lightweight budgets · 8 Build environment ·
9 Testing · 10 Packaging & release · 11 Upstream sync · 12 Risks ·
13 Build checklist · 14 Out of scope

---

## 1. Features

### F1. Dictation (Handy, kept as-is)
Hold `Ctrl+Space` to dictate into any app. `Ctrl+Shift+Space` dictates with AI
cleanup. Everything Handy already does stays available: live overlay, VAD,
filler-word removal, translate-to-English, paste methods, history, CLI flags.

### F2. Capture: freeze and select
- `Alt+Shift+S` captures **the monitor under the cursor** the instant the key is
  pressed, so hover states, open menus and tooltips are kept.
- A borderless, topmost, full-screen window shows that frozen frame, dimmed.
  The cursor is a crosshair with a live size label (in physical pixels).
- **Drag** selects a region. **Space** selects the window under the cursor.
  **Ctrl+A** selects the whole monitor. **Esc** cancels.
- Before the capture window takes focus, the app remembers which window had it
  (its window handle, process name and title). Send uses this to return focus.

**Done when:** at 100% and 150% scaling, on a second monitor, the cropped pixels
exactly match what was selected.

### F3. Capture editor: annotate in place
The editor opens over the frozen frame, anchored to the selection. You can drag
the selection's handles to adjust it.
- **Toolbar** above the selection: Select `V`, Box `B`, Arrow `A`, Pin `P`, Undo,
  Redo, three colors (pink, yellow, green).
- **Pins:** each click drops a numbered pin and adds a note row. Pins renumber
  automatically when one is deleted. `Del` removes the selected shape or pin.
  `Tab` and `Shift+Tab` move between the caption and the notes.
- **Caption bar** below the selection: one overall caption, plus a note row per
  pin. It flips above the selection when there's no room below.
- Tool keys are plain letters when no text field has focus, and need `Alt`
  (`Alt+B`) while typing.
- All drawing is a small custom SVG layer. No canvas library.

**Done when:** you can place, move, delete, undo and redo boxes, arrows and 10+
pins, and the numbering stays correct.

### F4. Voice in the editor
- While the capture window is open, **Handy's dictation goes to the editor
  instead of being pasted.** The text is inserted at the cursor in the focused
  field (caption or active note). This leaves the user's clipboard untouched
  and avoids focus races.
- With a streaming model, words appear live in grey, then become final text.
- The mic button in the caption bar mirrors the recording state. Clicking it
  starts or stops recording, the same as the hotkey.
- Handy's own recording overlay is hidden while the editor is open, because the
  editor shows its own listening state.

**Done when:** holding `Ctrl+Space` with the editor open fills the focused field
and nothing reaches the clipboard or the app behind.

### F5. AI cleanup for captions *(uses Handy's post-processing)*
- **✨ Clean up** button (`Ctrl+K`) in the caption bar rewrites the caption and
  all notes into short, specific coding instructions. The result replaces the
  fields in place, and `Ctrl+Z` brings back the original.
- Dictating with `Ctrl+Shift+Space` inside the editor cleans up just that
  dictated part, matching Handy's existing behaviour for that key.
- Optional setting **Always clean up on send** (off by default).
- Uses whichever provider is set up in Handy's Post-processing page: Anthropic,
  OpenAI, OpenRouter, Groq, Cerebras, or Custom (any OpenAI-compatible endpoint,
  including a local Ollama, so it can stay fully offline).
- Ships a new built-in prompt, **"Vibe coding instruction"**:
  > Rewrite these spoken notes about a UI screenshot into concise, specific
  > instructions for an AI coding assistant. Keep the same number of notes and
  > their order. Don't add requirements that weren't said. Keep exact values
  > (sizes, colors, names).
- Uses structured output: the request sends `{caption, notes[]}` and must return
  the same shape with the same number of notes. If the shape doesn't match, it
  falls back to cleaning each field separately.
- When no provider is set up, the button is disabled and links to the
  Post-processing page.

**Done when:** three rambling notes come back as three clean notes, in order,
with nothing invented, and `Ctrl+Z` restores the originals.

### F6. Send
| Key | Action |
|---|---|
| `Enter` | **Send:** paste the image, then the text, into the window you came from |
| `Ctrl+Enter` | **Send and submit:** Send, then press the app's submit key |
| `Shift+Enter` | **Copy only:** put the image on the clipboard and close |
| `Esc` | Cancel |

**Output image:** the crop at full resolution, the annotations, and (setting on
by default) a caption band underneath with the caption and numbered notes. The
image makes sense even if the text is lost.

**Output text:**
```
[screenshot above]
Make the hero section mobile friendly and match our design system.
1. Input and button heights don't match. Both should be 44px, aligned to the top.
2. Headline is too big on small screens. Clamp it between 28 and 40px.
3. Hide this illustration below 768px.
```

**Paste profiles** (per target app, matched on process name): what Send does
depends on where it's going.
| Profile | Behaviour | Default for |
|---|---|---|
| Image + text | paste image, pause, paste text | everything else (browsers, Claude/ChatGPT desktop, Cursor, VS Code) |
| File path + text | save the PNG, paste `path` and the text as one block of text | `WindowsTerminal.exe`, `pwsh.exe`, `cmd.exe`, `wezterm-gui.exe`, `alacritty.exe` (for Claude Code and other terminal agents) |
| Copy only | clipboard only, show a "Press Ctrl+V" toast | user-assigned |

The user's clipboard is put back after sending. The pause between the two
pastes is configurable (default 250 ms).

**Done when:** in Claude web, ChatGPT web, Claude desktop, Cursor chat, VS Code
Copilot chat and Claude Code in Windows Terminal, `Enter` produces the right
result without the user doing anything else.

### F7. Auto-submit everywhere
Uses Handy's existing submit-key setting (`Enter`, `Ctrl+Enter` or `Cmd+Enter`).
- Captures: `Ctrl+Enter` for one-off submits, plus a setting **Always submit
  after Send** (off by default).
- Macros: a per-macro **Press submit after inserting** toggle.
- Dictation: Handy's global auto-submit toggle, unchanged.

### F8. Prompt macros
- Settings → **Macros**. Each macro has a name, a hotkey (recorded with Handy's
  shortcut recorder, so conflicts are caught), a body, **Insert before**
  (nothing, space or new line), and **Press submit after inserting**.
- Pressing the hotkey anywhere inserts the body at the cursor, adding to what's
  already typed. Macros always paste through the clipboard, even when Handy's
  paste method is "direct typing", so multi-line prompts don't trigger a send
  halfway through. The clipboard is restored afterwards.
- **Variables:** `{clipboard}`, `{date}`, `{time}`, filled in when the macro fires.
- The body field accepts dictation (`Ctrl+Space`).
- Ships 4 editable starter macros on `Alt+1`…`Alt+4`: *Plan first*, *Match
  design system*, *Don't touch tests*, *Small diff*.
- The tray menu lists macros, and clicking one inserts it. Useful for macros
  without a hotkey.

**Done when:** `Alt+2` in a half-typed Claude message adds the prompt after a
space, and the clipboard is unchanged afterwards.

### F9. Developer vocabulary *(uses Handy's custom words)*
- On first run, a curated list of about 80 developer terms is added to Custom
  Words, for example: React, Next.js, Tailwind, TypeScript, useEffect, useState,
  npm, pnpm, Vite, Supabase, Prisma, shadcn, Vercel, API, JSON, CSS, flexbox,
  padding, margin, z-index, viewport, breakpoint, hover state, dropdown, modal,
  navbar, CTA, props, endpoint, localhost. The words are chosen to sound
  distinct, to keep Handy's fuzzy correction from making false swaps.
- **Import from project…** asks for a folder, reads `package.json` dependency
  names and PascalCase component file names (`*.tsx`, `*.jsx`, `*.vue`, `*.svelte`,
  up to 200), and shows a checklist before adding anything.
- A **Restore developer vocabulary** button re-adds the starter list.

**Done when:** "use effect", "tailwind" and "shad CN" come out as `useEffect`,
`Tailwind` and `shadcn` with the default Canary model.

### F10. Capture history
- Every Send or Copy is saved: a PNG in the app's data folder plus a database
  row (see §4). The History page gets **Dictations | Captures** tabs.
- Captures tab: thumbnail grid. Each item offers **Send again** (opens a
  window picker, then runs the normal Send), **Copy image**, **Copy text**,
  **Open in editor** (re-annotate), **Show in folder**, star, and delete.
- Follows Handy's existing history limit and retention settings. Starred items
  are never pruned.
- Optional **Also save to folder** (user-picked). When on, the file path is
  added to the output text.

### F11. Board: build a prompt from many images
A window for putting a prompt together before sending it: screenshots, any other
images (for example five alternatives ChatGPT generated, saved to a folder), and
text, laid out next to each other. Quick Send (F6) stays the same. The Board is
for when one capture isn't enough.

**Layout: structured, not freeform.** A board is a vertical list of
**sections**. Each section has an optional title, a row or grid of images, a
note under each image, and a text box. A **Prompt** box at the top holds the
overall request. Everything snaps into place, so images always line up with
their text, and the order on screen is the order the AI reads. A freeform
canvas (tldraw/Excalidraw style) was considered and rejected: it adds about
1 MB+ of JS, and freeform positions don't turn into an ordered prompt.

**Labels.** Every image gets a label the text can refer to. By default images
are numbered across the board (Image 1, 2, 3…). A section can switch to
**Options** labels (A, B, C…), which suits a set of alternatives.

**Adding images:**
- From a capture: **`Alt+Enter`** in the capture editor sends it to the board
  instead of the chat, keeping the annotations, caption and notes.
- **Drag and drop** files or a folder from Explorer, or drop them onto a section.
- **`Ctrl+V`** a copied image or copied files.
- **Add files…** / **Add from folder…** (with a thumbnail picker).
- From History → Captures: **Add to board**.
- **Inbox folder** (optional, e.g. Downloads): new images in that folder show up
  in a strip at the bottom of the board, ready to add with one click. The
  folder is checked every 2 s, and only while the board is open, so no file
  watcher runs in the background.
- Supported formats: PNG, JPG, WebP, GIF (first frame) and BMP. Imported files
  are copied into the board, so moving or deleting the originals later doesn't
  break it.

**Editing:** drag to reorder images and sections, or move an image to another
section. Double-click an image to open it in the capture editor and add pins,
boxes or arrows. Delete removes an item, with undo. Every text field takes
dictation (`Ctrl+Space`), and `Ctrl+K` runs AI cleanup on the whole board. The
board saves automatically.

**Output:**
| Action | Key | What happens |
|---|---|---|
| **Send** | `Ctrl+Enter` | Paste every image in order, then the compiled text, into the target window (see below). Paste profiles apply, so terminals get file paths. |
| **Copy as one image** | `Ctrl+Shift+C` | Render the board as one labelled sheet image (what you see is what you get) and put it on the clipboard. For apps that allow one image, or for sharing. |
| **Copy text** | `Ctrl+Alt+C` | Compiled text only. |

The target window is the one that was active before the board opened. Clicking
**Send to ▾** picks a different one (click any window) or a recent target.
Before pasting, images are resized so the longest edge is at most 2048 px
(configurable), so uploads are quick. Boards with more images than the paste
limit (default 10, configurable) trigger a warning that offers "Copy as one
image" instead, because chat apps cap attachments per message.

**Compiled text:** image labels match the paste order.
```
Redesign the landing hero. Use the current page for structure and pick the best
direction from the options. Implement it with our Next.js + Tailwind setup.

## Current (Image 1)
1. Headline is too big on mobile.
2. Input and button heights don't match.

## Options (Images 2–6)
Image 2 (Option A): centered, keeps the current layout.
Image 3 (Option B): split layout, product shot on the right. ← preferred
Image 4 (Option C): dark theme.
Image 5 (Option D): full-width image on top.
Image 6 (Option E): minimal, no illustration.
Prefer B, with the colors from C.
```

**Boards are kept:** several boards with names, plus *New*, *Duplicate* and
*Delete*, and a **Boards** tab in History. Open the board with
**`Alt+Shift+B`**, from the tray, or with the board button in the capture editor.

**Done when:** five images dropped from a folder plus one capture (Alt+Enter),
with notes, send into Claude web as 6 images and text whose labels match. The
same board copies as one sheet image that pastes into ChatGPT.

### F12. Tray, onboarding, branding
- **Tray** additions: *New capture* (with its hotkey), *Open board*, a *Macros*
  submenu, and *Copy last capture text*.
- **Onboarding:** Handy's steps (microphone permission, model download), with
  **Canary 180M Flash** (218 MB) pre-selected, then one new step: a hotkey card
  and a "Try it: capture this window" practice capture.
- **Branding:** name, `com.bay714.maximusvibius` identifier (a separate data
  folder, so it can sit beside a real Handy install), icons, tray tooltip,
  window titles, and an About page that credits Handy.

---

## 2. Hotkeys

| Global | Action |
|---|---|
| `Ctrl+Space` | Dictate (hold) |
| `Ctrl+Shift+Space` | Dictate + AI cleanup |
| `Alt+Shift+S` | Capture |
| `Alt+Shift+B` | Open the board |
| `Alt+1`…`Alt+4` | Starter macros (user can add more) |
| `Esc` | Cancel recording (Handy) |

| In the capture editor | Action |
|---|---|
| Drag / `Space` / `Ctrl+A` | Select region / window under cursor / whole monitor |
| `V` `B` `A` `P` (`Alt+` while typing) | Select / Box / Arrow / Pin |
| `Del`, `Ctrl+Z`, `Ctrl+Y` | Delete, Undo, Redo |
| `Tab` / `Shift+Tab` | Next / previous field |
| `Ctrl+K` | AI clean up |
| `Enter` / `Ctrl+Enter` / `Shift+Enter` / `Esc` | Send / Send and submit / Copy only / Cancel |
| `Alt+Enter` | Add to board instead of sending |

| On the board | Action |
|---|---|
| `Ctrl+V`, drag and drop | Add images |
| `Ctrl+K` | AI cleanup of the whole board |
| `Ctrl+Enter` / `Ctrl+Shift+C` / `Ctrl+Alt+C` | Send / Copy as one image / Copy text |
| Double-click an image | Annotate in the capture editor |

All global hotkeys can be changed in Settings → Shortcuts.

---

## 3. Architecture

```
┌──────────────────────────────── Rust: src-tauri/src ────────────────────────────────┐
│ shortcut/handler.rs ─▶ ACTION_MAP                                                    │
│     "transcribe", "transcribe_with_post_process", "cancel"   (Handy)                 │
│     "capture"        ─▶ vibe::capture::CaptureAction                       NEW       │
│     "macro:<id>"     ─▶ vibe::macros::MacroAction  (prefix dispatch)       NEW       │
│     "board"          ─▶ vibe::board::OpenBoardAction                       NEW       │
│                                                                                      │
│ vibe/                                                                      NEW       │
│   mod.rs        init, state registration, commands                                   │
│   capture.rs    xcap grab, CaptureState {frame, monitor, target}, capture:// scheme  │
│   window.rs     create/show/hide/destroy capture window, 60 s warm timer             │
│   target.rs     foreground HWND + process name, restore focus (Windows)              │
│   output.rs     compose text, save PNG, paste profiles, send sequence                │
│   clip.rs       clipboard snapshot/restore, image write (CF_DIBV5 + "PNG")           │
│   cleanup.rs    structured AI cleanup over llm_client.rs                             │
│   macros.rs     Macro CRUD, binding registration, variable expansion                 │
│   vocab.rs      starter list, project import scan                                    │
│   captures_db.rs  captures table + queries (shares Handy's history DB)               │
│   board.rs      board CRUD, file/clipboard import, thumbnails, inbox poll, send      │
│                                                                                      │
│ Touched Handy files (kept small):                                                    │
│   actions.rs       route final transcript → editor when capture window is open       │
│   settings.rs      new fields with #[serde(default)]; new built-in prompt            │
│   shortcut/handler.rs  "macro:" prefix lookup                                        │
│   managers/history.rs  migrations: captures, boards, board_images tables             │
│   tray.rs          menu items     lib.rs   vibe::init()     tauri.conf.json  brand   │
└──────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────── Frontend: src ──────────────────────────────────────┐
│ capture/                                                                  NEW        │
│   index.html, main.tsx      second Vite entry (like overlay/)                        │
│   Selector.tsx              crosshair, drag, window/monitor pick                     │
│   Editor.tsx                toolbar, caption bar, notes, keyboard map                │
│   Annotations.tsx           SVG shapes + hit testing          shapes.ts (model, undo)│
│   exportPng.ts              composite to canvas at physical px → PNG bytes           │
│   useDictation.ts           listens to vibe://dictation + stream events              │
│ board/                                                                    NEW        │
│   index.html, main.tsx      third Vite entry                                         │
│   Board.tsx                 prompt box, sections, toolbar, send bar, board picker    │
│   Section.tsx  ImageCard.tsx  Inbox.tsx   drag/drop (native HTML5), labels, notes    │
│   compile.ts                ordered images + compiled text (shared with output.rs)   │
│   exportSheet.ts            render the board to one PNG sheet                        │
│ components/settings/capture/   Capture page (send, profiles, folder, band, AI)  NEW  │
│ components/settings/macros/    list + editor                                    NEW  │
│ components/settings/history/   + Captures and Boards tabs                  touched  │
│ components/settings/CustomWords.tsx  + dev vocabulary / import buttons      touched  │
│ components/onboarding/         + hotkeys + practice step                    touched  │
│ Sidebar.tsx                    + Capture, Macros                            touched  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**New crates:** `xcap` (screen and window capture, Apache-2.0) is the only
genuinely new dependency. `clipboard-win` (BSL-1.0, for writing several
clipboard formats at once) and `image` are already in Handy's dependency tree
and just become direct dependencies. `windows`, `enigo`, `rusqlite` and the
clipboard plugin are already used directly.

### Commands (frontend → Rust)
| Command | Purpose |
|---|---|
| `vibe_capture_info()` | monitor bounds, scale factor, frame URL, window rects for `Space` select |
| `vibe_send({png, caption, notes, mode, submit})` | run the send pipeline (§5) |
| `vibe_cancel()` | close the capture window, drop the frame |
| `vibe_cleanup({caption, notes})` | AI cleanup, returns the same shape |
| `vibe_toggle_dictation()` | mic button |
| `macro_list/create/update/delete()` | macros (also re-register hotkeys) |
| `captures_list/get/delete/star/resend/copy()` | capture history |
| `vocab_add_starter()`, `vocab_scan_project(path)` | vocabulary |
| `board_list/get/create/update/duplicate/delete()` | boards |
| `board_add_files(boardId, sectionId, paths)`, `board_add_clipboard(...)`, `board_add_capture(...)` | import images (copied in, thumbnails made) |
| `board_inbox(folder)` | new images in the inbox folder since the board opened |
| `board_send({boardId, target})` | paste images in order, then the compiled text |
| `board_pick_target()` | click-to-pick a target window |

### Events (Rust → frontend)
`vibe://frame-ready`, `vibe://dictation {text, final}`, `vibe://recording {active}`,
`vibe://sent {captureId}`, `board://inbox {files}`, `board://sent {boardId}`, plus
Handy's existing stream events for live text.

---

## 4. Data model

```rust
// Added to AppSettings; every field has #[serde(default)], so older settings files load.
pub struct CaptureSettings {
    pub enter_action: EnterAction,         // Send (default) | CopyOnly
    pub always_submit: bool,               // false
    pub always_cleanup: bool,              // false
    pub cleanup_prompt_id: String,         // "vibe_coding_instruction"
    pub caption_band: bool,                // true
    pub include_text: bool,                // true
    pub save_folder: Option<PathBuf>,      // None
    pub include_path_in_text: bool,        // true (only when save_folder is set)
    pub paste_gap_ms: u64,                 // 250
    pub keep_warm_secs: u64,               // 60
    pub default_color: AnnotColor,         // Pink
    pub profiles: Vec<PasteProfile>,       // defaults in §1 F6
}
pub struct PasteProfile { pub process: String, pub mode: ProfileMode } // ImageText | PathText | CopyOnly
pub struct Macro {
    pub id: String,                        // binding id = "macro:<id>"
    pub name: String,
    pub body: String,
    pub insert_before: InsertBefore,       // Nothing | Space (default) | Newline
    pub submit: bool,                      // false
}
pub vibe_onboarding_done: bool,
pub dev_vocab_seeded: bool,
// Hotkeys for "capture" and "macro:<id>" live in Handy's existing `bindings` map.
```

```sql
-- One new migration in managers/history.rs (same SQLite file)
CREATE TABLE captures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  file_name TEXT NOT NULL,          -- PNG in <app data>/captures/
  width INTEGER NOT NULL, height INTEGER NOT NULL,
  caption TEXT NOT NULL,
  notes_json TEXT NOT NULL,         -- ["note 1", "note 2"]
  output_text TEXT NOT NULL,
  annotations_json TEXT NOT NULL,   -- shapes, so "Open in editor" can re-annotate
  source_png TEXT,                  -- un-annotated crop, for re-annotation
  target_process TEXT,
  saved BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  doc_json TEXT NOT NULL,           -- prompt, sections[], image order, notes, labels
  saved BOOLEAN NOT NULL DEFAULT 0
);
CREATE TABLE board_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,          -- <app data>/boards/<board_id>/<file>
  thumb_name TEXT NOT NULL,         -- 400 px thumbnail for the board view
  width INTEGER NOT NULL, height INTEGER NOT NULL,
  source TEXT NOT NULL,             -- capture | file | clipboard | inbox
  annotations_json TEXT             -- pins/boxes added in the editor
);
```

```ts
// boards.doc_json
type BoardDoc = {
  prompt: string;
  sections: {
    id: string; title?: string; labels: "numbers" | "options";
    layout: "row" | "grid";
    items: { imageId: number; note: string }[];
    text: string;
  }[];
};
```

Board settings (added to `CaptureSettings`): `board_inbox_folder: Option<PathBuf>`,
`board_max_edge_px: u32` (2048), `board_paste_limit: u32` (10).

---

## 5. Pipelines

### Capture
1. Hotkey → `CaptureAction::start`. Record the foreground window (handle,
   process name) and the cursor position.
2. `xcap::Monitor::from_point(cursor)` → `capture_image()` (RGBA). Also list
   windows on that monitor (`xcap::Window::all()`, filtered) for `Space` select.
3. Store the frame in `CaptureState`. It's served as an uncompressed BMP from
   memory at `capture://localhost/frame` (no disk, no base64 over IPC).
4. Show the capture window: positioned at the monitor's origin and sized to
   its physical bounds, always on top, no decorations, hidden from the taskbar,
   focused. If the window still exists from a recent capture it's reused,
   otherwise it's created.
5. The frontend draws the frame. Selection coordinates are in CSS pixels × the
   scale factor, which gives physical pixels.

### Dictation routing
`actions.rs`, at the final paste call (around line 839): if the capture window
exists and is visible, emit `vibe://dictation {text, final:true}` to it and skip
pasting. Post-processing, filler removal and custom words still run first, so
the editor gets the same cleaned text a normal paste would.

### Send
1. Frontend: `exportPng` draws the crop at physical resolution, the scaled
   annotations and the caption band, then encodes PNG bytes →
   `vibe_send`. If **Always clean up** is on, `vibe_cleanup` runs first.
2. Hide the capture window and start the keep-warm timer.
3. Save the PNG (plus the un-annotated crop) and add a `captures` row. Copy the
   PNG to the save folder if one is set.
4. Pick the paste profile for the target process.
5. Snapshot the clipboard (text, or image if there's no text).
6. Restore focus to the target window. If Windows refuses, retry the
   foreground-lock workaround, then confirm focus with `GetForegroundWindow`
   (up to 300 ms). If focus can't be restored, fall back to Copy only and show
   a toast.
7. **Image + text:** write the image (`CF_DIBV5` plus the registered `PNG`
   format) → `Ctrl+V` → wait `paste_gap_ms` → write the text → `Ctrl+V`.
   **File path + text:** write `"{path}\n{text}"` → `Ctrl+V`.
   **Copy only:** write the image and stop.
8. If submitting, send Handy's submit key.
9. Restore the clipboard after `paste_delay_after_ms`.
10. Emit `vibe://sent` and show a toast ("Pasted image + 4 notes").

### Board send
1. `compile.ts` walks the sections in order and assigns labels (Image 1…N,
   Option A…), producing `[{imageId, label}]` and the compiled text.
2. `board_send`: resize each image to `board_max_edge_px` if needed (the
   annotations are burned in), snapshot the clipboard, and restore focus to the
   target window (same as Send).
3. For each image: write it to the clipboard → `Ctrl+V` → wait `paste_gap_ms`.
   Then write the text → `Ctrl+V`. A *File path + text* profile instead pastes
   one block that lists every file path, then the text.
4. Restore the clipboard and show a toast ("Pasted 6 images + text").
5. **Copy as one image:** `exportSheet.ts` draws the board on a canvas (prompt,
   section titles, images with label badges, notes) at 2× scale, encodes it as
   PNG, and writes it to the clipboard. No send step.

### Macro
`MacroAction::start` → expand variables (read `{clipboard}` before anything
changes it) → add the insert-before prefix → Handy's `clipboard::paste` path
(forced to clipboard paste, restore on) → optional submit key.

---

## 6. Settings and UI

The **Board** is its own window (`Alt+Shift+B`, tray, or the capture editor),
not a settings page. History gets a **Boards** tab listing saved boards.

Sidebar: **General · Capture *(new)* · Macros *(new)* · History · Models ·
Post-processing · Advanced · About** (Debug stays hidden behind `Ctrl+Shift+D`).

| Page | Contents |
|---|---|
| Capture | Hotkey, Enter action, always submit, always clean up + prompt, caption band, include text, save folder + path in text, paste gap, keep-warm, default color, paste profiles table (add/edit/remove, "detect from running app") |
| Macros | List with hotkey chips; editor with name, hotkey, body (dictation works), insert before, submit; variables help; restore starter macros |
| History | Dictations / Captures tabs (F10) |
| General | Handy's settings + a hotkey summary card |
| Advanced → Custom words | Handy's list + "Restore developer vocabulary" + "Import from project…" |
| Post-processing | Handy's page; the "Vibe coding instruction" prompt appears in the list |

All new strings go through i18next (`en` first; other languages fall back to
English). Handy's ESLint rule enforces this.

---

## 7. Lightweight budgets

Measured against stock Handy on the same machine (recorded during the toolchain step):

| Metric | Budget |
|---|---|
| Installer size | Handy + ≤ 3 MB |
| Idle RAM (no capture window, model unloaded) | Handy + ≤ 5 MB |
| Capture window JS bundle | ≤ 150 KB gzipped |
| Board window JS bundle | ≤ 120 KB gzipped (no drag-and-drop or canvas library) |
| Hotkey → frozen frame visible | ≤ 150 ms (cold), ≤ 60 ms (warm) |
| Enter → image pasted | ≤ 300 ms (excluding the paste gap) |
| Capture window after close | destroyed after 60 s (configurable) |

How we stay in budget: no canvas or drawing library, one on-demand webview,
the frame served from memory, a small default model, Handy's model unloading
left on, and no new background processes.

---

## 8. Build environment (Windows)

Install once:
`winget install Rustlang.Rustup Microsoft.VisualStudio.2022.BuildTools Kitware.CMake KhronosGroup.VulkanSDK Oven-sh.Bun`
(Build Tools with the "Desktop development with C++" workload). Then:

```bash
bun install
mkdir -p src-tauri/resources/models
curl -o src-tauri/resources/models/silero_vad_v4.onnx https://blob.handy.computer/silero_vad_v4.onnx
bun run tauri dev
```

Before each commit: `bun run lint`, `bun run format:check`, `cargo clippy`,
`cargo test`.

---

## 9. Testing

**Rust unit tests** (`cargo test`):
- output text formatting (caption only, caption + notes, empty caption, path mode)
- crop math across scale factors (1.0, 1.25, 1.5, 2.0) and negative monitor origins
- paste-profile matching (case-insensitive, fallback)
- macro variable expansion and insert-before
- cleanup response validation (wrong note count → per-field fallback)
- `captures` migration on a copy of an existing Handy database
- dictation routing: capture window open → event; closed → paste
- board import: format detection, thumbnail size, copy-in, cascade delete
- board send order and the file-path profile block

**Frontend:** unit tests for `shapes.ts` (undo/redo, pin renumbering) and `compile.ts` (labels, numbering across sections, Options letters) with Bun's
test runner, like Handy's existing `keyboard.test.ts`. Extend Handy's
Playwright `app.spec.ts` for the Capture and Macros settings pages.

**Manual matrix** (checked before each release):
| Target | Image + text | Submit | Macro |
|---|---|---|---|
| Claude web (Edge, Chrome) | ☐ | ☐ | ☐ |
| ChatGPT web | ☐ | ☐ | ☐ |
| Claude desktop | ☐ | ☐ | ☐ |
| Cursor chat | ☐ | ☐ | ☐ |
| VS Code Copilot chat | ☐ | ☐ | ☐ |
| Claude Code in Windows Terminal (path mode) | ☐ | ☐ | ☐ |

Plus: 1 and 2 monitors at mixed 100%/150% scaling, high-contrast mode, dark/light
theme, and an existing Handy install side by side.

---

## 10. Packaging and release
- Adapt Handy's `.github/workflows/build.yml` to a Windows-only build that
  produces NSIS and MSI installers on tag push. Remove Handy's signing and macOS
  jobs for now.
- **Updater:** generate our own minisign keypair (the private key goes in GitHub
  secrets), point the updater at
  `github.com/bay714/MaximusVibius/releases/latest/download/latest.json`.
  Handy's endpoint and public key are removed.
- **Code signing:** ships unsigned at first, so Windows SmartScreen will show a
  "More info → Run anyway" prompt. Buying a signing certificate (or using Azure
  Trusted Signing) can come later without changing the code.
- `LICENSE`: MIT, keeping Handy's copyright line and adding ours.

---

## 11. Staying in sync with Handy
- New code lives in `src-tauri/src/vibe/` and `src/capture/`. Changes to
  Handy's files are limited to the "touched" list in §3.
- Merge `upstream/main` every 2–4 weeks on a branch, run the test suite and the
  manual matrix, then merge to `main`.
- Never reformat Handy's files, and keep our settings fields grouped at the end
  of `AppSettings`, so merges stay small.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Windows blocks returning focus to the previous window | Foreground-lock workaround and focus confirmation. If it still fails, fall back to Copy only with a toast. |
| A chat app drops the second paste while the image is still attaching | Configurable paste gap. Per-app profiles. |
| Electron/Chromium apps ignore `CF_DIB` images | Also write the registered `PNG` format, which Chromium reads first. |
| Mixed-DPI crop offsets | Crop in physical pixels from `xcap`. Unit tests on scale factors. Manual 2-monitor check. |
| Large vocabulary causes false word swaps (Handy's custom words are a fuzzy post-correction) | Curated, phonetically distinct starter list. Project import is opt-in with a checklist. Test against the default threshold. |
| AI cleanup invents requirements or reorders notes | Strict prompt, structured output with a shape check, per-field fallback, always undoable. |
| Hotkey conflicts (`Alt+Shift+S`, `Alt+1…4`) with the user's apps | Handy's recorder flags conflicts. Every hotkey can be changed. |
| Handy's keyboard hook and the capture window both reacting to `Esc` | Turn off Handy's cancel binding while the capture window is open. |
| Upstream merges conflict | Small changes to Handy's files (§11). Regular merges. |
| Pasting many images in a row is slow, or some get dropped while uploading | Images are resized before pasting, the paste gap applies per image, and a warning above the paste limit offers "Copy as one image". |
| Big boards slow down the board window | Thumbnails (400 px) in the view, originals only at send time. Images load lazily. |

---

## 13. Build checklist (in dependency order)

Each item is done when its acceptance check passes. Items at the same level
can be built in parallel.

**Foundation**
- [ ] Install the toolchain and run stock Handy. Record the baseline budgets (§7).
- [ ] Rebrand (name, identifier, icons, About credit). Remove Handy's updater endpoint and key.
- [ ] Default model → Canary 180M Flash.
- [ ] Add `vibe/` module skeleton, settings fields with defaults, the `captures`
      migration, and the `capture` binding. Add the second Vite entry `src/capture/`.

**Capture core** (needs Foundation)
- [ ] `capture.rs` + `target.rs`: grab, `capture://` scheme, remember the target window. *(F2)*
- [ ] `window.rs`: capture window lifecycle and keep-warm timer.
- [ ] `Selector.tsx`: drag, window select, monitor select, DPI-correct crop. *(F2 check)*

**Editor** (needs Capture core)
- [ ] `shapes.ts` model with undo/redo and pin renumbering, plus tests.
- [ ] `Annotations.tsx` + `Editor.tsx`: toolbar, caption bar, notes, keyboard map. *(F3 check)*
- [ ] `exportPng.ts`: composite with caption band at physical resolution.

**Voice and AI** (needs Editor)
- [ ] Dictation routing in `actions.rs` + `useDictation.ts`, live text, mic button, overlay suppression. *(F4 check)*
- [ ] `cleanup.rs` + the "Vibe coding instruction" prompt + `Ctrl+K`. *(F5 check)*

**Output** (needs Editor; can run alongside Voice and AI)
- [ ] `clip.rs`: snapshot/restore, `CF_DIBV5` + `PNG` image write.
- [ ] `output.rs`: text composition, paste profiles, the send sequence, submit, toasts. *(F6, F7 checks)*
- [ ] `captures_db.rs` + saving to the app data folder and the optional save folder.

**Macros** (needs Foundation only, so it can start right after the skeleton)
- [ ] `macros.rs`: CRUD, `macro:` dispatch, variables, insert-before, submit, starter macros. *(F8 check)*
- [ ] Macros settings page. Macros tray submenu.

**Vocabulary** (needs Foundation only)
- [ ] `vocab.rs`: starter list, first-run seeding, project scan. Custom Words buttons. *(F9 check)*

**Board** (needs Output, and the editor for annotating)
- [ ] `boards` / `board_images` migrations, `board.rs` CRUD, imports (files, folder, clipboard, capture), thumbnails.
- [ ] `Board.tsx` + `Section.tsx` + `ImageCard.tsx`: sections, labels, notes, drag and drop, reorder, autosave, dictation routing.
- [ ] Editor static mode: open any board image in the capture editor and save the annotations back.
- [ ] `compile.ts` + `board_send` + target picker. `exportSheet.ts` for Copy as one image. *(F11 check)*
- [ ] Inbox folder strip. `Alt+Enter` add-to-board from the editor. Boards tab in History.

**History and shell** (needs Output)
- [ ] Captures tab: grid, send again, copy, open in editor, star, delete, retention. *(F10)*
- [ ] Capture settings page with the paste profiles table.
- [ ] Tray items, onboarding step, sidebar. *(F12)*

**Release** (needs everything above)
- [ ] All Rust/Bun/Playwright tests pass. The manual matrix (§9) is fully checked.
- [ ] Budgets (§7) are met, or the gaps are written down.
- [ ] Windows CI build, own updater key, first tagged release `v0.1.0`.

**Order:** Phase 1 items are Foundation → Capture core → Editor → Voice and AI → Output → Macros → Vocabulary. Phase 2 items are Board, History, and the Release items.

---

## 14. Out of scope (for now)
- Browser extension that attaches the clicked DOM element's selector, HTML and
  URL to a capture.
- Selections that span monitors. Scrolling or long-page capture. Video or GIF capture.
- Macro steps beyond text (key sequences, delays, "start capture").
- A macro search palette for people with more than ~10 macros.
- A freeform board (shapes and arrows between images, free positioning). The
  structured board covers the prompt-building job and stays light.
- Generating images from inside the app. Generate them in ChatGPT or similar,
  and they come in through the inbox folder or drag and drop.
- macOS and Linux packaging. The code is written for them, but they aren't tested or shipped.
