// src/components/VirtualImageGrid.js
import React, { useMemo } from 'react';
import '../styles/VirtualImageGrid.css';

const VirtualImageGrid = ({
  images = [],
  onImageClick,
  selectedIndex,
  columnCount = 5,
  itemSize = 180
}) => {

  // Guard against null or undefined images
  const imageList = useMemo(() => images || [], [images]);

  // Render simple grid without react-window to avoid virtualization issues
  return (
    <div className="virtual-grid-container">
      <div
        className="virtual-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columnCount}, ${itemSize}px)`,
          gap: '10px',
          padding: '10px',
          overflowY: 'auto',
          maxHeight: '100%'
        }}
      >
        {imageList.map((image, index) => {
          const isSelected = index === selectedIndex;
          const annotationCount = image?.annotations?.length || 0;

          return (
            <div
              key={`${image?.name}-${index}`}
              className={`virtual-thumbnail-item ${isSelected ? 'active' : ''}`}
              onClick={() => onImageClick?.(index)}
              style={{
                cursor: 'pointer',
                width: itemSize,
                height: itemSize,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div className="virtual-thumbnail-image-container">
                {image?.src ? (
                  <img
                    src={image.src}
                    alt={image?.name || `Image ${index}`}
                    className="virtual-thumbnail-image"
                    loading="lazy"
                  />
                ) : (
                  <div className="virtual-thumbnail-image" style={{ backgroundColor: '#f0f0f0' }} />
                )}
                {annotationCount > 0 && (
                  <div className="annotation-badge">
                    {annotationCount}
                  </div>
                )}
              </div>
              <div className="virtual-thumbnail-info">
                <span className="virtual-thumbnail-name" title={image?.name}>
                  {image?.name || `Image ${index}`}
                </span>
                <span className="virtual-thumbnail-count">
                  {annotationCount} annotation{annotationCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualImageGrid;