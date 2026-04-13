import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadImages } from '../api';

export default function UploadPage({ uploadedFiles, setUploadedFiles }) {
  const [localFiles, setLocalFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const localPreviewUrls = useMemo(
    () => localFiles.map((file) => URL.createObjectURL(file)),
    [localFiles]
  );

  useEffect(() => {
    return () => {
      localPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [localPreviewUrls]);

  const handleFiles = useCallback((files) => {
    const imageFiles = Array.from(files).filter((f) =>
      ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(f.type)
    );
    if (imageFiles.length === 0) {
      setError('Vui lòng chọn file ảnh (PNG, JPEG, WebP)');
      return;
    }
    setError('');
    setLocalFiles((prev) => [...prev, ...imageFiles]);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    const files = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image/') !== -1) {
        files.push(items[i].getAsFile());
      }
    }
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  const handleRemoveLocal = (idx) => {
    setLocalFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (localFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(10);
    setError('');

    try {
      setUploadProgress(30);
      const result = await uploadImages(localFiles);
      setUploadProgress(100);
      const filesWithPreview = (result.files || []).map((file, index) => ({
        ...file,
        preview_url: localFiles[index] ? URL.createObjectURL(localFiles[index]) : null,
      }));
      setUploadedFiles(filesWithPreview);
      
      setTimeout(() => {
        navigate('/crop-type');
      }, 500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Hãy thử lại.');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Upload Screenshots</h1>
        <p className="page-desc">
          Kéo thả hoặc chọn ảnh chụp màn hình PUBG Mobile để bắt đầu tạo showcase poster.
        </p>
      </div>

      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="upload-icon">📸</span>
        <div className="upload-text">Kéo thả hoặc nhấn Ctrl+V để dán ảnh</div>
        <div className="upload-subtext">
          hoặc <span>click để chọn file</span> • PNG, JPEG, WebP
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(255, 71, 87, 0.1)',
          border: '1px solid rgba(255, 71, 87, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--error)',
          fontSize: '0.85rem'
        }}>
          ⚠️ {error}
        </div>
      )}

      {localFiles.length > 0 && (
        <>
          <div className="preview-grid">
            {localFiles.map((file, idx) => (
              <div className="preview-card" key={idx}>
                <img
                  src={localPreviewUrls[idx]}
                  alt={file.name}
                  loading="lazy"
                  decoding="async"
                />
                <div className="preview-card-info">
                  <div className="preview-card-name">{file.name}</div>
                  <div className="preview-card-meta">{formatSize(file.size)}</div>
                </div>
                <button
                  className="preview-card-remove"
                  onClick={(e) => { e.stopPropagation(); handleRemoveLocal(idx); }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="actions-bar">
            <div className="actions-info">
              <span className="actions-count">
                <strong>{localFiles.length}</strong> ảnh đã chọn
              </span>
            </div>
            <div className="btn-group">
              <button
                className="btn btn-ghost"
                onClick={() => setLocalFiles([])}
                disabled={uploading}
              >
                Xóa tất cả
              </button>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <span className="spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2 }} />
                    Đang upload...
                  </>
                ) : (
                  <>🚀 Upload & Tiếp tục</>
                )}
              </button>
            </div>
          </div>

          {uploading && (
            <div className="progress-bar" style={{ marginTop: '1rem' }}>
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
        </>
      )}

      {localFiles.length === 0 && uploadedFiles.length > 0 && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Đã upload {uploadedFiles.length} ảnh trước đó.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/crop-type')}>
            Chọn loại cắt →
          </button>
        </div>
      )}
    </div>
  );
}
