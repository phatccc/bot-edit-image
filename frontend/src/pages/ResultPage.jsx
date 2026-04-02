import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadZip, resolveApiUrl } from '../api';

function drawLabelText(ctx, text, x, y, options = {}) {
  const {
    align = 'left',
    fontSize = 38,
  } = options;
  ctx.save();
  ctx.font = `900 ${fontSize}px "Burbank Big Condensed Black", Impact, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';

  // Base setup (Removed stroke/border as requested by user)
  ctx.fillStyle = '#fff';

  // Outer shadow for depth and readability (instead of a thick crude border)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Only fill the text, NO stroke
  ctx.fillText(text, x, y);
  ctx.restore();
}

async function renderWeaponPreview(imageUrl, level, pkMode) {
  const trimmedLevel = String(level || '').trim();
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Dynamic font size that scales with image height, avoiding the massive minimum
  // Slightly reduced multiplier from 0.52 to 0.48
  const fontSize = Math.max(20, Math.round(canvas.height * 0.48));

  // Minimal margins to push text flush against the corners
  const marginX = Math.max(2, Math.round(canvas.width * 0.005));
  const bottomBaselineY = canvas.height - Math.max(2, Math.round(canvas.height * 0.005));

  const levelText = trimmedLevel ? `LV${trimmedLevel}` : '';
  const rightText = pkMode === 'fullpk' ? 'FULL PK' : pkMode === 'pk' ? 'PK' : '';

  if (levelText) {
    drawLabelText(ctx, levelText, marginX, bottomBaselineY, { fontSize, align: 'left' });
  }
  if (rightText) {
    drawLabelText(ctx, rightText, canvas.width - marginX, bottomBaselineY, { fontSize, align: 'right' });
  }

  return canvas.toDataURL('image/png');
}

async function mergeImagesInColumnsClient(blobs, maxPerColumn = 3) {
  const images = await Promise.all(
    blobs.map(async (blob) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      return new Promise((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = reject;
        img.src = url;
      });
    })
  );

  if (images.length === 0) return null;

  const cellWidth = images[0].width;

  const layout = images.map((img) => ({
    img,
    w: cellWidth,
    h: Math.round(img.height * (cellWidth / img.width))
  }));

  const cols = Math.ceil(layout.length / maxPerColumn);
  const colHeights = Array(cols).fill(0);

  for (let i = 0; i < layout.length; i++) {
    const colIndex = Math.floor(i / maxPerColumn);
    colHeights[colIndex] += layout[i].h;
  }
  const maxGridHeight = Math.max(...colHeights);

  const canvas = document.createElement('canvas');
  canvas.width = cellWidth * cols;
  canvas.height = maxGridHeight;
  const ctx = canvas.getContext('2d');

  let currentX = 0;
  for (let c = 0; c < cols; c++) {
    let currentY = 0;
    const startIndex = c * maxPerColumn;
    const endIndex = Math.min(startIndex + maxPerColumn, layout.length);
    for (let i = startIndex; i < endIndex; i++) {
      const item = layout[i];
      ctx.drawImage(item.img, currentX, currentY, item.w, item.h);
      currentY += item.h;
    }
    currentX += cellWidth;
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

async function mergeImagesVerticallyClient(blobs) {
  const images = await Promise.all(
    blobs.map(async (blob) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      return new Promise((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = reject;
        img.src = url;
      });
    })
  );

  if (images.length === 0) return null;

  const maxWidth = images[0].width;
  let totalHeight = 0;
  const layout = images.map((img) => {
    const h = Math.round(img.height * (maxWidth / img.width));
    const entry = { img, h, y: totalHeight };
    totalHeight += h;
    return entry;
  });

  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  layout.forEach((item) => {
    ctx.drawImage(item.img, 0, item.y, canvas.width, item.h);
  });

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function downloadImage(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function fetchImageBlob(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Không tải được ảnh để copy.');
  }
  return response.blob();
}

async function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };
    image.src = objectUrl;
  });
}

function rowHasVisibleContent(data, width, y, minVisiblePixels) {
  const rowOffset = y * width * 4;
  let visible = 0;
  for (let x = 0; x < width; x += 1) {
    const offset = rowOffset + x * 4;
    const alpha = data[offset + 3];
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    if (alpha > 24 && (r > 22 || g > 22 || b > 22)) {
      visible += 1;
      if (visible >= minVisiblePixels) {
        return true;
      }
    }
  }
  return false;
}

function colHasVisibleContent(data, width, height, x, minVisiblePixels) {
  let visible = 0;
  for (let y = 0; y < height; y += 1) {
    const offset = (y * width + x) * 4;
    const alpha = data[offset + 3];
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    if (alpha > 24 && (r > 22 || g > 22 || b > 22)) {
      visible += 1;
      if (visible >= minVisiblePixels) {
        return true;
      }
    }
  }
  return false;
}

function sampleCornerAverage(data, width, height, sampleSize) {
  const regions = [
    { startX: 0, startY: 0 },
    { startX: Math.max(0, width - sampleSize), startY: 0 },
    { startX: 0, startY: Math.max(0, height - sampleSize) },
    { startX: Math.max(0, width - sampleSize), startY: Math.max(0, height - sampleSize) },
  ];

  const totals = { r: 0, g: 0, b: 0, count: 0 };
  regions.forEach(({ startX, startY }) => {
    for (let y = startY; y < Math.min(height, startY + sampleSize); y += 1) {
      for (let x = startX; x < Math.min(width, startX + sampleSize); x += 1) {
        const offset = (y * width + x) * 4;
        totals.r += data[offset];
        totals.g += data[offset + 1];
        totals.b += data[offset + 2];
        totals.count += 1;
      }
    }
  });

  return {
    r: totals.r / Math.max(1, totals.count),
    g: totals.g / Math.max(1, totals.count),
    b: totals.b / Math.max(1, totals.count),
  };
}

function isNearBackground(r, g, b, background, tolerance) {
  return (
    Math.abs(r - background.r) <= tolerance &&
    Math.abs(g - background.g) <= tolerance &&
    Math.abs(b - background.b) <= tolerance
  );
}

function rowIsBackground(data, width, y, background, tolerance, requiredRatio) {
  const rowOffset = y * width * 4;
  let backgroundPixels = 0;
  for (let x = 0; x < width; x += 1) {
    const offset = rowOffset + x * 4;
    const alpha = data[offset + 3];
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    if (alpha <= 24 || isNearBackground(r, g, b, background, tolerance)) {
      backgroundPixels += 1;
    }
  }
  return backgroundPixels / Math.max(1, width) >= requiredRatio;
}

function colIsBackground(data, width, height, x, background, tolerance, requiredRatio) {
  let backgroundPixels = 0;
  for (let y = 0; y < height; y += 1) {
    const offset = (y * width + x) * 4;
    const alpha = data[offset + 3];
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    if (alpha <= 24 || isNearBackground(r, g, b, background, tolerance)) {
      backgroundPixels += 1;
    }
  }
  return backgroundPixels / Math.max(1, height) >= requiredRatio;
}

async function trimDarkBorderFromBlob(blob) {
  const image = await loadImageFromBlob(blob);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);

  const { data } = ctx.getImageData(0, 0, width, height);
  const sampleSize = Math.max(6, Math.round(Math.min(width, height) * 0.03));
  const background = sampleCornerAverage(data, width, height, sampleSize);
  const backgroundBrightness = (background.r + background.g + background.b) / 3;
  const isDarkBorderCandidate = backgroundBrightness <= 52;
  const backgroundTolerance = 34;
  const backgroundRowRatio = 0.94;
  const backgroundColRatio = 0.94;
  const minVisiblePerRow = Math.max(2, Math.round(width * 0.01));
  const minVisiblePerCol = Math.max(2, Math.round(height * 0.01));

  if (!isDarkBorderCandidate) {
    return blob;
  }

  if (isDarkBorderCandidate) {
    const aggressiveTolerance = 26;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const alpha = data[offset + 3];
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];

        if (alpha <= 24 || isNearBackground(r, g, b, background, aggressiveTolerance)) {
          continue;
        }

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (maxX >= minX && maxY >= minY) {
      const croppedWidth = Math.max(1, maxX - minX + 1);
      const croppedHeight = Math.max(1, maxY - minY + 1);
      const trimmedCanvas = document.createElement('canvas');
      trimmedCanvas.width = croppedWidth;
      trimmedCanvas.height = croppedHeight;
      const trimmedCtx = trimmedCanvas.getContext('2d');
      trimmedCtx.drawImage(
        canvas,
        minX,
        minY,
        croppedWidth,
        croppedHeight,
        0,
        0,
        croppedWidth,
        croppedHeight
      );

      return new Promise((resolve, reject) => {
        trimmedCanvas.toBlob((nextBlob) => {
          if (nextBlob) {
            resolve(nextBlob);
            return;
          }
          reject(new Error('Không thể cắt sát vùng nội dung.'));
        }, blob.type || 'image/png');
      });
    }
  }

  let top = 0;
  while (
    top < height &&
    (
      rowIsBackground(data, width, top, background, backgroundTolerance, backgroundRowRatio) ||
      !rowHasVisibleContent(data, width, top, minVisiblePerRow)
    )
  ) {
    top += 1;
  }

  let bottom = height - 1;
  while (
    bottom >= top &&
    (
      rowIsBackground(data, width, bottom, background, backgroundTolerance, backgroundRowRatio) ||
      !rowHasVisibleContent(data, width, bottom, minVisiblePerRow)
    )
  ) {
    bottom -= 1;
  }

  let left = 0;
  while (
    left < width &&
    (
      colIsBackground(data, width, height, left, background, backgroundTolerance, backgroundColRatio) ||
      !colHasVisibleContent(data, width, height, left, minVisiblePerCol)
    )
  ) {
    left += 1;
  }

  let right = width - 1;
  while (
    right >= left &&
    (
      colIsBackground(data, width, height, right, background, backgroundTolerance, backgroundColRatio) ||
      !colHasVisibleContent(data, width, height, right, minVisiblePerCol)
    )
  ) {
    right -= 1;
  }

  if (top === 0 && left === 0 && right === width - 1 && bottom === height - 1) {
    return blob;
  }

  const croppedWidth = Math.max(1, right - left + 1);
  const croppedHeight = Math.max(1, bottom - top + 1);
  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = croppedWidth;
  trimmedCanvas.height = croppedHeight;
  const trimmedCtx = trimmedCanvas.getContext('2d');
  trimmedCtx.drawImage(
    canvas,
    left,
    top,
    croppedWidth,
    croppedHeight,
    0,
    0,
    croppedWidth,
    croppedHeight
  );

  return new Promise((resolve, reject) => {
    trimmedCanvas.toBlob((nextBlob) => {
      if (nextBlob) {
        resolve(nextBlob);
        return;
      }
      reject(new Error('Không thể cắt bỏ viền đen.'));
    }, blob.type || 'image/png');
  });
}

async function fetchPreparedImageBlob(url) {
  const blob = await fetchImageBlob(url);
  return trimDarkBorderFromBlob(blob);
}

async function copyBlobToClipboard(blob) {
  if (!navigator.clipboard?.write || !window.ClipboardItem) {
    throw new Error('Trình duyệt này không hỗ trợ copy ảnh trực tiếp.');
  }

  const type = blob.type || 'image/png';
  await navigator.clipboard.write([
    new window.ClipboardItem({
      [type]: blob,
    }),
  ]);
}

async function copyMultipleBlobsToClipboard(blobs) {
  if (!navigator.clipboard?.write || !window.ClipboardItem) {
    throw new Error('Trình duyệt này không hỗ trợ copy nhiều ảnh.');
  }

  const items = blobs.map((blob) => {
    const type = blob.type || 'image/png';
    return new window.ClipboardItem({
      [type]: blob,
    });
  });

  await navigator.clipboard.write(items);
}

function isMultipleClipboardItemsUnsupported(error) {
  return /multiple\s+ClipboardItems\s+is\s+not\s+implemented/i.test(String(error?.message || error));
}

function ensureFileExtension(filename, blob) {
  if (/\.(png|jpg|jpeg|webp)$/i.test(filename)) {
    return filename;
  }
  if (blob.type === 'image/jpeg') {
    return `${filename}.jpg`;
  }
  if (blob.type === 'image/webp') {
    return `${filename}.webp`;
  }
  return `${filename}.png`;
}

function ResultCardShell({
  selected,
  onToggleSelected,
  imageUrl,
  filename,
  suppressLightboxRef,
  children,
}) {
  return (
    <div
      className={`result-card ${selected ? 'selected' : ''}`}
      data-result-filename={filename}
      onClick={(event) => {
        if (suppressLightboxRef.current) {
          suppressLightboxRef.current = false;
          return;
        }
        if (event.target.closest('button, input, a, .weapon-card-editor')) {
          return;
        }
        onToggleSelected();
      }}
    >
      <div className="result-card-media">
        <img
          src={imageUrl}
          alt={filename}
        />
      </div>
      {children}
    </div>
  );
}

function WeaponResultCard({
  output,
  imageUrl,
  editedImageUrl,
  selected,
  level,
  pkMode,
  onLevelChange,
  onPkModeChange,
  onEditedImageChange,
  onOpenLightbox,
  onToggleSelected,
  suppressLightboxRef,
}) {
  useEffect(() => {
    let active = true;
    const trimmedLevel = String(level || '').trim();

    if (!trimmedLevel && pkMode === 'none') {
      onEditedImageChange(output.filename, null);
      return undefined;
    }

    renderWeaponPreview(imageUrl, trimmedLevel, pkMode)
      .then((nextUrl) => {
        if (active) {
          onEditedImageChange(output.filename, nextUrl);
        }
      })
      .catch(() => {
        if (active) {
          onEditedImageChange(output.filename, null);
        }
      });

    return () => {
      active = false;
    };
  }, [imageUrl, level, onEditedImageChange, output.filename, pkMode]);

  const previewUrl = editedImageUrl || imageUrl;

  return (
    <ResultCardShell
      selected={selected}
      onToggleSelected={onToggleSelected}
      imageUrl={previewUrl}
      filename={output.filename}
      suppressLightboxRef={suppressLightboxRef}
    >
      <div className="weapon-card-editor">
        <div className="weapon-card-editor-label">Chỉnh Lv / PK</div>
        <div className="weapon-card-editor-grid">
          <input
            className="weapon-level-input"
            type="number"
            min="0"
            max="99"
            placeholder="Nhập Lv"
            value={level}
            onChange={(e) => onLevelChange(output.filename, e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
          />
          <div className="weapon-pk-group">
            <button
              type="button"
              className={`weapon-pk-button ${pkMode === 'none' ? 'active' : ''}`}
              onClick={() => onPkModeChange(output.filename, 'none')}
            >
              Không
            </button>
            <button
              type="button"
              className={`weapon-pk-button ${pkMode === 'pk' ? 'active' : ''}`}
              onClick={() => onPkModeChange(output.filename, 'pk')}
            >
              PK
            </button>
            <button
              type="button"
              className={`weapon-pk-button ${pkMode === 'fullpk' ? 'active' : ''}`}
              onClick={() => onPkModeChange(output.filename, 'fullpk')}
            >
              Full PK
            </button>
          </div>
        </div>
      </div>
    </ResultCardShell>
  );
}

function StandardResultCard({
  output,
  imageUrl,
  selected,
  onOpenLightbox,
  onToggleSelected,
  suppressLightboxRef,
}) {
  return (
    <ResultCardShell
      selected={selected}
      onToggleSelected={onToggleSelected}
      imageUrl={imageUrl}
      filename={output.filename}
      suppressLightboxRef={suppressLightboxRef}
    />
  );
}

export default function ResultPage({ outputs, cropType = 'outfit' }) {
  const [lightboxImage, setLightboxImage] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [editedImageUrls, setEditedImageUrls] = useState({});
  const [selectedMap, setSelectedMap] = useState({});
  const [dragFiles, setDragFiles] = useState([]);
  const [preparingDrag, setPreparingDrag] = useState(false);
  const [merging, setMerging] = useState(false);
  const [weaponMetadata, setWeaponMetadata] = useState({});
  const gridRef = useRef(null);
  const suppressLightboxRef = useRef(false);

  const isWeaponMode = cropType === 'weapon';

  const resolvedOutputs = useMemo(() => {
    const mapped = outputs.map((output) => ({ ...output, resolvedUrl: resolveApiUrl(output.url) }));
    if (isWeaponMode) {
      mapped.sort((a, b) => {
        const lvA = parseInt(a.detected_level || '0', 10);
        const lvB = parseInt(b.detected_level || '0', 10);
        return lvB - lvA;
      });
    }
    return mapped;
  }, [outputs, isWeaponMode]);

  useEffect(() => {
    const validFilenames = new Set(resolvedOutputs.map((output) => output.filename));
    setSelectedMap((prev) => {
      const next = {};
      for (const [filename, selected] of Object.entries(prev)) {
        if (selected && validFilenames.has(filename)) {
          next[filename] = true;
        }
      }
      return next;
    });
  }, [resolvedOutputs]);

  // Pre-populate weapon metadata from backend detected_level
  useEffect(() => {
    if (!isWeaponMode) return;
    const initial = {};
    resolvedOutputs.forEach((output) => {
      if (output.detected_level) {
        initial[output.filename] = {
          level: String(output.detected_level),
          pkMode: 'none',
        };
      }
    });
    if (Object.keys(initial).length > 0) {
      setWeaponMetadata((prev) => ({ ...initial, ...prev }));
    }
  }, [resolvedOutputs, isWeaponMode]);

  const handleEditedImageChange = useCallback((filename, nextUrl) => {
    setEditedImageUrls((prev) => {
      if (!nextUrl) {
        if (!(filename in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[filename];
        return next;
      }

      if (prev[filename] === nextUrl) {
        return prev;
      }

      return {
        ...prev,
        [filename]: nextUrl,
      };
    });
  }, []);

  const handleLevelChange = useCallback((filename, level) => {
    setWeaponMetadata((prev) => ({
      ...prev,
      [filename]: { ...(prev[filename] || { pkMode: 'none' }), level },
    }));
  }, []);

  const handlePkModeChange = useCallback((filename, pkMode) => {
    setWeaponMetadata((prev) => ({
      ...prev,
      [filename]: { ...(prev[filename] || { level: '' }), pkMode },
    }));
  }, []);

  const toggleSelected = useCallback((filename) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[filename]) {
        delete next[filename];
      } else {
        next[filename] = true;
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedMap(
      Object.fromEntries(resolvedOutputs.map((output) => [output.filename, true]))
    );
  }, [resolvedOutputs]);

  const selectedOutputs = useMemo(() => {
    return Object.keys(selectedMap)
      .map((filename) => resolvedOutputs.find((output) => output.filename === filename))
      .filter(Boolean);
  }, [resolvedOutputs, selectedMap]);
  const selectedCount = selectedOutputs.length;
  const allSelected = resolvedOutputs.length > 0 && selectedCount === resolvedOutputs.length;

  const getPreviewUrl = useCallback((output) => {
    return editedImageUrls[output.filename] || output.resolvedUrl;
  }, [editedImageUrls]);

  useEffect(() => {
    let active = true;

    if (selectedOutputs.length === 0) {
      setDragFiles([]);
      setPreparingDrag(false);
      return undefined;
    }

    setPreparingDrag(true);
    Promise.all(
      selectedOutputs.map(async (output) => {
        const url = getPreviewUrl(output);
        const blob = await fetchPreparedImageBlob(url);
        return new File(
          [blob],
          ensureFileExtension(output.filename, blob),
          { type: blob.type || 'image/png' }
        );
      })
    )
      .then((files) => {
        if (!active) {
          return;
        }
        setDragFiles(files);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setDragFiles([]);
      })
      .finally(() => {
        if (active) {
          setPreparingDrag(false);
        }
      });

    return () => {
      active = false;
    };
  }, [getPreviewUrl, selectedOutputs]);

  const handleDownloadSingle = useCallback((output, urlOverride = null) => {
    const filename = typeof output === 'string' ? output : output.filename;
    const url = typeof output === 'string' ? urlOverride : (urlOverride || getPreviewUrl(output));
    downloadImage(url, filename);
  }, [getPreviewUrl]);

  const handleCopySelected = useCallback(async () => {
    if (selectedCount === 0) {
      alert('Chọn ít nhất 1 ảnh để copy.');
      return;
    }

    if (selectedCount > 1) {
      setCopyMessage('Copy clipboard chỉ ổn định với 1 ảnh. Nếu muốn đưa hết sang Canva, hãy dùng "Kéo thả đã chọn".');
      return;
    }

    setCopying(true);
    setCopyMessage('');

    try {
      const urls = selectedOutputs.map((output) => getPreviewUrl(output));
      const blob = await fetchPreparedImageBlob(urls[0]);
      await copyBlobToClipboard(blob);
      setCopyMessage('Đã copy 1 ảnh. Bạn có thể paste thẳng vào Canva.');
    } catch (error) {
      alert(error.message || 'Copy ảnh thất bại.');
    }

    setCopying(false);
  }, [getPreviewUrl, selectedCount, selectedOutputs]);

  const handleDownloadAll = async () => {
    if (outputs.length === 0) return;
    setDownloading(true);
    try {
      if (isWeaponMode) {
        for (const output of resolvedOutputs) {
          downloadImage(getPreviewUrl(output), output.filename);
          await new Promise((resolve) => window.setTimeout(resolve, 120));
        }
      } else {
        const filenames = outputs.map((output) => output.filename);
        await downloadZip(filenames);
      }
    } catch (err) {
      alert('Download failed: ' + (err.message || 'Unknown error'));
    }
    setDownloading(false);
  };

  const handleMergeVertical = async () => {
    if (selectedCount === 0) {
      alert('Hãy chọn ít nhất 1 ảnh để ghép.');
      return;
    }
    setMerging(true);
    setCopyMessage('');
    try {
      let sortedOutputs = [...selectedOutputs];
      if (isWeaponMode) {
        sortedOutputs.sort((a, b) => {
          const lvA = parseInt((weaponMetadata[a.filename]?.level || '0'), 10);
          const lvB = parseInt((weaponMetadata[b.filename]?.level || '0'), 10);
          return lvB - lvA;
        });
      }

      const blobs = await Promise.all(
        sortedOutputs.map(async (output) => {
          const url = getPreviewUrl(output);
          return fetchPreparedImageBlob(url);
        })
      );

      let mergedBlob = null;
      if (isWeaponMode) {
        mergedBlob = await mergeImagesInColumnsClient(blobs, 10);
      } else {
        mergedBlob = await mergeImagesInColumnsClient(blobs, 3);
      }

      if (mergedBlob) {
        const url = URL.createObjectURL(mergedBlob);
        setLightboxImage(url);
        setCopyMessage(
          isWeaponMode
            ? 'Đã ghép xong ảnh dọc. Bạn có thể chuột phải lưu ảnh hoặc nhấn "Download tất cả" để lấy bản lưu tên khác.'
            : 'Đã ghép xong ảnh ngàng (chia cột). Bạn có thể chuột phải lưu ảnh!'
        );
      }
    } catch (err) {
      alert('Ghép ảnh thất bại: ' + err.message);
    }
    setMerging(false);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isCopyShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c';
      if (!isCopyShortcut) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (selectedCount === 0) {
        return;
      }

      event.preventDefault();
      handleCopySelected();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopySelected, selectedCount]);

  const handleDragSelectedStart = useCallback((event) => {
    if (dragFiles.length === 0) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'copy';
    dragFiles.forEach((file) => {
      try {
        event.dataTransfer.items.add(file);
      } catch (error) {
        // Ignore browsers that do not support adding File objects in dragstart.
      }
    });
  }, [dragFiles]);

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
          Kết quả đã được tạo thành công. Bấm vào thẻ để chọn ảnh cần copy.
        </p>
      </div>

      <div className="actions-bar" style={{ marginTop: 0, marginBottom: '1rem' }}>
        <div className="actions-info">
          <span className="actions-count">
            <strong>{outputs.length}</strong> kết quả đã tạo
          </span>
          <span className="crop-type-selected-label">
            <strong>{selectedCount}</strong> ảnh đang chọn
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
              <>{isWeaponMode ? '⬇️ Download tất cả' : '📦 Download tất cả (ZIP)'}</>
            )}
          </button>
        </div>
      </div>

      <div className="result-selection-bar">
        <div className="result-selection-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={allSelected ? () => setSelectedMap({}) : handleSelectAll}
          >
            {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCopySelected}
            disabled={copying || selectedCount === 0}
          >
            {copying ? 'Đang copy...' : 'Copy đã chọn'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            draggable={dragFiles.length > 0}
            onDragStart={handleDragSelectedStart}
            disabled={selectedCount === 0 || preparingDrag}
            title="Giữ chuột và kéo nút này sang Canva"
          >
            {preparingDrag ? 'Đang chuẩn bị kéo...' : 'Kéo thả đã chọn'}
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={handleMergeVertical}
            disabled={merging || selectedCount === 0}
          >
            {merging ? 'Đang ghép...' : (isWeaponMode ? 'Ghép ảnh dọc' : 'Ghép ảnh ngang')}
          </button>
        </div>
        <div className="result-selection-hint">
          {copyMessage || 'Bấm vào 1 thẻ để chọn đúng 1 ảnh rồi copy. Nếu muốn đưa hết ảnh sang Canva, hãy bấm "Chọn tất cả" rồi dùng "Kéo thả đã chọn".'}
        </div>
      </div>

      <div
        className="result-grid-wrapper"
        ref={gridRef}
      >
        <div className="result-grid">
          {resolvedOutputs.map((output, idx) => (
            isWeaponMode ? (
              <WeaponResultCard
                key={idx}
                output={output}
                imageUrl={output.resolvedUrl}
                editedImageUrl={editedImageUrls[output.filename]}
                selected={Boolean(selectedMap[output.filename])}
                level={weaponMetadata[output.filename]?.level || ''}
                pkMode={weaponMetadata[output.filename]?.pkMode || 'none'}
                onLevelChange={handleLevelChange}
                onPkModeChange={handlePkModeChange}
                onEditedImageChange={handleEditedImageChange}
                onToggleSelected={() => toggleSelected(output.filename)}
                suppressLightboxRef={suppressLightboxRef}
              />
            ) : (
              <StandardResultCard
                key={idx}
                output={output}
                imageUrl={output.resolvedUrl}
                selected={Boolean(selectedMap[output.filename])}
                onToggleSelected={() => toggleSelected(output.filename)}
                suppressLightboxRef={suppressLightboxRef}
              />
            )
          ))}
        </div>
      </div>

      {lightboxImage && (
        <div className="lightbox" onClick={() => setLightboxImage(null)}>
          <button className="lightbox-close" onClick={() => setLightboxImage(null)}>×</button>
          <img src={lightboxImage} alt="Full size preview" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
