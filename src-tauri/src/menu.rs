use tauri::menu::{Menu, MenuEvent, MenuItem};
use tauri::{AppHandle, Emitter, Runtime};

const CHECK_FOR_UPDATES: &str = "check-for-updates";

/// The default menu plus "Check for Updates…" right under "About" in the app menu, the
/// first submenu on macOS (the app ships for macOS only).
pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(app)?;
    let items = menu.items()?;
    if let Some(app_menu) = items.first().and_then(|item| item.as_submenu()) {
        let check = MenuItem::with_id(
            app,
            CHECK_FOR_UPDATES,
            "Check for Updates…",
            true,
            Some("Alt+CmdOrCtrl+U"),
        )?;
        app_menu.insert(&check, 1)?;
    }
    Ok(menu)
}

/// The menu only asks the webview to check; the webview calls `check_for_update`.
pub fn on_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    if event.id() == CHECK_FOR_UPDATES {
        if let Err(err) = app.emit("check-for-update-requested", ()) {
            log::error!("Failed to request an update check: {err}");
        }
    }
}
