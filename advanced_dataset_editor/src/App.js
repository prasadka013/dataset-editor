import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Image as KonvaImage } from 'react-konva';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import yaml from 'js-yaml';
import MergeDatasets from './components/MergeDatasets.js';
import Dashboard from './components/Dashboard.js';
import DatasetMonitor from './components/DatasetMonitor.js';
import ContextMenu from './components/ContextMenu';
// import TestingSection from './TestingSection';
import './styles/styles.css';
import ImageCropper from './components/ImageCropper.js';
import { invoke } from "@tauri-apps/api/tauri";
import LoadingProgress from './components/LoadingProgress';
import VirtualImageGrid from './components/VirtualImageGrid';
import { useMemoryMonitor, validateFileSize, formatBytes } from './hooks/MemoryMonitorHook.js';
import { fileToBlob, cleanupBlobUrls, base64ToBlob } from './utils/imageUtils';
import { imageCache, thumbnailCache } from './utils/ImageCache';

const App = () => {
  // State management
  const [dataset, setDataset] = useState(null);
  const [datasetConfig, setDatasetConfig] = useState(null); // Store original dataset config
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [preloadedImage, setPreloadedImage] = useState(null); // Cache preloaded image
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [classes, setClasses] = useState(['duplex_receptacle']);
  const [selectedClass, setSelectedClass] = useState('duplex_receptacle');
  const [tool, setTool] = useState('select'); // select, rectangle, polygon
  const [isDrawing, setIsDrawing] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [newAnnotation, setNewAnnotation] = useState(null); // For interactive drawing
  const [batchStartIndex, setBatchStartIndex] = useState(0); // For batch navigation
  const [batchSize] = useState(50); // Show 50 images per batch
  const [editingAnnotation, setEditingAnnotation] = useState(null); // For annotation editing
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null); // For hover tooltip
  const [crosshairPos, setCrosshairPos] = useState({ x: 0, y: 0 });
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [currentView, setCurrentView] = useState('editor'); // 'editor', 'dashboard', 'merge', 'monitor', or 'testing'

  // State for global padding settings
  const [classPadding, setClassPadding] = useState({}); // { classId: { width: 0.1, height: 0.1 } }

  // Store modified images for each split to preserve changes
  const [modifiedImages, setModifiedImages] = useState({});

  // Aggregated images across all splits for dashboard view
  const [dashboardImages, setDashboardImages] = useState([]);

  // State for dataset split selection
  const [datasetSplit, setDatasetSplit] = useState('train'); // train, valid, test
  const [availableSplits, setAvailableSplits] = useState(['train', 'valid', 'test']); // Always include all splits by default

  // State for new class input
  const [newClassName, setNewClassName] = useState('');

  // State for rectangle dragging
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragStartAnnotation, setDragStartAnnotation] = useState(null);

  const [isClassWiseBatch, setIsClassWiseBatch] = useState(false);
  const [classWiseBatchClass, setClassWiseBatchClass] = useState(null);



  // State for resizing
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null); // 'nw', 'ne', 'sw', 'se'

  // State for multiple selection
  const [selectedAnnotations, setSelectedAnnotations] = useState([]); // Array of selected annotation IDs

  // State for context menu
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    annotation: null
  });

  // Add these to your existing useState declarations
  const [loadingProgress, setLoadingProgress] = useState({
    active: false,
    current: 0,
    total: 0,
    stage: '',
    canCancel: false
  });

  const [loadingCancelled, setLoadingCancelled] = useState(false);
  const { memoryInfo, checkMemory } = useMemoryMonitor(3000);
  const blobUrlsRef = useRef([]);
  useEffect(() => {
    return () => {
      cleanupBlobUrls(blobUrlsRef.current);
    };
  }, []);

  // Refs
  const stageRef = useRef();
  const imageRef = useRef();
  const drawingRectRef = useRef();
  const fileInputRef = useRef();

  // Current image data
  const currentImage = images[currentImageIndex];

  // Keyboard shortcuts for tools and views
  useEffect(() => {
    const onKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey; // support Cmd on Mac
      if (!mod) return;

      const key = (e.key || '').toLowerCase();

      // Prevent default browser actions for mapped shortcuts (e.g. Ctrl+S)
      if (['s', '3', 'p', 'd'].includes(key)) e.preventDefault();

      switch (key) {
        case 's': // Ctrl/Cmd+S -> select tool
          setTool('select');
          setCurrentView('editor');
          break;
        case '3': // Ctrl/Cmd+R -> rectangle tool
          setTool('rectangle');
          setCurrentView('editor');
          break;
        case 'p': // Ctrl/Cmd+P -> polygon tool
          setTool('polygon');
          setCurrentView('editor');
          break;
        case 'd': // Ctrl/Cmd+D -> dashboard view
          setCurrentView('dashboard');
          break;
        // add more mappings here as needed
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setTool, setCurrentView]);

  // Add keyboard shortcut for Delete/Backspace to remove selected annotations
  useEffect(() => {
    const onKeyDown = (e) => {
      // don't trigger when typing in inputs or editable elements
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedAnnotations.length > 0) {
          handleMultipleAnnotationDelete();
        } else if (selectedAnnotation) {
          handleAnnotationDelete(selectedAnnotation.id);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedAnnotations, selectedAnnotation, handleMultipleAnnotationDelete, handleAnnotationDelete]);

  // Preload current image to ensure it loads before rendering
  useEffect(() => {
    if (currentImage && currentImage.src) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';

      const handleLoad = () => {
        setPreloadedImage(img);
      };

      const handleError = () => {
        console.error('Failed to load image:', currentImage.src);
        setPreloadedImage(null);
      };

      img.onload = handleLoad;
      img.onerror = handleError;
      img.src = currentImage.src;
    }
  }, [currentImage?.src]);


  // ============================================
  // OPTIMIZATION: Preload adjacent images for smooth navigation
  // ============================================
  useEffect(() => {
    const preloadAdjacentImages = async () => {
      if (!images || images.length === 0) return;

      // Preload next 2 and previous 2 images
      const indicesToPreload = [
        currentImageIndex - 2,
        currentImageIndex - 1,
        currentImageIndex + 1,
        currentImageIndex + 2
      ].filter(idx => idx >= 0 && idx < images.length);

      for (const idx of indicesToPreload) {
        const image = images[idx];

        // If image has a diskPath but no src, load it
        if (image && image.diskPath && !image.src) {
          console.log(`🔄 Preloading image ${idx + 1}/${images.length}`);
          await loadImageFromDisk(image.diskPath);
        }
      }
    };

    preloadAdjacentImages();
  }, [currentImageIndex, images]);

  // Function to get a consistent color for each class
  const getClassColor = (classId) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFBE0B', '#FB5607',
      '#8338EC', '#3A86FF', '#06D6A0', '#118AB2', '#073B4C',
      '#EF476F', '#FFD166', '#073B4C', '#118AB2', '#06D6A0'
    ];
    return colors[classId % colors.length];
  };

  // Function to get images that contain annotations of a specific class
  const getImagesWithClass = (classId) => {
    return images.filter(image =>
      image.annotations && image.annotations.some(annotation => annotation.classId === classId)
    );
  };

  const loadImageFromDisk = async (imagePath) => {
    try {
      console.log('🔄 Loading image from disk:', imagePath);

      // Check cache first
      if (imageCache.has(imagePath)) {
        console.log('✅ Image found in cache!');
        return imageCache.get(imagePath);
      }

      // Load from disk using Tauri
      const dataUrl = await invoke('get_image_as_data_url', {
        imagePath: imagePath
      });

      console.log('✅ Successfully loaded image from disk!');

      // Add to cache
      imageCache.set(imagePath, dataUrl);

      // Log cache stats
      console.log('📊 Cache stats:', imageCache.getStats());

      return dataUrl;
    } catch (error) {
      console.error('❌ Error loading image from disk:', error);
      return null;
    }
  };

  // Calculate current batch with class filtering
  const displayImages = isClassWiseBatch && classWiseBatchClass !== null
    ? getImagesWithClass(classWiseBatchClass)
    : (images || []);

  const currentBatch = displayImages.slice(batchStartIndex, batchStartIndex + batchSize);
  const totalBatches = Math.ceil(displayImages.length / batchSize);
  const currentBatchIndex = Math.floor(batchStartIndex / batchSize) + 1;


  // const displayImages = getDisplayImages();
  // const currentBatch = displayImages.slice(batchStartIndex, batchStartIndex + batchSize);
  // const totalBatches = Math.ceil(displayImages.length / batchSize);
  // const currentBatchIndex = Math.floor(batchStartIndex / batchSize) + 1;

  // Handle file upload
  const onDrop = async (acceptedFiles) => {
    try {
      // Check if we're adding individual images to an existing dataset
      if (dataset && acceptedFiles.length > 0 && !acceptedFiles[0].name.endsWith('.zip')) {
        // Handle individual image uploads
        await handleIndividualImageUpload(acceptedFiles);
        return;
      }

      // If no dataset is loaded and we have a ZIP file, load the dataset
      if (!dataset && acceptedFiles.length > 0 && acceptedFiles[0].name.endsWith('.zip')) {
        const file = acceptedFiles[0];
        if (!file.name.endsWith('.zip')) {
          alert("Invalid file type. Please select a ZIP file containing your dataset.");
          return;
        }

        const zip = new JSZip();
        const content = await zip.loadAsync(file);

        // Check if the ZIP file is valid and contains files
        const fileCount = Object.keys(content.files).length;
        if (fileCount === 0) {
          alert("The selected ZIP file is empty. Please select a valid dataset ZIP file.");
          return;
        }

        // Extract dataset.yaml
        const configFile = content.file("dataset.yaml");
        let config = null;
        if (configFile) {
          try {
            const configText = await configFile.async("text");
            config = yaml.load(configText);
            setDatasetConfig(config); // Store original config
            setClasses(config.names || ['unknown']);
            setSelectedClass(config.names?.[0] || 'unknown');

            // Determine available splits from config
            const splits = [];
            if (config.train) splits.push('train');
            if (config.val) splits.push('valid');
            if (config.test) splits.push('test');

            // If no splits found in config, add default ones
            if (splits.length === 0) {
              splits.push('train');
              if (content.folder("valid") || content.folder("val")) splits.push('valid');
              if (content.folder("test")) splits.push('test');
            }

            setAvailableSplits(splits);
          } catch (yamlError) {
            console.error("Error parsing dataset.yaml:", yamlError);
            alert("Error parsing dataset.yaml. Using default configuration.");
            setAvailableSplits(['train', 'valid']);
          }
        } else {
          console.warn("No dataset.yaml found in the ZIP file. Using default configuration.");
          alert("No dataset.yaml found in the ZIP file. Using default configuration.");
          setAvailableSplits(['train', 'valid']);
        }

        // Initialize modifiedImages with empty objects for each split
        const initialModifiedImages = {};
        // Use detected splits if available, otherwise default
        const effectiveSplits = (config && (config.train || config.val || config.test))
          ? [
            config.train ? 'train' : null,
            config.val ? 'valid' : null,
            config.test ? 'test' : null
          ].filter(Boolean)
          : ['train', 'valid', 'test'];

        effectiveSplits.forEach(split => {
          initialModifiedImages[split] = {};
        });
        setModifiedImages(initialModifiedImages);

        // Load all splits into a single combined images list for the editor view
        await loadDatasetAllSplits(content, config, effectiveSplits, initialModifiedImages);

        setDataset(file);
        return;
      }

      // If we have a dataset loaded and we're uploading a ZIP file, treat it as a new dataset
      if (dataset && acceptedFiles.length > 0 && acceptedFiles[0].name.endsWith('.zip')) {
        const file = acceptedFiles[0];
        const zip = new JSZip();
        const content = await zip.loadAsync(file);

        // Extract dataset.yaml
        const configFile = content.file("dataset.yaml");
        let config = null;
        if (configFile) {
          try {
            const configText = await configFile.async("text");
            config = yaml.load(configText);
            setDatasetConfig(config); // Store original config
            setClasses(config.names || ['unknown']);
            setSelectedClass(config.names?.[0] || 'unknown');

            // Determine available splits from config
            const splits = [];
            if (config.train) splits.push('train');
            if (config.val) splits.push('valid');
            if (config.test) splits.push('test');

            // If no splits found in config, add default ones
            if (splits.length === 0) {
              splits.push('train');
              if (content.folder("valid") || content.folder("val")) splits.push('valid');
              if (content.folder("test")) splits.push('test');
            }

            setAvailableSplits(splits);
          } catch (yamlError) {
            console.error("Error parsing dataset.yaml:", yamlError);
            alert("Error parsing dataset.yaml. Using default configuration.");
            setAvailableSplits(['train', 'valid']);
          }
        }

        // Initialize modifiedImages with empty objects for each split
        const initialModifiedImages = {};
        const splits = availableSplits.length > 0 ? availableSplits : ['train', 'valid'];
        splits.forEach(split => {
          initialModifiedImages[split] = {};
        });
        setModifiedImages(initialModifiedImages);

        loadDatasetForSplit(content, config, datasetSplit, initialModifiedImages);

        setDataset(file);
        return;
      }

      // Handle individual image uploads when no dataset is loaded
      if (!dataset && acceptedFiles.length > 0) {
        await handleIndividualImageUpload(acceptedFiles);
        return;
      }
    } catch (error) {
      console.error("Error loading dataset:", error);
      alert("Error loading dataset. Please make sure it's a valid ZIP file with the correct structure.\nError: " + error.message);
    }
  };

  const loadDatasetProgressive = async (content, config, split, initialModifiedImages) => {
    try {
      setLoadingCancelled(false);
      let imageFolder, labelFolder;

      // Determine folders based on split with proper fallback
      if (split === 'train') {
        const trainImagePath = (config && config.train) || "train/images";
        const trainBasePath = trainImagePath.replace('/images', '');
        imageFolder = content.folder(trainBasePath) || content.folder("train") || content.folder("images");
        labelFolder = content.folder(`${trainBasePath}/labels`) || content.folder("train/labels") || content.folder("labels");
      } else if (split === 'valid') {
        const valImagePath = (config && config.val) || "valid/images";
        const valBasePath = valImagePath.replace('/images', '');
        imageFolder = content.folder(valBasePath) || content.folder("valid") || content.folder("images");
        labelFolder = content.folder(`${valBasePath}/labels`) || content.folder("valid/labels") || content.folder("labels");
      } else if (split === 'test') {
        const testImagePath = (config && config.test) || "test/images";
        const testBasePath = testImagePath.replace('/images', '');
        imageFolder = content.folder(testBasePath) || content.folder("test") || content.folder("images");
        labelFolder = content.folder(`${testBasePath}/labels`) || content.folder("test/labels") || content.folder("labels");
      }

      if (!imageFolder) {
        throw new Error(`Could not find image folder for split: ${split}`);
      }

      const imageList = imageFolder.file(/.*\.(jpg|jpeg|png)$/i);
      const total = imageList.length;
      const chunkSize = 500;
      const extractedImages = [];

      setLoadingProgress({
        active: true,
        current: 0,
        total,
        stage: `Loading ${split} images...`,
        canCancel: true
      });

      for (let i = 0; i < imageList.length; i += chunkSize) {
        if (loadingCancelled) {
          throw new Error('Loading cancelled by user');
        }

        const chunk = imageList.slice(i, Math.min(i + chunkSize, imageList.length));

        const chunkImages = await Promise.all(chunk.map(async (imageFile, idx) => {
          const imageName = imageFile.name.split("/").pop();
          const imageKey = `${split}/${imageName}`;

          let imageAnnotations = [];

          if (initialModifiedImages[split]?.[imageKey]) {
            imageAnnotations = initialModifiedImages[split][imageKey];
          } else {
            const labelFileName = imageName.replace(/\.[^/.]+$/, ".txt");
            const labelFile = labelFolder?.file(labelFileName);

            if (labelFile) {
              const labelContent = await labelFile.async("text");
              imageAnnotations = parseAnnotations(labelContent);
            }
          }

          // Use Blob URLs instead of base64
          const imageData = await imageFile.async("base64");
          const blobUrl = base64ToBlob(`data:image/jpeg;base64,${imageData}`);
          blobUrlsRef.current.push(blobUrl);

          return {
            id: i + idx,
            name: imageName,
            src: blobUrl,
            annotations: imageAnnotations,
            split: split
          };
        }));

        extractedImages.push(...chunkImages);

        setLoadingProgress(prev => ({
          ...prev,
          current: extractedImages.length
        }));

        setImages(prev => [...prev, ...chunkImages]);

        await new Promise(resolve => setTimeout(resolve, 0));
        await checkMemory();
      }

      if (extractedImages.length > 0) {
        setAnnotations(extractedImages[0].annotations);
        setCurrentImageIndex(0);
      }

      setLoadingProgress({ active: false, current: 0, total: 0, stage: '', canCancel: false });

    } catch (error) {
      console.error("Error loading dataset:", error);
      setLoadingProgress({ active: false, current: 0, total: 0, stage: '', canCancel: false });
      throw error;
    }
  };

  // Handle individual image uploads to current split
  const handleIndividualImageUpload = async (imageFiles) => {
    try {
      const validImageFiles = imageFiles.filter(file =>
        file.type.startsWith('image/') ||
        /\.(jpg|jpeg|png|gif)$/i.test(file.name)
      );

      if (validImageFiles.length === 0) {
        alert("No valid image files were selected.");
        return;
      }

      // Process each image file
      const newImages = [];
      for (const file of validImageFiles) {
        const reader = new FileReader();
        const imageData = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(file);
        });

        newImages.push({
          id: images.length + newImages.length,
          name: file.name,
          src: imageData,
          annotations: []
        });
      }

      // Add new images to the current split
      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);

      // If no dataset was previously loaded, create a basic one
      if (!dataset) {
        // Create a simple dataset object
        const dummyDataset = {
          name: "Manual Dataset",
          size: updatedImages.length
        };
        setDataset(dummyDataset);
      }

      alert(`Successfully added ${validImageFiles.length} images to the ${datasetSplit} split!`);
    } catch (error) {
      console.error("Error adding images:", error);
      alert("Error adding images. Please try again.");
    }
  };

  // Load dataset for a specific split
  const loadDatasetForSplit = async (content, config, split, currentModifiedImages = modifiedImages) => {
    try {
      // Clean up old blob URLs and reset the array
      cleanupBlobUrls(blobUrlsRef.current);
      blobUrlsRef.current = [];

      // Extract images and annotations based on selected split
      const extractedImages = [];

      // Determine folder paths based on selected split with proper fallback
      let imageFolder, labelFolder;
      if (split === 'train') {
        // For train, we need to handle the path correctly
        const trainImagePath = (config && config.train) || "train/images";
        const trainBasePath = trainImagePath.replace('/images', '');
        imageFolder = content.folder(trainBasePath) || content.folder("train") || content.folder("images");
        labelFolder = content.folder(trainBasePath ? `${trainBasePath}/labels` : "train/labels") || content.folder("train/labels") || content.folder("labels");
      } else if (split === 'valid') {
        // For valid, we need to handle the path correctly
        const valImagePath = (config && config.val) || "valid/images";
        const valBasePath = valImagePath.replace('/images', '');
        imageFolder = content.folder(valBasePath) || content.folder("valid") || content.folder("images");
        labelFolder = content.folder(valBasePath ? `${valBasePath}/labels` : "valid/labels") || content.folder("valid/labels") || content.folder("labels");
      } else if (split === 'test') {
        // For test, we need to handle the path correctly
        const testImagePath = (config && config.test) || "test/images";
        const testBasePath = testImagePath.replace('/images', '');
        imageFolder = content.folder(testBasePath) || content.folder("test") || content.folder("images");
        labelFolder = content.folder(testBasePath ? `${testBasePath}/labels` : "test/labels") || content.folder("test/labels") || content.folder("labels");
      } else {
        // Default to train if split not found
        imageFolder = content.folder("train") || content.folder("images");
        labelFolder = content.folder("train/labels") || content.folder("labels");
      }

      // If we couldn't find the specific folder, try to find any image folder
      if (!imageFolder) {
        // Try to find any folder with images
        const folders = Object.keys(content.files).filter(key => key.includes('/') && !key.includes('.')).map(key => key.split('/')[0]);
        const uniqueFolders = [...new Set(folders)];

        for (const folder of uniqueFolders) {
          const folderContent = content.folder(folder);
          if (folderContent && folderContent.file(/.*\.(jpg|jpeg|png)$/i).length > 0) {
            imageFolder = folderContent;
            break;
          }
        }

        // If still no image folder, try root level images
        if (!imageFolder) {
          imageFolder = content;
        }

        // Set label folder to the same base or labels folder
        labelFolder = content.folder("labels") || content;
      }

      if (imageFolder) {
        const imageList = imageFolder.file(/.*\.(jpg|jpeg|png)$/i);

        for (let i = 0; i < imageList.length; i++) {
          const imageFile = imageList[i];
          const imageData = await imageFile.async("base64");
          const imageName = imageFile.name.split("/").pop();

          // Check if we have modified annotations for this image
          const imageKey = `${split}/${imageName}`;
          if (currentModifiedImages[split] && currentModifiedImages[split][imageKey]) {
            // Use modified annotations
            extractedImages.push({
              id: i,
              name: imageName,
              src: `data:image/jpeg;base64,${imageData}`,
              annotations: currentModifiedImages[split][imageKey]
            });
          } else {
            // Load original annotations
            const labelFileName = imageName.replace(/\.[^/.]+$/, ".txt");
            let labelFile = labelFolder?.file(labelFileName);

            // If not found, try to find in the same folder as the image
            if (!labelFile && imageFile.name.includes('/')) {
              const imagePathParts = imageFile.name.split('/');
              imagePathParts.pop(); // Remove filename
              const imageFolderPath = imagePathParts.join('/');
              const imageBaseFolder = content.folder(imageFolderPath);
              if (imageBaseFolder) {
                const labelsFolderPath = imageFolderPath.replace('/images', '/labels');
                const labelsFolder = content.folder(labelsFolderPath);
                labelFile = labelsFolder?.file(labelFileName) || imageBaseFolder.file(labelFileName);
              }
            }

            let imageAnnotations = [];
            if (labelFile) {
              const labelContent = await labelFile.async("text");
              imageAnnotations = parseAnnotations(labelContent);
            }

            extractedImages.push({
              id: i,
              name: imageName,
              src: `data:image/jpeg;base64,${imageData}`,
              annotations: imageAnnotations
            });
          }
        }

        setImages(extractedImages);
        if (extractedImages.length > 0) {
          setAnnotations(extractedImages[0].annotations);
          setCurrentImageIndex(0);
        } else {
          setAnnotations([]);
          setCurrentImageIndex(0);
        }

        // Reset selections
        setSelectedAnnotation(null);
        setNewAnnotation(null);
        setEditingAnnotation(null);
        setHoveredAnnotation(null);
        setSelectedAnnotations([]);
      }
    } catch (error) {
      console.error("Error loading dataset for split:", error);
      alert("Error loading dataset for the selected split: " + error.message);
    }
  };

  // Load dataset for all splits and combine into a single images array for the editor view
  const loadDatasetAllSplits = async (content, config, splits, currentModifiedImages = modifiedImages) => {
    try {
      // Clean up old blob URLs and reset the array
      cleanupBlobUrls(blobUrlsRef.current);
      blobUrlsRef.current = [];

      const combinedImages = [];
      let globalIndex = 0;

      for (const split of splits) {
        // Reuse split-specific loading logic but keep track of split on each image
        // Determine folder paths based on split with proper fallback
        let imageFolder, labelFolder;
        if (split === 'train') {
          const trainImagePath = (config && config.train) || 'train/images';
          const trainBasePath = trainImagePath.replace('/images', '');
          imageFolder = content.folder(trainBasePath) || content.folder('train') || content.folder('images');
          labelFolder = content.folder(trainBasePath ? `${trainBasePath}/labels` : 'train/labels') || content.folder('train/labels') || content.folder('labels');
        } else if (split === 'valid') {
          const valImagePath = (config && config.val) || 'valid/images';
          const valBasePath = valImagePath.replace('/images', '');
          imageFolder = content.folder(valBasePath) || content.folder('valid') || content.folder('images');
          labelFolder = content.folder(valBasePath ? `${valBasePath}/labels` : 'valid/labels') || content.folder('valid/labels') || content.folder('labels');
        } else if (split === 'test') {
          const testImagePath = (config && config.test) || 'test/images';
          const testBasePath = testImagePath.replace('/images', '');
          imageFolder = content.folder(testBasePath) || content.folder('test') || content.folder('images');
          labelFolder = content.folder(testBasePath ? `${testBasePath}/labels` : 'test/labels') || content.folder('test/labels') || content.folder('labels');
        } else {
          imageFolder = content.folder('train') || content.folder('images');
          labelFolder = content.folder('train/labels') || content.folder('labels');
        }

        // Fallback search for any image folder if specific one not found
        if (!imageFolder) {
          const folders = Object.keys(content.files)
            .filter(key => key.includes('/') && !key.includes('.'))
            .map(key => key.split('/')[0]);
          const uniqueFolders = [...new Set(folders)];

          for (const folder of uniqueFolders) {
            const folderContent = content.folder(folder);
            if (folderContent && folderContent.file(/.*\.(jpg|jpeg|png)$/i).length > 0) {
              imageFolder = folderContent;
              break;
            }
          }

          if (!imageFolder) {
            imageFolder = content;
          }

          labelFolder = content.folder('labels') || content;
        }

        if (!imageFolder) continue;

        const imageList = imageFolder.file(/.*\.(jpg|jpeg|png)$/i);
        const chunkSize = 500;

        for (let i = 0; i < imageList.length; i += chunkSize) {
          const chunk = imageList.slice(i, Math.min(i + chunkSize, imageList.length));

          const chunkImages = await Promise.all(chunk.map(async (imageFile, idx) => {
            const imageData = await imageFile.async('base64');
            const imageName = imageFile.name.split('/').pop();

            const imageKey = `${split}/${imageName}`;
            let imageAnnotations = [];

            // Prefer modified annotations if available
            if (currentModifiedImages[split] && currentModifiedImages[split][imageKey]) {
              imageAnnotations = currentModifiedImages[split][imageKey];
            } else {
              const labelFileName = imageName.replace(/\.[^/.]+$/, '.txt');
              let labelFile = labelFolder?.file(labelFileName);

              if (!labelFile && imageFile.name.includes('/')) {
                const imagePathParts = imageFile.name.split('/');
                imagePathParts.pop();
                const imageFolderPath = imagePathParts.join('/');
                const imageBaseFolder = content.folder(imageFolderPath);
                if (imageBaseFolder) {
                  const labelsFolderPath = imageFolderPath.replace('/images', '/labels');
                  const labelsFolder = content.folder(labelsFolderPath);
                  labelFile = labelsFolder?.file(labelFileName) || imageBaseFolder.file(labelFileName);
                }
              }

              if (labelFile) {
                const labelContent = await labelFile.async('text');
                imageAnnotations = parseAnnotations(labelContent);
              }
            }

            // Use Blob URLs instead of base64
            const blobUrl = base64ToBlob(`data:image/jpeg;base64,${imageData}`);
            blobUrlsRef.current.push(blobUrl);

            return {
              id: globalIndex + idx,
              name: imageName,
              src: blobUrl,
              annotations: imageAnnotations,
              split: split
            };
          }));

          combinedImages.push(...chunkImages);
          setImages(prev => [...prev, ...chunkImages]);
          globalIndex += chunk.length;

          // Yield to event loop to prevent freezing
          await new Promise(resolve => setTimeout(resolve, 0));
          await checkMemory();
        }
      }
      if (combinedImages.length > 0) {
        setAnnotations(combinedImages[0].annotations || []);
        setCurrentImageIndex(0);
      } else {
        setAnnotations([]);
        setCurrentImageIndex(0);
      }

      setSelectedAnnotation(null);
      setNewAnnotation(null);
      setEditingAnnotation(null);
      setHoveredAnnotation(null);
      setSelectedAnnotations([]);
    } catch (error) {
      console.error('Error loading dataset for all splits:', error);
      alert('Error loading dataset for all splits: ' + error.message);
    }
  };

  // Handle dataset split change
  const handleDatasetSplitChange = async (newSplit) => {
    // Save current annotations to modifiedImages before switching
    if (dataset && images.length > 0) {
      const updatedModifiedImages = { ...modifiedImages };

      // Save current image annotations
      const currentImageName = images[currentImageIndex]?.name;
      if (currentImageName) {
        const imageKey = `${datasetSplit}/${currentImageName}`;
        if (!updatedModifiedImages[datasetSplit]) {
          updatedModifiedImages[datasetSplit] = {};
        }
        updatedModifiedImages[datasetSplit][imageKey] = annotations;
      }

      setModifiedImages(updatedModifiedImages);

      // Load the new split with modified images
      try {
        const zip = new JSZip();
        const content = await zip.loadAsync(dataset);
        setDatasetSplit(newSplit);
        loadDatasetForSplit(content, datasetConfig, newSplit, updatedModifiedImages);
      } catch (error) {
        console.error("Error loading dataset for split:", error);
        alert("Error loading dataset for the selected split: " + error.message);
      }
    } else {
      setDatasetSplit(newSplit);
    }
  };

  // Open dashboard with aggregated images from all splits
  const openDashboard = async () => {
    if (!dataset) {
      // If no dataset file (manual images), just use current images
      setDashboardImages(images || []);
      setCurrentView('dashboard');
      return;
    }

    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(dataset);
      const combinedImages = [];

      for (const split of availableSplits) {
        let imageFolder;
        if (split === 'train') {
          imageFolder = zipContent.folder((datasetConfig && datasetConfig.train) ? datasetConfig.train.replace('/images', '') : 'train') ||
            zipContent.folder('train/images') ||
            zipContent.folder('train') ||
            zipContent.folder('images');
        } else if (split === 'valid') {
          imageFolder = zipContent.folder((datasetConfig && datasetConfig.val) ? datasetConfig.val.replace('/images', '') : 'valid') ||
            zipContent.folder('valid/images') ||
            zipContent.folder('valid') ||
            zipContent.folder('images');
        } else if (split === 'test') {
          imageFolder = zipContent.folder((datasetConfig && datasetConfig.test) ? datasetConfig.test.replace('/images', '') : 'test') ||
            zipContent.folder('test/images') ||
            zipContent.folder('test') ||
            zipContent.folder('images');
        } else {
          imageFolder = zipContent.folder('train/images') || zipContent.folder('train') || zipContent.folder('images');
        }

        if (!imageFolder) continue;

        const imageList = imageFolder.file(/.*\.(jpg|jpeg|png)$/i);

        for (let i = 0; i < imageList.length; i++) {
          const imageFile = imageList[i];
          const imageName = imageFile.name.split('/').pop();
          const imageData = await imageFile.async('base64');

          // Determine annotations: prefer modifiedImages, otherwise original labels
          let imageAnnotations = [];
          const imageKey = `${split}/${imageName}`;
          if (modifiedImages[split] && modifiedImages[split][imageKey]) {
            imageAnnotations = modifiedImages[split][imageKey];
          } else {
            // Try to load original annotation file
            let labelFolder;
            if (split === 'train') {
              labelFolder = zipContent.folder((datasetConfig && datasetConfig.train) ? datasetConfig.train.replace('/images', '/labels') : 'train/labels') ||
                zipContent.folder('train/labels') ||
                zipContent.folder('labels');
            } else if (split === 'valid') {
              labelFolder = zipContent.folder((datasetConfig && datasetConfig.val) ? datasetConfig.val.replace('/images', '/labels') : 'valid/labels') ||
                zipContent.folder('valid/labels') ||
                zipContent.folder('labels');
            } else if (split === 'test') {
              labelFolder = zipContent.folder((datasetConfig && datasetConfig.test) ? datasetConfig.test.replace('/images', '/labels') : 'test/labels') ||
                zipContent.folder('test/labels') ||
                zipContent.folder('labels');
            } else {
              labelFolder = zipContent.folder('train/labels') || zipContent.folder('labels');
            }

            if (labelFolder) {
              const labelFileName = imageName.replace(/\.[^/.]+$/, '.txt');
              const labelFile = labelFolder.file(labelFileName);
              if (labelFile) {
                const labelContent = await labelFile.async('text');
                imageAnnotations = parseAnnotations(labelContent);
              }
            }
          }

          combinedImages.push({
            id: combinedImages.length,
            name: imageName,
            src: `data:image/jpeg;base64,${imageData}`,
            annotations: imageAnnotations,
            split: split
          });
        }
      }

      setDashboardImages(combinedImages);
    } catch (error) {
      console.error('Error preparing dashboard images:', error);
      alert('Error preparing dashboard view. Showing current split only.');
      setDashboardImages(images || []);
    }

    setCurrentView('dashboard');
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  // Parse YOLO annotations
  const parseAnnotations = (content) => {
    const lines = content.trim().split('\n');
    const parsedAnnotations = [];

    lines.forEach((line, index) => {
      if (line.trim()) {
        const [classId, centerX, centerY, width, height] = line.trim().split(' ').map(Number);
        parsedAnnotations.push({
          id: index,
          classId: classId || 0,
          centerX: centerX || 0,
          centerY: centerY || 0,
          width: width || 0,
          height: height || 0,
          type: 'rectangle'
        });
      }
    });

    return parsedAnnotations;
  };

  // Convert normalized coordinates to pixel coordinates
  const normalizedToPixel = (annotation, imageWidth, imageHeight) => {
    return {
      x: annotation.centerX * imageWidth,
      y: annotation.centerY * imageHeight,
      width: annotation.width * imageWidth,
      height: annotation.height * imageHeight
    };
  };

  // Convert pixel coordinates to normalized coordinates
  const pixelToNormalized = (x, y, width, height, imageWidth, imageHeight) => {
    return {
      centerX: x / imageWidth,
      centerY: y / imageHeight,
      width: width / imageWidth,
      height: height / imageHeight
    };
  };

  // Handle image selection
  const handleImageSelect = (index) => {
    // Save current annotations to modifiedImages before switching images
    if (images.length > 0 && currentImageIndex < images.length) {
      const updatedModifiedImages = { ...modifiedImages };
      const currentImageName = images[currentImageIndex]?.name;
      if (currentImageName) {
        const imageKey = `${datasetSplit}/${currentImageName}`;
        if (!updatedModifiedImages[datasetSplit]) {
          updatedModifiedImages[datasetSplit] = {};
        }
        updatedModifiedImages[datasetSplit][imageKey] = annotations;
      }
      setModifiedImages(updatedModifiedImages);
    }

    setCurrentImageIndex(index);
    setAnnotations(images[index].annotations);
    setSelectedAnnotation(null);
    setNewAnnotation(null);
    setEditingAnnotation(null);
    setHoveredAnnotation(null);
  };

  // Handle mouse down for drawing, dragging, or resizing
  const handleMouseDown = (e) => {
    if (!currentImage) return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

    // Transform pointer position to account for scale and position
    const x = (pointer.x - stagePos.x) / scale;
    const y = (pointer.y - stagePos.y) / scale;

    // Check if we clicked on an existing annotation (for dragging or resizing)
    if (tool === 'select' && selectedAnnotation) {
      const pixelCoords = normalizedToPixel(
        selectedAnnotation,
        stageSize.width,
        stageSize.height
      );

      const rectX = pixelCoords.x - pixelCoords.width / 2;
      const rectY = pixelCoords.y - pixelCoords.height / 2;
      const rectWidth = pixelCoords.width;
      const rectHeight = pixelCoords.height;

      // Check if click is on a resize handle (5px from corners)
      const handleSize = 10 / scale; // Adjust for scale

      // Northwest handle
      if (x >= rectX - handleSize && x <= rectX + handleSize &&
        y >= rectY - handleSize && y <= rectY + handleSize) {
        setIsResizing(true);
        setResizeHandle('nw');
        setDragStartPos({ x, y });
        setDragStartAnnotation({ ...selectedAnnotation });
        return;
      }

      // Northeast handle
      if (x >= rectX + rectWidth - handleSize && x <= rectX + rectWidth + handleSize &&
        y >= rectY - handleSize && y <= rectY + handleSize) {
        setIsResizing(true);
        setResizeHandle('ne');
        setDragStartPos({ x, y });
        setDragStartAnnotation({ ...selectedAnnotation });
        return;
      }

      // Southwest handle
      if (x >= rectX - handleSize && x <= rectX + handleSize &&
        y >= rectY + rectHeight - handleSize && y <= rectY + rectHeight + handleSize) {
        setIsResizing(true);
        setResizeHandle('sw');
        setDragStartPos({ x, y });
        setDragStartAnnotation({ ...selectedAnnotation });
        return;
      }

      // Southeast handle
      if (x >= rectX + rectWidth - handleSize && x <= rectX + rectWidth + handleSize &&
        y >= rectY + rectHeight - handleSize && y <= rectY + rectHeight + handleSize) {
        setIsResizing(true);
        setResizeHandle('se');
        setDragStartPos({ x, y });
        setDragStartAnnotation({ ...selectedAnnotation });
        return;
      }

      // Check if click is within the selected annotation (for dragging)
      if (x >= rectX && x <= rectX + rectWidth &&
        y >= rectY && y <= rectY + rectHeight) {
        setIsDragging(true);
        setDragStartPos({ x, y });
        setDragStartAnnotation({ ...selectedAnnotation });
        return;
      }
    }

    // Start drawing a new rectangle if in rectangle mode
    if (tool === 'rectangle') {
      setIsDrawing(true);
      setNewAnnotation({
        x,
        y,
        width: 0,
        height: 0
      });
    }
  };

  // Handle mouse move for drawing, dragging, resizing, or panning
  const handleMouseMove = (e) => {
    if (!currentImage) return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

    // Transform pointer position to account for scale and position
    const x = (pointer.x - stagePos.x) / scale;
    const y = (pointer.y - stagePos.y) / scale;

    // Update crosshair position
    setCrosshairPos({ x, y });

    // Handle resizing of existing annotation
    if (isResizing && selectedAnnotation && dragStartAnnotation && resizeHandle) {
      const dx = x - dragStartPos.x;
      const dy = y - dragStartPos.y;

      // Get original annotation properties
      const origPixelCoords = normalizedToPixel(
        dragStartAnnotation,
        stageSize.width,
        stageSize.height
      );

      const origX = origPixelCoords.x - origPixelCoords.width / 2;
      const origY = origPixelCoords.y - origPixelCoords.height / 2;
      const origWidth = origPixelCoords.width;
      const origHeight = origPixelCoords.height;

      let newCenterX, newCenterY, newWidth, newHeight;

      // Calculate new dimensions based on which handle is being dragged
      switch (resizeHandle) {
        case 'nw': // Northwest (top-left)
          newWidth = origWidth - dx;
          newHeight = origHeight - dy;
          newCenterX = origPixelCoords.x - dx / 2;
          newCenterY = origPixelCoords.y - dy / 2;
          break;
        case 'ne': // Northeast (top-right)
          newWidth = origWidth + dx;
          newHeight = origHeight - dy;
          newCenterX = origPixelCoords.x + dx / 2;
          newCenterY = origPixelCoords.y - dy / 2;
          break;
        case 'sw': // Southwest (bottom-left)
          newWidth = origWidth - dx;
          newHeight = origHeight + dy;
          newCenterX = origPixelCoords.x - dx / 2;
          newCenterY = origPixelCoords.y + dy / 2;
          break;
        case 'se': // Southeast (bottom-right)
          newWidth = origWidth + dx;
          newHeight = origHeight + dy;
          newCenterX = origPixelCoords.x + dx / 2;
          newCenterY = origPixelCoords.y + dy / 2;
          break;
        default:
          return;
      }

      // Convert to normalized coordinates
      const normalized = pixelToNormalized(
        newCenterX - newWidth / 2,
        newCenterY - newHeight / 2,
        newWidth,
        newHeight,
        stageSize.width,
        stageSize.height
      );

      // Update the annotation
      const updatedAnnotation = {
        ...selectedAnnotation,
        centerX: normalized.centerX + normalized.width / 2,
        centerY: normalized.centerY + normalized.height / 2,
        width: normalized.width,
        height: normalized.height
      };

      const updatedAnnotations = annotations.map(ann =>
        ann.id === selectedAnnotation.id ? updatedAnnotation : ann
      );

      setAnnotations(updatedAnnotations);

      // Update the image in the images array and modifiedImages
      updateImageAnnotations(currentImageIndex, updatedAnnotations);

      // Update selected annotation
      setSelectedAnnotation(updatedAnnotation);
      setEditingAnnotation({ ...editingAnnotation, ...updatedAnnotation });

      return;
    }

    // Handle dragging of existing annotation
    if (isDragging && selectedAnnotation && dragStartAnnotation) {
      const dx = x - dragStartPos.x;
      const dy = y - dragStartPos.y;

      // Calculate new center position
      const newCenterX = dragStartAnnotation.centerX + (dx / stageSize.width);
      const newCenterY = dragStartAnnotation.centerY + (dy / stageSize.height);

      // Update the annotation
      const updatedAnnotations = annotations.map(ann =>
        ann.id === selectedAnnotation.id
          ? { ...ann, centerX: newCenterX, centerY: newCenterY }
          : ann
      );

      setAnnotations(updatedAnnotations);

      // Update the image in the images array and modifiedImages
      updateImageAnnotations(currentImageIndex, updatedAnnotations);

      // Update selected annotation
      setSelectedAnnotation({ ...selectedAnnotation, centerX: newCenterX, centerY: newCenterY });
      setEditingAnnotation({ ...editingAnnotation, centerX: newCenterX, centerY: newCenterY });

      return;
    }

    // Handle drawing new annotation
    if (isDrawing && newAnnotation) {
      setNewAnnotation({
        ...newAnnotation,
        width: x - newAnnotation.x,
        height: y - newAnnotation.y
      });
      return;
    }

    // Handle panning (when dragging on empty space with middle mouse button)
    if (e.evt.buttons === 4) {
      const deltaX = pointer.x - (dragStartPos.x * scale + stagePos.x);
      const deltaY = pointer.y - (dragStartPos.y * scale + stagePos.y);

      setStagePos({
        x: stagePos.x + deltaX,
        y: stagePos.y + deltaY
      });
    }
  };

  // Update the image in the images array and modifiedImages
  const updateImageAnnotations = (imageIndex, updatedAnnotations) => {
    // Update images state
    const updatedImages = [...images];
    updatedImages[imageIndex] = {
      ...updatedImages[imageIndex],
      annotations: updatedAnnotations
    };
    setImages(updatedImages);

    // Update modifiedImages state
    const updatedModifiedImages = { ...modifiedImages };
    const imageName = images[imageIndex]?.name;
    const imageSplit = images[imageIndex]?.split || datasetSplit;
    if (imageName) {
      const imageKey = `${imageSplit}/${imageName}`;
      if (!updatedModifiedImages[imageSplit]) {
        updatedModifiedImages[imageSplit] = {};
      }
      updatedModifiedImages[imageSplit][imageKey] = updatedAnnotations;
      setModifiedImages(updatedModifiedImages);
    }

    return updatedImages;
  };

  // Handle mouse up for drawing, dragging, or resizing
  const handleMouseUp = (e) => {
    if (!currentImage) return;

    // Reset states
    if (isDragging || isResizing) {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
      setDragStartPos({ x: 0, y: 0 });
      setDragStartAnnotation(null);
      return;
    }

    // Handle drawing new annotation
    if (isDrawing && newAnnotation) {
      // Only create annotation if it has meaningful size
      if (Math.abs(newAnnotation.width) > 5 && Math.abs(newAnnotation.height) > 5) {
        const imageWidth = imageRef.current?.width() || 1;
        const imageHeight = imageRef.current?.height() || 1;

        // Calculate normalized coordinates
        const normalized = pixelToNormalized(
          Math.min(newAnnotation.x, newAnnotation.x + newAnnotation.width),
          Math.min(newAnnotation.y, newAnnotation.y + newAnnotation.height),
          Math.abs(newAnnotation.width),
          Math.abs(newAnnotation.height),
          imageWidth,
          imageHeight
        );

        // Create a new rectangle annotation
        const newAnnotationObj = {
          id: Date.now(),
          classId: classes.indexOf(selectedClass),
          centerX: normalized.centerX + normalized.width / 2,
          centerY: normalized.centerY + normalized.height / 2,
          width: normalized.width,
          height: normalized.height,
          type: 'rectangle'
        };

        const updatedAnnotations = [...annotations, newAnnotationObj];
        setAnnotations(updatedAnnotations);

        // Update the image in the images array and modifiedImages
        updateImageAnnotations(currentImageIndex, updatedAnnotations);
      }

      // Reset drawing state
      setIsDrawing(false);
      setNewAnnotation(null);
      return;
    }
  };

  // Handle annotation selection (single or multiple with Ctrl)
  const handleAnnotationSelect = (annotation, event) => {
    // Check if Ctrl key is pressed for multiple selection
    if (event && event.ctrlKey) {
      // Toggle selection in multiple selection mode
      if (selectedAnnotations.some(id => id === annotation.id)) {
        // Remove from selection
        setSelectedAnnotations(selectedAnnotations.filter(id => id !== annotation.id));
      } else {
        // Add to selection
        setSelectedAnnotations([...selectedAnnotations, annotation.id]);
      }
      // Clear single selection when in multiple selection mode
      setSelectedAnnotation(null);
      setEditingAnnotation(null);
    } else {
      // Single selection mode
      setSelectedAnnotation(annotation);
      setSelectedAnnotations([annotation.id]); // Only this annotation is selected
      setEditingAnnotation({ ...annotation }); // Create a copy for editing
    }

    setHoveredAnnotation(null);
  };

  // Handle annotation deletion
  const handleAnnotationDelete = (annotationId) => {
    const updatedAnnotations = annotations.filter(ann => ann.id !== annotationId);
    setAnnotations(updatedAnnotations);

    // Update the image in the images array and modifiedImages
    updateImageAnnotations(currentImageIndex, updatedAnnotations);

    if (selectedAnnotation && selectedAnnotation.id === annotationId) {
      setSelectedAnnotation(null);
      setEditingAnnotation(null);
    }

    if (hoveredAnnotation && hoveredAnnotation.id === annotationId) {
      setHoveredAnnotation(null);
    }
  };

  // Handle right-click context menu
  const handleContextMenu = (event, annotation) => {
    event.evt.preventDefault();

    const stage = event.target.getStage();
    const pointer = stage.getPointerPosition();

    setContextMenu({
      visible: true,
      x: pointer.x,
      y: pointer.y,
      annotation: annotation
    });
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      annotation: null
    });
  };

  // Context menu options
  const getContextMenuOptions = () => {
    return [
      {
        label: 'Delete',
        icon: '🗑️',
        action: (annotation) => {
          if (annotation) {
            handleAnnotationDelete(annotation.id);
          }
        }
      },
      {
        label: 'Select',
        icon: '👆',
        action: (annotation) => {
          if (annotation) {
            handleAnnotationSelect(annotation);
          }
        }
      },
      {
        label: 'Edit Class',
        icon: '🏷️',
        action: (annotation) => {
          if (annotation) {
            handleAnnotationSelect(annotation);
            // Scroll to edit panel if not visible
            const editPanel = document.querySelector('.annotation-edit-panel');
            if (editPanel) {
              editPanel.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }
      }
    ];
  };

  // Handle multiple annotation deletion
  const handleMultipleAnnotationDelete = () => {
    if (selectedAnnotations.length === 0) return;

    // Filter out selected annotations
    const updatedAnnotations = annotations.filter(ann => !selectedAnnotations.includes(ann.id));
    setAnnotations(updatedAnnotations);

    // Update the image in the images array and modifiedImages
    updateImageAnnotations(currentImageIndex, updatedAnnotations);

    // Clear selection
    setSelectedAnnotations([]);
    setSelectedAnnotation(null);
    setEditingAnnotation(null);

    alert(`Deleted ${selectedAnnotations.length} annotations`);
  };

  // Handle annotation class change
  const handleAnnotationClassChange = (annotationId, newClassId) => {
    const updatedAnnotations = annotations.map(ann =>
      ann.id === annotationId ? { ...ann, classId: newClassId } : ann
    );
    setAnnotations(updatedAnnotations);

    // Update the image in the images array and modifiedImages
    updateImageAnnotations(currentImageIndex, updatedAnnotations);

    // Update selected annotation if it's the one being edited
    if (selectedAnnotation && selectedAnnotation.id === annotationId) {
      setSelectedAnnotation({ ...selectedAnnotation, classId: newClassId });
      setEditingAnnotation({ ...editingAnnotation, classId: newClassId });
    }

    // Update hovered annotation if it's the one being edited
    if (hoveredAnnotation && hoveredAnnotation.id === annotationId) {
      setHoveredAnnotation({ ...hoveredAnnotation, classId: newClassId });
    }
  };

  // Handle annotation size change
  const handleAnnotationSizeChange = (annotationId, newWidth, newHeight) => {
    const updatedAnnotations = annotations.map(ann =>
      ann.id === annotationId ? { ...ann, width: newWidth, height: newHeight } : ann
    );
    setAnnotations(updatedAnnotations);

    // Update the image in the images array and modifiedImages
    updateImageAnnotations(currentImageIndex, updatedAnnotations);

    // Update selected annotation if it's the one being edited
    if (selectedAnnotation && selectedAnnotation.id === annotationId) {
      setSelectedAnnotation({ ...selectedAnnotation, width: newWidth, height: newHeight });
      setEditingAnnotation({ ...editingAnnotation, width: newWidth, height: newHeight });
    }

    // Update hovered annotation if it's the one being edited
    if (hoveredAnnotation && hoveredAnnotation.id === annotationId) {
      setHoveredAnnotation({ ...hoveredAnnotation, width: newWidth, height: newHeight });
    }
  };

  // Handle zoom
  const handleZoom = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const scaleBy = 1.05;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    stage.scale({ x: newScale, y: newScale });

    const newPos = {
      x: pointer.x - (pointer.x - stage.x()) * (newScale / oldScale),
      y: pointer.y - (pointer.y - stage.y()) * (newScale / oldScale)
    };

    stage.position(newPos);
    setScale(newScale);
    setStagePos(newPos);
  };

  // Handle mouse move for crosshair
  const handleStageMouseMove = (e) => {
    if (!currentImage) return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

    // Transform pointer position to account for scale and position
    const x = (pointer.x - stagePos.x) / scale;
    const y = (pointer.y - stagePos.y) / scale;

    setCrosshairPos({ x, y });
  };

  // Handle mouse enter/leave for crosshair visibility
  const handleStageMouseEnter = () => {
    setShowCrosshair(true);
  };

  const handleStageMouseLeave = () => {
    setShowCrosshair(false);
  };

  // Add drag start position tracking
  const handleStageMouseDown = (e) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

    // Store initial drag position for panning
    setDragStartPos({
      x: (pointer.x - stagePos.x) / scale,
      y: (pointer.y - stagePos.y) / scale
    });
  };

  // Navigation functions
  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      handleImageSelect(currentImageIndex - 1);
    }
  };

  const goToNextImage = () => {
    if (currentImageIndex < images.length - 1) {
      handleImageSelect(currentImageIndex + 1);
    }
  };

  // Batch navigation
  const goToPreviousBatch = () => {
    if (batchStartIndex >= batchSize) {
      setBatchStartIndex(batchStartIndex - batchSize);
    }
  };

  const goToNextBatch = () => {
    if (batchStartIndex + batchSize < images.length) {
      setBatchStartIndex(batchStartIndex + batchSize);
    }
  };

  // Save annotations
  const saveAnnotations = () => {
    // Save current annotations to modifiedImages
    if (images.length > 0 && currentImageIndex < images.length) {
      const updatedModifiedImages = { ...modifiedImages };

      // Save current image annotations
      const currentImageName = images[currentImageIndex]?.name;
      const currentImageSplit = images[currentImageIndex]?.split || datasetSplit;
      if (currentImageName) {
        const imageKey = `${currentImageSplit}/${currentImageName}`;
        if (!updatedModifiedImages[currentImageSplit]) {
          updatedModifiedImages[currentImageSplit] = {};
        }
        updatedModifiedImages[currentImageSplit][imageKey] = annotations;
        setModifiedImages(updatedModifiedImages);
      }
    }

    alert("Annotations saved successfully!");
    // In a real implementation, this would save to the dataset files
  };

  // Download modified dataset in YOLO format
  const downloadDataset = async () => {
    if (!dataset) {
      alert("Please load a dataset first!");
      return;
    }

    try {
      // Create a new JSZip instance
      const zip = new JSZip();

      // Add dataset.yaml with preserved structure
      let datasetConfigToSave = { ...datasetConfig };
      if (datasetConfigToSave) {
        // Update names if they exist in state
        if (datasetConfigToSave.names) {
          datasetConfigToSave.names = classes;
        }
        // Update nc (number of classes) if it exists
        if (datasetConfigToSave.nc) {
          datasetConfigToSave.nc = classes.length;
        }
      } else {
        // FallbackCreate ifnew noconfig originalfor configmanually created dataset
        datasetConfigToSave = {
          path: './',
          train: 'train/images',
          val: 'valid/images',
          test: 'test/images',
          nc: classes.length,
          names: classes
        };
      }

      const yamlContent = yaml.dump(datasetConfigToSave);
      zip.file("dataset.yaml", yamlContent);

      // Create folders for each split
      const splitFolders = {};
      availableSplits.forEach(split => {
        splitFolders[split] = zip.folder(split);
        splitFolders[split].folder("images");
        splitFolders[split].folder("labels");
      });

      // Check if we're working with a manually created dataset (not from a ZIP file)
      // A manually created dataset will have a simple object, not a File object
      const isManualDataset = !(dataset instanceof File) && !(dataset instanceof Blob);
      if (!dataset.name || typeof dataset.name !== 'string') {
        // Handle manually added images
        images.forEach((image, index) => {
          // Extract base64 data from image src
          const base64Data = image.src.split(',')[1];
          if (base64Data) {
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);

            for (let j = 0; j < binaryString.length; j++) {
              bytes[j] = binaryString.charCodeAt(j);
            }

            // Add image to zip
            const imageName = image.name || `image_${index}.jpg`;
            splitFolders[datasetSplit].folder("images").file(imageName, bytes);

            // Get annotations for this image - check modifiedImages first
            let imageAnnotations = image.annotations || [];
            const imageKey = `${datasetSplit}/${imageName}`;
            if (modifiedImages[datasetSplit] && modifiedImages[datasetSplit][imageKey]) {
              // Use modified annotations if available
              imageAnnotations = modifiedImages[datasetSplit][imageKey];
            }

            // Create annotation content
            let annotationContent = "";
            imageAnnotations.forEach(annotation => {
              annotationContent += `${annotation.classId} ${annotation.centerX} ${annotation.centerY} ${annotation.width} ${annotation.height}\n`;
            });

            // Add annotation file to zip
            const labelFileName = imageName.replace(/\.[^/.]+$/, ".txt");
            splitFolders[datasetSplit].folder("labels").file(labelFileName, annotationContent);
          }
        });
      } else {
        // Process each split (original ZIP file approach)
        for (const split of availableSplits) {
          // Get the images for this split
          const zipContent = await JSZip.loadAsync(dataset);
          let imageFolder;
          if (split === 'train') {
            imageFolder = zipContent.folder(datasetConfig?.train?.replace('/images', '') || "train/images") || zipContent.folder("train/images") || zipContent.folder("images");
          } else if (split === 'valid') {
            imageFolder = zipContent.folder(datasetConfig?.val?.replace('/images', '') || "valid/images") || zipContent.folder("valid/images") || zipContent.folder("images");
          } else if (split === 'test') {
            imageFolder = zipContent.folder(datasetConfig?.test?.replace('/images', '') || "test/images") || zipContent.folder("test/images") || zipContent.folder("images");
          } else {
            imageFolder = zipContent.folder("train/images") || zipContent.folder("images");
          }

          if (imageFolder) {
            const imageList = imageFolder.file(/.*\.(jpg|jpeg|png)$/i);

            for (let i = 0; i < imageList.length; i++) {
              const imageFile = imageList[i];
              const imageName = imageFile.name.split("/").pop();

              // Extract the original image data (base64)
              const imageData = await imageFile.async("base64");
              const binaryString = atob(imageData);
              const bytes = new Uint8Array(binaryString.length);

              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }

              // Add image to zip
              splitFolders[split].folder("images").file(imageName, bytes);

              // Get annotations - either modified or original
              let imageAnnotations = [];
              const imageKey = `${split}/${imageName}`;
              if (modifiedImages[split] && modifiedImages[split][imageKey]) {
                // Use modified annotations
                imageAnnotations = modifiedImages[split][imageKey];
              } else {
                // Load original annotations if available
                let labelFolder;
                if (split === 'train') {
                  labelFolder = zipContent.folder(datasetConfig?.train?.replace('/images', '/labels') || "train/labels") || zipContent.folder("train/labels") || zipContent.folder("labels");
                } else if (split === 'valid') {
                  labelFolder = zipContent.folder(datasetConfig?.val?.replace('/images', '/labels') || "valid/labels") || zipContent.folder("valid/labels") || zipContent.folder("labels");
                } else if (split === 'test') {
                  labelFolder = zipContent.folder(datasetConfig?.test?.replace('/images', '/labels') || "test/labels") || zipContent.folder("test/labels") || zipContent.folder("labels");
                } else {
                  labelFolder = zipContent.folder("train/labels") || zipContent.folder("labels");
                }

                const labelFileName = imageName.replace(/\.[^/.]+$/, ".txt");
                const labelFile = labelFolder?.file(labelFileName);

                if (labelFile) {
                  const labelContent = await labelFile.async("text");
                  imageAnnotations = parseAnnotations(labelContent);
                }
              }

              // Create annotation content
              let annotationContent = "";
              imageAnnotations.forEach(annotation => {
                annotationContent += `${annotation.classId} ${annotation.centerX} ${annotation.centerY} ${annotation.width} ${annotation.height}\n`;
              });

              // Add annotation file to zip
              const labelFileName = imageName.replace(/\.[^/.]+$/, ".txt");
              splitFolders[split].folder("labels").file(labelFileName, annotationContent);
            }
          }
        }
      }

      // Generate the zip file
      const content = await zip.generateAsync({ type: "blob" });

      // Create download link
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = "edited_dataset_yolo.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert("Dataset downloaded successfully in YOLO format!");
    } catch (error) {
      console.error("Error downloading dataset:", error);
      alert("Error downloading dataset. Please try again.");
    }
  };

  // Download modified dataset in COCO format
  const downloadDatasetCOCO = async () => {
    if (!dataset) {
      alert("Please load a dataset first!");
      return;
    }

    try {
      // Create a new JSZip instance
      const zip = new JSZip();

      // Create COCO format structure
      const cocoDataset = {
        info: {
          year: new Date().getFullYear(),
          version: "1.0",
          description: "Exported from YOLO File Review Dataset Editor",
          contributor: "YOLO File Review Dataset Editor",
          url: "",
          date_created: new Date().toISOString()
        },
        licenses: [{
          id: 1,
          name: "Unknown",
          url: ""
        }],
        images: [],
        annotations: [],
        categories: classes.map((name, id) => ({
          id: id,
          name: name,
          supercategory: "object"
        }))
      };

      // Keep track of image and annotation IDs
      let imageIdCounter = 1;
      let annotationIdCounter = 1;

      // Process each split
      for (const split of availableSplits) {
        // Create folders for this split
        const splitFolder = zip.folder(split);
        const imagesFolder = splitFolder.folder("images");

        // Get the images for this split
        let splitImages = [];

        // If we're working with a manually created dataset
        if (!dataset.name || typeof dataset.name !== 'string') {
          splitImages = images;
        } else {
          // Load from original ZIP file
          const zipContent = await JSZip.loadAsync(dataset);
          let imageFolder;
          if (split === 'train') {
            imageFolder = zipContent.folder(datasetConfig?.train?.replace('/images', '') || "train/images") || zipContent.folder("train/images") || zipContent.folder("images");
          } else if (split === 'valid') {
            imageFolder = zipContent.folder(datasetConfig?.val?.replace('/images', '') || "valid/images") || zipContent.folder("valid/images") || zipContent.folder("images");
          } else if (split === 'test') {
            imageFolder = zipContent.folder(datasetConfig?.test?.replace('/images', '') || "test/images") || zipContent.folder("test/images") || zipContent.folder("images");
          } else {
            imageFolder = zipContent.folder("train/images") || zipContent.folder("images");
          }

          if (imageFolder) {
            const imageList = imageFolder.file(/.*\.(jpg|jpeg|png)$/i);

            for (let i = 0; i < imageList.length; i++) {
              const imageFile = imageList[i];
              const imageName = imageFile.name.split("/").pop();

              // Extract the original image data (base64)
              const imageData = await imageFile.async("base64");
              const binaryString = atob(imageData);
              const bytes = new Uint8Array(binaryString.length);

              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }

              // Add image to zip
              imagesFolder.file(imageName, bytes);

              // Get annotations - either modified or original
              let imageAnnotations = [];
              const imageKey = `${split}/${imageName}`;
              if (modifiedImages[split] && modifiedImages[split][imageKey]) {
                // Use modified annotations
                imageAnnotations = modifiedImages[split][imageKey];
              } else {
                // Load original annotations if available
                let labelFolder;
                if (split === 'train') {
                  labelFolder = zipContent.folder(datasetConfig?.train?.replace('/images', '/labels') || "train/labels") || zipContent.folder("train/labels") || zipContent.folder("labels");
                } else if (split === 'valid') {
                  labelFolder = zipContent.folder(datasetConfig?.val?.replace('/images', '/labels') || "valid/labels") || zipContent.folder("valid/labels") || zipContent.folder("labels");
                } else if (split === 'test') {
                  labelFolder = zipContent.folder(datasetConfig?.test?.replace('/images', '/labels') || "test/labels") || zipContent.folder("test/labels") || zipContent.folder("labels");
                } else {
                  labelFolder = zipContent.folder("train/labels") || zipContent.folder("labels");
                }

                const labelFileName = imageName.replace(/\.[^/.]+$/, ".txt");
                const labelFile = labelFolder?.file(labelFileName);

                if (labelFile) {
                  const labelContent = await labelFile.async("text");
                  imageAnnotations = parseAnnotations(labelContent);
                }
              }

              // Add to our split images array
              splitImages.push({
                id: i,
                name: imageName,
                src: `data:image/jpeg;base64,${imageData}`,
                annotations: imageAnnotations
              });
            }
          }
        }

        // Process images for COCO format
        for (const image of splitImages) {
          // Create a temporary image element to get dimensions
          const imgElement = new Image();
          imgElement.src = image.src;

          // Wait for image to load to get dimensions
          await new Promise((resolve) => {
            imgElement.onload = () => resolve();
          });

          const width = imgElement.width;
          const height = imgElement.height;

          // Add image info to COCO dataset
          const cocoImage = {
            id: imageIdCounter,
            width: width,
            height: height,
            file_name: image.name,
            license: 1,
            flickr_url: "",
            coco_url: "",
            date_captured: new Date().toISOString()
          };

          cocoDataset.images.push(cocoImage);

          // Add annotations to COCO dataset
          if (image.annotations) {
            image.annotations.forEach(annotation => {
              // Convert YOLO format to COCO format
              const bboxWidth = annotation.width * width;
              const bboxHeight = annotation.height * height;
              const bboxX = (annotation.centerX * width) - (bboxWidth / 2);
              const bboxY = (annotation.centerY * height) - (bboxHeight / 2);

              const cocoAnnotation = {
                id: annotationIdCounter,
                image_id: imageIdCounter,
                category_id: annotation.classId,
                bbox: [bboxX, bboxY, bboxWidth, bboxHeight],
                area: bboxWidth * bboxHeight,
                segmentation: [], // Empty segmentation for bounding boxes
                iscrowd: 0
              };

              cocoDataset.annotations.push(cocoAnnotation);
              annotationIdCounter++;
            });
          }

          imageIdCounter++;

          // If we're working with a manually created dataset, add image to zip
          if (!dataset.name || typeof dataset.name !== 'string') {
            const base64Data = image.src.split(',')[1];
            if (base64Data) {
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);

              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }

              imagesFolder.file(image.name, bytes);
            }
          }
        }
      }

      // Add COCO annotations JSON file
      zip.file("annotations.json", JSON.stringify(cocoDataset, null, 2));

      // Generate the zip file
      const content = await zip.generateAsync({ type: "blob" });

      // Create download link
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = "edited_dataset_coco.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert("Dataset downloaded successfully in COCO format!");
    } catch (error) {
      console.error("Error downloading dataset in COCO format:", error);
      alert("Error downloading dataset in COCO format. Please try again.");
    }
  };

  // Function to add a new class
  const addNewClass = () => {
    if (!newClassName.trim()) {
      alert('Please enter a class name');
      return;
    }

    // Check if class already exists
    if (classes.includes(newClassName.trim())) {
      alert('Class already exists');
      return;
    }

    // Add new class
    const updatedClasses = [...classes, newClassName.trim()];
    setClasses(updatedClasses);
    setNewClassName(''); // Clear input

    alert(`Class "${newClassName.trim()}" added successfully!`);
  };

  // Function to apply global padding to all annotations of a specific class
  const applyGlobalPadding = (classId, widthPadding, heightPadding) => {
    // Update the class padding settings
    setClassPadding(prev => ({
      ...prev,
      [classId]: { width: widthPadding, height: heightPadding }
    }));

    // Apply padding to all annotations of this class across all images
    const updatedImages = images.map(image => {
      const updatedAnnotations = image.annotations.map(annotation => {
        if (annotation.classId === classId) {
          // Apply padding to width and height
          const newWidth = Math.min(1, Math.max(0, annotation.width + widthPadding));
          const newHeight = Math.min(1, Math.max(0, annotation.height + heightPadding));

          return {
            ...annotation,
            width: newWidth,
            height: newHeight
          };
        }
        return annotation;
      });

      return {
        ...image,
        annotations: updatedAnnotations
      };
    });

    setImages(updatedImages);

    // Update current annotations if we're on the current image
    if (currentImageIndex < updatedImages.length) {
      setAnnotations(updatedImages[currentImageIndex].annotations);
    }

    // Update modifiedImages state
    const updatedModifiedImages = { ...modifiedImages };
    updatedImages.forEach(image => {
      const imageSplit = image.split || datasetSplit;
      const imageKey = `${imageSplit}/${image.name}`;
      if (!updatedModifiedImages[imageSplit]) {
        updatedModifiedImages[imageSplit] = {};
      }
      updatedModifiedImages[imageSplit][imageKey] = image.annotations;
    });
    setModifiedImages(updatedModifiedImages);

    alert(`Global padding applied to all "${classes[classId]}" annotations!`);
  };

  // Function to reset padding for a class
  const resetClassPadding = (classId) => {
    setClassPadding(prev => {
      const updated = { ...prev };
      delete updated[classId];
      return updated;
    });

    alert(`Padding reset for "${classes[classId]}" annotations!`);
  };

  // Function to handle class renaming
  const handleClassRename = (updatedImages, updatedClasses) => {
    // Update images
    setImages(updatedImages);

    // Persist class changes for downloads by updating modifiedImages cache
    setModifiedImages(prev => {
      const next = { ...prev };
      const splitKey = datasetSplit;
      const splitImages = next[splitKey] ? { ...next[splitKey] } : {};

      updatedImages.forEach(image => {
        if (image?.name) {
          const imageKey = `${splitKey}/${image.name}`;
          splitImages[imageKey] = image.annotations || [];
        }
      });

      next[splitKey] = splitImages;
      return next;
    });

    // Update classes
    setClasses(updatedClasses);

    // Update annotations for the current image
    if (updatedImages[currentImageIndex]) {
      setAnnotations(updatedImages[currentImageIndex].annotations || []);
    }

    // Update selected class if it was renamed
    if (!updatedClasses.includes(selectedClass)) {
      setSelectedClass(updatedClasses[0] || '');
    }
  };

  const validateFileSize = async (file) => {
    const systemMemory = await invoke("get_system_memory");
    const maxAllowedSize = (systemMemory / 1024 / 1024) * 0.1 * 1024 * 1024 * 1024; // 10% of RAM

    if (file.size > maxAllowedSize) {
      const maxGB = (maxAllowedSize / (1024 * 1024 * 1024)).toFixed(2);
      throw new Error(`File too large! Maximum allowed: ${maxGB}GB. Your file: ${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB`);
    }
  };

  function isFileTooLarge(fileSizeBytes, systemMemoryKB) {
    const systemGB = systemMemoryKB / 1024 / 1024;
    const maxAllowed = systemGB * 0.1 * 1024 * 1024 * 1024;

    return fileSizeBytes > maxAllowed;
  }

  const message = async (message) => {
    const txt = await invoke("greet", { name: message });
    console.log(txt);
    const totalMemory = await invoke("get_system_memory");
    console.log("System RAM:", totalMemory, "KB");
  }

  // message("from App.js");

  return (
    <div className="app">
      {currentView === 'editor' ? (
        <>
          <div className="header">
            <h1>🎨 Advanced Dataset Editor</h1>
            <div className="header-controls">
              {/* Tool Buttons */}
              <div className="tool-buttons">
                <button
                  className={`tool-button ${tool === 'select' ? 'active' : ''}`}
                  onClick={() => setTool('select')}
                  title="Select Tool"
                >
                  🖱️ Select
                </button>
                <button
                  className={`tool-button ${tool === 'rectangle' ? 'active' : ''}`}
                  onClick={() => setTool('rectangle')}
                  title="Rectangle Tool"
                >
                  ⬛ Rectangle
                </button>
                <button className="button" onClick={() => setCurrentView('imageCropper')} style={{ marginRight: '10px' }}>
                  🖼️ Image Cropper
                </button>
              </div>

              <div className="header-actions">
                {dataset && (
                  <>
                    <button className="button" onClick={() => setCurrentView('dashboard')} style={{ marginRight: '10px' }}>
                      📊 Dashboard
                    </button>
                    <button className="button" onClick={() => setCurrentView('merge')} style={{ marginRight: '10px' }}>
                      🔄 Merge Datasets
                    </button>
                    <button className="button" onClick={() => setCurrentView('monitor')} style={{ marginRight: '10px' }}>
                      🔍 Dataset Monitor
                    </button>
                    <button className="button" onClick={() => setCurrentView('testing')} style={{ marginRight: '10px' }}>
                      🧪 API Testing
                    </button>
                  </>
                )}
                <button className="button" onClick={saveAnnotations}>💾 Save Annotations</button>
                {dataset && (
                  <>
                    <button className="button" onClick={downloadDataset} style={{ marginLeft: '10px' }}>📦 Download YOLO</button>
                    <button className="button" onClick={downloadDatasetCOCO} style={{ marginLeft: '10px' }}>📦 Download COCO</button>
                  </>
                )}
                <button className="button" onClick={() => window.open('http://localhost:8501', '_blank')} style={{ marginLeft: '10px' }}>🚀 Open Streamlit App</button>
              </div>
            </div>
          </div>

          <div className="main-content">
            {/* Sidebar */}
            <div className="sidebar">
              <h2>📁 Dataset</h2>

              {!dataset ? (
                <div className="dataset-start-options">
                  <h3 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>Choose How to Start</h3>

                  {/* Option 1: Load Existing Dataset */}
                  <div className="start-option-card">
                    <h4>📦 Load Existing YOLO Dataset</h4>
                    <p>Upload a ZIP file containing images and annotations in YOLO format</p>
                    <div {...getRootProps()} className="dropzone" style={{ marginTop: '1rem' }}>
                      <input {...getInputProps()} />
                      {isDragActive ? (
                        <p>Drop the dataset ZIP file here ...</p>
                      ) : (
                        <p>Drag 'n' drop a dataset ZIP file here, or click to select one</p>
                      )}
                      <p style={{ fontSize: '0.9rem', marginTop: '10px' }}>
                        (Supports YOLO format datasets)
                      </p>
                    </div>

                    {/* Dataset Split Selection */}
                    <div className="form-group" style={{ marginTop: '15px' }}>
                      <label>Dataset Split:</label>
                      <select
                        value={datasetSplit}
                        onChange={(e) => setDatasetSplit(e.target.value)}
                      >
                        {availableSplits.map((split) => (
                          <option key={split} value={split}>
                            {split.charAt(0).toUpperCase() + split.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Option 2: Start from Scratch */}
                  <div className="start-option-card">
                    <h4>🎨 Start from Scratch</h4>
                    <p>Upload raw images and create annotations from scratch</p>

                    {/* Class Definition */}
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label>Define Your Classes (comma-separated):</label>
                      <input
                        type="text"
                        placeholder="e.g., person, car, dog"
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                      />
                      <p style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '0.25rem' }}>
                        Enter class names separated by commas
                      </p>
                    </div>

                    {/* Image Upload */}
                    <div
                      {...getRootProps()}
                      className="dropzone"
                      style={{ marginTop: '1rem' }}
                    >
                      <input {...getInputProps()} />
                      {isDragActive ? (
                        <p>Drop images here ...</p>
                      ) : (
                        <p>Drag 'n' drop images here, or click to select</p>
                      )}
                      <p style={{ fontSize: '0.8rem', marginTop: '5px' }}>
                        (Supports JPG, PNG, GIF formats)
                      </p>
                    </div>

                    <button
                      className="button"
                      onClick={() => {
                        if (newClassName.trim()) {
                          const classNames = newClassName.split(',').map(c => c.trim()).filter(c => c);
                          if (classNames.length > 0) {
                            setClasses(classNames);
                            setSelectedClass(classNames[0]);
                            alert(`Classes set: ${classNames.join(', ')}\n\nNow upload your images to start annotating!`);
                          }
                        } else {
                          alert('Please enter at least one class name');
                        }
                      }}
                      style={{ width: '100%', marginTop: '1rem' }}
                    >
                      Set Classes & Start Annotating
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Manual Image Upload Section */}
                  <div className="form-group">
                    <label>➕ Add Images to Current Split ({datasetSplit}):</label>
                    <div
                      {...getRootProps()}
                      className="dropzone"
                      style={{ padding: '1rem', marginBottom: '1rem' }}
                    >
                      <input {...getInputProps()} />
                      {isDragActive ? (
                        <p>Drop images here ...</p>
                      ) : (
                        <p>Drag 'n' drop images here, or click to select files</p>
                      )}
                      <p style={{ fontSize: '0.8rem', marginTop: '5px' }}>
                        (Add individual images to the {datasetSplit} split)
                      </p>
                    </div>
                    <button
                      className="button"
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      style={{ width: '100%', marginBottom: '1rem' }}
                    >
                      📁 Select Images
                    </button>
                  </div>

                  {/* Dataset Split Selection */}
                  <div className="form-group">
                    <label>Dataset Split:</label>
                    <select
                      value={datasetSplit}
                      onChange={(e) => handleDatasetSplitChange(e.target.value)}
                    >
                      {availableSplits.map((split) => (
                        <option key={split} value={split}>
                          {split.charAt(0).toUpperCase() + split.slice(1)}
                        </option>
                      ))}
                    </select>
                    <p style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '5px' }}>
                      Loaded {images.length} images from {datasetSplit} set
                    </p>
                  </div>

                  <div className="form-group">
                    <label>Selected Class:</label>
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                    >
                      {classes.map((cls, index) => (
                        <option key={index} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>

                  {/* Global Padding Controls */}
                  <div className="form-group">
                    <label>Global Padding for "{selectedClass}":</label>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '2px' }}>Width</label>
                        <input
                          type="number"
                          step="0.01"
                          min="-1"
                          max="1"
                          value={classPadding[classes.indexOf(selectedClass)]?.width || 0}
                          onChange={(e) => {
                            const classId = classes.indexOf(selectedClass);
                            const widthPadding = parseFloat(e.target.value) || 0;
                            setClassPadding(prev => ({
                              ...prev,
                              [classId]: {
                                ...(prev[classId] || { height: 0 }),
                                width: widthPadding
                              }
                            }));
                          }}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '2px' }}>Height</label>
                        <input
                          type="number"
                          step="0.01"
                          min="-1"
                          max="1"
                          value={classPadding[classes.indexOf(selectedClass)]?.height || 0}
                          onChange={(e) => {
                            const classId = classes.indexOf(selectedClass);
                            const heightPadding = parseFloat(e.target.value) || 0;
                            setClassPadding(prev => ({
                              ...prev,
                              [classId]: {
                                ...(prev[classId] || { width: 0 }),
                                height: heightPadding
                              }
                            }));
                          }}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        className="button"
                        onClick={() => {
                          const classId = classes.indexOf(selectedClass);
                          const widthPadding = classPadding[classId]?.width || 0;
                          const heightPadding = classPadding[classId]?.height || 0;
                          applyGlobalPadding(classId, widthPadding, heightPadding);
                        }}
                        style={{ flex: 1 }}
                      >
                        Apply to All
                      </button>
                      <button
                        className="button"
                        onClick={() => resetClassPadding(classes.indexOf(selectedClass))}
                        style={{ backgroundColor: '#e74c3c', flex: 1 }}
                      >
                        Reset
                      </button>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#7f8c8d', marginTop: '5px' }}>
                      Values between -1 and 1. Positive values increase size, negative values decrease.
                    </p>
                  </div>

                  {/* Add New Class */}
                  <div className="form-group">
                    <label>Add New Class:</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input
                        type="text"
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        placeholder="Enter new class name"
                        style={{ flex: 1 }}
                      />
                      <button
                        className="button"
                        onClick={addNewClass}
                        style={{ padding: '0.5rem', minWidth: '60px' }}
                      >
                        Add
                      </button>
                    </div>
                  </div>


                  <div className="batch-navigation">
                    <h3>🖼️ Images ({images.length})</h3>
                    <div className="batch-controls">
                      <button
                        className="nav-button"
                        onClick={goToPreviousBatch}
                        disabled={batchStartIndex === 0}
                      >
                        ◀ Prev Batch
                      </button>
                      <span>
                        Batch {currentBatchIndex} of {totalBatches}
                      </span>
                      <button
                        className="nav-button"
                        onClick={goToNextBatch}
                        disabled={batchStartIndex + batchSize >= images.length}
                      >
                        Next Batch ▶
                      </button>
                    </div>
                  </div>

                  {/* Batch Navigation - existing code */}
                  <div className="batch-navigation">
                    <h3>Images ({images.length})</h3>
                    <div className="batch-controls">
                      <button className="nav-button" onClick={goToPreviousBatch} disabled={batchStartIndex === 0}>
                        Prev Batch
                      </button>
                      <span>Batch {currentBatchIndex} of {totalBatches}</span>
                      <button className="nav-button" onClick={goToNextBatch} disabled={batchStartIndex + batchSize >= images.length}>
                        Next Batch
                      </button>
                    </div>
                  </div>

                  {/* Class-wise Batch Filter */}
                  <div className="form-group" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e0e0e0' }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={isClassWiseBatch}
                        onChange={(e) => {
                          setIsClassWiseBatch(e.target.checked);
                          setBatchStartIndex(0); // Reset to first batch
                          if (e.target.checked) {
                            setClassWiseBatchClass(classes.indexOf(selectedClass));
                          }
                        }}
                      />
                      {' '}Filter batch by class
                    </label>

                    {isClassWiseBatch && (
                      <>
                        <select
                          value={classWiseBatchClass !== null ? classWiseBatchClass : classes.indexOf(selectedClass)}
                          onChange={(e) => {
                            setClassWiseBatchClass(parseInt(e.target.value));
                            setBatchStartIndex(0); // Reset to first batch when changing class
                          }}
                          style={{ marginTop: '10px', width: '100%' }}
                        >
                          {classes.map((cls, index) => {
                            const imageCount = getImagesWithClass(index).length;
                            return (
                              <option key={index} value={index}>
                                {cls} ({imageCount} images)
                              </option>
                            );
                          })}
                        </select>

                        <p style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '5px' }}>
                          Showing {getImagesWithClass(classWiseBatchClass).length} images with "{classes[classWiseBatchClass]}" annotations
                        </p>
                      </>
                    )}
                  </div>



                  {/* Thumbnail Grid */}
                  <div style={{ height: '500px', width: '100%' }}>
                    <VirtualImageGrid
                      images={currentBatch}
                      onImageClick={(index) => {
                        const actualIndex = images.findIndex(img => img.id === currentBatch[index].id);
                        handleImageSelect(actualIndex);
                      }}
                      selectedIndex={currentImageIndex}
                    />
                  </div>


                  {/* Annotation Editing Panel */}
                  {selectedAnnotations.length > 0 && (
                    <div className="annotation-edit-panel">
                      {selectedAnnotation && selectedAnnotations.length === 1 ? (
                        // Single annotation editing
                        <>
                          <h3>✏️ Edit Annotation</h3>
                          <div className="form-group">
                            <label>Class:</label>
                            <select
                              value={(editingAnnotation?.classId !== undefined && editingAnnotation?.classId !== null) ? editingAnnotation.classId : (selectedAnnotation?.classId || 0)}
                              onChange={(e) => {
                                const newClassId = parseInt(e.target.value);
                                if (selectedAnnotation) {
                                  handleAnnotationClassChange(selectedAnnotation.id, newClassId);
                                  setEditingAnnotation({ ...editingAnnotation, classId: newClassId });
                                }
                              }}
                            >
                              {classes.map((cls, index) => (
                                <option key={index} value={index}>{cls}</option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Width:</label>
                            <input
                              type="number"
                              step="0.001"
                              value={(editingAnnotation?.width !== undefined && editingAnnotation?.width !== null) ? editingAnnotation.width : (selectedAnnotation?.width || 0)}
                              onChange={(e) => {
                                const newWidth = parseFloat(e.target.value);
                                if (selectedAnnotation) {
                                  handleAnnotationSizeChange(selectedAnnotation.id, newWidth, (editingAnnotation?.height !== undefined && editingAnnotation?.height !== null) ? editingAnnotation.height : (selectedAnnotation?.height || 0));
                                  setEditingAnnotation({ ...editingAnnotation, width: newWidth });
                                }
                              }}
                            />
                          </div>

                          <div className="form-group">
                            <label>Height:</label>
                            <input
                              type="number"
                              step="0.001"
                              value={(editingAnnotation?.height !== undefined && editingAnnotation?.height !== null) ? editingAnnotation.height : (selectedAnnotation?.height || 0)}
                              onChange={(e) => {
                                const newHeight = parseFloat(e.target.value);
                                if (selectedAnnotation) {
                                  handleAnnotationSizeChange(selectedAnnotation.id, (editingAnnotation?.width !== undefined && editingAnnotation?.width !== null) ? editingAnnotation.width : (selectedAnnotation?.width || 0), newHeight);
                                  setEditingAnnotation({ ...editingAnnotation, height: newHeight });
                                }
                              }}
                            />
                          </div>

                          <button
                            className="delete-btn"
                            onClick={() => selectedAnnotation && handleAnnotationDelete(selectedAnnotation.id)}
                            style={{ width: '100%', marginTop: '10px' }}
                          >
                            Delete Annotation
                          </button>
                        </>
                      ) : selectedAnnotations.length > 1 ? (
                        // Multiple annotation info
                        <>
                          <h3>✏️ Multiple Annotations Selected</h3>
                          <p>{selectedAnnotations.length} annotations selected</p>
                          <button
                            className="delete-btn"
                            onClick={handleMultipleAnnotationDelete}
                            style={{ width: '100%', marginTop: '10px' }}
                          >
                            Delete All Selected
                          </button>
                        </>
                      ) : null}
                    </div>
                  )}

                  {/* Annotations List */}
                  {annotations.length > 0 && (
                    <div className="annotation-list">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3>📝 Annotations ({annotations.length})</h3>
                        {selectedAnnotations.length > 1 && (
                          <button
                            className="delete-btn"
                            onClick={handleMultipleAnnotationDelete}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          >
                            Delete {selectedAnnotations.length} Selected
                          </button>
                        )}
                      </div>
                      {annotations.map((annotation) => (
                        <div
                          key={annotation.id}
                          className={`annotation-item ${selectedAnnotations.includes(annotation.id) ? 'active' : ''}`}
                          onClick={(e) => handleAnnotationSelect(annotation, e)}
                        >
                          <div className="annotation-item-header">
                            <h4>Annotation #{annotation.id}</h4>
                            <button
                              className="delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAnnotationDelete(annotation.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                          <p>Class: {classes[annotation.classId] || 'Unknown'}</p>
                          <p>Center: ({annotation.centerX.toFixed(3)}, {annotation.centerY.toFixed(3)})</p>
                          <p>Size: {annotation.width.toFixed(3)} × {annotation.height.toFixed(3)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Main Canvas Area */}
            <div className="canvas-container">
              <div className="canvas-wrapper">
                {currentImage ? (
                  <Stage
                    ref={stageRef}
                    width={stageSize.width}
                    height={stageSize.height}
                    onMouseDown={(e) => {
                      handleMouseDown(e);
                      handleStageMouseDown(e);
                    }}
                    onMouseMove={(e) => {
                      handleMouseMove(e);
                      handleStageMouseMove(e);
                    }}
                    onMouseUp={handleMouseUp}
                    onWheel={handleZoom}
                    scaleX={scale}
                    scaleY={scale}
                    x={stagePos.x}
                    y={stagePos.y}
                    style={{ cursor: tool === 'rectangle' ? 'crosshair' : isDragging || isResizing ? 'move' : 'default' }}
                    onMouseEnter={handleStageMouseEnter}
                    onMouseLeave={handleStageMouseLeave}
                  >
                    <Layer>
                      {/* Image */}
                      <KonvaImage
                        ref={imageRef}
                        image={preloadedImage}
                        x={0}
                        y={0}
                        width={stageSize.width}
                        height={stageSize.height}
                      />

                      {/* Crosshair lines */}
                      {showCrosshair && tool === 'rectangle' && (
                        <>
                          <Line
                            points={[crosshairPos.x, 0, crosshairPos.x, stageSize.height]}
                            stroke="#000000"
                            strokeWidth={1}
                            dash={[5, 5]}
                          />
                          <Line
                            points={[0, crosshairPos.y, stageSize.width, crosshairPos.y]}
                            stroke="#000000"
                            strokeWidth={1}
                            dash={[5, 5]}
                          />
                        </>
                      )}

                      {/* Existing Annotations */}
                      {annotations.map((annotation) => {
                        const pixelCoords = normalizedToPixel(
                          annotation,
                          stageSize.width,
                          stageSize.height
                        );

                        const x = pixelCoords.x - pixelCoords.width / 2;
                        const y = pixelCoords.y - pixelCoords.height / 2;
                        const classColor = getClassColor(annotation.classId);

                        // Check if this annotation is selected (single or multiple)
                        const isSelected = (selectedAnnotation && selectedAnnotation.id === annotation.id) ||
                          selectedAnnotations.includes(annotation.id);

                        return (
                          <React.Fragment key={annotation.id}>
                            <Rect
                              x={x}
                              y={y}
                              width={pixelCoords.width}
                              height={pixelCoords.height}
                              stroke={isSelected ? "#ff0000" : classColor}
                              strokeWidth={isSelected ? 3 : 2}
                              fill={isSelected ? "rgba(255, 0, 0, 0.3)" : `rgba(${parseInt(classColor.slice(1, 3), 16)}, ${parseInt(classColor.slice(3, 5), 16)}, ${parseInt(classColor.slice(5, 7), 16)}, 0.2)`}
                              onClick={(e) => handleAnnotationSelect(annotation, e.evt)}
                              onContextMenu={(e) => handleContextMenu(e, annotation)}
                              onMouseEnter={(e) => {
                                setHoveredAnnotation(annotation);
                              }}
                              onMouseLeave={(e) => {
                                setHoveredAnnotation(null);
                              }}
                            />

                            {/* Resize handles for selected annotation */}
                            {selectedAnnotation && selectedAnnotation.id === annotation.id && (
                              <>
                                {/* Northwest handle */}
                                <Rect
                                  x={x - 5 / scale}
                                  y={y - 5 / scale}
                                  width={10 / scale}
                                  height={10 / scale}
                                  fill="#ffffff"
                                  stroke="#000000"
                                  strokeWidth={1 / scale}
                                />
                                {/* Northeast handle */}
                                <Rect
                                  x={x + pixelCoords.width - 5 / scale}
                                  y={y - 5 / scale}
                                  width={10 / scale}
                                  height={10 / scale}
                                  fill="#ffffff"
                                  stroke="#000000"
                                  strokeWidth={1 / scale}
                                />
                                {/* Southwest handle */}
                                <Rect
                                  x={x - 5 / scale}
                                  y={y + pixelCoords.height - 5 / scale}
                                  width={10 / scale}
                                  height={10 / scale}
                                  fill="#ffffff"
                                  stroke="#000000"
                                  strokeWidth={1 / scale}
                                />
                                {/* Southeast handle */}
                                <Rect
                                  x={x + pixelCoords.width - 5 / scale}
                                  y={y + pixelCoords.height - 5 / scale}
                                  width={10 / scale}
                                  height={10 / scale}
                                  fill="#ffffff"
                                  stroke="#000000"
                                  strokeWidth={1 / scale}
                                />
                              </>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* Hover Tooltip */}
                      {hoveredAnnotation && (
                        (() => {
                          const annotation = hoveredAnnotation;
                          const pixelCoords = normalizedToPixel(
                            annotation,
                            stageSize.width,
                            stageSize.height
                          );

                          const x = pixelCoords.x - pixelCoords.width / 2;
                          const y = pixelCoords.y - pixelCoords.height / 2;
                          const classColor = getClassColor(annotation.classId);

                          return (
                            <Text
                              x={x}
                              y={y - 20}
                              text={classes[annotation.classId] || 'Unknown'}
                              fill={classColor}
                              fontSize={14}
                              fontStyle="bold"
                              shadowColor="black"
                              shadowBlur={2}
                              shadowOpacity={0.5}
                            />
                          );
                        })()
                      )}

                      {/* New Annotation Being Drawn */}
                      {newAnnotation && (
                        <Rect
                          x={Math.min(newAnnotation.x, newAnnotation.x + newAnnotation.width)}
                          y={Math.min(newAnnotation.y, newAnnotation.y + newAnnotation.height)}
                          width={Math.abs(newAnnotation.width)}
                          height={Math.abs(newAnnotation.height)}
                          stroke="#ff0000"
                          strokeWidth={2}
                          dash={[5, 5]}
                          fill="rgba(255, 0, 0, 0.1)"
                        />
                      )}
                    </Layer>
                  </Stage>
                ) : (
                  <div style={{ textAlign: 'center', color: '#7f8c8d' }}>
                    <h2>🖼️ Upload a Dataset to Get Started</h2>
                    <p>Drag and drop a ZIP file containing your dataset</p>
                  </div>
                )}
              </div>

              {/* Tools Panel */}
              <div className="tools-panel">
                <button
                  className="button"
                  onClick={goToPreviousImage}
                  disabled={currentImageIndex <= 0}
                >
                  ◀ Previous
                </button>

                <span>
                  Image {currentImageIndex + 1} of {images.length}
                </span>

                <button
                  className="button"
                  onClick={goToNextImage}
                  disabled={currentImageIndex >= images.length - 1}
                >
                  Next ▶
                </button>
              </div>
            </div>
          </div>

          <div className="status-bar">
            {dataset && (
              <span>Dataset loaded: {dataset.name || 'Uploaded dataset'} | Split: {datasetSplit} ({images.length} images)</span>
            )}
            {tool === 'rectangle' && (
              <span style={{ marginLeft: '20px' }}>Drawing rectangles: Click and drag on the image</span>
            )}
            {tool === 'select' && selectedAnnotation && (
              <span style={{ marginLeft: '20px' }}>Selected annotation: Drag to move, use corner handles to resize</span>
            )}
          </div>

          {/* Context Menu */}
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            visible={contextMenu.visible}
            onClose={closeContextMenu}
            options={getContextMenuOptions()}
            annotation={contextMenu.annotation}
          />
        </>
      ) : currentView === 'dashboard' ? (
        <Dashboard
          images={dashboardImages && dashboardImages.length > 0 ? dashboardImages : (images || [])}
          classes={classes}
          onBackToEditor={() => setCurrentView('editor')}
          onImagesUpdate={(updatedData) => {
            // updatedData can be { images, classes } or just images
            if (updatedData && updatedData.images && updatedData.classes) {
              const updatedImages = updatedData.images;
              const updatedClasses = updatedData.classes;

              // Update dashboard images
              setDashboardImages(updatedImages);

              // Persist changes back into modifiedImages per split
              setModifiedImages(prev => {
                const next = { ...prev };
                updatedImages.forEach(img => {
                  if (!img?.name || !img?.split) return;
                  const splitKey = img.split;
                  const imageKey = `${splitKey}/${img.name}`;
                  const splitImages = next[splitKey] ? { ...next[splitKey] } : {};
                  splitImages[imageKey] = img.annotations || [];
                  next[splitKey] = splitImages;
                });
                return next;
              });

              // If we're currently viewing one of the updated split images, refresh images/annotations
              if (datasetSplit && images && images.length > 0) {
                const currentName = images[currentImageIndex]?.name;
                if (currentName) {
                  const updatedForCurrentSplit = updatedImages.filter(img => img.split === datasetSplit);
                  if (updatedForCurrentSplit.length > 0) {
                    setImages(updatedForCurrentSplit);
                    const match = updatedForCurrentSplit.find(img => img.name === currentName) || updatedForCurrentSplit[0];
                    setAnnotations(match.annotations || []);
                    setCurrentImageIndex(updatedForCurrentSplit.findIndex(img => img.name === match.name));
                  }
                }
              }

              // Update classes using existing handler
              handleClassRename(updatedImages, updatedClasses);
            } else {
              const updatedImages = Array.isArray(updatedData) ? updatedData : (updatedData?.images || []);

              // Update dashboard images
              setDashboardImages(updatedImages);

              // Persist changes back into modifiedImages per split
              setModifiedImages(prev => {
                const next = { ...prev };
                updatedImages.forEach(img => {
                  if (!img?.name || !img?.split) return;
                  const splitKey = img.split;
                  const imageKey = `${splitKey}/${img.name}`;
                  const splitImages = next[splitKey] ? { ...next[splitKey] } : {};
                  splitImages[imageKey] = img.annotations || [];
                  next[splitKey] = splitImages;
                });
                return next;
              });

              // If we're currently viewing one of the updated split images, refresh images/annotations
              if (datasetSplit && images && images.length > 0) {
                const currentName = images[currentImageIndex]?.name;
                if (currentName) {
                  const updatedForCurrentSplit = updatedImages.filter(img => img.split === datasetSplit);
                  if (updatedForCurrentSplit.length > 0) {
                    setImages(updatedForCurrentSplit);
                    const match = updatedForCurrentSplit.find(img => img.name === currentName) || updatedForCurrentSplit[0];
                    setAnnotations(match.annotations || []);
                    setCurrentImageIndex(updatedForCurrentSplit.findIndex(img => img.name === match.name));
                  }
                }
              }
            }
          }}
        />
      ) : currentView === 'merge' ? (
        <MergeDatasets
          onBackToEditor={() => setCurrentView('editor')}
        />
      )
        // : currentView === 'testing' ? (
        //   <TestingSection 
        //     onBackToEditor={() => setCurrentView('editor')} 
        //   />
        // ) 
        : currentView === 'monitor' ? (
          <DatasetMonitor
            images={images}
            classes={classes}
            datasetSplit={datasetSplit}
            availableSplits={availableSplits}
            onDatasetSplitChange={handleDatasetSplitChange}
            onImageSelect={handleImageSelect}
            onBackToEditor={() => setCurrentView('editor')}
          />
        ) : (
          <ImageCropper setCurrentView={setCurrentView} />
        )}

      {/* Loading Progress Overlay */}
      {loadingProgress.active && (
        <LoadingProgress
          current={loadingProgress.current}
          total={loadingProgress.total}
          stage={loadingProgress.stage}
          memoryUsage={memoryInfo}
          showMemory={true}
          onCancel={loadingProgress.canCancel ? () => setLoadingCancelled(true) : null}
        />
      )}

      {/* Memory Monitor Display (optional, in status bar) */}
      <div className="status-bar">
        {dataset ? (
          <span>
            Dataset loaded: {dataset.name || 'Uploaded dataset'} |
            Split: {datasetSplit} ({images.length} images) |
            Memory: {formatBytes(memoryInfo.processMemory)} / {formatBytes(memoryInfo.totalMemory)}
            {memoryInfo.warning && ' ⚠️'}
          </span>
        ) : (
          <span>Ready to load dataset</span>
        )}
      </div>
    </div>
  );
};

export default App;