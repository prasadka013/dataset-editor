# Advanced Dataset Editor - Complete Project Documentation

A professional-grade YOLO dataset annotation editor built with React and Tauri. This desktop application allows users to upload, view, edit, and export object detection datasets in YOLO and COCO formats.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Installation & Setup](#installation--setup)
5. [Project Structure](#project-structure)
6. [Core Components](#core-components)
7. [State Management](#state-management)
8. [Key Features](#key-features)
9. [Data Flow](#data-flow)
10. [User Workflows](#user-workflows)
11. [API Documentation](#api-documentation)
12. [Performance Optimizations](#performance-optimizations)
13. [Troubleshooting](#troubleshooting)

---

## Project Overview

### Purpose

The Advanced Dataset Editor is a desktop application designed for machine learning professionals who need to:

- **Upload datasets** in YOLO format (ZIP files with images and labels)
- **Annotate objects** by drawing bounding boxes on images
- **Manage multiple classes** with add, rename, delete, and merge operations
- **Handle dataset splits** (train, valid, test) independently or together
- **Export datasets** in YOLO or COCO format for training
- **Visualize statistics** about annotations and class distributions
- **Monitor system resources** to prevent memory overflow during large dataset operations

### Key Capabilities

| Feature | Description |
|---------|------------|
| **YOLO Format Support** | Native read/write of normalized bounding box coordinates |
| **Interactive Annotation** | Draw, drag, resize, and delete bounding boxes with mouse |
| **Multi-Class Management** | Add, rename, delete, and merge annotation classes |
| **Dataset Splits** | Work with train/valid/test splits independently or in aggregate |
| **Batch Navigation** | Browse images in 50-image batches with virtual scrolling |
| **Statistical Dashboard** | View class distribution, total annotations, and preview thumbnails |
| **Export Formats** | Download datasets in YOLO or COCO JSON format |
| **Memory Monitoring** | Real-time memory usage tracking to prevent crashes |
| **Crop Viewer** | Inspect individual annotations as crops extracted from images |

---

## Technology Stack

### Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | React | 18.2.0 | Component-based UI, state management |
| **Canvas Library** | Konva.js | 9.2.0 | Interactive canvas for annotation drawing |
| **React Konva** | react-konva | 18.2.5 | React bindings for Konva.js |
| **Virtualization** | react-window | 2.2.3 | Efficient grid rendering (5 columns) |
| **Auto-Sizer** | react-virtualized-auto-sizer | 1.0.26 | Responsive container sizing |
| **File Handling** | JSZip | 3.10.1 | Extract/create ZIP archives |
| **YAML Parsing** | js-yaml | 4.1.0 | Parse dataset.yaml config files |
| **Icons** | lucide-react | 0.554.0 | UI icon library |
| **File Upload** | react-dropzone | 14.2.3 | Drag-and-drop file upload |

### Build Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **Bundler** | Webpack | 5.88.2 | Module bundling and code splitting |
| **Transpiler** | Babel | 7.22.9 | ES6+ to compatible JavaScript |
| **Loaders** | babel-loader, css-loader, style-loader | - | Asset processing |
| **Dev Server** | webpack-dev-server | 4.15.1 | Hot reload during development |

### Desktop & Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Desktop Framework** | Tauri | 1.6.3 | Electron-like desktop wrapper |
| **Tauri API** | @tauri-apps/api | 1.6.0 | Access to OS-level APIs |
| **Backend** | Rust | - | Image compression, file operations |

---

## Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              Advanced Dataset Editor Desktop App             │
│                      (Tauri Window)                          │
├─────────────────────────────────────────────────────────────┤
│
│  ┌─────────────────────────────────────────────────────┐
│  │             React Component Layer                   │
│  ├─────────────────────────────────────────────────────┤
│  │
│  │  App.js (Main Component - 3000+ lines)
│  │  ├─ Global State Management
│  │  ├─ Canvas Interaction Handler
│  │  ├─ Dataset Loading Logic
│  │  └─ Export Functionality
│  │
│  │  ┌─────────────────────────────────┐
│  │  │    Editor View                  │
│  │  ├─────────────────────────────────┤
│  │  │ • Konva Stage (Canvas)          │
│  │  │ • Image Layer                   │
│  │  │ • Annotation Rectangles         │
│  │  │ • Toolbar (Tools Selection)     │
│  │  │ • Inspector Panel               │
│  │  └─────────────────────────────────┘
│  │
│  │  ┌─────────────────────────────────┐
│  │  │    Dashboard View               │
│  │  ├─────────────────────────────────┤
│  │  │ • Statistics Overview           │
│  │  │ • Class Distribution            │
│  │  │ • Crop Viewer                   │
│  │  │ • Class Management              │
│  │  └─────────────────────────────────┘
│  │
│  │  Additional Components:
│  │  ├─ VirtualImageGrid (Thumbnail grid)
│  │  ├─ DatasetMonitor (Memory tracker)
│  │  ├─ LoadingProgress (Upload progress)
│  │  ├─ ContextMenu (Right-click menu)
│  │  ├─ ImageCropper (Extract crops)
│  │  └─ MergeDatasets (Class operations)
│  │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │         Utilities & Hooks                           │
│  ├─────────────────────────────────────────────────────┤
│  │ • ImageUtils.js (Image processing)                 │
│  │ • MemoryMonitorHook (Memory tracking)              │
│  │ • ContextMenu logic (Right-click handling)         │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │         State Management (React Hooks)             │
│  ├─────────────────────────────────────────────────────┤
│  │ • useState for local component state               │
│  │ • useEffect for side effects & lifecycle           │
│  │ • useRef for DOM references & caching              │
│  │ • useCallback for memoized functions               │
│  └─────────────────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────┘
         │                              │
         ├──────────────────────────────┤
         ▼                              ▼
┌──────────────────┐        ┌──────────────────────┐
│  Local Storage   │        │  Tauri Backend (Rust)│
│  (Blob URLs)     │        ├──────────────────────┤
│                  │        │ • Image Compression  │
│  Cache Directory │        │ • File Operations    │
│  (Images/Labels) │        │ • System Calls       │
└──────────────────┘        └──────────────────────┘
```

### Component Hierarchy

```
App.js (Main)
├── Header (Navigation & Split Selector)
├── Main Canvas Area
│   ├── VirtualImageGrid (5-column thumbnail grid)
│   ├── Konva Stage
│   │   ├── Image Layer
│   │   ├── Annotation Rectangles
│   │   ├── Drawing Layer
│   │   ├── Crosshair
│   │   └── Selection Handles
│   └── Inspector Panel
│       ├── Annotation List
│       ├── Class Selector
│       └── Edit Controls
├── Dashboard View
│   ├── Statistics Cards
│   ├── Class Distribution Chart
│   ├── Crop Viewer Modal
│   └── Class Management Panel
├── DatasetMonitor (Memory tracking)
├── LoadingProgress (Progress bar)
├── ContextMenu (Right-click)
└── Modals
    ├── Crop Viewer
    └── Merge Datasets
```

---

## Installation & Setup

### Prerequisites

- Node.js 16+ and npm
- Rust 1.56+ (for Tauri backend)
- Git

### Step-by-Step Setup

#### 1. Clone the Repository

```bash
cd desktop_dataset_editor/advanced_dataset_editor
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Development Mode

**For Web Development (with hot reload):**
```bash
npm start
```
This starts webpack-dev-server on `http://localhost:8080` with hot module replacement.

**For Desktop Development (Tauri):**
```bash
npm run tauri:dev
```
This opens the desktop application in development mode with inspector tools.

#### 4. Production Build

**Web Build:**
```bash
npm run build
```
Output goes to `dist/` directory.

**Desktop Build:**
```bash
npm run tauri:build
```
Output executables go to `src-tauri/target/release/`.

---

## Project Structure

```
desktop_dataset_editor/
├── advanced_dataset_editor/
│   ├── package.json                 # Dependencies and scripts
│   ├── webpack.config.js            # Webpack bundler config
│   ├── README.md                    # Project readme
│   │
│   ├── src/                         # Frontend source code
│   │   ├── App.js                   # Main app component (3000+ lines)
│   │   ├── index.js                 # React entry point
│   │   ├── index.html               # HTML template
│   │   ├── styles.css               # Global styles
│   │   ├── ContextMenu.css          # Context menu styles
│   │   ├── LoadingProgress.css      # Progress bar styles
│   │   │
│   │   ├── components/              # Reusable components
│   │   │   ├── Dashboard.js         # Statistics & class management
│   │   │   ├── VirtualImageGrid.js  # Virtualized thumbnail grid
│   │   │   ├── DatasetMonitor.js    # Memory usage tracking
│   │   │   ├── LoadingProgress.js   # Upload progress indicator
│   │   │   ├── ContextMenu.js       # Right-click menu
│   │   │   ├── ImageCropper.js      # Crop extraction
│   │   │   ├── MergeDatasets.js     # Class merge UI
│   │   │   └── TestingSection.js    # Development testing
│   │   │
│   │   ├── hooks/                   # Custom React hooks
│   │   │   └── MemoryMonitorHook.js # Memory monitoring
│   │   │
│   │   └── utils/                   # Utility functions
│   │       └── ImageUtils.js        # Image processing
│   │
│   ├── src-tauri/                   # Tauri (Rust) backend
│   │   ├── Cargo.toml               # Rust dependencies
│   │   ├── tauri.conf.json          # Tauri configuration
│   │   ├── build.rs                 # Build script
│   │   │
│   │   ├── src/
│   │   │   ├── main.rs              # Tauri main entry
│   │   │   └── lib.rs               # Library code
│   │   │
│   │   ├── capabilities/            # Tauri security scopes
│   │   ├── icons/                   # App icons
│   │   └── gen/                     # Generated files
│   │
│   └── node_modules/                # Installed dependencies
│
└── doc.md                           # This file

Key File Sizes:
- App.js: ~3000 lines (core logic)
- Dashboard.js: ~900 lines (statistics & management)
- Other components: 100-300 lines each
```

---

## Core Components

### 1. App.js - Main Application Component

**Size:** ~3000 lines of code  
**Purpose:** Central hub for all application logic

#### Key State Variables

```javascript
// Image & Annotation Data
const [images, setImages] = useState([]);
const [annotations, setAnnotations] = useState([]);
const [currentImageIndex, setCurrentImageIndex] = useState(0);
const [selectedAnnotation, setSelectedAnnotation] = useState(null);
const [selectedAnnotations, setSelectedAnnotations] = useState([]); // Multiple selection

// Canvas State
const [scale, setScale] = useState(1);
const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
const [crosshairPos, setCrosshairPos] = useState({ x: 0, y: 0 });
const [showCrosshair, setShowCrosshair] = useState(false);

// Dataset Management
const [dataset, setDataset] = useState(null);
const [datasetConfig, setDatasetConfig] = useState(null);
const [classes, setClasses] = useState(['duplex_receptacle']);
const [selectedClass, setSelectedClass] = useState('duplex_receptacle');
const [datasetSplit, setDatasetSplit] = useState('train'); // train, valid, test
const [availableSplits, setAvailableSplits] = useState(['train', 'valid', 'test']);
const [modifiedImages, setModifiedImages] = useState({}); // Changes per split
const [dashboardImages, setDashboardImages] = useState([]); // All splits combined

// UI State
const [tool, setTool] = useState('select'); // select, rectangle, polygon
const [currentView, setCurrentView] = useState('editor'); // editor, dashboard, merge, etc.
const [isDrawing, setIsDrawing] = useState(false);
const [isDragging, setIsDragging] = useState(false);
const [isResizing, setIsResizing] = useState(false);
const [resizeHandle, setResizeHandle] = useState(null); // nw, ne, sw, se

// Loading & Progress
const [loadingProgress, setLoadingProgress] = useState({
  active: false,
  current: 0,
  total: 0,
  stage: '',
  canCancel: false
});
```

#### Key Functions

| Function | Purpose |
|----------|---------|
| `onDrop(acceptedFiles)` | Handle ZIP file upload, validate size, extract, parse YAML |
| `loadDatasetProgressive()` | Load images in 10-image chunks with progress updates |
| `handleMouseDown/Move/Up()` | Canvas interaction: draw, drag, resize annotations |
| `handleImageSelect(index)` | Switch to different image |
| `handleAnnotationSelect()` | Select annotation (single or multiple with Ctrl) |
| `handleAnnotationDelete()` | Remove annotation and update state |
| `handleAnnotationClassChange()` | Update annotation's class ID |
| `updateImageAnnotations()` | Persist annotation changes to modifiedImages |
| `downloadDataset()` | Export dataset as YOLO format ZIP |
| `downloadDatasetCOCO()` | Export dataset as COCO JSON format |
| `openDashboard()` | Load and display statistics view |
| `handleDatasetSplitChange()` | Switch between train/valid/test splits |
| `saveAnnotations()` | Save current annotations to memory |

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Select tool |
| `Ctrl/Cmd + 3` | Rectangle tool |
| `Ctrl/Cmd + P` | Polygon tool |
| `Ctrl/Cmd + D` | Dashboard view |
| `Delete/Backspace` | Delete selected annotation(s) |
| `Mouse Wheel` | Zoom in/out on canvas |

### 2. Dashboard.js - Statistics & Management

**Size:** ~900 lines  
**Purpose:** Display statistics, manage classes, view annotation crops

#### Key Features

- **Statistics Calculation**
  - Total images and annotations
  - Per-class annotation count
  - Percentage distribution
  - Preview thumbnails for each class

- **Class Management**
  - Merge classes (combine annotations into target class)
  - Rename classes
  - Delete classes (remove all annotations)
  - Merge all classes into one

- **Crop Viewer Modal**
  - Extract individual annotations as image crops
  - Paginated display (50 crops per page)
  - Change class of individual crops
  - Remove annotations directly from viewer

#### Key Functions

```javascript
// Calculate per-class statistics
useEffect(() => { /* stats calculation */ }, [images, classes])

// Generate preview thumbnails
useEffect(() => { /* thumbnail generation */ }, [images, classes])

mergeClasses() // Merge source class into target
deleteClass(classId) // Delete all annotations of class
renameClass() // Update class name
mergeAllClasses() // Merge all classes into one
viewClassCrops(classId) // Open crop viewer for class
removeAnnotationAndImageFromFile() // Delete from disk and UI
changeAnnotationClass() // Change class of individual crop
```

### 3. VirtualImageGrid.js - Thumbnail Grid

**Size:** ~100 lines  
**Purpose:** Display images in virtualized scrollable grid

#### Features

- **Virtual Scrolling:** Only renders visible thumbnails (performance)
- **5-Column Layout:** Fixed 5 images per row
- **180x180px Items:** Each thumbnail + metadata
- **Auto-Sizing:** Responsive to container dimensions
- **Click Selection:** Thumbnail click loads image

#### Implementation

```javascript
const VirtualImageGrid = ({ images, onImageClick, selectedIndex }) => {
  const Cell = ({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * COLUMN_COUNT + columnIndex;
    // Render individual thumbnail with image + annotation count
  };
  
  return (
    <AutoSizer>
      {({ height, width }) => (
        <Grid
          columnCount={5}
          columnWidth={180}
          height={height}
          rowCount={Math.ceil(images.length / 5)}
          rowHeight={180}
          width={width}
        >
          {Cell}
        </Grid>
      )}
    </AutoSizer>
  );
};
```

### 4. DatasetMonitor.js - Memory Tracking

**Purpose:** Monitor system memory usage and warn of issues

#### Features

- Real-time memory monitoring (polls every 3 seconds)
- Displays total/used/process memory
- Percentage usage indicator
- Warning threshold (85%)
- Visual indicator for critical memory

### 5. LoadingProgress.js - Upload Progress

**Purpose:** Show progress during dataset upload/processing

#### Features

- Progress bar with percentage
- Current stage label
- Cancel button (when available)
- Image loading indicator

### 6. ImageCropper.js - Crop Extraction

**Purpose:** Extract individual annotations as image crops

**Function:**
```javascript
async function extractCrop(image, annotation, width, height) {
  // Create canvas
  // Draw image subset
  // Return as data URL or blob
}
```

---

## State Management

### Architecture

The application uses **React Hooks** (useState, useEffect, useRef, useCallback) for state management. There's no Redux or Context API - all state is local to App.js and passed down as props.

### State Organization

```
App.js (Parent - holds all state)
├── Images & Annotations State
│   ├── images: Image[]
│   ├── annotations: Annotation[]
│   ├── currentImageIndex: number
│   ├── modifiedImages: { [split]: { [imageKey]: Annotation[] } }
│   └── dashboardImages: Image[]
│
├── Canvas State
│   ├── scale: number
│   ├── stagePos: { x, y }
│   ├── newAnnotation: { x, y, width, height }
│   ├── isDrawing: boolean
│   ├── isDragging: boolean
│   └── isResizing: boolean
│
├── UI State
│   ├── tool: 'select' | 'rectangle' | 'polygon'
│   ├── currentView: 'editor' | 'dashboard' | 'merge' | 'monitor'
│   ├── selectedAnnotation: Annotation
│   ├── selectedAnnotations: Annotation[]
│   └── contextMenu: { visible, x, y, annotation }
│
├── Dataset State
│   ├── dataset: File
│   ├── datasetConfig: DatasetConfig
│   ├── classes: string[]
│   ├── selectedClass: string
│   ├── datasetSplit: 'train' | 'valid' | 'test'
│   └── availableSplits: string[]
│
└── UI Feedback
    ├── loadingProgress: ProgressState
    ├── classPadding: { [classId]: { width, height } }
    └── memoryInfo: MemoryInfo
```

### State Update Patterns

#### Immutable Updates (Always create new objects)

```javascript
// ✓ CORRECT - Create new state object
const updatedAnnotations = [
  ...annotations,
  { id: Date.now(), classId: 0, centerX: 0.5, ... }
];
setAnnotations(updatedAnnotations);

// ✓ CORRECT - Spread operator for updates
const updated = annotations.map(ann => 
  ann.id === targetId ? { ...ann, classId: newId } : ann
);
setAnnotations(updated);

// ✗ WRONG - Mutating state directly
annotations.push(newAnnotation); // Don't do this!
setAnnotations(annotations);
```

#### Image Annotation Synchronization

```javascript
// When updating annotations, also update:
// 1. Component state (annotations)
// 2. Image in images array
// 3. modifiedImages for persistence

const updateImageAnnotations = (imageIndex, updatedAnnotations) => {
  // 1. Update annotations state
  setAnnotations(updatedAnnotations);
  
  // 2. Update image in images array
  const updatedImages = [...images];
  updatedImages[imageIndex] = {
    ...updatedImages[imageIndex],
    annotations: updatedAnnotations
  };
  setImages(updatedImages);
  
  // 3. Persist to modifiedImages
  const updatedModified = { ...modifiedImages };
  const imageSplit = images[imageIndex]?.split || datasetSplit;
  updatedModified[imageSplit] = {
    ...(updatedModified[imageSplit] || {}),
    [`${imageSplit}/${images[imageIndex].name}`]: updatedAnnotations
  };
  setModifiedImages(updatedModified);
};
```

---

## Key Features

### Feature 1: Interactive Annotation Drawing

#### Rectangle Drawing Flow

1. User selects "Rectangle" tool
2. Click and drag on canvas to draw
3. `handleMouseDown()` → saves start position
4. `handleMouseMove()` → draws temporary rectangle (stored in `newAnnotation` state)
5. `handleMouseUp()` → finalizes annotation (creates new Annotation object)

#### Coordinate System

```javascript
// Normalized coordinates (YOLO format)
annotation = {
  classId: 0,
  centerX: 0.5,      // 0-1, center relative to image width
  centerY: 0.5,      // 0-1, center relative to image height
  width: 0.3,        // 0-1, as fraction of image width
  height: 0.2        // 0-1, as fraction of image height
}

// Conversion functions
const normalizedToPixel = (annotation, imageWidth, imageHeight) => ({
  x: annotation.centerX * imageWidth,
  y: annotation.centerY * imageHeight,
  width: annotation.width * imageWidth,
  height: annotation.height * imageHeight
});

const pixelToNormalized = (x, y, width, height, imgW, imgH) => ({
  centerX: x / imgW,
  centerY: y / imgH,
  width: width / imgW,
  height: height / imgH
});
```

### Feature 2: Annotation Editing

#### Move
- Click inside annotation rectangle
- Drag to new position
- Updates `centerX` and `centerY`
- Calls `updateImageAnnotations()` to persist

#### Resize
- Click on corner handles (nw, ne, sw, se)
- Drag to resize
- Recalculates `width`, `height`, `centerX`, `centerY`
- Validates to prevent negative dimensions

#### Change Class
- Select annotation
- Choose new class from dropdown
- Updates `classId` property
- Updates colors on canvas

#### Delete
- Select annotation
- Press Delete key or click delete button
- Removes from `annotations` array
- Calls `updateImageAnnotations()` to persist

### Feature 3: Batch Navigation

#### How It Works

```javascript
// Batch size: 50 images per batch
const batchSize = 50;
const [batchStartIndex, setBatchStartIndex] = useState(0);

// Calculate current batch
const currentBatch = images.slice(batchStartIndex, batchStartIndex + batchSize);
const totalBatches = Math.ceil(images.length / batchSize);
const currentBatchIndex = Math.floor(batchStartIndex / batchSize) + 1;

// Navigation
const goToNextBatch = () => {
  if (batchStartIndex + batchSize < images.length) {
    setBatchStartIndex(batchStartIndex + batchSize);
  }
};

const goToPreviousBatch = () => {
  if (batchStartIndex >= batchSize) {
    setBatchStartIndex(batchStartIndex - batchSize);
  }
};
```

#### Class-Wise Batch

Special mode: only show images containing annotations of selected class

```javascript
const [isClassWiseBatch, setIsClassWiseBatch] = useState(false);
const [classWiseBatchClass, setClassWiseBatchClass] = useState(null);

const displayImages = isClassWiseBatch && classWiseBatchClass !== null
  ? images.filter(img => 
      img.annotations?.some(ann => ann.classId === classWiseBatchClass)
    )
  : images;

const currentBatch = displayImages.slice(batchStartIndex, batchStartIndex + batchSize);
```

### Feature 4: Multi-Split Support

#### Dataset Structure

YOLO datasets have train/valid/test splits:

```
dataset.zip
├── train/
│   ├── images/   (training images)
│   └── labels/   (training annotations)
├── valid/
│   ├── images/   (validation images)
│   └── labels/   (validation annotations)
├── test/
│   ├── images/   (test images)
│   └── labels/   (test annotations)
└── dataset.yaml  (metadata)
```

#### Split Management

```javascript
// All splits available
const [availableSplits, setAvailableSplits] = useState(['train', 'valid', 'test']);

// Current working split
const [datasetSplit, setDatasetSplit] = useState('train');

// Track changes per split
const [modifiedImages, setModifiedImages] = useState({
  train: {},   // { 'train/image.jpg': Annotation[] }
  valid: {},
  test: {}
});

// Switch splits with auto-save
const handleDatasetSplitChange = async (newSplit) => {
  // Save current split's changes
  const imageKey = `${datasetSplit}/${currentImage.name}`;
  modifiedImages[datasetSplit][imageKey] = annotations;
  
  // Load new split
  setDatasetSplit(newSplit);
  loadDatasetForSplit(zipContent, config, newSplit);
};
```

### Feature 5: Export Formats

#### YOLO Format Export

```
exported.zip
├── dataset.yaml
├── train/
│   ├── images/ (...jpg files...)
│   └── labels/ (...txt files...)
├── valid/
│   ├── images/
│   └── labels/
└── test/
    ├── images/
    └── labels/

Each .txt file format:
  <class_id> <center_x> <center_y> <width> <height>
  0 0.5 0.5 0.3 0.2
  1 0.2 0.7 0.1 0.15
```

#### COCO JSON Format Export

```json
{
  "info": {
    "year": 2024,
    "version": "1.0",
    "description": "Exported from Advanced Dataset Editor"
  },
  "licenses": [...],
  "images": [
    { "id": 1, "file_name": "image.jpg", "width": 1920, "height": 1080 }
  ],
  "annotations": [
    {
      "id": 1,
      "image_id": 1,
      "category_id": 0,
      "bbox": [x, y, width, height],  // pixel coordinates, not normalized
      "area": width * height,
      "iscrowd": 0
    }
  ],
  "categories": [
    { "id": 0, "name": "class_name", "supercategory": "object" }
  ]
}
```

---

## Data Flow

### Flow 1: Dataset Upload & Loading

```
User drops ZIP file
           ↓
1. validateFileSize()
   └─ Calls Tauri backend to check available memory
   └─ Returns error if file too large
           ↓
2. JSZip.loadAsync(file)
   └─ Extracts ZIP into memory
   └─ Sets loading stage: "Loading ZIP file..."
           ↓
3. Parse dataset.yaml
   └─ Reads dataset.yaml if present
   └─ Extracts class names → setClasses()
   └─ Extracts folder structure (train/valid/test)
   └─ Sets loading stage: "Reading configuration..."
           ↓
4. Initialize modifiedImages
   └─ Creates empty objects for each split
   └─ Tracks per-image changes
           ↓
5. loadDatasetProgressive(content, config, split)
   └─ Loads images in 10-image chunks
   └─ For each image:
      ├─ Read image data as base64
      ├─ Convert to Blob URL (memory efficient)
      ├─ Parse corresponding label file (.txt)
      ├─ Create Annotation objects
      └─ Return Image object
   └─ Updates loading progress after each chunk
   └─ Yields to event loop every chunk (await setTimeout)
           ↓
6. setImages(allLoadedImages)
   └─ Updates state with all loaded images
   └─ Sets currentImageIndex to 0
           ↓
7. Display in VirtualImageGrid
   └─ Thumbnails appear in 5-column grid
   └─ User can click to select image
```

### Flow 2: Image Annotation

```
User clicks on canvas image
           ↓
Canvas onClick handler triggered
           ↓
Select Tool Mode:
  ├─ Check if click is on existing annotation
  ├─ If yes: handleAnnotationSelect() → highlight it
  └─ If no: deselect current annotation
           ↓
Rectangle Tool Mode:
  ├─ handleMouseDown()
  │  └─ Save starting position to dragStartPos
  │
  ├─ handleMouseMove() (repeated)
  │  ├─ Calculate current mouse position
  │  ├─ Draw temporary rectangle (newAnnotation state)
  │  └─ Canvas re-renders on each move
  │
  └─ handleMouseUp()
     ├─ Calculate final dimensions
     ├─ Convert pixel coords to normalized coords
     ├─ Create Annotation object with new ID
     ├─ Add to annotations array
     └─ Call updateImageAnnotations()
                ↓
updateImageAnnotations():
  ├─ Update annotations state
  ├─ Update image in images array
  └─ Update modifiedImages[split][imageKey]
                ↓
Component re-renders
  └─ Konva canvas redraws annotation rectangle
```

### Flow 3: Annotation Editing

```
User selects annotation (click on it)
           ↓
handleAnnotationSelect(annotation)
  ├─ setSelectedAnnotation(annotation)
  ├─ setEditingAnnotation({...annotation}) // copy for editing
  └─ Display in Inspector panel
           ↓
User drags annotation body (move mode)
           ↓
handleMouseDown() detects click inside annotation
  ├─ setIsDragging(true)
  └─ Save startPos and original annotation state
           ↓
handleMouseMove() (repeated during drag)
  ├─ Calculate dx, dy (change in position)
  ├─ Calculate new center: centerX += dx / imageWidth
  ├─ Update selectedAnnotation state
  ├─ Call updateImageAnnotations()
  └─ Canvas redraws annotation at new position
           ↓
handleMouseUp()
  ├─ setIsDragging(false)
  └─ Changes are already persisted in updateImageAnnotations()
           ↓
OR User drags corner handle (resize mode)
           ↓
handleMouseDown() detects click on resize handle
  ├─ setIsResizing(true)
  ├─ setResizeHandle('nw'|'ne'|'sw'|'se')
  └─ Save reference annotation
           ↓
handleMouseMove() (repeated during resize)
  ├─ Calculate new dimensions based on which handle
  ├─ Update width, height, centerX, centerY
  ├─ Call updateImageAnnotations()
  └─ Canvas redraws resized annotation
           ↓
handleMouseUp()
  └─ setIsResizing(false)
```

### Flow 4: Dataset Export

```
User clicks "Download Dataset" button
           ↓
downloadDataset() function starts
           ↓
For each split (train, valid, test):
  ├─ Get images for this split
  ├─ Create split folder structure in ZIP
  └─ For each image:
     ├─ Get annotation changes from modifiedImages
     ├─ Convert normalized coords to YOLO format
     ├─ Write image file to ZIP
     ├─ Write label file (.txt) to ZIP
     └─ Continue progress
           ↓
Add dataset.yaml to ZIP
  └─ Update class names (if user added/removed classes)
  └─ Update dataset structure metadata
           ↓
Generate ZIP blob
           ↓
Create download link
  ├─ URL.createObjectURL(blob)
  ├─ Simulate click on <a> tag
  └─ Browser downloads file
           ↓
Cleanup
  └─ URL.revokeObjectURL(url)
```

---

## User Workflows

### Workflow 1: Upload and Annotate

**Scenario:** User has 100 YOLO images, wants to add more annotations

```
1. Open application
2. Click "Upload Dataset" or drag-drop ZIP file
3. Wait for loading to complete (progress bar shows stages)
4. See images in grid
5. Click first image to open in canvas
6. Select "Rectangle" tool
7. Draw annotation by clicking and dragging
8. Select class from dropdown
9. Click next image (button or keyboard)
10. Repeat annotation process
11. When done, click "Download Dataset"
12. Save ZIP file locally
```

### Workflow 2: Merge Classes

**Scenario:** User has "person_front" and "person_back" but wants single "person" class

```
1. Open Dashboard view
2. In "Merge Classes" section:
   - Source: "person_front"
   - Target: "person"
   - Click "Merge Classes"
3. All "person_front" annotations become "person"
4. Class list updated
5. Return to editor to verify
6. Export dataset
```

### Workflow 3: Review Class Distribution

**Scenario:** User wants to see annotation statistics

```
1. Open Dashboard view
2. See statistics cards:
   - Total Images: 100
   - Total Annotations: 250
   - Classes: 5
   - Avg per image: 2.5
3. See per-class breakdown:
   - person: 120 annotations (48%)
   - car: 80 (32%)
   - dog: 50 (20%)
4. View thumbnail sample for each class
5. Click "View All (120)" to see all person crops
```

### Workflow 4: Switch Dataset Splits

**Scenario:** User wants to work on validation split

```
1. Initially working on "train" split
2. Use dropdown to select "valid"
3. Application saves train changes
4. Loads valid split images
5. Image grid updates with validation thumbnails
6. User can annotate validation images
7. Switch back to "train" - changes preserved
```

---

## API Documentation

### Canvas Functions

#### Drawing

```javascript
handleMouseDown(e)
// Triggered when user presses mouse button on canvas
// - If Select tool: check if clicking on annotation
// - If Rectangle tool: start drawing new annotation
// - If Middle button: start panning

handleMouseMove(e)
// Triggered when user moves mouse over canvas
// - Update crosshair position
// - If drawing: update newAnnotation dimensions
// - If dragging: update annotation position
// - If resizing: update annotation dimensions
// - If panning: update stage position

handleMouseUp(e)
// Triggered when user releases mouse button
// - If drawing: finalize new annotation
// - If dragging: complete position update
// - If resizing: complete dimension update
// - Clean up temporary state
```

#### Zoom & Pan

```javascript
handleZoom(e)
// Mouse wheel zoom
// Parameters: e.evt.deltaY (positive = scroll down = zoom out)
// Updates: scale, stagePos

handleStageMouseEnter()
// Show crosshair when hovering over canvas

handleStageMouseLeave()
// Hide crosshair when leaving canvas
```

### State Modification Functions

```javascript
updateImageAnnotations(imageIndex, updatedAnnotations)
// Update annotations for an image
// Persists to:
//   1. annotations state (current display)
//   2. images[imageIndex].annotations
//   3. modifiedImages[split][imageKey]

handleAnnotationSelect(annotation, event)
// Select annotation for editing
// With Ctrl: toggle in multi-selection
// Without Ctrl: single selection

handleAnnotationDelete(annotationId)
// Remove annotation
// Calls updateImageAnnotations() to persist

handleAnnotationClassChange(annotationId, newClassId)
// Update annotation's class
// Calls updateImageAnnotations() to persist

handleAnnotationSizeChange(annotationId, newWidth, newHeight)
// Update annotation dimensions
// Calls updateImageAnnotations() to persist
```

### Dataset Functions

```javascript
async onDrop(acceptedFiles)
// Handle ZIP file drop/upload
// Validates, extracts, parses config, loads images

async loadDatasetProgressive(content, config, split, initialModifiedImages)
// Load images in chunks
// content: JSZip object
// config: parsed dataset.yaml
// split: 'train', 'valid', or 'test'
// Yields after each chunk for responsive UI

async loadDatasetForSplit(content, config, split)
// Load single split entirely

async loadDatasetAllSplits(content, config, splits)
// Load all specified splits into combined image array

async downloadDataset()
// Export as YOLO format ZIP

async downloadDatasetCOCO()
// Export as COCO JSON format

async openDashboard()
// Load and display dashboard view

handleDatasetSplitChange(newSplit)
// Switch between train/valid/test
// Auto-saves current split changes
```

### Utility Functions

```javascript
parseAnnotations(content: string): Annotation[]
// Parse .txt label file into Annotation objects
// Input: "0 0.5 0.5 0.3 0.2\n1 0.2 0.7..."
// Output: [{ classId: 0, centerX: 0.5, ... }, ...]

normalizedToPixel(annotation, imageWidth, imageHeight): PixelCoords
// Convert normalized YOLO coords to pixel coords

pixelToNormalized(x, y, width, height, imgW, imgH): NormalizedCoords
// Convert pixel coords to normalized YOLO coords

getClassColor(classId): string
// Return color for annotation display
// Colors cycle through palette based on classId

getImagesWithClass(classId): Image[]
// Filter images containing annotations of given class
// Used for class-wise batch mode
```

---

## Performance Optimizations

### 1. Virtual Scrolling

**What:** Only render visible thumbnail items in grid

**Why:** Large datasets (1000+ images) would be slow if rendering all thumbnails

**How:** `react-window` Grid component

```javascript
<AutoSizer>
  {({ height, width }) => (
    <Grid
      columnCount={COLUMN_COUNT}
      columnWidth={ITEM_SIZE}
      height={height}  // Only render what fits
      rowCount={rowCount}
      rowHeight={ITEM_SIZE}
      width={width}
    >
      {Cell}  // Cell only rendered when visible
    </Grid>
  )}
</AutoSizer>
```

**Impact:** Can handle 10,000+ images without performance issues

### 2. Progressive Image Loading

**What:** Load images in chunks (10 at a time) instead of all at once

**Why:** Large datasets would freeze UI if loading all images synchronously

**How:**

```javascript
for (let i = 0; i < imageList.length; i += chunkSize) {
  const chunk = imageList.slice(i, i + chunkSize);
  
  const chunkImages = await Promise.all(
    chunk.map(imageFile => processImage(imageFile))
  );
  
  setImages(prev => [...prev, ...chunkImages]);
  
  // Yield to event loop for UI updates
  await new Promise(resolve => setTimeout(resolve, 0));
}
```

**Impact:** 1000-image dataset loads in seconds with progress feedback

### 3. Blob URLs Instead of Base64

**What:** Use `blob:` URLs instead of embedding full base64 data

**Why:** Base64 data URLs are 33% larger and stored in memory

**How:**

```javascript
// ✓ GOOD
const imageData = await imageFile.async("base64");
const blobUrl = base64ToBlob(`data:image/jpeg;base64,${imageData}`);
// Store blobUrl, not the base64 string

// ✗ BAD
src={`data:image/jpeg;base64,${largeBase64String}`}
// Massive string in DOM, duplicated in memory
```

**Impact:** 30-40% memory savings for large image sets

### 4. Memory Monitoring

**What:** Track memory usage and warn before crashes

**How:**

```javascript
const checkMemory = async () => {
  const [total, used, process] = await invoke([
    'get_system_memory',
    'get_memory_usage',
    'get_process_memory'
  ]);
  
  const percentage = (used / total) * 100;
  if (percentage > 85) {
    // Show warning to user
    console.warn('High memory usage:', percentage);
  }
};

// Check every 3 seconds
useEffect(() => {
  const interval = setInterval(checkMemory, 3000);
  return () => clearInterval(interval);
}, []);
```

**Impact:** Prevents OOM crashes, guides users to export/restart

### 5. Lazy Image Loading

**What:** Images load with `loading="lazy"` attribute

**Why:** Thumbnails below viewport don't load until scrolled into view

```html
<img 
  src={image.src}
  alt={image.name}
  loading="lazy"  <!-- ← Native lazy loading -->
/>
```

**Impact:** Faster initial render, reduced memory per batch

### 6. Canvas Optimization (Konva.js)

**What:** Canvas is rendered by Konva, not React

**Why:** React rendering overhead for many rectangles would be severe

**How:**

```javascript
// Konva handles rendering, React updates state
<Stage ref={stageRef} width={stageSize.width} height={stageSize.height}>
  <Layer>
    <Image image={imageRef} />
    {annotations.map(ann => (
      <Rect
        key={ann.id}
        x={pixelCoords.x - pixelCoords.width / 2}
        y={pixelCoords.y - pixelCoords.height / 2}
        // ... more props
      />
    ))}
  </Layer>
</Stage>
```

**Impact:** Smooth interaction even with 100+ annotations per image

### 7. Event Debouncing

**What:** Skip intermediate states during rapid events

**Why:** Mouse move fires 60+ times per second, don't recalculate all on each

**How:**

```javascript
// Already optimized by React batching
handleMouseMove = (e) => {
  // This updates state, React batches multiple calls per frame
  setCrosshairPos({ x, y });
  setNewAnnotation({ ...newAnnotation, width, height });
}
```

---

## Troubleshooting

### Issue: "Cannot read properties of undefined"

**Symptom:** Error when uploading dataset

**Common Causes:**
1. `config` is null (no dataset.yaml in ZIP)
2. `images` array is empty
3. `currentImage` is undefined

**Solution:**
```javascript
// Always guard against undefined
const trainPath = (config && config.train) || 'train/images';
if (!images || images.length === 0) return;
if (!currentImage) return;
```

### Issue: React-Window "Cannot convert undefined or null to object"

**Symptom:** Error in VirtualImageGrid when loading

**Cause:** `height` or `width` from AutoSizer is undefined

**Solution:**
```javascript
<AutoSizer>
  {({ height, width }) => {
    if (!height || !width) return null;  // ← Guard clause
    return <Grid ... />;
  }}
</AutoSizer>
```

### Issue: Large Dataset Freezes UI

**Symptom:** Application becomes unresponsive during loading

**Cause:** Loading all images synchronously

**Solution:** Already implemented - `loadDatasetProgressive()` loads in chunks

### Issue: Memory Usage Growing

**Symptom:** App gets slower, eventually crashes

**Common Causes:**
1. Blob URLs not cleaned up
2. Large base64 strings in state
3. Many open modals/copies

**Solution:**
```javascript
// Cleanup on unmount
useEffect(() => {
  return () => {
    blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  };
}, []);
```

### Issue: Annotations Not Saving

**Symptom:** Changes disappear when switching images/splits

**Cause:** Not calling `updateImageAnnotations()`

**Solution:** All mutation functions should call:
```javascript
const updateImageAnnotations = (imageIndex, updatedAnnotations) => {
  setAnnotations(updatedAnnotations);
  updateImagesArray(imageIndex, updatedAnnotations);
  updateModifiedImages(imageIndex, updatedAnnotations);
};
```

### Issue: Exported ZIP Has Missing Images/Labels

**Symptom:** Downloaded ZIP incomplete

**Cause:** Not iterating through all splits or images

**Solution:**
```javascript
// Export must process all splits
for (const split of availableSplits) {
  // Get images for this split
  // Get annotations from modifiedImages[split]
  // Add all to ZIP
}
```

---

## Development Tips

### Running in Development Mode

```bash
# Terminal 1: Start Webpack dev server (for fast reload)
npm start

# Terminal 2: Start Tauri dev window
npm run tauri:dev
```

### Debug Console

In Tauri dev window: `Ctrl+Shift+I` or right-click → Inspect

### Adding Features

1. **New Component:** Create in `src/components/`, import in App.js
2. **New State:** Add useState in App.js, pass down as props
3. **New Tool:** Add case to tool selection, implement mouse handlers
4. **New View:** Add condition in render, set via `currentView` state

### Performance Debugging

```javascript
// Add to App.js
useEffect(() => {
  console.time('App render');
  return () => console.timeEnd('App render');
}, []);

// Track state size
useEffect(() => {
  const size = new Blob([JSON.stringify(images)]).size;
  console.log('Images state size:', (size / 1024).toFixed(2) + ' KB');
}, [images]);
```

---

## Summary

The Advanced Dataset Editor is a comprehensive tool for YOLO dataset annotation with:

- **Interactive UI** for intuitive annotation creation and editing
- **Performance-optimized** for large datasets (1000+ images)
- **Multi-split support** for train/valid/test workflows
- **Flexible export** to YOLO or COCO formats
- **Real-time feedback** with progress tracking and memory monitoring
- **Desktop integration** via Tauri for native OS access

The architecture uses React for UI state management, Konva.js for interactive canvas drawing, JSZip for dataset I/O, and Tauri for desktop integration. The application is modular, maintainable, and ready for production use.

---

**Last Updated:** November 20, 2025  
**Version:** 1.0.0  
**License:** MIT


