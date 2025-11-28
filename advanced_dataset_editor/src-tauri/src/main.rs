// src-tauri/src/main.rs
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs;
use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

use log::info;
use simple_logger::SimpleLogger;

use serde::Serialize;
use serde_json::json;

use sysinfo::{System, RefreshKind, ProcessRefreshKind, Pid};

use image::ImageReader;
use image::ImageFormat;

use zip::ZipArchive;

use tauri::Manager; // for Window emit

use base64::{Engine as _, engine::general_purpose};

// ---------- init logging ----------
fn init_logging() {
    // init only once; ignore error if already initialized
    let _ = SimpleLogger::new().init();
    info!("Logger initialized");
}

// ---------- helper: run blocking tasks ----------
fn spawn_blocking<F, T>(f: F) -> tauri::async_runtime::JoinHandle<T>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
}

// ---------- Commands ----------

#[tauri::command]
fn greet(name: &str) -> String {
    info!("greet called: {}", name);
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_system_memory() -> u64 {
    let mut sys = System::new_all();
    sys.refresh_memory();
    sys.total_memory()
}

#[tauri::command]
fn get_memory_usage() -> u64 {
    let mut sys = System::new_all();
    sys.refresh_memory();
    sys.used_memory()
}

#[tauri::command]
fn get_process_memory() -> u64 {
    // Use RefreshKind with processes; this is compatible with recent sysinfo versions
    let mut sys = System::new();
    sys.refresh_specifics(RefreshKind::new().with_processes(ProcessRefreshKind::everything()));

    let pid = std::process::id();
    let pid_sys = Pid::from(pid as usize);

    if let Some(process) = sys.process(pid_sys) {
        process.memory()
    } else {
        0
    }
}

#[tauri::command]
async fn validate_file_size(file_size: u64) -> Result<bool, String> {
    let mut sys = System::new_all();
    sys.refresh_memory();
    let total_memory = sys.total_memory();
    let max_allowed = (total_memory as f64 * 0.10) as u64;
    if file_size > max_allowed {
        let max_gb = max_allowed as f64 / (1024.0 * 1024.0 * 1024.0);
        let file_gb = file_size as f64 / (1024.0 * 1024.0 * 1024.0);
        return Err(format!(
            "File too large! Maximum allowed: {:.2}GB. Your file: {:.2}GB",
            max_gb, file_gb
        ));
    }
    Ok(true)
}

/// Async-optimized image compression using spawn_blocking + streaming write.
/// quality: 0-100
#[tauri::command]
async fn compress_image(
    image_path: String,
    quality: u8,
    output_path: String,
) -> Result<String, String> {
    let image_path2 = image_path.clone();
    let output_path2 = output_path.clone();

    let handle = spawn_blocking(move || {
        // Open and decode image using modern ImageReader
        let reader = ImageReader::open(&image_path2)
            .map_err(|e| format!("Failed to open image: {}", e))?;
        let dynimg = reader
            .decode()
            .map_err(|e| format!("Failed to decode image: {}", e))?;

        // Save with format - save_with_format will auto-encode to JPEG
        dynimg
            .save_with_format(&output_path2, ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to write image: {}", e))?;

        // If you want to control JPEG quality precisely, you can use a JPEG encoder directly.
        // For simplicity and compatibility we use save_with_format here.

        Ok(output_path2)
    });

    handle.await.map_err(|e| format!("Join error: {}", e))?
}

/// Cache image bytes and annotation JSON to disk in a memory-safe way.
#[tauri::command]
async fn cache_image(
    cache_dir: String,
    image_id: String,
    image_data: Vec<u8>,
    annotations: String,
) -> Result<(), String> {
    let cache_dir2 = cache_dir.clone();
    let image_id2 = image_id.clone();
    let image_data2 = image_data.clone();
    let annotations2 = annotations.clone();

    let handle = spawn_blocking(move || {
        let cache_path = Path::new(&cache_dir2);
        fs::create_dir_all(cache_path)
            .map_err(|e| format!("Failed to create cache directory: {}", e))?;

        // Write image as streaming write
        let img_path = cache_path.join(format!("{}.jpg", image_id2));
        let mut f = File::create(&img_path)
            .map_err(|e| format!("Failed to create image file: {}", e))?;
        // write in chunks (Vec<u8> may be already contiguous but this is safe)
        const CHUNK: usize = 8 * 1024;
        let mut offset = 0;
        while offset < image_data2.len() {
            let end = usize::min(offset + CHUNK, image_data2.len());
            f.write_all(&image_data2[offset..end])
                .map_err(|e| format!("Failed to write image chunk: {}", e))?;
            offset = end;
        }
        f.flush().map_err(|e| format!("Failed to flush image file: {}", e))?;

        // Write annotations
        let ann_path = cache_path.join(format!("{}.json", image_id2));
        fs::write(&ann_path, annotations2).map_err(|e| format!("Failed to write annotations: {}", e))?;

        Ok(())
    });

    handle.await.map_err(|e| format!("Join error: {}", e))?
}

/// Load cached image and annotations (stream read)
#[tauri::command]
async fn load_cached_image(
    cache_dir: String,
    image_id: String,
) -> Result<(Vec<u8>, String), String> {
    let cache_dir2 = cache_dir.clone();
    let image_id2 = image_id.clone();

    let handle = spawn_blocking(move || {
        let cache_path = Path::new(&cache_dir2);
        let img_path = cache_path.join(format!("{}.jpg", image_id2));
        let f = File::open(&img_path).map_err(|e| format!("Failed to open image: {}", e))?;
        let mut buf = Vec::new();
        let mut reader = BufReader::new(f);
        reader.read_to_end(&mut buf).map_err(|e| format!("Failed to read image: {}", e))?;

        let ann_path = cache_path.join(format!("{}.json", image_id2));
        let annotations = fs::read_to_string(&ann_path).map_err(|e| format!("Failed to read annotations: {}", e))?;

        Ok((buf, annotations))
    });

    handle.await.map_err(|e| format!("Join error: {}", e))?
}

/// Extract zip contents to target directory with progress events emitted to the calling window.
/// frontend should call: invoke('extract_zip_with_progress', { zip_path, dest_dir })
#[derive(Serialize)]
struct ZipProgress {
    index: usize,
    total: usize,
    name: String,
}

#[tauri::command]
async fn extract_zip_with_progress(
    window: tauri::Window,
    zip_path: String,
    dest_dir: String,
) -> Result<(), String> {
    let wp = window.clone();
    let zip_path2 = zip_path.clone();
    let dest_dir2 = dest_dir.clone();

    let handle = spawn_blocking(move || {
        let f = File::open(&zip_path2).map_err(|e| format!("Failed to open zip: {}", e))?;
        let mut archive = ZipArchive::new(BufReader::new(f)).map_err(|e| format!("Failed to read zip: {}", e))?;
        let total = archive.len();

        for i in 0..total {
            let mut file = archive.by_index(i).map_err(|e| format!("Failed to read entry {}: {}", i, e))?;

            // prefer enclosed_name() (safe) and fallback to raw name
            let outpath: PathBuf = match file.enclosed_name() {
                Some(p) => Path::new(&dest_dir2).join(p),
                None => Path::new(&dest_dir2).join(Path::new(file.name())),
            };

            if file.name().ends_with('/') {
                fs::create_dir_all(&outpath).map_err(|e| format!("Failed to create dir: {}", e))?;
                let p = ZipProgress { index: i, total, name: file.name().to_string() };
                let _ = wp.emit("zip-progress", json!(p));
                continue;
            } else {
                if let Some(parent) = outpath.parent() {
                    fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dir: {}", e))?;
                }
                // Stream write the file instead of collecting into memory
                let mut outfile = File::create(&outpath).map_err(|e| format!("Failed to create file: {}", e))?;
                let mut writer = BufWriter::new(&mut outfile);
                // copy in buffered chunks
                let mut buf = [0u8; 8192];
                loop {
                    let read = file.read(&mut buf).map_err(|e| format!("Read error: {}", e))?;
                    if read == 0 { break; }
                    writer.write_all(&buf[..read]).map_err(|e| format!("Write error: {}", e))?;
                }
                writer.flush().map_err(|e| format!("Flush error: {}", e))?;

                // Emit progress
                let p = ZipProgress { index: i, total, name: file.name().to_string() };
                let _ = wp.emit("zip-progress", json!(p));
            }
        }
        Ok(())
    });

    handle.await.map_err(|e| format!("Join error: {}", e))?
}

// ============================================
// NEW OPTIMIZATION COMMANDS
// ============================================

/// Get the system temp directory
#[tauri::command]
async fn get_temp_dir() -> Result<String, String> {
    std::env::temp_dir()
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to get temp dir".to_string())
}

/// List all image files in a directory
#[tauri::command]
async fn list_images_in_directory(directory: String) -> Result<Vec<String>, String> {
    spawn_blocking(move || {
        let mut images = Vec::new();
        
        let path = Path::new(&directory);
        if !path.exists() {
            return Ok(images);
        }
        
        for entry in fs::read_dir(&directory)
            .map_err(|e| format!("Failed to read dir: {}", e))? 
        {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();
            
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_str().unwrap_or("");
                if matches!(ext_str.to_lowercase().as_str(), "jpg" | "jpeg" | "png") {
                    if let Some(path_str) = path.to_str() {
                        images.push(path_str.to_string());
                    }
                }
            }
        }
        
        Ok(images)
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
}

/// Write binary file to disk
#[tauri::command]
async fn write_binary_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    spawn_blocking(move || {
        if let Some(parent) = Path::new(&path).parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directories: {}", e))?;
        }
        
        fs::write(&path, contents)
            .map_err(|e| format!("Failed to write file: {}", e))?;
        
        Ok(())
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
}

/// Read text file from disk
#[tauri::command]
async fn read_text_file(file_path: String) -> Result<String, String> {
    spawn_blocking(move || {
        fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read file: {}", e))
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
}

/// Get image as data URL (base64 encoded)
#[tauri::command]
async fn get_image_as_data_url(image_path: String) -> Result<String, String> {
    spawn_blocking(move || {
        let mut file = File::open(&image_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;
        
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|e| format!("Failed to read image: {}", e))?;
        
        let base64 = general_purpose::STANDARD.encode(&buffer);
        Ok(format!("data:image/jpeg;base64,{}", base64))
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
}

/// Generate thumbnail for an image
#[tauri::command]
async fn generate_thumbnail(
    image_path: String,
    max_size: u32,
    output_path: String,
) -> Result<String, String> {
    spawn_blocking(move || {
        let reader = ImageReader::open(&image_path)
            .map_err(|e| format!("Failed to open: {}", e))?;
        let img = reader.decode()
            .map_err(|e| format!("Failed to decode: {}", e))?;
        
        let thumbnail = img.thumbnail(max_size, max_size);
        
        // Create parent directory if needed
        if let Some(parent) = Path::new(&output_path).parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create thumbnail dir: {}", e))?;
        }
        
        thumbnail.save_with_format(&output_path, ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to save: {}", e))?;
        
        Ok(output_path)
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
}

fn main() {
    // initialize logger (ignore failure if already initialized)
    let _ = init_logging();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            get_system_memory,
            get_memory_usage,
            get_process_memory,
            validate_file_size,
            compress_image,
            cache_image,
            load_cached_image,
            extract_zip_with_progress,
            // NEW OPTIMIZATION COMMANDS
            get_temp_dir,
            list_images_in_directory,
            write_binary_file,
            read_text_file,
            get_image_as_data_url,
            generate_thumbnail,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
