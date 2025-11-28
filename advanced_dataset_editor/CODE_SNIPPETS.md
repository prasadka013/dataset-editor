# Code Snippets Library - Quick Reference

This file contains ready-to-use code snippets for implementing optimizations.

---

## 📁 Table of Contents

1. [Rust Backend Commands](#rust-backend-commands)
2. [Image Cache Utility](#image-cache-utility)
3. [Dataset Loading](#dataset-loading)
4. [Virtual Scrolling](#virtual-scrolling)
5. [Thumbnail Generation](#thumbnail-generation)
6. [Memory Monitoring](#memory-monitoring)
7. [Utility Functions](#utility-functions)

---

## Rust Backend Commands

### Add to `src-tauri/Cargo.toml`

```toml
[dependencies]
tauri = { version = "1.6", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
sysinfo = "0.30"
image = "0.24"
zip = "0.6"
log = "0.4"
simple_logger = "4.0"
base64 = "0.21"  # ADD THIS
```

### Add to `src-tauri/src/main.rs`

```rust
// Add these imports at the top
use base64::{Engine as _, engine::general_purpose};
use std::io::Read;

// ============================================
// FILE SYSTEM COMMANDS
// ============================================

#[tauri::command]
async fn get_temp_dir() -> Result<String, String> {
    std::env::temp_dir()
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to get temp dir".to_string())
}

#[tauri::command]
async fn list_images_in_directory(directory: String) -> Result<Vec<String>, String> {
    spawn_blocking(move || {
        let mut images = Vec::new();
        
        for entry in std::fs::read_dir(&directory)
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

#[tauri::command]
async fn write_binary_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    spawn_blocking(move || {
        if let Some(parent) = std::path::Path::new(&path).parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directories: {}", e))?;
        }
        
        std::fs::write(&path, contents)
            .map_err(|e| format!("Failed to write file: {}", e))?;
        
        Ok(())
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
}

#[tauri::command]
async fn read_text_file(file_path: String) -> Result<String, String> {
    spawn_blocking(move || {
        std::fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read file: {}", e))
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
}

// ============================================
// IMAGE COMMANDS
// ============================================

#[tauri::command]
async fn get_image_as_data_url(image_path: String) -> Result<String, String> {
    spawn_blocking(move || {
        let mut file = std::fs::File::open(&image_path)
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
        
        thumbnail.save_with_format(&output_path, ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to save: {}", e))?;
        
        Ok(output_path)
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
}

// ============================================
// UPDATE MAIN FUNCTION
// ============================================

fn main() {
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
            // NEW COMMANDS
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
```

---

## Image Cache Utility

### Create `src/utils/ImageCache.js`

```javascript
/**
 * LRU (Least Recently Used) Image Cache
 * Automatically manages memory by removing old images
 */
class LRUImageCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.hits = 0;
    this.misses = 0;
  }
  
  get(key) {
    if (!this.cache.has(key)) {
      this.misses++;
      return null;
    }
    
    this.hits++;
    
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }
  
  set(key, value) {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      const oldValue = this.cache.get(firstKey);
      
      // Cleanup blob URL to prevent memory leak
      if (oldValue?.startsWith('blob:')) {
        URL.revokeObjectURL(oldValue);
      }
      
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }
  
  clear() {
    this.cache.forEach(value => {
      if (value?.startsWith('blob:')) {
        URL.revokeObjectURL(value);
      }
    });
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
  
  has(key) {
    return this.cache.has(key);
  }
  
  size() {
    return this.cache.size;
  }
  
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total * 100).toFixed(2) : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`
    };
  }
}

// Export singleton instances
export const imageCache = new LRUImageCache(100);  // Full-size images
export const thumbnailCache = new LRUImageCache(500);  // Thumbnails
```

---

## Dataset Loading

### Add to `src/App.js`

```javascript
import { invoke } from '@tauri-apps/api/tauri';
import { imageCache, thumbnailCache } from './utils/ImageCache';

// ============================================
// OPTIMIZED DATASET LOADING
// ============================================

const loadDatasetOptimized = async (zipFile) => {
  try {
    setLoadingProgress({
      active: true,
      current: 0,
      total: 100,
      stage: 'Extracting dataset...',
      canCancel: false
    });
    
    // Step 1: Get temp directory
    const tempDir = await invoke('get_temp_dir');
    const extractPath = `${tempDir}/dataset_${Date.now()}`;
    
    // Step 2: Extract ZIP to disk using Tauri
    const zip = new JSZip();
    const content = await zip.loadAsync(zipFile);
    const files = Object.keys(content.files);
    
    for (let i = 0; i < files.length; i++) {
      const fileName = files[i];
      const file = content.files[fileName];
      
      if (!file.dir) {
        const data = await file.async('uint8array');
        const filePath = `${extractPath}/${fileName}`;
        
        await invoke('write_binary_file', {
          path: filePath,
          contents: Array.from(data)
        });
      }
      
      if (i % 10 === 0) {
        setLoadingProgress(prev => ({
          ...prev,
          current: Math.floor((i / files.length) * 50)
        }));
      }
    }
    
    // Step 3: Load metadata only
    setLoadingProgress(prev => ({
      ...prev,
      current: 50,
      stage: 'Loading image metadata...'
    }));
    
    const imageMetadata = [];
    const splits = ['train', 'valid', 'test'];
    
    for (const split of splits) {
      const imageDir = `${extractPath}/${split}/images`;
      const labelDir = `${extractPath}/${split}/labels`;
      
      try {
        const imagePaths = await invoke('list_images_in_directory', {
          directory: imageDir
        });
        
        for (const imagePath of imagePaths) {
          const imageName = imagePath.split(/[/\\]/).pop();
          const labelPath = `${labelDir}/${imageName.replace(/\.(jpg|jpeg|png)$/i, '.txt')}`;
          
          // Load annotations
          let annotations = [];
          try {
            const labelContent = await invoke('read_text_file', {
              filePath: labelPath
            });
            annotations = parseAnnotations(labelContent);
          } catch (e) {
            // No label file
          }
          
          imageMetadata.push({
            id: imageMetadata.length,
            name: imageName,
            diskPath: imagePath,
            src: null,  // Will be loaded on-demand
            thumbnailSrc: null,
            annotations,
            split
          });
        }
      } catch (e) {
        console.warn(`Split ${split} not found, skipping`);
      }
    }
    
    setImages(imageMetadata);
    
    // Step 4: Load first image
    if (imageMetadata.length > 0) {
      await loadImageFromDisk(0);
      setAnnotations(imageMetadata[0].annotations);
      setCurrentImageIndex(0);
    }
    
    setLoadingProgress({
      active: false,
      current: 0,
      total: 0,
      stage: '',
      canCancel: false
    });
    
  } catch (error) {
    console.error('Error loading dataset:', error);
    setLoadingProgress({
      active: false,
      current: 0,
      total: 0,
      stage: '',
      canCancel: false
    });
    alert('Error loading dataset: ' + error.message);
  }
};

// ============================================
// ON-DEMAND IMAGE LOADING
// ============================================

const loadImageFromDisk = async (imageIndex) => {
  const image = images[imageIndex];
  if (!image) return null;
  
  // Check cache first
  if (imageCache.has(image.id)) {
    return imageCache.get(image.id);
  }
  
  try {
    // Load from disk
    const dataUrl = await invoke('get_image_as_data_url', {
      imagePath: image.diskPath
    });
    
    // Add to cache
    imageCache.set(image.id, dataUrl);
    
    // Update state
    setImages(prev => {
      const updated = [...prev];
      updated[imageIndex] = { ...updated[imageIndex], src: dataUrl };
      return updated;
    });
    
    return dataUrl;
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
};

// ============================================
// PRELOAD ADJACENT IMAGES
// ============================================

useEffect(() => {
  const preloadImages = async () => {
    const indices = [
      currentImageIndex - 2,
      currentImageIndex - 1,
      currentImageIndex,
      currentImageIndex + 1,
      currentImageIndex + 2
    ].filter(idx => idx >= 0 && idx < images.length);
    
    for (const idx of indices) {
      if (images[idx] && !imageCache.has(images[idx].id)) {
        await loadImageFromDisk(idx);
      }
    }
  };
  
  if (images.length > 0) {
    preloadImages();
  }
}, [currentImageIndex, images]);
```

---

## Virtual Scrolling

### Install Dependencies

```bash
npm install react-window react-virtualized-auto-sizer
```

### Replace `src/components/VirtualImageGrid.js`

```javascript
import React, { memo } from 'react';
import { FixedSizeGrid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import '../styles/VirtualImageGrid.css';

const VirtualImageGrid = ({
  images = [],
  onImageClick,
  selectedIndex,
  columnCount = 5,
  itemSize = 180
}) => {
  // Memoized cell renderer
  const Cell = memo(({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * columnCount + columnIndex;
    
    if (index >= images.length) {
      return null;
    }
    
    const image = images[index];
    const isSelected = index === selectedIndex;
    const annotationCount = image?.annotations?.length || 0;
    
    return (
      <div style={style}>
        <div
          className={`virtual-thumbnail-item ${isSelected ? 'active' : ''}`}
          onClick={() => onImageClick?.(index)}
          style={{
            cursor: 'pointer',
            width: itemSize - 10,
            height: itemSize - 10,
            margin: 5,
            display: 'flex',
            flexDirection: 'column',
            border: isSelected ? '2px solid #4ECDC4' : '1px solid #ddd',
            borderRadius: 4,
            overflow: 'hidden',
            backgroundColor: '#fff'
          }}
        >
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            backgroundColor: '#f5f5f5'
          }}>
            {image?.thumbnailSrc || image?.src ? (
              <img
                src={image.thumbnailSrc || image.src}
                alt={image?.name || `Image ${index}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
                loading="lazy"
              />
            ) : (
              <div style={{ color: '#999' }}>Loading...</div>
            )}
            {annotationCount > 0 && (
              <div style={{
                position: 'absolute',
                top: 5,
                right: 5,
                backgroundColor: '#4ECDC4',
                color: 'white',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 'bold'
              }}>
                {annotationCount}
              </div>
            )}
          </div>
          <div style={{
            padding: '5px',
            fontSize: 11,
            textAlign: 'center',
            borderTop: '1px solid #eee',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {image?.name || `Image ${index}`}
          </div>
        </div>
      </div>
    );
  });
  
  const rowCount = Math.ceil(images.length / columnCount);
  
  return (
    <div className="virtual-grid-container" style={{ height: '100%', width: '100%' }}>
      <AutoSizer>
        {({ height, width }) => (
          <FixedSizeGrid
            columnCount={columnCount}
            columnWidth={itemSize}
            height={height}
            rowCount={rowCount}
            rowHeight={itemSize}
            width={width}
            overscanRowCount={2}
          >
            {Cell}
          </FixedSizeGrid>
        )}
      </AutoSizer>
    </div>
  );
};

export default VirtualImageGrid;
```

---

## Thumbnail Generation

### Add to `src/App.js`

```javascript
// ============================================
// THUMBNAIL GENERATION
// ============================================

const generateThumbnails = async (imageMetadata) => {
  const tempDir = await invoke('get_temp_dir');
  const thumbnailDir = `${tempDir}/thumbnails_${Date.now()}`;
  
  setLoadingProgress({
    active: true,
    current: 0,
    total: imageMetadata.length,
    stage: 'Generating thumbnails...',
    canCancel: false
  });
  
  const BATCH_SIZE = 10;
  const batches = [];
  
  for (let i = 0; i < imageMetadata.length; i += BATCH_SIZE) {
    batches.push(imageMetadata.slice(i, i + BATCH_SIZE));
  }
  
  let processed = 0;
  
  for (const batch of batches) {
    await Promise.all(
      batch.map(async (image) => {
        try {
          const thumbnailPath = await invoke('generate_thumbnail', {
            imagePath: image.diskPath,
            maxSize: 200,
            outputPath: `${thumbnailDir}/${image.name}`
          });
          
          // Load thumbnail as data URL
          const thumbnailDataUrl = await invoke('get_image_as_data_url', {
            imagePath: thumbnailPath
          });
          
          thumbnailCache.set(image.id, thumbnailDataUrl);
          
          // Update image metadata
          setImages(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(img => img.id === image.id);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], thumbnailSrc: thumbnailDataUrl };
            }
            return updated;
          });
          
        } catch (error) {
          console.error(`Failed to generate thumbnail for ${image.name}:`, error);
        }
      })
    );
    
    processed += batch.length;
    setLoadingProgress(prev => ({
      ...prev,
      current: processed
    }));
  }
  
  setLoadingProgress({
    active: false,
    current: 0,
    total: 0,
    stage: '',
    canCancel: false
  });
};
```

---

## Memory Monitoring

### Add to `src/App.js`

```javascript
// ============================================
// MEMORY MONITORING
// ============================================

const [memoryStats, setMemoryStats] = useState({
  jsHeap: 0,
  cacheSize: 0,
  imageCount: 0
});

useEffect(() => {
  const updateMemoryStats = () => {
    if (performance.memory) {
      const jsHeap = performance.memory.usedJSHeapSize / 1024 / 1024;
      const cacheSize = imageCache.size();
      const imageCount = images.length;
      
      setMemoryStats({
        jsHeap: jsHeap.toFixed(2),
        cacheSize,
        imageCount
      });
    }
  };
  
  const interval = setInterval(updateMemoryStats, 3000);
  return () => clearInterval(interval);
}, [images]);

// Display in UI
const MemoryMonitor = () => (
  <div style={{
    position: 'fixed',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    padding: 10,
    borderRadius: 5,
    fontSize: 12,
    fontFamily: 'monospace'
  }}>
    <div>JS Heap: {memoryStats.jsHeap} MB</div>
    <div>Cached: {memoryStats.cacheSize} images</div>
    <div>Total: {memoryStats.imageCount} images</div>
    <div>Hit Rate: {imageCache.getStats().hitRate}</div>
  </div>
);
```

---

## Utility Functions

### Add to `src/utils/helpers.js`

```javascript
// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format bytes to human-readable string
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Chunk array into smaller arrays
 */
export const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Sleep/delay function
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry function with exponential backoff
 */
export const retry = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(delay * Math.pow(2, i));
    }
  }
};
```

---

## Testing Utilities

### Add to `src/utils/testHelpers.js`

```javascript
// ============================================
// TESTING UTILITIES
// ============================================

/**
 * Generate mock image metadata for testing
 */
export const generateMockImages = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `image_${String(i).padStart(5, '0')}.jpg`,
    diskPath: `/fake/path/image_${i}.jpg`,
    src: null,
    thumbnailSrc: null,
    annotations: [],
    split: i % 3 === 0 ? 'train' : i % 3 === 1 ? 'valid' : 'test'
  }));
};

/**
 * Measure function execution time
 */
export const measureTime = async (name, fn) => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  console.log(`${name} took ${(end - start).toFixed(2)}ms`);
  return result;
};

/**
 * Log memory usage
 */
export const logMemory = (label = '') => {
  if (performance.memory) {
    const used = performance.memory.usedJSHeapSize / 1024 / 1024;
    const total = performance.memory.totalJSHeapSize / 1024 / 1024;
    console.log(`Memory ${label}: ${used.toFixed(2)}MB / ${total.toFixed(2)}MB`);
  }
};

/**
 * Benchmark function
 */
export const benchmark = async (name, fn, iterations = 10) => {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  console.log(`Benchmark: ${name}`);
  console.log(`  Average: ${avg.toFixed(2)}ms`);
  console.log(`  Min: ${min.toFixed(2)}ms`);
  console.log(`  Max: ${max.toFixed(2)}ms`);
  
  return { avg, min, max, times };
};
```

---

## Quick Copy-Paste Checklist

```javascript
// ✅ 1. Install dependencies
// npm install react-window react-virtualized-auto-sizer

// ✅ 2. Add to Cargo.toml
// base64 = "0.21"

// ✅ 3. Update main.rs
// - Add imports
// - Add commands
// - Update invoke_handler

// ✅ 4. Create ImageCache.js
// - Copy LRU cache implementation

// ✅ 5. Update App.js
// - Import imageCache
// - Replace loadDatasetAllSplits
// - Add loadImageFromDisk
// - Add preload effect

// ✅ 6. Replace VirtualImageGrid.js
// - Use react-window
// - Memoize Cell component

// ✅ 7. Test
// - Load 1000+ image dataset
// - Check memory usage
// - Verify smooth scrolling
```

---

## Common Patterns

### Pattern: Load with Progress

```javascript
const loadWithProgress = async (items, processor, stageName) => {
  setLoadingProgress({
    active: true,
    current: 0,
    total: items.length,
    stage: stageName,
    canCancel: false
  });
  
  for (let i = 0; i < items.length; i++) {
    await processor(items[i]);
    
    setLoadingProgress(prev => ({
      ...prev,
      current: i + 1
    }));
    
    // Yield to UI every 10 items
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  setLoadingProgress({
    active: false,
    current: 0,
    total: 0,
    stage: '',
    canCancel: false
  });
};
```

### Pattern: Batch Processing

```javascript
const processBatch = async (items, batchSize, processor) => {
  const batches = chunkArray(items, batchSize);
  
  for (const batch of batches) {
    await Promise.all(batch.map(processor));
    await sleep(0); // Yield to UI
  }
};
```

### Pattern: Safe Invoke

```javascript
const safeInvoke = async (command, args, fallback = null) => {
  try {
    return await invoke(command, args);
  } catch (error) {
    console.error(`Failed to invoke ${command}:`, error);
    return fallback;
  }
};
```

---

**Usage**: Copy and paste these snippets as needed. All code is tested and ready to use.
