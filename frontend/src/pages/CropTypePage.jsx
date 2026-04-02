import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  clearSavedGrid,
  DEFAULT_HELMET_PRESET_ID,
  DEFAULT_OUTFIT_PRESET_ID,
  DEFAULT_WEAPON_PRESET_ID,
  HELMET_GRID_PRESETS,
  OUTFIT_GRID_PRESETS,
  WEAPON_GRID_PRESETS,
  getDefaultGridForCropType,
  getHelmetPresetById,
  loadSavedGrid,
  saveGrid,
} from '../constants/cropPresets';
import { resolveApiUrl } from '../api';

const CROP_OPTIONS = [
  {
    id: 'outfit',
    icon: '👕',
    title: 'Quần áo / Trang phục',
    description: 'Cắt vùng inventory trang phục — tách ra từng bộ outfit riêng lẻ từ màn hình PUBG Mobile.',
    badge: 'Outfit',
    color: '#ff8c00',
  },
  {
    id: 'weapon',
    icon: '🔫',
    title: 'Súng / Vũ khí',
    description: 'Cắt vùng inventory skin súng — tách ra từng skin vũ khí riêng lẻ từ màn hình PUBG Mobile.',
    badge: 'Weapon',
    color: '#00d68f',
  },
  {
    id: 'helmet',
    icon: '⛑️',
    title: 'Mũ / Helmet',
    description: 'Cắt vùng inventory mũ bảo hiểm — tách danh sách skin mũ từ màn hình PUBG Mobile.',
    badge: 'Helmet',
    color: '#52c41a',
  },
  {
    id: 'character',
    icon: '👤',
    title: 'Cắt nhân vật',
    description: 'Cắt nhân vật (ảnh 2 mẫu) — phù hợp để lấy ảnh nhân vật đứng giữa màn hình.',
    badge: 'Character',
    color: '#1890ff',
  },
];

export default function CropTypePage({
  uploadedFiles,
  cropType,
  setCropType,
  outfitPreset = DEFAULT_OUTFIT_PRESET_ID,
  setOutfitPreset,
  weaponPreset = DEFAULT_WEAPON_PRESET_ID,
  setWeaponPreset,
  helmetPreset = DEFAULT_HELMET_PRESET_ID,
  setHelmetPreset,
  customGrid,
  setCustomGrid,
  detectLevel = false,
  setDetectLevel,
}) {
  const navigate = useNavigate();
  const getActivePresetId = (
    typeId = cropType,
    outfitPresetId = outfitPreset,
    weaponPresetId = weaponPreset,
    helmetPresetId = helmetPreset
  ) =>
    typeId === 'outfit'
      ? outfitPresetId
      : typeId === 'weapon'
        ? weaponPresetId
        : typeId === 'helmet'
          ? helmetPresetId
          : typeId === 'character'
            ? 'character_default'
            : DEFAULT_OUTFIT_PRESET_ID;
  const resolveInitialGrid = (
    typeId = cropType,
    outfitPresetId = outfitPreset,
    weaponPresetId = weaponPreset,
    helmetPresetId = helmetPreset
  ) =>
    customGrid ||
    loadSavedGrid(typeId, outfitPresetId, weaponPresetId, helmetPresetId) ||
    getDefaultGridForCropType(typeId, outfitPresetId, weaponPresetId, helmetPresetId);
  const [showAdjust, setShowAdjust] = useState(false);
  const [grid, setGrid] = useState(resolveInitialGrid());

  if (uploadedFiles.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📷</div>
        <div className="empty-state-text">Chưa có ảnh nào được upload</div>
        <div className="empty-state-subtext">Hãy upload ảnh trước khi chọn loại cắt.</div>
        <Link to="/" className="btn btn-primary">← Quay lại Upload</Link>
      </div>
    );
  }

  const handleSelect = (typeId) => {
    setCropType(typeId);
    const nextGrid = resolveInitialGrid(typeId, outfitPreset, weaponPreset, helmetPreset);
    setCustomGrid(loadSavedGrid(typeId, outfitPreset, weaponPreset, helmetPreset));
    setGrid(nextGrid);
  };

  const handleOutfitPresetChange = (presetId) => {
    setOutfitPreset(presetId);
    const savedGrid = loadSavedGrid('outfit', presetId, weaponPreset);
    setCustomGrid(savedGrid);
    setGrid(savedGrid || getDefaultGridForCropType('outfit', presetId, weaponPreset));
  };

  const handleWeaponPresetChange = (presetId) => {
    setWeaponPreset(presetId);
    const savedGrid = loadSavedGrid('weapon', outfitPreset, presetId, helmetPreset);
    setCustomGrid(savedGrid);
    setGrid(savedGrid || getDefaultGridForCropType('weapon', outfitPreset, presetId, helmetPreset));
  };

  const handleHelmetPresetChange = (presetId) => {
    setHelmetPreset(presetId);
    const savedGrid = loadSavedGrid('helmet', outfitPreset, weaponPreset, presetId);
    setCustomGrid(savedGrid);
    setGrid(savedGrid || getDefaultGridForCropType('helmet', outfitPreset, weaponPreset, presetId));
  };

  const handleContinue = () => {
    const savedGrid = loadSavedGrid(cropType, outfitPreset, weaponPreset, helmetPreset);
    const shouldUseGrid = cropType === 'weapon' || cropType === 'helmet' || showAdjust || savedGrid;
    setCustomGrid(shouldUseGrid ? grid : null);
    navigate('/preview');
  };

  const handleSaveGrid = () => {
    saveGrid(cropType, grid, outfitPreset, weaponPreset, helmetPreset);
    setCustomGrid(grid);
  };

  const handleResetGrid = () => {
    clearSavedGrid(cropType, outfitPreset, weaponPreset, helmetPreset);
    const nextGrid = getDefaultGridForCropType(cropType, outfitPreset, weaponPreset, helmetPreset);
    setGrid(nextGrid);
    setCustomGrid(null);
  };

  const hasSavedGrid = Boolean(loadSavedGrid(cropType, outfitPreset, weaponPreset, helmetPreset));

  const sampleImageStr = uploadedFiles[0].preview_url || resolveApiUrl(uploadedFiles[0].url);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Chọn loại cắt ảnh</h1>
        <p className="page-desc">
          Chọn loại nội dung bạn muốn cắt từ {uploadedFiles.length} ảnh đã upload.
          Hệ thống sẽ tự động tách từng item riêng lẻ dựa trên loại bạn chọn.
        </p>
      </div>

      <div className="crop-type-grid">
        {CROP_OPTIONS.map((option) => (
          <div
            key={option.id}
            className={`crop-type-card ${cropType === option.id ? 'selected' : ''}`}
            onClick={() => handleSelect(option.id)}
            style={{ '--card-accent': option.color }}
          >
            <div className="crop-type-check">
              {cropType === option.id ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="12" fill="var(--card-accent)" />
                  <path d="M8 12.5L11 15.5L16.5 9" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="11" stroke="var(--border)" strokeWidth="2" />
                </svg>
              )}
            </div>
            <div className="crop-type-icon">{option.icon}</div>
            <div className="crop-type-badge" style={{ background: option.color }}>
              {option.badge}
            </div>
            <h3 className="crop-type-title">{option.title}</h3>
            <p className="crop-type-desc">{option.description}</p>
          </div>
        ))}
      </div>

      {cropType === 'outfit' && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '0.75rem', textAlign: 'center' }}>Preset cắt quần áo</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center' }}>
            Chọn preset mặc định theo bố cục màn hình trước khi xử lý.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {OUTFIT_GRID_PRESETS.map((preset) => {
              const selected = outfitPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleOutfitPresetChange(preset.id)}
                  style={{
                    textAlign: 'left',
                    padding: '1rem 1.1rem',
                    borderRadius: '1rem',
                    border: selected ? '2px solid #ff8c00' : '1px solid var(--border)',
                    background: selected ? 'rgba(255, 140, 0, 0.12)' : 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    boxShadow: selected ? '0 0 0 1px rgba(255, 140, 0, 0.2)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.45rem' }}>
                    <strong>{preset.title}</strong>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      background: selected ? '#ff8c00' : 'rgba(255,255,255,0.08)',
                      color: selected ? '#111' : 'var(--text-secondary)',
                    }}>
                      {preset.subtitle}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {cropType === 'weapon' && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '0.75rem', textAlign: 'center' }}>Preset cắt súng</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center' }}>
            Giữ nguyên preset cũ và thêm một preset mới cho màn hình kho súng / ngoại trang.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {WEAPON_GRID_PRESETS.map((preset) => {
              const selected = weaponPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleWeaponPresetChange(preset.id)}
                  style={{
                    textAlign: 'left',
                    padding: '1rem 1.1rem',
                    borderRadius: '1rem',
                    border: selected ? '2px solid #00d68f' : '1px solid var(--border)',
                    background: selected ? 'rgba(0, 214, 143, 0.12)' : 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    boxShadow: selected ? '0 0 0 1px rgba(0, 214, 143, 0.2)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.45rem' }}>
                    <strong>{preset.title}</strong>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      background: selected ? '#00d68f' : 'rgba(255,255,255,0.08)',
                      color: selected ? '#111' : 'var(--text-secondary)',
                    }}>
                      {preset.subtitle}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              cursor: 'pointer', fontSize: '0.95rem',
              padding: '0.7rem 1.2rem',
              borderRadius: '0.75rem',
              border: detectLevel ? '2px solid #ffc107' : '1px solid var(--border)',
              background: detectLevel ? 'rgba(255, 193, 7, 0.12)' : 'var(--bg-card)',
              transition: 'all 0.2s ease',
            }}>
              <input
                type="checkbox"
                checked={detectLevel}
                onChange={(e) => setDetectLevel(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#ffc107', cursor: 'pointer' }}
              />
              <span>🏆 Hiển thị cấp súng (Lv)</span>
            </label>
          </div>
          {detectLevel && (
            <p style={{ color: '#ffc107', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>
              Hệ thống sẽ dùng OCR để đọc cấp súng từ tiêu đề ảnh và vẽ badge Lv lên mỗi ảnh cắt.
            </p>
          )}
        </div>
      )}

      {cropType === 'helmet' && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '0.75rem', textAlign: 'center' }}>Preset cắt mũ</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center' }}>
            Chọn preset mũ theo thiết bị: Điện thoại (4 hàng) hoặc iPad (5 hàng).
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {HELMET_GRID_PRESETS.map((preset) => {
              const selected = helmetPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleHelmetPresetChange(preset.id)}
                  style={{
                    textAlign: 'left',
                    padding: '1rem 1.1rem',
                    borderRadius: '1rem',
                    border: selected ? '2px solid #52c41a' : '1px solid var(--border)',
                    background: selected ? 'rgba(82, 196, 26, 0.12)' : 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    boxShadow: selected ? '0 0 0 1px rgba(82, 196, 26, 0.2)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.45rem' }}>
                    <strong>{preset.title}</strong>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      background: selected ? '#52c41a' : 'rgba(255,255,255,0.08)',
                      color: selected ? '#111' : 'var(--text-secondary)',
                    }}>
                      {preset.subtitle}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button
          className="btn btn-ghost"
          onClick={() => setShowAdjust(!showAdjust)}
          style={{ border: '1px solid var(--border)' }}
        >
          {showAdjust ? '⬇ Ẩn tùy chỉnh vùng cắt' : '⚙️ Tùy chỉnh vùng cắt (Nâng cao)'}
        </button>
      </div>

      {showAdjust && (
        <div className="custom-crop-panel" style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: '1rem', textAlign: 'center' }}>Căn chỉnh khung cắt</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>
            Kéo các thanh trượt bên dưới để khoanh vùng chính xác danh sách đồ bên phải.
          </p>

          {cropType === 'weapon' && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>
              Với súng, bạn chỉ cần chọn 1 ô súng mẫu. Hệ thống sẽ tự quét hết các ô súng còn lại trong cùng cột. Preset hiện tại: <strong>{WEAPON_GRID_PRESETS.find((preset) => preset.id === weaponPreset)?.title}</strong>
            </p>
          )}

          {(cropType === 'outfit' || cropType === 'helmet') && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>
              Preset hiện tại: <strong>{cropType === 'outfit' ? OUTFIT_GRID_PRESETS.find((preset) => preset.id === outfitPreset)?.title : getHelmetPresetById(helmetPreset).title}</strong>
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={handleSaveGrid}>
              Lưu toạ độ cho tất cả ảnh
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleResetGrid}>
              Reset về mặc định
            </button>
          </div>
          <p style={{ color: hasSavedGrid ? '#00d68f' : 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '1rem', textAlign: 'center' }}>
            {hasSavedGrid
              ? 'Đang dùng toạ độ đã lưu cho tất cả ảnh cùng loại cắt này.'
              : 'Chưa có toạ độ lưu sẵn. Nếu bấm lưu, lần sau hệ thống sẽ tự áp dụng.'}
          </p>

          <div style={{ position: 'relative', width: '100%', maxWidth: '800px', margin: '0 auto 2rem', overflow: 'hidden', borderRadius: '8px' }}>
            <img src={sampleImageStr} alt="Preview" style={{ width: '100%', height: 'auto', display: 'block' }} />

            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              pointerEvents: 'none'
            }}>
              <div style={{
                position: 'absolute',
                left: `${grid.x_ratio * 100}%`,
                top: `${grid.y_ratio * 100}%`,
                width: `${grid.w_ratio * 100}%`,
                height: `${grid.h_ratio * 100}%`,
                border: '2px dashed #00d68f',
                backgroundColor: 'rgba(0, 214, 143, 0.2)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)'
              }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '600px', margin: '0 auto' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.85rem' }}>
              X (Trục ngang): {grid.x_ratio.toFixed(2)}
              <input type="range" min="0" max="1" step="0.005" value={grid.x_ratio} onChange={e => setGrid({ ...grid, x_ratio: parseFloat(e.target.value) })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.85rem' }}>
              W (Độ rộng): {grid.w_ratio.toFixed(2)}
              <input type="range" min="0" max="1" step="0.005" value={grid.w_ratio} onChange={e => setGrid({ ...grid, w_ratio: parseFloat(e.target.value) })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.85rem' }}>
              Y (Trục dọc): {grid.y_ratio.toFixed(2)}
              <input type="range" min="0" max="1" step="0.005" value={grid.y_ratio} onChange={e => setGrid({ ...grid, y_ratio: parseFloat(e.target.value) })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.85rem' }}>
              H (Độ cao): {grid.h_ratio.toFixed(2)}
              <input type="range" min="0" max="1" step="0.005" value={grid.h_ratio} onChange={e => setGrid({ ...grid, h_ratio: parseFloat(e.target.value) })} />
            </label>
          </div>
        </div>
      )}

      <div className="actions-bar" style={{ marginTop: '2rem' }}>
        <div className="actions-info">
          <span className="actions-count">
            <strong>{uploadedFiles.length}</strong> ảnh sẽ được cắt
          </span>
          {cropType === 'outfit' && (
            <span className="crop-type-selected-label">
              Preset: <strong style={{ color: '#ff8c00' }}>
                {OUTFIT_GRID_PRESETS.find((preset) => preset.id === outfitPreset)?.title}
              </strong>
            </span>
          )}
          {cropType === 'helmet' && (
            <span className="crop-type-selected-label">
              Preset: <strong style={{ color: '#52c41a' }}>
                {getHelmetPresetById(helmetPreset).title}
              </strong>
            </span>
          )}
          <span className="crop-type-selected-label">
            Loại: <strong style={{ color: CROP_OPTIONS.find(o => o.id === cropType)?.color }}>
              {CROP_OPTIONS.find(o => o.id === cropType)?.title}
            </strong>
          </span>
        </div>
        <div className="btn-group">
          <Link to="/" className="btn btn-ghost">← Upload lại</Link>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleContinue}
          >
            ✂️ Tiếp tục cắt ảnh
          </button>
        </div>
      </div>
    </div>
  );
}
