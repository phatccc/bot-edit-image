import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadZip } from '../api';

export default function ResultPage({ outputs }) {
  const [lightboxImage, setLightboxImage] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadSingle = (output) => {
    const link = document.createElement('a');
    link.href = output.url;
    link.download = output.filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownloadAll = async () => {
    if (outputs.length === 0) return;
    setDownloading(true);
    try {
      const filenames = outputs.map((o) => o.filename);
      await downloadZip(filenames);
    } catch (err) {
      alert('Download failed: ' + (err.message || 'Unknown error'));
    }
    setDownloading(false);
  };

  if (outputs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🖼️</div>
        <div className="empty-state-text">Chưa có ảnh output nào</div>
        <div className="empty-state-subtext">Hãy upload và xử lý ảnh trước.</div>
        <Link to="/" className="btn btn-primary">← Bắt đầu lại</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🎉 Showcase Results</h1>
        <p className="page-desc">
          Poster đã được tạo thành công! Click vào ảnh để xem full size.
        </p>
      </div>

      <div className="actions-bar" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
        <div className="actions-info">
          <span className="actions-count">
            <strong>{outputs.length}</strong> poster đã tạo
          </span>
        </div>
        <div className="btn-group">
          <Link to="/" className="btn btn-ghost">← Upload thêm</Link>
          <Link to="/preview" className="btn btn-secondary">Xử lý lại</Link>
          <button
            className="btn btn-success btn-lg"
            onClick={handleDownloadAll}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2 }} />
                Đang tải...
              </>
            ) : (
              <>📦 Download tất cả (ZIP)</>
            )}
          </button>
        </div>
      </div>

      <div className="result-grid">
        {outputs.map((output, idx) => (
          <div className="result-card" key={idx}>
            <img
              src={output.url}
              alt={output.filename}
              onClick={() => setLightboxImage(output.url)}
            />
            <div className="result-card-footer">
              <div>
                <div className="result-card-name">{output.filename}</div>
                <div className="result-card-source">Từ: {output.source_name}</div>
              </div>
              <button
                className="btn btn-secondary btn-icon"
                onClick={() => handleDownloadSingle(output)}
                title="Download"
              >
                ⬇️
              </button>
            </div>
          </div>
        ))}
      </div>

      {lightboxImage && (
        <div className="lightbox" onClick={() => setLightboxImage(null)}>
          <button className="lightbox-close" onClick={() => setLightboxImage(null)}>×</button>
          <img src={lightboxImage} alt="Full size preview" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
