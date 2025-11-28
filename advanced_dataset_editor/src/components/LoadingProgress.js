// src/components/LoadingProgress.js
import React from 'react';
import '../styles/LoadingProgress.css';

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const LoadingProgress = ({ 
  current = 0, 
  total = 0, 
  stage = 'Loading...', 
  memoryUsage = null, 
  showMemory = true,
  onCancel = null 
}) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const memoryPercentage = memoryUsage?.percentage || 0;
  const memoryWarning = memoryPercentage > 85;

  return (
    <div className="loading-overlay">
      <div className="loading-container">
        <div className="loading-header">
          <h2>🔄 {stage || 'Loading...'}</h2>
          {onCancel && (
            <button className="cancel-btn" onClick={onCancel}>
              ✕ Cancel
            </button>
          )}
        </div>

        <div className="progress-section">
          <div className="progress-info">
            <span>Progress: {current} / {total}</span>
            <span>{percentage.toFixed(1)}%</span>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {showMemory && memoryUsage && (
          <div className="memory-section">
            <div className="memory-info">
              <span className={memoryWarning ? 'memory-warning' : ''}>
                Memory Usage
              </span>
              <span className={memoryWarning ? 'memory-warning' : ''}>
                {formatBytes(memoryUsage.processMemory || 0)} / {formatBytes(memoryUsage.totalMemory || 0)}
              </span>
            </div>
            <div className="progress-bar-container">
              <div 
                className={`progress-bar-fill ${memoryWarning ? 'warning' : ''}`}
                style={{ width: `${memoryPercentage}%` }}
              />
            </div>
            {memoryWarning && (
              <div className="warning-message">
                ⚠️ High memory usage detected. Consider closing other applications.
              </div>
            )}
          </div>
        )}

        <div className="loading-tips">
          <p>💡 Tip: Large datasets may take several minutes to load</p>
          <p>🔄 Processing in chunks to prevent memory issues</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingProgress;