import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { processImages, getTemplates, resolveApiUrl } from '../api';
import {
  DEFAULT_HELMET_PRESET_ID,
  DEFAULT_OUTFIT_PRESET_ID,
  getHelmetPresetById,
  getOutfitPresetById,
  DEFAULT_WEAPON_PRESET_ID,
  getWeaponPresetById,
} from '../constants/cropPresets';

export default function PreviewPage({
  uploadedFiles,
  setOutputs,
  cropType = 'outfit',
  outfitPreset = DEFAULT_OUTFIT_PRESET_ID,
  weaponPreset = DEFAULT_WEAPON_PRESET_ID,
  helmetPreset = DEFAULT_HELMET_PRESET_ID,
  customGrid = null
}) {
  const [processing, setProcessing] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('default');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await getTemplates();
      setTemplates(data.templates || []);
    } catch {
      // Fallback
      setTemplates([{ name: 'default', filename: 'default.json' }]);
    }
  };

  const handleProcess = async () => {
    if (uploadedFiles.length === 0) return;
    setProcessing(true);
    setError('');

    try {
      const filenames = uploadedFiles.map((f) => f.filename);
      const result = await processImages(
        filenames,
        selectedTemplate,
        cropType,
        customGrid,
        cropType === 'outfit' ? outfitPreset : null
      );
      setOutputs(result.outputs);
      
      setTimeout(() => {
        navigate('/result');
      }, 500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Processing failed. Hãy thử lại.');
      setProcessing(false);
    }
  };

  if (uploadedFiles.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📷</div>
        <div className="empty-state-text">Chưa có ảnh nào được upload</div>
        <div className="empty-state-subtext">Hãy upload ảnh trước khi preview.</div>
        <Link to="/crop-type" className="btn btn-primary">← Quay lại chọn loại</Link>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="processing-overlay">
        <div className="spinner" />
        <div className="processing-text">Đang tạo showcase poster...</div>
        <div className="processing-subtext">
          Xử lý {uploadedFiles.length} ảnh • Crop, detect, compose
        </div>
        <div className="progress-bar" style={{ maxWidth: 300, marginTop: '1.5rem' }}>
          <div className="progress-fill" style={{ width: '60%', animation: 'none' }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Preview & Xử lý</h1>
        <p className="page-desc">
          Xem lại ảnh đã upload, chọn template, và bắt đầu tạo showcase poster.
        </p>
      </div>

      <div className="preview-grid">
        {uploadedFiles.map((file, idx) => (
          <div className="preview-card" key={idx}>
            <img src={file.preview_url || resolveApiUrl(file.url)} alt={file.original_name} />
            <div className="preview-card-info">
              <div className="preview-card-name">{file.original_name}</div>
              <div className="preview-card-meta">
                {file.width} × {file.height} • {(file.size / 1024).toFixed(0)} KB
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="actions-bar">
        <div className="actions-info">
          <span className="actions-count">
            <strong>{uploadedFiles.length}</strong> ảnh sẵn sàng xử lý
          </span>
          {cropType === 'outfit' && (
            <span className="crop-type-selected-label">
              Preset outfit: <strong style={{ color: '#ff8c00' }}>{getOutfitPresetById(outfitPreset).title}</strong>
            </span>
          )}
          {cropType === 'weapon' && (
            <span className="crop-type-selected-label">
              Preset súng: <strong style={{ color: '#00d68f' }}>{getWeaponPresetById(weaponPreset).title}</strong>
            </span>
          )}
          {cropType === 'helmet' && (
            <span className="crop-type-selected-label">
              Preset mũ: <strong style={{ color: '#52c41a' }}>{getHelmetPresetById(helmetPreset).title}</strong>
            </span>
          )}
          <div className="template-select">
            <label>Template:</label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="btn-group">
          <Link to="/crop-type" className="btn btn-ghost">← Đổi loại cắt</Link>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleProcess}
            disabled={processing}
          >
            ⚡ Tạo Showcase
          </button>
        </div>
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
    </div>
  );
}
