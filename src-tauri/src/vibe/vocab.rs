//! Starter developer vocabulary, added once to Handy's custom words so
//! dictation spells common coding terms correctly.
//!
//! Handy's custom words are a fuzzy post-correction, so this list sticks to
//! terms that don't sound like everyday English words (no "Vue", "Rust",
//! "props") to avoid false replacements.

use super::store;
use crate::settings;
use tauri::AppHandle;

pub const DEV_WORDS: &[&str] = &[
    "TypeScript",
    "JavaScript",
    "Tailwind",
    "Next.js",
    "Node.js",
    "Vite",
    "Supabase",
    "Prisma",
    "shadcn",
    "Vercel",
    "Netlify",
    "Zustand",
    "Tauri",
    "Svelte",
    "Nuxt",
    "useEffect",
    "useState",
    "useMemo",
    "useCallback",
    "useRef",
    "onClick",
    "className",
    "localhost",
    "PostgreSQL",
    "GraphQL",
    "Kubernetes",
    "Dockerfile",
    "pnpm",
    "npm",
    "GitHub",
    "Figma",
    "Excalidraw",
    "Claude",
    "ChatGPT",
    "flexbox",
    "z-index",
    "navbar",
    "tooltip",
    "dropdown",
    "favicon",
    "OAuth",
    "JSON",
    "API",
    "CSS",
    "HTML",
    "SQL",
    "regex",
];

pub fn seed(app: &AppHandle) {
    if store::get::<bool>(app, "vocabSeeded").unwrap_or(false) {
        return;
    }
    let mut s = settings::get_settings(app);
    for word in DEV_WORDS {
        if !s.custom_words.iter().any(|w| w.eq_ignore_ascii_case(word)) {
            s.custom_words.push(word.to_string());
        }
    }
    settings::write_settings(app, s);
    store::set(app, "vocabSeeded", &true);
}

#[cfg(test)]
mod tests {
    use super::DEV_WORDS;

    #[test]
    fn no_duplicates() {
        let mut lower: Vec<String> = DEV_WORDS.iter().map(|w| w.to_lowercase()).collect();
        lower.sort();
        lower.dedup();
        assert_eq!(lower.len(), DEV_WORDS.len());
    }
}
