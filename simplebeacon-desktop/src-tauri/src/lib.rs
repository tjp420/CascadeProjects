use serde::Serialize;
use std::collections::HashMap;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
struct ScanEntry {
    path: String,
    size: u64,
    is_dir: bool,
}

#[derive(Serialize)]
struct ScanResult {
    root: String,
    entries: Vec<ScanEntry>,
    total_files: usize,
    total_dirs: usize,
}

#[tauri::command]
async fn select_folder(app: AppHandle) -> Result<Option<String>, String> {
    let dialog = app.dialog();
    let file_path = dialog.file().pick_folder().await;
    match file_path {
        Some(path) => Ok(Some(path.to_string_lossy().to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
async fn read_directory(path: String) -> Result<ScanResult, String> {
    let mut entries = Vec::new();
    let mut total_files = 0usize;
    let mut total_dirs = 0usize;

    let mut read_queue = vec![path.clone()];
    while let Some(dir) = read_queue.pop() {
        let mut dir_entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(err) => return Err(format!("Failed to read {}: {}", dir, err)),
        };

        while let Some(Ok(entry)) = dir_entries.next() {
            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let path = entry.path().to_string_lossy().to_string();
            let is_dir = metadata.is_dir();
            entries.push(ScanEntry {
                path: path.clone(),
                size: metadata.len(),
                is_dir,
            });
            if is_dir {
                total_dirs += 1;
                read_queue.push(path);
            } else {
                total_files += 1;
            }
        }
    }

    Ok(ScanResult {
        root: path,
        entries,
        total_files,
        total_dirs,
    })
}

#[tauri::command]
async fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|err| format!("Failed to read {}: {}", path, err))
}

#[tauri::command]
async fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|err| format!("Failed to write {}: {}", path, err))
}

#[tauri::command]
async fn platform_info() -> Result<HashMap<String, String>, String> {
    let mut info = HashMap::new();
    info.insert("os".to_string(), std::env::consts::OS.to_string());
    info.insert("arch".to_string(), std::env::consts::ARCH.to_string());
    if let Ok(dir) = std::env::current_dir() {
        info.insert("cwd".to_string(), dir.to_string_lossy().to_string());
    }
    Ok(info)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            select_folder,
            read_directory,
            read_text_file,
            write_text_file,
            platform_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
