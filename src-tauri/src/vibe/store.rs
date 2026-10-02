//! VibiusMaximus's own settings file (`vibe.json`), kept apart from Handy's
//! `settings_store.json` so upstream settings changes never conflict with ours.

use serde::{de::DeserializeOwned, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

pub const STORE_PATH: &str = "vibe.json";

pub fn get<T: DeserializeOwned>(app: &AppHandle, key: &str) -> Option<T> {
    let store = app.store(crate::portable::store_path(STORE_PATH)).ok()?;
    store
        .get(key)
        .and_then(|value| serde_json::from_value(value).ok())
}

pub fn set<T: Serialize + ?Sized>(app: &AppHandle, key: &str, value: &T) {
    let Ok(store) = app.store(crate::portable::store_path(STORE_PATH)) else {
        log::error!("Failed to open {}", STORE_PATH);
        return;
    };
    match serde_json::to_value(value) {
        Ok(v) => {
            store.set(key, v);
            if let Err(e) = store.save() {
                log::error!("Failed to save {}: {}", STORE_PATH, e);
            }
        }
        Err(e) => log::error!("Failed to serialise {}: {}", key, e),
    }
}
