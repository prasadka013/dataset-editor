import React, { useState, useEffect } from 'react';
import datasetApi from './api/datasetApi';

const TestingSection = ({ onBackToEditor }) => {
  const [datasetId, setDatasetId] = useState('test-dataset-001');
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState('');
  const [apiHealth, setApiHealth] = useState(null);

  useEffect(() => {
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    try {
      const healthy = await datasetApi.healthCheck();
      setApiHealth(healthy ? 'Connected' : 'Disconnected');
    } catch (error) {
      setApiHealth('Error');
    }
  };

  const loadManifest = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await datasetApi.getManifest(datasetId);
      setManifest(data);
    } catch (err) {
      setError(`Failed to load manifest: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadFile(file);
      setUploadProgress('');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError(null);
    setUploadProgress('Starting upload...');

    try {
      // Determine file type
      const fileType = uploadFile.type.startsWith('image/') ? 'image' : 'label';
      
      setUploadProgress('Uploading file through backend...');
      // Use direct upload instead of presigned URL
      const result = await datasetApi.uploadFileDirect(uploadFile, datasetId, fileType, 'train');
      
      setUploadProgress(`Upload successful! File: ${result.fileName}`);
      setUploadFile(null);
      
      // Refresh manifest
      await loadManifest();
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
      setUploadProgress('');
    } finally {
      setLoading(false);
    }
  };

  const testAnnotationSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const testImageId = 'test-image-001';
      const testLabel = '0 0.5 0.5 0.3 0.4\n1 0.2 0.3 0.1 0.15';
      
      await datasetApi.saveAnnotation(datasetId, testImageId, testLabel, 'train');
      alert('Annotation saved successfully!');
      
      // Try to retrieve it
      const retrieved = await datasetApi.getAnnotation(datasetId, testImageId, 'train');
      console.log('Retrieved annotation:', retrieved);
    } catch (err) {
      setError(`Annotation test failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={styles.title}>🧪 API Testing Section</h2>
        <button onClick={onBackToEditor} style={{...styles.button, backgroundColor: '#95a5a6'}}>
          ← Back to Editor
        </button>
      </div>
      
      {/* API Health Status */}
      <div style={styles.section}>
        <h3>API Status</h3>
        <div style={styles.statusBadge}>
          Status: <span style={{
            color: apiHealth === 'Connected' ? '#4CAF50' : '#f44336',
            fontWeight: 'bold'
          }}>
            {apiHealth || 'Checking...'}
          </span>
        </div>
        <button onClick={checkApiHealth} style={styles.button}>
          Refresh Status
        </button>
      </div>

      {/* Dataset ID Input */}
      <div style={styles.section}>
        <h3>Dataset Configuration</h3>
        <label style={styles.label}>
          Dataset ID:
          <input
            type="text"
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            style={styles.input}
            placeholder="Enter dataset ID"
          />
        </label>
      </div>

      {/* File Upload Test */}
      <div style={styles.section}>
        <h3>File Upload Test</h3>
        <input
          type="file"
          onChange={handleFileSelect}
          accept="image/*,.txt"
          style={styles.fileInput}
        />
        {uploadFile && (
          <div style={styles.fileInfo}>
            Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(2)} KB)
          </div>
        )}
        <button
          onClick={handleUpload}
          disabled={!uploadFile || loading}
          style={{...styles.button, ...styles.primaryButton}}
        >
          {loading ? 'Uploading...' : 'Upload to S3'}
        </button>
        {uploadProgress && (
          <div style={styles.progress}>{uploadProgress}</div>
        )}
      </div>

      {/* Manifest Test */}
      <div style={styles.section}>
        <h3>Dataset Manifest</h3>
        <button
          onClick={loadManifest}
          disabled={loading}
          style={styles.button}
        >
          {loading ? 'Loading...' : 'Load Manifest'}
        </button>
        
        {manifest && (
          <div style={styles.manifestContainer}>
            <h4>Statistics</h4>
            <div style={styles.stats}>
              {Object.entries(manifest.statistics).map(([key, value]) => (
                <div key={key} style={styles.statItem}>
                  <strong>{key.replace(/_/g, ' ')}:</strong> {value}
                </div>
              ))}
            </div>
            
            <h4>Files ({manifest.files.length})</h4>
            <div style={styles.fileList}>
              {manifest.files.slice(0, 10).map((file, idx) => (
                <div key={idx} style={styles.fileItem}>
                  <div><strong>{file.fileName}</strong></div>
                  <div style={styles.fileDetails}>
                    Type: {file.fileType} | Split: {file.split} | 
                    Size: {(file.size / 1024).toFixed(2)} KB
                  </div>
                </div>
              ))}
              {manifest.files.length > 10 && (
                <div style={styles.moreFiles}>
                  ... and {manifest.files.length - 10} more files
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Annotation Test */}
      <div style={styles.section}>
        <h3>Annotation Test</h3>
        <button
          onClick={testAnnotationSave}
          disabled={loading}
          style={styles.button}
        >
          Test Save & Retrieve Annotation
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={styles.error}>
          ⚠️ {error}
        </div>
      )}

      {/* Instructions */}
      <div style={styles.instructions}>
        <h4>📋 Instructions</h4>
        <ol>
          <li>Ensure the backend API is running (dotnet run in backend folder)</li>
          <li>Configure AWS credentials in backend/appsettings.json</li>
          <li>Enter a dataset ID and test file uploads</li>
          <li>Load manifest to see all files in the dataset</li>
          <li>Test annotation save/retrieve functionality</li>
        </ol>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif'
  },
  title: {
    color: '#333',
    borderBottom: '3px solid #2196F3',
    paddingBottom: '10px',
    marginBottom: '20px'
  },
  section: {
    backgroundColor: '#f5f5f5',
    padding: '20px',
    marginBottom: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  statusBadge: {
    padding: '10px',
    backgroundColor: 'white',
    borderRadius: '4px',
    marginBottom: '10px'
  },
  label: {
    display: 'block',
    marginBottom: '10px',
    fontWeight: 'bold'
  },
  input: {
    display: 'block',
    width: '100%',
    padding: '10px',
    marginTop: '5px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px'
  },
  fileInput: {
    marginBottom: '10px'
  },
  fileInfo: {
    padding: '10px',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    marginBottom: '10px'
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    marginRight: '10px',
    marginTop: '10px'
  },
  primaryButton: {
    backgroundColor: '#4CAF50'
  },
  progress: {
    marginTop: '10px',
    padding: '10px',
    backgroundColor: '#fff3cd',
    borderRadius: '4px',
    color: '#856404'
  },
  manifestContainer: {
    marginTop: '15px',
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '4px'
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
    marginBottom: '15px'
  },
  statItem: {
    padding: '10px',
    backgroundColor: '#e8f5e9',
    borderRadius: '4px'
  },
  fileList: {
    maxHeight: '400px',
    overflowY: 'auto'
  },
  fileItem: {
    padding: '10px',
    borderBottom: '1px solid #eee',
    marginBottom: '5px'
  },
  fileDetails: {
    fontSize: '12px',
    color: '#666',
    marginTop: '5px'
  },
  moreFiles: {
    padding: '10px',
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic'
  },
  error: {
    padding: '15px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '4px',
    marginBottom: '20px',
    border: '1px solid #ef5350'
  },
  instructions: {
    padding: '20px',
    backgroundColor: '#fff9c4',
    borderRadius: '8px',
    marginTop: '20px'
  }
};

export default TestingSection;