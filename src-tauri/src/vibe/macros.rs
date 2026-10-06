//! Prompt macros: a hotkey inserts saved text at the cursor in any app.
//!
//! Macros live in their own store file (`vibe.json`). Each macro's hotkey is a
//! regular Handy binding with the id `macro:<id>`, so Handy's shortcut
//! recorder, validation and registration all work for it unchanged.

use super::{keys, output, store};
use crate::clipboard::send_return_key;
use crate::input::EnigoState;
use crate::settings::{self, ShortcutBinding};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

pub const BINDING_PREFIX: &str = "macro:";

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum InsertBefore {
    Nothing,
    #[default]
    Space,
    Newline,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Macro {
    pub id: String,
    pub name: String,
    pub body: String,
    #[serde(default)]
    pub insert_before: InsertBefore,
    /// Press the submit key (Handy's auto-submit key) after inserting.
    #[serde(default)]
    pub submit: bool,
}

// Starter macros: the workflow Research -> Summarize -> Plan -> Scope ->
// Execute. Written from published practice: Anthropic's Claude Code guide
// (explore, then plan; self-contained specs that name files, interfaces and
// non-goals; give the model a check it can run; review in a fresh context for
// real gaps only), Anthropic's multi-agent research system (each delegated
// brief needs an objective, output format, sources and boundaries; divide work
// so agents don't overlap), GitHub Spec Kit (what and why before how,
// acceptance criteria, implement and check until it converges), OpenAI's
// agent and GPT-5 guides (orchestrator keeps control, clear exit conditions,
// restate the goal and plan), Anthropic's hallucination guidance (cite
// sources, allow "not sure"), and bottom-line-up-front summaries.
// In workflow order: find out, boil it down, decide how, define exactly
// what "done" is for the builders, then build it.
const STARTERS: &[(&str, &str, &str, &str)] = &[
    (
        "research",
        "Research",
        "alt+1",
        "Research this before answering. Prefer primary sources (official docs, changelogs, specs, source code) over blog posts, and note versions and dates, since this may have changed recently. Then give me:\n- The answer in 2-3 sentences, first\n- The key findings, each with its source\n- What's established fact and what's your inference. If you're not sure, say so instead of guessing\n- Where sources or experts disagree\n- One worked example applied to my case\n- What I should double-check before relying on this",
    ),
    (
        "summary",
        "Summarize",
        "alt+2",
        "Summarize the above for someone who wasn't following along.\nStart with a one-line bottom line: the most important takeaway or decision.\nThen for each topic:\n- What it is: one line of background, no jargon\n- Where it stands: done, decided or still open\n- The next step, with your recommendation if there's a choice to make\nEnd with any decisions you need from me. Keep names, numbers and commitments exact, drop everything else, and stay under 200 words.",
    ),
    (
        "plan",
        "Plan",
        "alt+3",
        "Plan this before touching any code. Read the relevant code first, then:\n1. Restate the goal in one sentence and what \"done\" looks like.\n2. If anything important is ambiguous, ask me up to 3 questions and stop there.\n3. Otherwise lay out the approach: the files to change and why, the steps in order, and how each step will be checked (a test, a command, or what to look at).\n4. Name the risks and what could break.\nIf there are competing approaches, give each one line with its trade-off and recommend one. Wait for my OK before writing code.",
    ),
    (
        "scope",
        "Scope",
        "alt+4",
        "Fully scope this so a builder who has never seen this conversation can deliver it without guessing. Investigate the code first and ask me about anything you can't settle yourself. Then write the spec:\n- Goal and why it matters. Non-goals: what we are not doing.\n- Acceptance criteria: specific and testable, including edge cases and error states.\n- Constraints: files, interfaces and patterns to follow, and what must not change.\n- Tasks: small and ordered. Each names its files, its output and its own done-check, and says whether it can run in parallel.\n- Review gates: what gets verified after each task and before we ship, and how (test, build, screenshot, or me).\n- Risks, open questions, and every assumption you made.\nSpecific beats long.",
    ),
    (
        "execute",
        "Execute",
        "alt+5",
        "Execute this as the orchestrator, not the builder. Work from the agreed scope or plan. If there isn't one, write it first and wait for my OK.\n- Split the work into tasks and give each builder (subagent) a self-contained brief: the objective, the files it owns, what not to touch, the acceptance criteria and the check it must pass. Never put two builders on the same files.\n- Run independent tasks in parallel and dependent ones in order.\n- Have a fresh reviewer check every result against its criteria. Accept evidence (test output, build, screenshot), not claims. Send failures back with the specific fix.\n- Don't widen the scope. If something needs a decision, stop and ask me.\n- If you can't run subagents, do the tasks yourself, one at a time, with the same checks.\nFinish with what was built, the evidence for each criterion, and anything left open.",
    ),
];

/// Earlier starter macros, by id, with the text they shipped with, and the
/// starter that now sits on the same key. Copies nobody edited are upgraded
/// to it, so each key keeps its position.
const OLD_STARTERS: &[(&str, &str, &str)] = &[
    (
        "plan-first",
        "research",
        "Before writing any code, list the files you'll change and why, then wait for my OK.",
    ),
    (
        "design-system",
        "summary",
        "Use our existing components and Tailwind tokens. Don't add new colors, fonts or spacing values. If a component is missing, tell me first instead of creating one.",
    ),
    (
        "keep-tests",
        "plan",
        "Don't modify or delete existing tests. If a test fails because of your change, fix the code, not the test.",
    ),
    (
        "small-diff",
        "scope",
        "Make the smallest change that fixes this. No refactors, renames or formatting changes outside the lines you need to touch.",
    ),
    (
        "research-first",
        "plan",
        "Research this first: check the official docs and current best practice. Bring back a concise summary (3 bullets max), then one detailed, worked example.",
    ),
    (
        "summarize",
        "scope",
        "Too long. Give me the short version: 3 bullets max, then the one thing I should do next.",
    ),
];

pub fn binding_id(macro_id: &str) -> String {
    format!("{BINDING_PREFIX}{macro_id}")
}

pub fn load(app: &AppHandle) -> Vec<Macro> {
    store::get(app, "macros").unwrap_or_default()
}

/// The saved macros, or an error if they're there but can't be read. Anything
/// that writes macros back uses this, so a read problem can't wipe them.
fn load_checked(app: &AppHandle) -> Result<Vec<Macro>, String> {
    Ok(store::get_checked(app, "macros")?.unwrap_or_default())
}

/// Hotkeys compared the way the keyboard sees them: `alt_left+1` and `Alt+1`
/// both use Alt and 1.
fn same_hotkey(a: &str, b: &str) -> bool {
    let norm = |k: &str| {
        k.to_ascii_lowercase()
            .split('+')
            .map(|part| {
                part.trim()
                    .trim_end_matches("_left")
                    .trim_end_matches("_right")
                    .replace("control", "ctrl")
            })
            .collect::<Vec<_>>()
    };
    norm(a) == norm(b)
}

/// What upgrading the starters changes, decided without touching the app.
#[derive(Debug, Default)]
struct UpgradePlan {
    /// Ids of unedited starters that took the current starter's name and text.
    renamed: Vec<String>,
    /// New starters to add, with their hotkey.
    added: Vec<(Macro, &'static str)>,
}

/// Upgrade unedited starters in place (same id, same hotkey) and pick the new
/// starters whose id and hotkey are both free. `bound` is every hotkey in use.
fn plan_upgrade(macros: &mut [Macro], bound: &[String]) -> UpgradePlan {
    let mut plan = UpgradePlan::default();
    for m in macros.iter_mut() {
        let Some((_, slot, _)) = OLD_STARTERS
            .iter()
            .find(|(id, _, body)| *id == m.id && m.body.trim() == *body)
        else {
            continue;
        };
        let Some((_, name, _, body)) = STARTERS.iter().find(|s| s.0 == *slot) else {
            continue;
        };
        m.name = name.to_string();
        m.body = body.to_string();
        plan.renamed.push(m.id.clone());
    }
    for (id, name, hotkey, body) in STARTERS {
        let taken =
            macros.iter().any(|m| m.id == *id) || bound.iter().any(|b| same_hotkey(b, hotkey));
        if taken {
            continue;
        }
        let m = Macro {
            id: id.to_string(),
            name: name.to_string(),
            body: body.to_string(),
            insert_before: InsertBefore::Space,
            submit: false,
        };
        plan.added.push((m, hotkey));
    }
    plan
}

fn save(app: &AppHandle, macros: &[Macro]) {
    store::set(app, "macros", macros);
}

fn binding_for(m: &Macro, hotkey: &str) -> ShortcutBinding {
    ShortcutBinding {
        id: binding_id(&m.id),
        name: m.name.clone(),
        description: m.body.chars().take(80).collect(),
        default_binding: hotkey.to_string(),
        current_binding: hotkey.to_string(),
    }
}

/// Add the starter macros on first run.
pub fn seed(app: &AppHandle) {
    if store::get::<bool>(app, "macrosSeeded").unwrap_or(false) {
        return;
    }
    let mut macros = match load_checked(app) {
        Ok(macros) => macros,
        Err(e) => {
            error!("Couldn't read macros ({e}); leaving them untouched");
            return;
        }
    };
    let mut settings = settings::get_settings(app);
    for (id, name, hotkey, body) in STARTERS {
        if macros.iter().any(|m| m.id == *id) {
            continue;
        }
        let m = Macro {
            id: id.to_string(),
            name: name.to_string(),
            body: body.to_string(),
            insert_before: InsertBefore::Space,
            submit: false,
        };
        settings
            .bindings
            .entry(binding_id(id))
            .or_insert_with(|| binding_for(&m, hotkey));
        macros.push(m);
    }
    settings::write_settings(app, settings);
    save(app, &macros);
    store::set(app, "macrosSeeded", &true);
}

/// Once per install: replace starter macros nobody edited with the current
/// starters (each keeps its id and hotkey; only the name and text change),
/// and add new starters whose hotkey is still free. Edited macros, and ones
/// the user made, are left alone.
pub fn upgrade_starters(app: &AppHandle) {
    if store::get::<bool>(app, "startersV3").unwrap_or(false) {
        return;
    }
    let mut macros = match load_checked(app) {
        Ok(macros) => macros,
        Err(e) => {
            // Try again next start rather than save over macros we can't read.
            error!("Couldn't read macros ({e}); leaving them untouched");
            return;
        }
    };
    let mut settings = settings::get_settings(app);
    let bound: Vec<String> = settings
        .bindings
        .values()
        .map(|b| b.current_binding.clone())
        .collect();
    let plan = plan_upgrade(&mut macros, &bound);
    // Hotkeys themselves never change; only the names shown next to them.
    for id in &plan.renamed {
        if let (Some(m), Some(binding)) = (
            macros.iter().find(|m| &m.id == id),
            settings.bindings.get_mut(&binding_id(id)),
        ) {
            binding.name = m.name.clone();
            binding.description = m.body.chars().take(80).collect();
        }
    }
    let changed = plan.renamed.len() + plan.added.len();
    for (m, hotkey) in plan.added {
        settings
            .bindings
            .insert(binding_id(&m.id), binding_for(&m, hotkey));
        macros.push(m);
    }
    if changed > 0 {
        settings::write_settings(app, settings);
        save(app, &macros);
        info!("Upgraded {} starter macro(s)", changed);
    }
    store::set(app, "startersV3", &true);
}

/// Register every macro hotkey. Handy only registers its built-in bindings at
/// startup, so this runs right after it.
pub fn register_all(app: &AppHandle) {
    for (id, binding) in settings::get_bindings(app) {
        if id.starts_with(BINDING_PREFIX) && !binding.current_binding.trim().is_empty() {
            if let Err(e) = crate::shortcut::register_shortcut(app, binding) {
                warn!("Failed to register macro shortcut {}: {}", id, e);
            }
        }
    }
}

/// Called from the shortcut handler for `macro:<id>` bindings.
pub fn fire(app: &AppHandle, macro_id: &str) {
    let app = app.clone();
    let macro_id = macro_id.to_string();
    std::thread::spawn(move || {
        if let Err(e) = fire_blocking(&app, &macro_id) {
            error!("Macro '{}' failed: {}", macro_id, e);
        }
    });
}

fn fire_blocking(app: &AppHandle, macro_id: &str) -> Result<(), String> {
    let m = load(app)
        .into_iter()
        .find(|m| m.id == macro_id)
        .ok_or_else(|| format!("No macro with id '{macro_id}'"))?;
    let enigo_state = app
        .try_state::<EnigoState>()
        .ok_or("Keyboard input not initialised")?;

    keys::mask_menu(&enigo_state);
    keys::wait_for_modifiers_released(Duration::from_millis(1500));

    let clipboard = app.clipboard();
    let saved = clipboard.read_text().ok();
    let body = expand(
        &m.body,
        saved.as_deref().unwrap_or(""),
        chrono::Local::now(),
    );
    let text = match m.insert_before {
        InsertBefore::Nothing => body,
        InsertBefore::Space => format!(" {body}"),
        InsertBefore::Newline => format!("\n{body}"),
    };

    // Always paste through the clipboard, even when Handy is set to type
    // directly: typing a multi-line prompt would press Enter mid-way.
    clipboard.write_text(text).map_err(|e| e.to_string())?;
    output::paste(&enigo_state)?;

    let settings = settings::get_settings(app);
    if m.submit {
        std::thread::sleep(Duration::from_millis(120));
        let mut enigo = enigo_state.0.lock().map_err(|e| e.to_string())?;
        send_return_key(&mut enigo, settings.auto_submit_key)?;
    }
    std::thread::sleep(Duration::from_millis(
        settings.paste_delay_after_ms.max(200),
    ));
    if let Some(saved) = saved {
        let _ = clipboard.write_text(saved);
    }
    info!("Macro '{}' inserted", m.name);
    Ok(())
}

/// Fill in `{clipboard}`, `{date}` and `{time}`.
fn expand(body: &str, clipboard: &str, now: chrono::DateTime<chrono::Local>) -> String {
    body.replace("{clipboard}", clipboard)
        .replace("{date}", &now.format("%Y-%m-%d").to_string())
        .replace("{time}", &now.format("%H:%M").to_string())
}

// ---------------------------------------------------------------------------
// Commands for the Macros settings page
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn vibe_macros_list(app: AppHandle) -> Vec<Macro> {
    load(&app)
}

/// Create or update a macro. New macros get a binding with no hotkey; the
/// settings page then sets one through Handy's `change_binding`.
#[tauri::command]
pub fn vibe_macro_save(app: AppHandle, item: Macro) -> Result<Vec<Macro>, String> {
    // Refuse rather than save over macros that couldn't be read.
    load_checked(&app)?;
    if item.id.trim().is_empty() || item.id.contains(char::is_whitespace) {
        return Err("Invalid macro id".into());
    }
    let mut macros = load(&app);
    match macros.iter_mut().find(|m| m.id == item.id) {
        Some(existing) => *existing = item.clone(),
        None => macros.push(item.clone()),
    }
    save(&app, &macros);

    let mut settings = settings::get_settings(&app);
    let id = binding_id(&item.id);
    let hotkey = settings
        .bindings
        .get(&id)
        .map(|b| b.current_binding.clone())
        .unwrap_or_default();
    let mut binding = binding_for(&item, &hotkey);
    if let Some(existing) = settings.bindings.get(&id) {
        binding.default_binding = existing.default_binding.clone();
    }
    settings.bindings.insert(id, binding);
    settings::write_settings(&app, settings);
    Ok(macros)
}

#[tauri::command]
pub fn vibe_macro_delete(app: AppHandle, id: String) -> Result<Vec<Macro>, String> {
    load_checked(&app)?;
    let mut macros = load(&app);
    macros.retain(|m| m.id != id);
    save(&app, &macros);

    let mut settings = settings::get_settings(&app);
    if let Some(binding) = settings.bindings.remove(&binding_id(&id)) {
        if !binding.current_binding.trim().is_empty() {
            let _ = crate::shortcut::unregister_shortcut(&app, binding);
        }
    }
    settings::write_settings(&app, settings);
    Ok(macros)
}

/// Remove a macro's hotkey (Handy's `change_binding` rejects empty bindings).
#[tauri::command]
pub fn vibe_macro_clear_hotkey(app: AppHandle, id: String) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    if let Some(binding) = settings.bindings.get_mut(&binding_id(&id)) {
        if !binding.current_binding.trim().is_empty() {
            let _ = crate::shortcut::unregister_shortcut(&app, binding.clone());
        }
        binding.current_binding.clear();
        binding.default_binding.clear();
    }
    settings::write_settings(&app, settings);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn expands_variables() {
        let now = chrono::Local
            .with_ymd_and_hms(2026, 10, 1, 9, 5, 0)
            .unwrap();
        assert_eq!(
            expand("Fix {clipboard} on {date} at {time}", "the bug", now),
            "Fix the bug on 2026-10-01 at 09:05"
        );
    }

    #[test]
    fn leaves_unknown_braces_alone() {
        let now = chrono::Local::now();
        assert_eq!(expand("use {props}", "", now), "use {props}");
    }

    #[test]
    fn every_old_starter_maps_to_a_current_one() {
        for (_, slot, _) in OLD_STARTERS {
            assert!(STARTERS.iter().any(|s| s.0 == *slot), "{slot}");
        }
    }

    #[test]
    fn starters_run_in_workflow_order() {
        let order: Vec<_> = STARTERS.iter().map(|s| (s.1, s.2)).collect();
        assert_eq!(
            order,
            [
                ("Research", "alt+1"),
                ("Summarize", "alt+2"),
                ("Plan", "alt+3"),
                ("Scope", "alt+4"),
                ("Execute", "alt+5"),
            ]
        );
    }

    fn user_macro(id: &str, name: &str, body: &str) -> Macro {
        Macro {
            id: id.into(),
            name: name.into(),
            body: body.into(),
            insert_before: InsertBefore::Space,
            submit: false,
        }
    }

    fn old_body(id: &str) -> &'static str {
        OLD_STARTERS.iter().find(|o| o.0 == id).unwrap().2
    }

    /// The setup of a real install updated from 1.0.0: Alt+1 edited and
    /// rebound to left-Alt + 1, the other three starters untouched.
    fn real_install() -> (Vec<Macro>, Vec<String>) {
        let macros = vec![
            user_macro(
                "plan-first",
                "Summarize concisely",
                "Give me a concise but detailed summary.",
            ),
            user_macro(
                "design-system",
                "Match design system",
                old_body("design-system"),
            ),
            user_macro("keep-tests", "Don't touch tests", old_body("keep-tests")),
            user_macro("small-diff", "Small diff", old_body("small-diff")),
        ];
        let bound = [
            "alt_left+1",
            "alt+2",
            "alt+3",
            "alt+4",
            "alt+s",
            "alt+b",
            "ctrl+space",
        ]
        .map(String::from)
        .to_vec();
        (macros, bound)
    }

    #[test]
    fn upgrade_keeps_edited_macros_and_hotkeys() {
        let (mut macros, bound) = real_install();
        let plan = plan_upgrade(&mut macros, &bound);
        // The edited macro is untouched.
        assert_eq!(macros[0].name, "Summarize concisely");
        assert_eq!(macros[0].body, "Give me a concise but detailed summary.");
        // Unedited starters take the starter now on their key; ids are kept,
        // so their hotkey bindings (`macro:<id>`) are unchanged.
        let names: Vec<_> = macros.iter().map(|m| m.name.as_str()).collect();
        assert_eq!(names, ["Summarize concisely", "Summarize", "Plan", "Scope"]);
        assert_eq!(plan.renamed, ["design-system", "keep-tests", "small-diff"]);
        // Only Execute is added: Alt+1 is taken by the user's left-Alt + 1.
        let added: Vec<_> = plan
            .added
            .iter()
            .map(|(m, k)| (m.name.as_str(), *k))
            .collect();
        assert_eq!(added, [("Execute", "alt+5")]);
    }

    #[test]
    fn upgrade_never_takes_a_key_the_user_uses() {
        let (mut macros, mut bound) = real_install();
        bound.push("Alt+5".into());
        let plan = plan_upgrade(&mut macros, &bound);
        assert!(plan.added.is_empty());
    }

    #[test]
    fn upgrade_twice_changes_nothing_more() {
        let (mut macros, bound) = real_install();
        plan_upgrade(&mut macros, &bound);
        let before: Vec<_> = macros
            .iter()
            .map(|m| (m.name.clone(), m.body.clone()))
            .collect();
        let again = plan_upgrade(&mut macros, &bound);
        let after: Vec<_> = macros
            .iter()
            .map(|m| (m.name.clone(), m.body.clone()))
            .collect();
        assert!(again.renamed.is_empty());
        assert_eq!(before, after);
    }

    #[test]
    fn hotkeys_compare_by_key_not_spelling() {
        assert!(same_hotkey("alt_left+1", "alt+1"));
        assert!(same_hotkey("Alt+5", "alt+5"));
        assert!(same_hotkey("control+k", "ctrl+k"));
        assert!(!same_hotkey("alt+1", "alt+2"));
        assert!(!same_hotkey("alt+shift+1", "alt+1"));
    }

    #[test]
    fn macros_saved_by_older_versions_still_load() {
        // 1.0.0 format, and one with fields this version doesn't know yet.
        let old = r#"[{"id":"a","name":"A","body":"x","insertBefore":"space","submit":false},
                      {"id":"b","name":"B","body":"y"},
                      {"id":"c","name":"C","body":"z","someFutureField":1}]"#;
        let macros: Vec<Macro> = serde_json::from_str(old).unwrap();
        assert_eq!(macros.len(), 3);
        assert_eq!(macros[1].insert_before, InsertBefore::Space);
    }

    #[test]
    fn starter_hotkeys_are_unique() {
        let mut keys: Vec<_> = STARTERS.iter().map(|s| s.2).collect();
        keys.sort();
        keys.dedup();
        assert_eq!(keys.len(), STARTERS.len());
    }
}
