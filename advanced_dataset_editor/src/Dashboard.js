import React, { useState, useEffect } from 'react';
import './styles.css';

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
  
  // Generate preview thumbnails for each class
  useEffect(() => {
    const generatePreviewThumbnails = async () => {
      if (!images || images.length === 0 || !classes || classes.length === 0) {
        setClassPreviewThumbnails({});
        return;
      }
      
      const thumbnails = {};
      
      for (let classId = 0; classId < classes.length; classId++) {
        // Find first annotation for this class
        let foundAnnotation = null;
        let foundImage = null;
        
        for (const image of images) {
          if (image.annotations) {
            const annotation = image.annotations.find(ann => ann.classId === classId);
            if (annotation) {
              foundAnnotation = annotation;
              foundImage = image;
              break;
            }
          }
        }
        
        if (foundAnnotation && foundImage) {
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
                
                thumbnails[classId] = canvas.toDataURL();
                resolve();
              };
              
              if (img.complete) {
                img.onload();
              }
            });
          } catch (error) {
            console.error(`Error generating thumbnail for class ${classId}:`, error);
          }
        }
      }
      
      setClassPreviewThumbnails(thumbnails);
    };
    
    generatePreviewThumbnails();
  }, [images, classes]);
  
  // Function to extract annotation crop metadata for a specific class (lightweight)
  const extractClassCropMetadata = (classId, imageData = null) => {
    const metadata = [];
    const sourceImages = imageData || images;
    
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
  const processPageCrops = async (metadata, page, perPage) => {
    const startIndex = (page - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, metadata.length);
    const pageMetadata = metadata.slice(startIndex, endIndex);
    
    // Process only the crops for this page
    const processedCrops = await Promise.all(
      pageMetadata.map((cropMeta) => {
        return new Promise((resolve) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.src = cropMeta.imageSrc;
          
          img.onload = () => {
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
            
            resolve({
              id: cropMeta.id,
              imageName: cropMeta.imageName,
              imageIndex: cropMeta.imageIndex,
              annotationIndex: cropMeta.annotationIndex,
              cropSrc: cropDataUrl,
              annotation: cropMeta.annotation
            });
          };
          
          // If image is already loaded
          if (img.complete) {
            img.onload();
          }
        });
      })
    );
    
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
  };
  
  // Function to remove a specific annotation from the dataset
  const removeAnnotationFromCrop = async (imageIndex, annotationIndex) => {
    if (!window.confirm('Are you sure you want to remove this annotation?')) {
      return;
    }
    
    // Create a deep copy of images
    const updatedImages = JSON.parse(JSON.stringify(images));
    
    // Remove the specific annotation
    if (updatedImages[imageIndex] && updatedImages[imageIndex].annotations) {
      updatedImages[imageIndex].annotations.splice(annotationIndex, 1);
    }
    
    // Refresh the crop viewer with updated data IMMEDIATELY using updatedImages
    if (selectedClassForCrops) {
      // Re-extract metadata from the updated images
      const metadata = extractClassCropMetadata(selectedClassForCrops.id, updatedImages);
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
  
  // Function to change the class of a specific annotation
  const changeAnnotationClass = async (imageIndex, annotationIndex, newClassId) => {
    // Create a deep copy of images
    const updatedImages = JSON.parse(JSON.stringify(images));
    
    // Update the annotation's class
    if (updatedImages[imageIndex] && updatedImages[imageIndex].annotations && 
        updatedImages[imageIndex].annotations[annotationIndex]) {
      updatedImages[imageIndex].annotations[annotationIndex].classId = parseInt(newClassId);
    }
    
    // Refresh the crop viewer IMMEDIATELY - the crop will disappear from current class view
    if (selectedClassForCrops) {
      // Re-extract metadata from the updated images
      const metadata = extractClassCropMetadata(selectedClassForCrops.id, updatedImages);
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
    
    // Create a deep copy of images to modify
    const updatedImages = JSON.parse(JSON.stringify(images));
    
    // Update all annotations of the source class to the target class
    updatedImages.forEach(image => {
      if (image.annotations) {
        image.annotations.forEach(annotation => {
          if (annotation.classId === sourceClassId) {
            annotation.classId = targetClassId;
          }
        });
      }
    });
    
    // Update the classes array by removing the source class
    const updatedClasses = [...classes];
    updatedClasses.splice(sourceClassId, 1);
    
    // Reindex annotations to account for the removed class
    updatedImages.forEach(image => {
      if (image.annotations) {
        image.annotations = image.annotations.map(annotation => {
          if (annotation.classId > sourceClassId) {
            return { ...annotation, classId: annotation.classId - 1 };
          }
          return annotation;
        });
      }
    });
    
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
    // Deep copy images
    const updatedImages = JSON.parse(JSON.stringify(images));
    // Set every annotation's classId to 0
    updatedImages.forEach(img => {
      if (img.annotations && Array.isArray(img.annotations)) {
        img.annotations = img.annotations.map(a => ({ ...a, classId: 0 }));
      }
    });
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
    
    // Create a deep copy of images to modify
    const updatedImages = JSON.parse(JSON.stringify(images));
    
    // Remove all annotations of the class to be deleted
    updatedImages.forEach(image => {
      if (image.annotations) {
        image.annotations = image.annotations.filter(
          annotation => annotation.classId !== classId
        );
      }
    });
    
    // Update the classes array by removing the deleted class
    // We need to reindex all annotations with classId > classId
    const updatedClasses = [...classes];
    updatedClasses.splice(classId, 1);
    
    // Reindex annotations to account for the removed class
    updatedImages.forEach(image => {
      if (image.annotations) {
        image.annotations = image.annotations.map(annotation => {
          if (annotation.classId > classId) {
            return { ...annotation, classId: annotation.classId - 1 };
          }
          return annotation;
        });
      }
    });
    
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
    
    // Create a deep copy of images to modify
    const updatedImages = JSON.parse(JSON.stringify(images));
    
    // Update the class name in the classes array
    const updatedClasses = [...classes];
    updatedClasses[classId] = newClassName.trim();
    
    // Pass both updated images and classes to parent component
    if (onImagesUpdate) {
      onImagesUpdate({
        images: updatedImages,
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
                {classCrops.map((crop) => (
                  <div key={crop.id} className="crop-item">
                    <img src={crop.cropSrc} alt={`Crop from ${crop.imageName}`} />
                    <div className="crop-info">
                      <p className="crop-image-name">{crop.imageName}</p>
                      <p className="crop-details">
                        Size: {(crop.annotation.width * 100).toFixed(1)}% × {(crop.annotation.height * 100).toFixed(1)}%
                      </p>
                      
                      {/* Action controls */}
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
                          onClick={() => removeAnnotationFromCrop(crop.imageIndex, crop.annotationIndex)}
                          title="Remove annotation"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;