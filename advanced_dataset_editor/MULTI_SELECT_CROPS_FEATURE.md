# Multi-Select Feature for Crop Viewer

## 🎯 Feature Overview

Add ability to:
- ✅ **Select multiple crops** with checkboxes
- ✅ **Bulk delete** selected crops
- ✅ **Bulk change class** for selected crops
- ✅ **Select all** / **Deselect all** buttons
- ✅ **Visual feedback** for selected crops

---

## 📝 Step 1: Add State Variables

**Location:** After line 21 in `Dashboard.js`

```javascript
const itemsPerPage = 50;

// ADD THESE NEW STATE VARIABLES:
const [selectedCrops, setSelectedCrops] = useState([]); // Array of selected crop IDs
const [isSelectionMode, setIsSelectionMode] = useState(false); // Toggle selection mode
```

---

## 📝 Step 2: Add Selection Helper Functions

**Location:** After the `closeCropViewer` function (around line 350)

```javascript
// Function to toggle selection mode
const toggleSelectionMode = () => {
  setIsSelectionMode(!isSelectionMode);
  if (isSelectionMode) {
    // Clear selections when exiting selection mode
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
const bulkDeleteCrops = async () => {
  if (selectedCrops.length === 0) {
    alert('No crops selected');
    return;
  }
  
  if (!window.confirm(`Delete ${selectedCrops.length} selected crop(s)?`)) {
    return;
  }
  
  // Create a deep copy of images
  const updatedImages = JSON.parse(JSON.stringify(images));
  
  // Track which crops to delete (imageIndex, annotationIndex pairs)
  const cropsToDelete = [];
  
  selectedCrops.forEach(cropId => {
    const crop = classCrops.find(c => c.id === cropId);
    if (crop) {
      cropsToDelete.push({
        imageIndex: crop.imageIndex,
        annotationIndex: crop.annotationIndex
      });
    }
  });
  
  // Sort by imageIndex and annotationIndex in reverse order
  // This ensures we delete from end to start, avoiding index shift issues
  cropsToDelete.sort((a, b) => {
    if (a.imageIndex !== b.imageIndex) {
      return b.imageIndex - a.imageIndex;
    }
    return b.annotationIndex - a.annotationIndex;
  });
  
  // Delete annotations
  cropsToDelete.forEach(({ imageIndex, annotationIndex }) => {
    if (updatedImages[imageIndex] && updatedImages[imageIndex].annotations) {
      updatedImages[imageIndex].annotations.splice(annotationIndex, 1);
    }
  });
  
  // Refresh the crop viewer
  if (selectedClassForCrops) {
    const metadata = extractClassCropMetadata(selectedClassForCrops.id, updatedImages);
    setCropMetadata(metadata);
    setTotalCrops(metadata.length);
    
    // Adjust page if needed
    const totalPages = Math.ceil(metadata.length / itemsPerPage);
    const newPage = currentPage > totalPages ? Math.max(1, totalPages) : currentPage;
    setCurrentPage(newPage);
    
    // Reload crops
    const processedCrops = await processPageCrops(metadata, newPage, itemsPerPage);
    setClassCrops(processedCrops);
  }
  
  // Clear selection
  setSelectedCrops([]);
  
  // Update parent
  if (onImagesUpdate) {
    onImagesUpdate({
      images: updatedImages,
      classes: classes
    });
  }
  
  alert(`Deleted ${cropsToDelete.length} crop(s) successfully!`);
};

// Function to bulk change class for selected crops
const bulkChangeClass = async (newClassId) => {
  if (selectedCrops.length === 0) {
    alert('No crops selected');
    return;
  }
  
  const className = classes[newClassId];
  if (!window.confirm(`Change ${selectedCrops.length} selected crop(s) to class "${className}"?`)) {
    return;
  }
  
  // Create a deep copy of images
  const updatedImages = JSON.parse(JSON.stringify(images));
  
  // Update each selected crop's class
  selectedCrops.forEach(cropId => {
    const crop = classCrops.find(c => c.id === cropId);
    if (crop && updatedImages[crop.imageIndex] && 
        updatedImages[crop.imageIndex].annotations &&
        updatedImages[crop.imageIndex].annotations[crop.annotationIndex]) {
      updatedImages[crop.imageIndex].annotations[crop.annotationIndex].classId = parseInt(newClassId);
    }
  });
  
  // Refresh the crop viewer
  if (selectedClassForCrops) {
    const metadata = extractClassCropMetadata(selectedClassForCrops.id, updatedImages);
    setCropMetadata(metadata);
    setTotalCrops(metadata.length);
    
    // Adjust page if needed
    const totalPages = Math.ceil(metadata.length / itemsPerPage);
    const newPage = currentPage > totalPages ? Math.max(1, totalPages) : currentPage;
    setCurrentPage(newPage);
    
    // Reload crops
    const processedCrops = await processPageCrops(metadata, newPage, itemsPerPage);
    setClassCrops(processedCrops);
  }
  
  // Clear selection
  setSelectedCrops([]);
  
  // Update parent
  if (onImagesUpdate) {
    onImagesUpdate({
      images: updatedImages,
      classes: classes
    });
  }
  
  alert(`Changed ${selectedCrops.length} crop(s) to class "${className}" successfully!`);
};
```

---

## 📝 Step 3: Update Crop Viewer UI

**Location:** Replace the crop viewer modal section (lines 805-895)

```javascript
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
      
      {/* NEW: Multi-Select Controls */}
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
                        e.target.value = ''; // Reset
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
                {/* NEW: Selection Checkbox */}
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
```

---

## 📝 Step 4: Add CSS Styles

**Location:** Add to your `styles.css` file

```css
/* Multi-select controls */
.multi-select-controls {
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 15px;
}

.button-active {
  box-shadow: 0 0 10px rgba(52, 152, 219, 0.5);
}

.crop-item-selected {
  transform: scale(0.98);
  transition: all 0.2s ease;
}

.crop-item {
  transition: all 0.2s ease;
}

.crop-item:hover {
  transform: scale(1.02);
}
```

---

## 🎯 Features You'll Get

### 1. **Selection Mode Toggle**
- Click "Enable Selection" to enter selection mode
- Click again to exit and clear selections

### 2. **Individual Selection**
- Click checkbox or image to select/deselect
- Visual feedback with blue border and background

### 3. **Bulk Selection**
- "Select All on Page" - selects all 50 crops on current page
- "Deselect All" - clears all selections

### 4. **Bulk Actions**
- **Bulk Delete**: Delete all selected crops at once
- **Bulk Change Class**: Change class for all selected crops

### 5. **Selection Counter**
- Shows how many crops are selected
- Updates in real-time

---

## 🚀 Usage Example

1. **View crops** for a class (e.g., "person")
2. **Enable Selection Mode**
3. **Select multiple crops** by clicking checkboxes
4. **Choose bulk action**:
   - Change all to "car" class
   - Or delete all selected

**Result:** Save hours of manual work! 🎉

---

## ✅ Testing Checklist

- [ ] Selection mode toggles on/off
- [ ] Individual crops can be selected/deselected
- [ ] "Select All on Page" works
- [ ] "Deselect All" clears selections
- [ ] Bulk delete removes selected crops
- [ ] Bulk change class updates selected crops
- [ ] Selection persists when changing pages
- [ ] Visual feedback shows selected crops
- [ ] Counter shows correct number

---

**This will save you TONS of time when managing large datasets!** 🚀
