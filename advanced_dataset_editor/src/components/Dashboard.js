import React, { useState, useEffect, useRef } from 'react';
import '../styles/styles.css';

const Dashboard = ({ images, classes, onBackToEditor, onImagesUpdate }) => {
  const [classStats, setClassStats] = useState([]);
  const [totalAnnotations, setTotalAnnotations] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [sourceClass, setSourceClass] = useState('');
  const [targetClass, setTargetClass] = useState('');
  const [mergedImages, setMergedImages] = useState(null);
  const [renameClassId, setRenameClassId] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [mergeAllClassName, setMergeAllClassName] = useState('');
  const [selectedClassForCrops, setSelectedClassForCrops] = useState(null);
  const [classCrops, setClassCrops] = useState([]);
  const [showCropViewer, setShowCropViewer] = useState(false);
  const [classPreviewThumbnails, setClassPreviewThumbnails] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCrops, setTotalCrops] = useState(0);
  const [cropMetadata, setCropMetadata] = useState([]);
  const itemsPerPage = 50;

  // Multi-select state
  const [selectedCrops, setSelectedCrops] = useState([]); // Array of selected crop IDs
  const [isSelectionMode, setIsSelectionMode] = useState(false); // Toggle selection mode

  // ============================================
  // PERFORMANCE OPTIMIZATION: Image Cache with LRU
  // ============================================
  const imageCache = useRef(new Map()); // Map<imageSrc, {img: Image, lastUsed: timestamp}>
  const MAX_CACHE_SIZE = 200; // Limit to prevent memory issues

  // LRU cache management
  const getCachedImage = (imageSrc) => {
    const cached = imageCache.current.get(imageSrc);
    if (cached) {
      cached.lastUsed = Date.now();
      return cached.img;
    }
    return null;
  };

  const setCachedImage = (imageSrc, img) => {
    // Evict oldest entries if cache is full
    if (imageCache.current.size >= MAX_CACHE_SIZE) {
      let oldestKey = null;
      let oldestTime = Infinity;

      imageCache.current.forEach((value, key) => {
        if (value.lastUsed < oldestTime) {
          oldestTime = value.lastUsed;
          oldestKey = key;
        }
      });

      if (oldestKey) {
        imageCache.current.delete(oldestKey);
      }
    }

    imageCache.current.set(imageSrc, {
      img,
      lastUsed: Date.now()
    });
  };

  // Clear cache on unmount
  useEffect(() => {
    return () => {
      imageCache.current.clear();
    };
  }, []);

  useEffect(() => {
    // Calculate statistics
    if (images && images.length > 0) {
      // Total images
      setTotalImages(images.length);

      // Initialize class statistics
      const stats = classes.map((cls, index) => ({
        id: index,
        name: cls,
        count: 0,
        percentage: 0
      }));

      // Count annotations per class
      let totalAnnotationsCount = 0;
      images.forEach(image => {
        if (image.annotations) {
          image.annotations.forEach(annotation => {
            if (annotation.classId >= 0 && annotation.classId < stats.length) {
              stats[annotation.classId].count++;
              totalAnnotationsCount++;
            }
          });
        }
      });

      // Calculate percentages
      stats.forEach(stat => {
        stat.percentage = totalAnnotationsCount > 0
          ? ((stat.count / totalAnnotationsCount) * 100).toFixed(2)
          : 0;
      });

      setClassStats(stats);
      setTotalAnnotations(totalAnnotationsCount);
    } else {
      // Reset if no images
      setClassStats(classes.map((cls, index) => ({
        id: index,
        name: cls,
        count: 0,
        percentage: 0
      })));
      setTotalAnnotations(0);
      setTotalImages(0);
    }
  }, [images, classes]);

  // Keep track of which annotation was used for each thumbnail to avoid unnecessary regeneration
  const [thumbnailSources, setThumbnailSources] = useState({});

  // Generate preview thumbnails for each class
  useEffect(() => {
    const generatePreviewThumbnails = async () => {
      if (!images || images.length === 0 || !classes || classes.length === 0) {
        setClassPreviewThumbnails({});
        setThumbnailSources({});
        return;
      }

      const newThumbnails = { ...classPreviewThumbnails };
      const newSources = { ...thumbnailSources };
      let hasChanges = false;

      for (let classId = 0; classId < classes.length; classId++) {
        // Find first annotation for this class
        let foundAnnotation = null;
        let foundImage = null;
        let foundSourceKey = null;

        for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
          const image = images[imgIdx];
          if (image.annotations) {
            const annIdx = image.annotations.findIndex(ann => ann.classId === classId);
            if (annIdx !== -1) {
              foundAnnotation = image.annotations[annIdx];
              foundImage = image;
              // Create a unique key for this annotation source
              // Use image path/name + annotation coordinates as key
              foundSourceKey = `${image.src}-${foundAnnotation.centerX}-${foundAnnotation.centerY}`;
              break;
            }
          }
        }

        if (foundAnnotation && foundImage) {
          // Check if we already have a thumbnail from this exact source
          if (newSources[classId] === foundSourceKey && newThumbnails[classId]) {
            continue; // Skip regeneration
          }

          // Extract crop thumbnail
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = foundImage.src;

            await new Promise((resolve) => {
              img.onload = () => {
                const imgWidth = img.width;
                const imgHeight = img.height;

                const cropX = (foundAnnotation.centerX - foundAnnotation.width / 2) * imgWidth;
                const cropY = (foundAnnotation.centerY - foundAnnotation.height / 2) * imgHeight;
                const cropWidth = foundAnnotation.width * imgWidth;
                const cropHeight = foundAnnotation.height * imgHeight;

                // Set canvas to thumbnail size (max 80x80)
                const maxSize = 80;
                const scale = Math.min(maxSize / cropWidth, maxSize / cropHeight, 1);
                canvas.width = cropWidth * scale;
                canvas.height = cropHeight * scale;

                ctx.drawImage(
                  img,
                  cropX, cropY, cropWidth, cropHeight,
                  0, 0, canvas.width, canvas.height
                );

                newThumbnails[classId] = canvas.toDataURL();
                newSources[classId] = foundSourceKey;
                hasChanges = true;
                resolve();
              };

              if (img.complete) {
                img.onload();
              }

              img.onerror = () => {
                console.error(`Failed to load image for thumbnail: ${foundImage.src}`);
                resolve(); // Resolve anyway to continue
              };
            });
          } catch (error) {
            console.error(`Error generating thumbnail for class ${classId}:`, error);
          }
        } else if (newThumbnails[classId]) {
          // Class no longer has annotations, remove thumbnail
          delete newThumbnails[classId];
          delete newSources[classId];
          hasChanges = true;
        }
      }

      if (hasChanges) {
        setClassPreviewThumbnails(newThumbnails);
        setThumbnailSources(newSources);
      }
    };

    generatePreviewThumbnails();
  }, [images, classes]);

  // Function to extract annotation crop metadata for a specific class (lightweight)
  // OPTIMIZED: Supports incremental updates to avoid scanning all images
  const extractClassCropMetadata = (classId, imageData = null, affectedImageIndices = null) => {
    const sourceImages = imageData || images;

    // If affectedImageIndices is provided, do incremental update
    if (affectedImageIndices && affectedImageIndices.size > 0) {
      // Start with existing metadata and update only affected images
      const metadata = cropMetadata.filter(meta => !affectedImageIndices.has(meta.imageIndex));

      // Add updated metadata for affected images
      affectedImageIndices.forEach(imageIndex => {
        if (imageIndex >= 0 && imageIndex < sourceImages.length) {
          const image = sourceImages[imageIndex];
          if (image.annotations) {
            image.annotations.forEach((annotation, annotationIndex) => {
              if (annotation.classId === classId) {
                metadata.push({
                  id: `${imageIndex}-${annotationIndex}`,
                  imageName: image.name,
                  imageIndex: imageIndex,
                  annotationIndex: annotationIndex,
                  annotation: annotation,
                  imageSrc: image.src
                });
              }
            });
          }
        }
      });

      return metadata;
    }

    // Full scan (only when necessary - initial load or class change)
    const metadata = [];
    sourceImages.forEach((image, imageIndex) => {
      if (image.annotations) {
        image.annotations.forEach((annotation, annotationIndex) => {
          if (annotation.classId === classId) {
            // Store only metadata, not the actual image processing
            metadata.push({
              id: `${imageIndex}-${annotationIndex}`,
              imageName: image.name,
              imageIndex: imageIndex,
              annotationIndex: annotationIndex,
              annotation: annotation,
              imageSrc: image.src
            });
          }
        });
      }
    });

    return metadata;
  };

  // Function to process crops for a specific page
  // OPTIMIZED: Uses image cache to avoid reloading same images
  const processPageCrops = async (metadata, page, perPage) => {
    const startIndex = (page - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, metadata.length);
    const pageMetadata = metadata.slice(startIndex, endIndex);

    // Collect unique image sources needed for this page
    const uniqueImageSources = new Set(pageMetadata.map(meta => meta.imageSrc));
    const imagesToLoad = new Map(); // Map<imageSrc, Promise<Image>>

    // Load all unique images in parallel (check cache first)
    uniqueImageSources.forEach(imageSrc => {
      const cachedImg = getCachedImage(imageSrc);
      if (cachedImg) {
        // Image already cached, use it
        imagesToLoad.set(imageSrc, Promise.resolve(cachedImg));
      } else {
        // Need to load the image
        imagesToLoad.set(imageSrc, new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            setCachedImage(imageSrc, img);
            resolve(img);
          };
          img.onerror = () => reject(new Error(`Failed to load: ${imageSrc}`));
          img.src = imageSrc;
        }));
      }
    });

    // Wait for all images to load
    const loadedImagesMap = new Map();
    try {
      const results = await Promise.all(
        Array.from(imagesToLoad.entries()).map(async ([src, promise]) => {
          const img = await promise;
          return [src, img];
        })
      );
      results.forEach(([src, img]) => loadedImagesMap.set(src, img));
    } catch (error) {
      console.error('Error loading images for crops:', error);
    }

    // Process all crops using the loaded images
    const processedCrops = pageMetadata.map((cropMeta) => {
      const img = loadedImagesMap.get(cropMeta.imageSrc);
      if (!img) {
        console.error(`Image not loaded for crop: ${cropMeta.imageSrc}`);
        return null;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const imgWidth = img.width;
      const imgHeight = img.height;

      // Calculate crop dimensions in pixels
      const cropX = (cropMeta.annotation.centerX - cropMeta.annotation.width / 2) * imgWidth;
      const cropY = (cropMeta.annotation.centerY - cropMeta.annotation.height / 2) * imgHeight;
      const cropWidth = cropMeta.annotation.width * imgWidth;
      const cropHeight = cropMeta.annotation.height * imgHeight;

      // Set canvas size to crop size
      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // Draw the cropped portion
      ctx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );

      // Convert to data URL
      const cropDataUrl = canvas.toDataURL();

      return {
        id: cropMeta.id,
        imageName: cropMeta.imageName,
        imageIndex: cropMeta.imageIndex,
        annotationIndex: cropMeta.annotationIndex,
        cropSrc: cropDataUrl,
        annotation: cropMeta.annotation
      };
    }).filter(Boolean); // Remove any null entries

    return processedCrops;
  };

  // Function to view crops for a specific class with pagination
  const viewClassCrops = async (classId, className) => {
    setSelectedClassForCrops({ id: classId, name: className });

    // Extract metadata for all crops (lightweight operation)
    const metadata = extractClassCropMetadata(classId);
    setCropMetadata(metadata);
    setTotalCrops(metadata.length);
    setCurrentPage(1);

    // Process only the first page
    const processedCrops = await processPageCrops(metadata, 1, itemsPerPage);
    setClassCrops(processedCrops);
    setShowCropViewer(true);
  };

  // Function to load a specific page
  const loadPage = async (page) => {
    if (page < 1 || page > Math.ceil(totalCrops / itemsPerPage)) {
      return;
    }

    setCurrentPage(page);
    const processedCrops = await processPageCrops(cropMetadata, page, itemsPerPage);
    setClassCrops(processedCrops);
  };

  // Function to close crop viewer
  const closeCropViewer = () => {
    setShowCropViewer(false);
    setSelectedClassForCrops(null);
    setClassCrops([]);
    setCropMetadata([]);
    setTotalCrops(0);
    setCurrentPage(1);
    setSelectedCrops([]);
    setIsSelectionMode(false);
  };

  // ============================================
  // MULTI-SELECT FUNCTIONS
  // ============================================

  // Function to toggle selection mode
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedCrops([]);
    }
  };

  // Function to toggle individual crop selection
  const toggleCropSelection = (cropId) => {
    setSelectedCrops(prev => {
      if (prev.includes(cropId)) {
        return prev.filter(id => id !== cropId);
      } else {
        return [...prev, cropId];
      }
    });
  };

  // Function to select all crops on current page
  const selectAllOnPage = () => {
    const allCropIds = classCrops.map(crop => crop.id);
    setSelectedCrops(allCropIds);
  };

  // Function to deselect all
  const deselectAll = () => {
    setSelectedCrops([]);
  };

  // Function to bulk delete selected crops
  // OPTIMIZED: Uses incremental metadata updates
  const bulkDeleteCrops = async () => {
    if (selectedCrops.length === 0) {
      alert('No crops selected');
      return;
    }

    if (!window.confirm(`Delete ${selectedCrops.length} selected crop(s)?`)) {
      return;
    }

    // Optimization: Avoid deep copy of all images
    const updatedImages = [...images];

    // Map crop IDs to their image and annotation indices
    const cropsToDelete = selectedCrops.map(cropId => {
      const crop = classCrops.find(c => c.id === cropId);
      return crop ? { imageIndex: crop.imageIndex, annotationIndex: crop.annotationIndex } : null;
    }).filter(Boolean);

    // Group by image index and track affected images
    const cropsByImage = {};
    const affectedImageIndices = new Set();
    cropsToDelete.forEach(item => {
      if (!cropsByImage[item.imageIndex]) {
        cropsByImage[item.imageIndex] = [];
      }
      cropsByImage[item.imageIndex].push(item.annotationIndex);
      affectedImageIndices.add(item.imageIndex);
    });

    // Process each affected image
    Object.keys(cropsByImage).forEach(idxStr => {
      const imageIndex = parseInt(idxStr);
      const indices = cropsByImage[imageIndex].sort((a, b) => b - a); // Descending order

      // Shallow copy the image and its annotations
      const image = updatedImages[imageIndex];
      const newAnnotations = [...image.annotations];

      // Remove annotations
      indices.forEach(annIdx => {
        if (annIdx >= 0 && annIdx < newAnnotations.length) {
          newAnnotations.splice(annIdx, 1);
        }
      });

      // Update the image in the array
      updatedImages[imageIndex] = {
        ...image,
        annotations: newAnnotations
      };
    });

    // Refresh crop viewer with INCREMENTAL update
    if (selectedClassForCrops) {
      const metadata = extractClassCropMetadata(selectedClassForCrops.id, updatedImages, affectedImageIndices);
      setCropMetadata(metadata);
      setTotalCrops(metadata.length);

      const totalPages = Math.ceil(metadata.length / itemsPerPage);
      const newPage = currentPage > totalPages ? Math.max(1, totalPages) : currentPage;
      setCurrentPage(newPage);

      const processedCrops = await processPageCrops(metadata, newPage, itemsPerPage);
      setClassCrops(processedCrops);
    }

    setSelectedCrops([]);

    if (onImagesUpdate) {
      onImagesUpdate({
        images: updatedImages,
        classes: classes
      });
    }

    alert(`Deleted ${cropsToDelete.length} crop(s) successfully!`);
  };

  // Function to bulk change class for selected crops
  // OPTIMIZED: Uses incremental metadata updates
  const bulkChangeClass = async (newClassId) => {
    if (selectedCrops.length === 0) {
      alert('No crops selected');
      return;
    }

    const className = classes[newClassId];
    if (!window.confirm(`Change ${selectedCrops.length} selected crop(s) to class "${className}"?`)) {
      return;
    }

    // Optimization: Avoid deep copy
    const updatedImages = [...images];
    const targetClassId = parseInt(newClassId);
    const affectedImageIndices = new Set();

    selectedCrops.forEach(cropId => {
      const crop = classCrops.find(c => c.id === cropId);
      if (crop) {
        const imageIndex = crop.imageIndex;
        const annotationIndex = crop.annotationIndex;

        affectedImageIndices.add(imageIndex);

        // Clone image if not already cloned in this operation
        if (updatedImages[imageIndex] === images[imageIndex]) {
          updatedImages[imageIndex] = {
            ...images[imageIndex],
            annotations: [...images[imageIndex].annotations]
          };
        }

        // Clone annotation and update
        const image = updatedImages[imageIndex];
        if (image.annotations[annotationIndex]) {
          image.annotations[annotationIndex] = {
            ...image.annotations[annotationIndex],
            classId: targetClassId
          };
        }
      }
    });

    // Refresh crop viewer with INCREMENTAL update
    if (selectedClassForCrops) {
      const metadata = extractClassCropMetadata(selectedClassForCrops.id, updatedImages, affectedImageIndices);
      setCropMetadata(metadata);
      setTotalCrops(metadata.length);

      const totalPages = Math.ceil(metadata.length / itemsPerPage);
      const newPage = currentPage > totalPages ? Math.max(1, totalPages) : currentPage;
      setCurrentPage(newPage);

      const processedCrops = await processPageCrops(metadata, newPage, itemsPerPage);
      setClassCrops(processedCrops);
    }

    setSelectedCrops([]);

    if (onImagesUpdate) {
      onImagesUpdate({
        images: updatedImages,
        classes: classes
      });
    }

    alert(`Changed ${selectedCrops.length} crop(s) to class "${className}" successfully!`);
  };

  // Function to remove a specific annotation from the dataset
  // OPTIMIZED: Uses incremental metadata updates
  const removeAnnotationAndImageFromFile = async (imageIndex, annotationIndex) => {
    if (!window.confirm("Remove annotation and image from disk?")) return;

    // Optimization: Avoid deep copy
    const updatedImages = [...images];
    const image = updatedImages[imageIndex];

    // Clone annotations
    const newAnnotations = [...image.annotations];
    const annotation = newAnnotations[annotationIndex];

    // Remove from memory
    newAnnotations.splice(annotationIndex, 1);

    updatedImages[imageIndex] = {
      ...image,
      annotations: newAnnotations
    };

    // Remove from disk if paths exist
    if (annotation.annotationFilePath) {
      try {
        await invoke("delete_annotation_from_disk", {
          annotationPath: annotation.annotationFilePath
        });
      } catch (err) {
        console.error("Failed to delete annotation from disk:", err);
      }
    }

    if (image.imagePath) {
      try {
        await invoke("delete_image", { imagePath: image.imagePath });
      } catch (err) {
        console.error("Failed to delete image from disk:", err);
      }
    }

    // Refresh UI with INCREMENTAL update
    if (selectedClassForCrops) {
      const affectedImageIndices = new Set([imageIndex]);
      const metadata = extractClassCropMetadata(selectedClassForCrops.id, updatedImages, affectedImageIndices);
      setCropMetadata(metadata);
      setTotalCrops(metadata.length);

      const totalPages = Math.ceil(metadata.length / itemsPerPage);
      const newPage = currentPage > totalPages ? Math.max(1, totalPages) : currentPage;
      setCurrentPage(newPage);

      const processedCrops = await processPageCrops(metadata, newPage, itemsPerPage);
      setClassCrops(processedCrops);
    }

    onImagesUpdate({
      images: updatedImages,
      classes: classes
    });
  };

  // Function to change the class of a specific annotation
  // OPTIMIZED: Uses incremental metadata updates
  const changeAnnotationClass = async (imageIndex, annotationIndex, newClassId) => {
    // Optimization: Avoid deep copy
    const updatedImages = [...images];

    // Clone image and annotations
    const image = updatedImages[imageIndex];
    const newAnnotations = [...image.annotations];

    // Update the annotation's class
    if (newAnnotations[annotationIndex]) {
      newAnnotations[annotationIndex] = {
        ...newAnnotations[annotationIndex],
        classId: parseInt(newClassId)
      };

      updatedImages[imageIndex] = {
        ...image,
        annotations: newAnnotations
      };
    }

    // Refresh the crop viewer IMMEDIATELY - the crop will disappear from current class view
    if (selectedClassForCrops) {
      // Re-extract metadata from the updated images with INCREMENTAL update
      const affectedImageIndices = new Set([imageIndex]);
      const metadata = extractClassCropMetadata(selectedClassForCrops.id, updatedImages, affectedImageIndices);
      setCropMetadata(metadata);
      setTotalCrops(metadata.length);

      // If current page is now empty, go to previous page
      const totalPages = Math.ceil(metadata.length / itemsPerPage);
      const newPage = currentPage > totalPages ? Math.max(1, totalPages) : currentPage;
      setCurrentPage(newPage);

      // Reload the page with updated data
      const processedCrops = await processPageCrops(metadata, newPage, itemsPerPage);
      setClassCrops(processedCrops);
    }

    // Update the parent component after UI refresh
    if (onImagesUpdate) {
      onImagesUpdate({
        images: updatedImages,
        classes: classes
      });
    }
  };

  // Function to merge classes
  const mergeClasses = () => {
    // if (!sourceClass || !targetClass || sourceClass === targetClass) {
    //   alert('Please select different source and target classes');
    //   return;
    // }

    const sourceClassId = classes.findIndex(cls => cls === sourceClass);
    const targetClassId = classes.findIndex(cls => cls === targetClass);

    if (sourceClassId === -1 || targetClassId === -1) {
      alert('Invalid class selection');
      return;
    }

    // Optimization: Avoid deep copy
    const updatedImages = [...images];

    // Update all annotations of the source class to the target class
    // And reindex annotations to account for the removed class
    for (let i = 0; i < updatedImages.length; i++) {
      const image = updatedImages[i];
      if (!image.annotations) continue;

      let hasChanges = false;
      const newAnnotations = image.annotations.map(ann => {
        if (ann.classId === sourceClassId) {
          hasChanges = true;
          return { ...ann, classId: targetClassId > sourceClassId ? targetClassId - 1 : targetClassId };
        } else if (ann.classId > sourceClassId) {
          hasChanges = true;
          return { ...ann, classId: ann.classId - 1 };
        }
        return ann;
      });

      if (hasChanges) {
        updatedImages[i] = {
          ...image,
          annotations: newAnnotations
        };
      }
    }

    // Update the classes array by removing the source class
    const updatedClasses = [...classes];
    updatedClasses.splice(sourceClassId, 1);

    // Pass both updated images and classes to parent component
    if (onImagesUpdate) {
      onImagesUpdate({
        images: updatedImages,
        classes: updatedClasses
      });
    }

    // Alert the user of successful merge
    alert(`Successfully merged ${sourceClass} into ${targetClass}`);

    // Reset selections
    setSourceClass('');
    setTargetClass('');
  };

  // Merge ALL classes into a single class with the provided name
  const mergeAllClasses = () => {
    if (!mergeAllClassName.trim()) {
      alert('Please enter a class name to merge all classes into.');
      return;
    }

    // Optimization: Avoid deep copy
    const updatedImages = [...images];

    for (let i = 0; i < updatedImages.length; i++) {
      const image = updatedImages[i];
      if (image.annotations && image.annotations.length > 0) {
        const newAnnotations = image.annotations.map(a => ({ ...a, classId: 0 }));
        updatedImages[i] = {
          ...image,
          annotations: newAnnotations
        };
      }
    }

    // Single class array
    const updatedClasses = [mergeAllClassName.trim()];
    // Send up to parent
    if (onImagesUpdate) {
      onImagesUpdate({ images: updatedImages, classes: updatedClasses });
    }
    alert(`Merged all classes into "${mergeAllClassName.trim()}"`);
    setMergeAllClassName('');
  };

  // Function to handle class deletion
  const deleteClass = (classId) => {
    if (!window.confirm(`Are you sure you want to delete this class?`)) {
      return;
    }

    // Optimization: Avoid deep copy
    const updatedImages = [...images];

    // Remove all annotations of the class to be deleted
    // And reindex annotations
    for (let i = 0; i < updatedImages.length; i++) {
      const image = updatedImages[i];
      if (!image.annotations) continue;

      const originalCount = image.annotations.length;
      const newAnnotations = [];
      let hasChanges = false;

      image.annotations.forEach(ann => {
        if (ann.classId === classId) {
          hasChanges = true; // Deleted
        } else if (ann.classId > classId) {
          hasChanges = true; // Reindexed
          newAnnotations.push({ ...ann, classId: ann.classId - 1 });
        } else {
          newAnnotations.push(ann);
        }
      });

      if (hasChanges) {
        updatedImages[i] = {
          ...image,
          annotations: newAnnotations
        };
      }
    }

    // Update the classes array by removing the deleted class
    const updatedClasses = [...classes];
    updatedClasses.splice(classId, 1);

    // Pass both updated images and classes to parent component
    if (onImagesUpdate) {
      onImagesUpdate({
        images: updatedImages,
        classes: updatedClasses
      });
    }

    // Alert the user of successful deletion
    alert(`Class deleted successfully`);
  };

  // Function to rename a class
  const renameClass = () => {
    if (!renameClassId || !newClassName.trim()) {
      alert('Please select a class and enter a new name');
      return;
    }

    const classId = parseInt(renameClassId);
    if (isNaN(classId) || classId < 0 || classId >= classes.length) {
      alert('Invalid class selection');
      return;
    }

    if (classes.includes(newClassName.trim())) {
      alert('A class with this name already exists');
      return;
    }

    // Optimization: No need to copy images at all, as we are only changing class names
    // which are stored in the 'classes' array, not in the annotations.

    // Update the class name in the classes array
    const updatedClasses = [...classes];
    updatedClasses[classId] = newClassName.trim();

    // Pass both updated images and classes to parent component
    if (onImagesUpdate) {
      onImagesUpdate({
        images: images, // Pass original images reference
        classes: updatedClasses
      });
    }

    // Alert the user of successful rename
    alert(`Class renamed successfully to "${newClassName.trim()}"`);

    // Reset selections
    setRenameClassId('');
    setNewClassName('');
  };

  return (
    <div className="app">
      <div className="header">
        <h1>📊 Annotation Dashboard</h1>
        <div className="header-controls">
          <button className="button" onClick={onBackToEditor}>
            ← Back to Editor
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="sidebar">
          <h2>📈 Statistics Overview</h2>

          <div className="stats-card">
            <h3>Total Images</h3>
            <p className="stat-number">{totalImages}</p>
          </div>

          <div className="stats-card">
            <h3>Total Annotations</h3>
            <p className="stat-number">{totalAnnotations}</p>
          </div>

          <div className="stats-card">
            <h3>Classes</h3>
            <p className="stat-number">{classes.length}</p>
          </div>

          <div className="stats-card">
            <h3>Avg. Annotations/Image</h3>
            <p className="stat-number">
              {totalImages > 0 ? (totalAnnotations / totalImages).toFixed(2) : 0}
            </p>
          </div>

          {/* Class Management Section */}
          <div className="class-management">
            <h3>Class Management</h3>

            <div className="merge-classes">
              <h4>Merge Classes</h4>
              <div className="merge-form">
                <select
                  value={sourceClass}
                  onChange={(e) => setSourceClass(e.target.value)}
                  className="class-select"
                >
                  <option value="">Select source class</option>
                  {classStats.map(stat => (
                    <option key={`source-${stat.id}`} value={stat.name}>
                      {stat.name} ({stat.count})
                    </option>
                  ))}
                </select>

                <span className="merge-arrow">→</span>

                <select
                  value={targetClass}
                  onChange={(e) => setTargetClass(e.target.value)}
                  className="class-select"
                >
                  <option value="">Select target class</option>
                  {classStats.map(stat => (
                    <option key={`target-${stat.id}`} value={stat.name}>
                      {stat.name} ({stat.count})
                    </option>
                  ))}
                </select>

                <button
                  className="button merge-button"
                  onClick={mergeClasses}
                  disabled={!sourceClass || !targetClass || sourceClass === targetClass}
                >
                  Merge Classes
                </button>
              </div>
            </div>

            {/* Rename Class Section */}
            <div className="rename-class">
              <h4>Rename Class</h4>
              <div className="rename-form">
                <select
                  value={renameClassId}
                  onChange={(e) => setRenameClassId(e.target.value)}
                  className="class-select"
                >
                  <option value="">Select class to rename</option>
                  {classes.map((cls, index) => (
                    <option key={`rename-${index}`} value={index}>
                      {cls}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Enter new class name"
                  className="class-input"
                />

                <button
                  className="button rename-button"
                  onClick={renameClass}
                  disabled={!renameClassId || !newClassName.trim()}
                >
                  Rename Class
                </button>
              </div>
            </div>

            {/* Merge ALL Classes Section */}
            <div className="merge-all-classes">
              <h4>Merge All Classes</h4>
              <div className="merge-all-form">
                <input
                  type="text"
                  value={mergeAllClassName}
                  onChange={(e) => setMergeAllClassName(e.target.value)}
                  placeholder="Enter final class name (e.g., object)"
                  className="class-input"
                />
                <button
                  className="button merge-button"
                  onClick={mergeAllClasses}
                  disabled={!mergeAllClassName.trim()}
                >
                  Merge All → One Class
                </button>
                <p style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '6px' }}>
                  This converts all annotations to a single class and updates class list to one entry. YOLO export will use this merged class name.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="canvas-container">
          <div className="dashboard-content">
            <h2>Class-wise Annotation Distribution</h2>

            {classStats.length > 0 ? (
              <div className="stats-container">
                <div className="class-stats-grid">
                  {classStats.map((stat) => (
                    <div key={stat.id} className="class-stat-card">
                      <div className="class-stat-header">
                        <h3>{stat.name}</h3>
                        <span className="stat-count">{stat.count}</span>
                      </div>
                      <div className="stat-bar-container">
                        <div
                          className="stat-bar"
                          style={{
                            width: `${stat.percentage}%`,
                            backgroundColor: `hsl(${stat.id * 30}, 70%, 50%)`
                          }}
                        ></div>
                      </div>
                      <div className="stat-percentage">
                        {stat.percentage}%
                      </div>
                      <div className="class-preview-section">
                        {classPreviewThumbnails[stat.id] ? (
                          <div className="class-thumbnail-container">
                            <img
                              src={classPreviewThumbnails[stat.id]}
                              alt={`${stat.name} preview`}
                              className="class-thumbnail"
                            />
                          </div>
                        ) : (
                          <div className="class-thumbnail-placeholder">
                            {stat.count > 0 ? '📷' : '❌'}
                          </div>
                        )}
                        <button
                          className="button view-crops-btn"
                          onClick={() => viewClassCrops(stat.id, stat.name)}
                          disabled={stat.count === 0}
                          title="View all annotation crops for this class"
                        >
                          View All ({stat.count})
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="class-stats-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>Count</th>
                        <th>Percentage</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStats.map((stat) => (
                        <tr key={stat.id}>
                          <td>{stat.name}</td>
                          <td>{stat.count}</td>
                          <td>{stat.percentage}%</td>
                          <td>
                            {classPreviewThumbnails[stat.id] ? (
                              <img
                                src={classPreviewThumbnails[stat.id]}
                                alt={`${stat.name} preview`}
                                className="table-thumbnail"
                                style={{ marginRight: '8px', cursor: 'pointer' }}
                                onClick={() => viewClassCrops(stat.id, stat.name)}
                                title="View crops"
                              />
                            ) : (
                              <button
                                className="view-crops-btn-small"
                                onClick={() => viewClassCrops(stat.id, stat.name)}
                                disabled={stat.count === 0}
                                title="View crops"
                                style={{ marginRight: '8px' }}
                              >
                                📷
                              </button>
                            )}
                            <button
                              className="delete-btn"
                              onClick={() => deleteClass(stat.id)}
                              title="Delete class"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="no-data">
                <p>No annotation data available. Upload a dataset to see statistics.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="status-bar">
        <span>Dashboard View | {totalAnnotations} total annotations across {totalImages} images</span>
      </div>

      {/* Crop Viewer Modal */}
      {showCropViewer && (
        <div className="crop-viewer-modal" onClick={closeCropViewer}>
          <div className="crop-viewer-content" onClick={(e) => e.stopPropagation()}>
            <div className="crop-viewer-header">
              <h2>📸 Annotation Crops - {selectedClassForCrops?.name}</h2>
              <button className="close-btn" onClick={closeCropViewer}>✕</button>
            </div>
            <div className="crop-viewer-info">
              <p>Total crops: {totalCrops}</p>
              <p style={{ fontSize: '0.85rem', color: '#7f8c8d', marginTop: '0.5rem' }}>
                Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCrops)} of {totalCrops}
              </p>
            </div>

            {/* Multi-Select Controls */}
            <div className="multi-select-controls" style={{
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              marginBottom: '15px',
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <button
                className={`button ${isSelectionMode ? 'button-active' : ''}`}
                onClick={toggleSelectionMode}
                style={{
                  backgroundColor: isSelectionMode ? '#3498db' : '#95a5a6',
                  color: 'white'
                }}
              >
                {isSelectionMode ? '✓ Selection Mode ON' : '☐ Enable Selection'}
              </button>

              {isSelectionMode && (
                <>
                  <button
                    className="button"
                    onClick={selectAllOnPage}
                    style={{ backgroundColor: '#27ae60' }}
                  >
                    ✓ Select All on Page
                  </button>
                  <button
                    className="button"
                    onClick={deselectAll}
                    style={{ backgroundColor: '#95a5a6' }}
                  >
                    ✕ Deselect All
                  </button>

                  <span style={{
                    marginLeft: '10px',
                    fontWeight: 'bold',
                    color: selectedCrops.length > 0 ? '#3498db' : '#95a5a6'
                  }}>
                    {selectedCrops.length} selected
                  </span>

                  {selectedCrops.length > 0 && (
                    <>
                      <div style={{
                        display: 'flex',
                        gap: '10px',
                        marginLeft: 'auto',
                        alignItems: 'center'
                      }}>
                        <label style={{ fontWeight: 'bold' }}>Bulk Actions:</label>
                        <select
                          className="crop-class-select"
                          onChange={(e) => {
                            if (e.target.value !== '') {
                              bulkChangeClass(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          style={{ minWidth: '150px' }}
                        >
                          <option value="">Change Class...</option>
                          {classes.map((cls, idx) => (
                            <option key={idx} value={idx}>
                              → {cls}
                            </option>
                          ))}
                        </select>
                        <button
                          className="crop-remove-btn"
                          onClick={bulkDeleteCrops}
                          style={{
                            backgroundColor: '#e74c3c',
                            color: 'white',
                            padding: '8px 16px'
                          }}
                        >
                          🗑️ Delete Selected ({selectedCrops.length})
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="pagination-controls">
              <button
                className="button pagination-btn"
                onClick={() => loadPage(1)}
                disabled={currentPage === 1}
              >
                ⏮ First
              </button>
              <button
                className="button pagination-btn"
                onClick={() => loadPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {Math.ceil(totalCrops / itemsPerPage)}
              </span>
              <button
                className="button pagination-btn"
                onClick={() => loadPage(currentPage + 1)}
                disabled={currentPage >= Math.ceil(totalCrops / itemsPerPage)}
              >
                Next →
              </button>
              <button
                className="button pagination-btn"
                onClick={() => loadPage(Math.ceil(totalCrops / itemsPerPage))}
                disabled={currentPage >= Math.ceil(totalCrops / itemsPerPage)}
              >
                Last ⏭
              </button>
            </div>

            <div className="crop-viewer-grid-wrapper">
              <div className="crop-viewer-grid">
                {classCrops.map((crop) => {
                  const isSelected = selectedCrops.includes(crop.id);

                  return (
                    <div
                      key={crop.id}
                      className={`crop-item ${isSelected ? 'crop-item-selected' : ''}`}
                      style={{
                        border: isSelected ? '3px solid #3498db' : '1px solid #ddd',
                        backgroundColor: isSelected ? '#e3f2fd' : 'white',
                        position: 'relative'
                      }}
                    >
                      {/* Selection Checkbox */}
                      {isSelectionMode && (
                        <div style={{
                          position: 'absolute',
                          top: '5px',
                          left: '5px',
                          zIndex: 10
                        }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCropSelection(crop.id)}
                            style={{
                              width: '20px',
                              height: '20px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      )}

                      <img
                        src={crop.cropSrc}
                        alt={`Crop from ${crop.imageName}`}
                        onClick={() => isSelectionMode && toggleCropSelection(crop.id)}
                        style={{ cursor: isSelectionMode ? 'pointer' : 'default' }}
                      />
                      <div className="crop-info">
                        <p className="crop-image-name">{crop.imageName}</p>
                        <p className="crop-details">
                          Size: {(crop.annotation.width * 100).toFixed(1)}% × {(crop.annotation.height * 100).toFixed(1)}%
                        </p>

                        {/* Action controls - Hidden in selection mode */}
                        {!isSelectionMode && (
                          <div className="crop-actions">
                            <select
                              className="crop-class-select"
                              value={crop.annotation.classId}
                              onChange={(e) => changeAnnotationClass(crop.imageIndex, crop.annotationIndex, e.target.value)}
                              title="Change class"
                            >
                              {classes.map((cls, idx) => (
                                <option key={idx} value={idx}>
                                  {cls}
                                </option>
                              ))}
                            </select>
                            <button
                              className="crop-remove-btn"
                              onClick={() => removeAnnotationAndImageFromFile(crop.imageIndex, crop.annotationIndex)}
                              title="Remove annotation"
                            >
                              🗑️ Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;