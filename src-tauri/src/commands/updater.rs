use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

/// The update the last `check_for_update` found, so `install_update` installs exactly
/// the one the user saw.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<Update>>);

impl PendingUpdate {
    fn replace(&self, update: Option<Update>) {
        *self.0.lock().unwrap() = update;
    }

    fn take(&self) -> Option<Update> {
        self.0.lock().unwrap().take()
    }

    /// Puts back an update that failed to install, unless a newer check stored another.
    fn restore(&self, update: Update) {
        self.0.lock().unwrap().get_or_insert(update);
    }
}

#[derive(Debug, thiserror::Error)]
pub enum UpdateError {
    #[error("{0}")]
    Updater(#[from] tauri_plugin_updater::Error),
    #[error("There is no update to install. Check for updates first.")]
    NoPendingUpdate,
}

/// `{code: "UPDATE_ERROR", message}`; the details go to the log.
impl Serialize for UpdateError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(2))?;
        map.serialize_entry("code", "UPDATE_ERROR")?;
        map.serialize_entry("message", &self.to_string())?;
        map.end()
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub notes: Option<String>,
}

/// Asks the update endpoint for a newer release and keeps it for `install_update`.
/// Debug builds never find one, so dev never installs over `target/`.
#[tauri::command]
pub async fn check_for_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
) -> Result<Option<UpdateInfo>, UpdateError> {
    if cfg!(debug_assertions) {
        log::info!("Skipping the update check in a debug build");
        return Ok(None);
    }

    let check = async { app.updater()?.check().await };
    let update = check.await.inspect_err(|err| {
        log::error!("Update check failed: {err:?}");
    })?;
    let info = update.as_ref().map(|update| UpdateInfo {
        version: update.version.clone(),
        notes: update.body.clone(),
    });
    match &info {
        Some(info) => log::info!("Update {} available", info.version),
        None => log::info!("No update available"),
    }
    pending.replace(update);
    Ok(info)
}

/// Downloads and installs the update `check_for_update` found, then restarts the app.
#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
) -> Result<(), UpdateError> {
    let update = pending.take().ok_or(UpdateError::NoPendingUpdate)?;
    log::info!("Installing update {}", update.version);
    if let Err(err) = update.download_and_install(|_, _| {}, || {}).await {
        log::error!("Update {} failed to install: {err:?}", update.version);
        // Keep it so the user can try again.
        pending.restore(update);
        return Err(err.into());
    }
    app.restart()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_error_serializes_to_code_and_message() {
        let json = serde_json::to_value(UpdateError::NoPendingUpdate).unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "code": "UPDATE_ERROR",
                "message": "There is no update to install. Check for updates first.",
            })
        );
    }
}
