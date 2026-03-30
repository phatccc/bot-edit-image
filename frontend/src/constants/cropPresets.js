export const OUTFIT_GRID_PRESETS = [
  {
    id: 'outfit_3_rows',
    title: 'Cắt 3 hàng',
    subtitle: 'Điện thoại',
    description: 'Preset mặc định cho ảnh outfit hiển thị 3 hàng item.',
    grid: { x_ratio: 0.61, y_ratio: 0.22, w_ratio: 0.26, h_ratio: 0.62 },
  },
  {
    id: 'outfit_5_rows',
    title: 'Cắt 5 hàng',
    subtitle: 'iPad 15"',
    description: 'Preset mặc định cho ảnh outfit hiển thị 5 hàng item.',
    grid: { x_ratio: 0.57, y_ratio: 0.16, w_ratio: 0.32, h_ratio: 0.75 },
  },
];

export const DEFAULT_OUTFIT_PRESET_ID = OUTFIT_GRID_PRESETS[0].id;

export const WEAPON_DEFAULT_GRID = {
  x_ratio: 0.74,
  y_ratio: 0.13,
  w_ratio: 0.25,
  h_ratio: 0.85,
};

export const HELMET_DEFAULT_GRID = {
  x_ratio: 0.61,
  y_ratio: 0.15,
  w_ratio: 0.26,
  h_ratio: 0.84,
};

export function cloneGrid(grid) {
  return { ...grid };
}

export function getOutfitPresetById(presetId = DEFAULT_OUTFIT_PRESET_ID) {
  return (
    OUTFIT_GRID_PRESETS.find((preset) => preset.id === presetId) ||
    OUTFIT_GRID_PRESETS[0]
  );
}

export function getDefaultGridForCropType(cropType, outfitPresetId = DEFAULT_OUTFIT_PRESET_ID) {
  if (cropType === 'weapon') {
    return cloneGrid(WEAPON_DEFAULT_GRID);
  }

  if (cropType === 'helmet') {
    return cloneGrid(HELMET_DEFAULT_GRID);
  }

  return cloneGrid(getOutfitPresetById(outfitPresetId).grid);
}

export function getGridStorageKey(cropType, outfitPresetId = DEFAULT_OUTFIT_PRESET_ID) {
  const presetPart = cropType === 'outfit' ? outfitPresetId : 'default';
  return `pubg_showcase_grid::${cropType}::${presetPart}`;
}

export function loadSavedGrid(cropType, outfitPresetId = DEFAULT_OUTFIT_PRESET_ID) {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(getGridStorageKey(cropType, outfitPresetId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.x_ratio === 'number' &&
      typeof parsed?.y_ratio === 'number' &&
      typeof parsed?.w_ratio === 'number' &&
      typeof parsed?.h_ratio === 'number'
    ) {
      return cloneGrid(parsed);
    }
  } catch {
    return null;
  }

  return null;
}

export function saveGrid(cropType, grid, outfitPresetId = DEFAULT_OUTFIT_PRESET_ID) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    getGridStorageKey(cropType, outfitPresetId),
    JSON.stringify(cloneGrid(grid))
  );
}

export function clearSavedGrid(cropType, outfitPresetId = DEFAULT_OUTFIT_PRESET_ID) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(getGridStorageKey(cropType, outfitPresetId));
}
