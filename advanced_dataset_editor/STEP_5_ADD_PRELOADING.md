# Step 5: Add Image Preloading (First Usage of loadImageFromDisk)

## 📍 Where to Add

Add this code **after line 192** in `src/App.js` (right after the existing image preload useEffect).

## 🔧 Code to Add

```javascript
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
```

## 📝 Exact Location

Your code should look like this:

```javascript
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
    // ... rest of code
```

## ✅ What This Does

This `useEffect`:
1. **Runs whenever you change images** (currentImageIndex changes)
2. **Preloads 4 adjacent images** (2 before, 2 after current)
3. **Only loads if needed** (checks if `diskPath` exists and `src` doesn't)
4. **Uses the cache** (via `loadImageFromDisk`)

## 🎯 Result

When you navigate through images:
- Current image loads instantly (already in cache)
- Next/previous images are ready (preloaded)
- Smooth, fast navigation! 🚀

## ⚠️ Note

This will only work once we update the dataset loading to use `diskPath` instead of loading all images into memory. That's the next step!

---

**After adding this, save the file and the app should hot-reload automatically!**
