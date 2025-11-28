# Testing the Optimization - Step 4

## 🎉 Great Progress!

The `loadImageFromDisk` function is added and Tauri is running!

## 🧪 Step 4: Test the Backend

Let's test if the Rust commands work before integrating them fully.

### Test 1: Open Browser Console

1. Wait for the app to open in your browser
2. Press **F12** to open Developer Tools
3. Go to the **Console** tab

### Test 2: Test the Tauri Commands

Copy and paste these commands one by one into the browser console:

```javascript
// Test 1: Get temp directory
window.__TAURI__.invoke('get_temp_dir').then(result => {
  console.log('✅ Temp dir:', result);
}).catch(error => {
  console.error('❌ Error:', error);
});

// Test 2: Test image cache
console.log('📊 Cache stats:', imageCache.getStats());

// Test 3: Add something to cache
imageCache.set('test-key', 'test-value');
console.log('✅ Added to cache');
console.log('📊 Cache stats:', imageCache.getStats());

// Test 4: Get from cache
const value = imageCache.get('test-key');
console.log('✅ Retrieved from cache:', value);
```

### Expected Results

You should see:
- ✅ Temp directory path (e.g., `C:\Users\...\AppData\Local\Temp`)
- ✅ Cache stats showing size: 0, hits: 0, misses: 0
- ✅ After adding: size: 1
- ✅ Retrieved value: "test-value"

### If Tests Pass ✅

Great! The backend is working. Now we can integrate it.

### If Tests Fail ❌

Check:
1. Is the app running without errors?
2. Are there any red errors in the console?
3. Did Tauri compile successfully?

---

## 🎯 Next: Where to Use `loadImageFromDisk`

Once tests pass, we'll use this function in **two places**:

### 1. **When navigating between images** (Image switching)
Replace the current image loading with on-demand loading from disk

### 2. **When loading datasets** (Initial load)
Instead of loading all images into memory, load only metadata

---

## 📝 Quick Integration Preview

Here's where we'll use it:

### Location 1: Image Navigation
```javascript
// In handleImageSelect function (around line 975)
const handleImageSelect = async (index) => {
  // ... existing code ...
  
  // NEW: Load image from disk if not already loaded
  if (images[index] && images[index].diskPath && !images[index].src) {
    const dataUrl = await loadImageFromDisk(images[index].diskPath);
    if (dataUrl) {
      setImages(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], src: dataUrl };
        return updated;
      });
    }
  }
  
  // ... rest of code ...
};
```

### Location 2: Dataset Loading
```javascript
// In loadDatasetAllSplits function (around line 668)
// Instead of loading image data, just store the path:
combinedImages.push({
  id: globalIndex++,
  name: imageName,
  diskPath: imagePath,  // NEW: Store path instead of data
  src: null,            // NEW: Don't load yet
  annotations: imageAnnotations,
  split: split
});
```

---

## 🚀 Ready to Integrate?

**First, run the tests above** to make sure everything works.

Then let me know and I'll help you integrate it step by step!

---

**Current Status:**
- ✅ Rust backend ready
- ✅ Image cache ready  
- ✅ Helper function added
- 🧪 Testing in progress...
