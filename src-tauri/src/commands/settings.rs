use crate::services::{SettingsService, AppSettings};
use tauri::State;

#[tauri::command]
pub async fn get_settings(
    app_state: State<'_, tokio::sync::Mutex<crate::services::AppState>>,
) -> Result<AppSettings, String> {
    let state = app_state.lock().await;
    let db_path = state.get_database_file();
    
    let settings_service = SettingsService::new(&db_path)
        .map_err(|e| format!("Failed to initialize settings service: {}", e))?;
    
    settings_service.get_all_settings()
        .map_err(|e| format!("Failed to get settings: {}", e))
}

#[tauri::command]
pub async fn save_settings(
    settings: AppSettings,
    app_state: State<'_, tokio::sync::Mutex<crate::services::AppState>>,
) -> Result<(), String> {
    let state = app_state.lock().await;
    let db_path = state.get_database_file();
    
    let settings_service = SettingsService::new(&db_path)
        .map_err(|e| format!("Failed to initialize settings service: {}", e))?;
    
    settings_service.save_settings(&settings)
        .map_err(|e| format!("Failed to save settings: {}", e))
}

#[tauri::command]
pub async fn get_setting(
    key: String,
    app_state: State<'_, tokio::sync::Mutex<crate::services::AppState>>,
) -> Result<Option<String>, String> {
    let state = app_state.lock().await;
    let db_path = state.get_database_file();
    
    let settings_service = SettingsService::new(&db_path)
        .map_err(|e| format!("Failed to initialize settings service: {}", e))?;
    
    settings_service.get_setting(&key)
        .map_err(|e| format!("Failed to get setting: {}", e))
}

#[tauri::command]
pub async fn set_setting(
    key: String,
    value: String,
    app_state: State<'_, tokio::sync::Mutex<crate::services::AppState>>,
) -> Result<(), String> {
    let state = app_state.lock().await;
    let db_path = state.get_database_file();
    
    let settings_service = SettingsService::new(&db_path)
        .map_err(|e| format!("Failed to initialize settings service: {}", e))?;
    
    settings_service.set_setting(&key, &value)
        .map_err(|e| format!("Failed to save setting: {}", e))
}

#[tauri::command]
pub async fn reset_settings(
    app_state: State<'_, tokio::sync::Mutex<crate::services::AppState>>,
) -> Result<(), String> {
    let state = app_state.lock().await;
    let db_path = state.get_database_file();
    
    let settings_service = SettingsService::new(&db_path)
        .map_err(|e| format!("Failed to initialize settings service: {}", e))?;
    
    settings_service.reset_to_defaults()
        .map_err(|e| format!("Failed to reset settings: {}", e))
}
