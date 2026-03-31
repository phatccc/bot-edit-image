export const OUTFIT_GRID_PRESETS = [
  {
    id: 'outfit_3_rows',
    title: 'Cắt 3 hàng',
    subtitle: 'Điện thoại',
    description: 'Preset mặc định cho ảnh outfit hiển thị 3 hàng item.',
    grid: { x_ratio: 0.61, y_ratio: 0.22, w_ratio: 0.26, h_ratio: 0.63 },
  },
  {
    id: 'outfit_5_rows',
    title: 'Cắt 5 hàng',
    subtitle: 'iPad 15"',
    description: 'Preset mặc định cho ảnh outfit hiển thị 5 hàng item.',
    grid: { x_ratio: 0.57, y_ratio: 0.16, w_ratio: 0.32, h_ratio: 0.79 },
  },
];

export const DEFAULT_OUTFIT_PRESET_ID = OUTFIT_GRID_PRESETS[0].id;

export const WEAPON_GRID_PRESETS = [
  {
    id: 'weapon_classic',
    title: 'Súng cũ',
    subtitle: 'Mẫu cũ',
    description: 'Preset mặc định cho màn hình súng cũ đang dùng ổn.',
    grid: { x_ratio: 0.69, y_ratio: 0.12, w_ratio: 0.25, h_ratio: 0.12 },
  },
  {
    id: 'weapon_collection',
    title: 'Súng kho',
    subtitle: 'Ngoại trang',
    description: 'Preset cho màn hình kho súng / ngoại trang như ảnh mẫu mới.',
    grid: { x_ratio: 0.628, y_ratio: 0.192, w_ratio: 0.215, h_ratio: 0.137 },
  },
];

export const DEFAULT_WEAPON_PRESET_ID = WEAPON_GRID_PRESETS[0].id;

export const HELMET_GRID_PRESETS = [
  {
    id: 'helmet_phone',
    title: 'Điện thoại (4 hàng)',
    subtitle: '4 hàng',
    description: 'Preset màn hình mũ điện thoại theo toạ độ ảnh 1.',
    grid: { x_ratio: 0.61, y_ratio: 0.15, w_ratio: 0.27, h_ratio: 0.86 },
  },
  {
    id: 'helmet_ipad',
    title: 'iPad (5 hàng)',
    subtitle: '5 hàng',
    description: 'Preset màn hình mũ iPad theo toạ độ ảnh 2.',
    grid: { x_ratio: 0.57, y_ratio: 0.11, w_ratio: 0.32, h_ratio: 0.80 },
  },
];

export const DEFAULT_HELMET_PRESET_ID = 'helmet_ipad';

export function cloneGrid(grid) {
  return { ...grid };
}

export function getOutfitPresetById(presetId = DEFAULT_OUTFIT_PRESET_ID) {
  return (
    OUTFIT_GRID_PRESETS.find((preset) => preset.id === presetId) ||
    OUTFIT_GRID_PRESETS[0]
  );
}

export function getWeaponPresetById(presetId = DEFAULT_WEAPON_PRESET_ID) {
  return (
    WEAPON_GRID_PRESETS.find((preset) => preset.id === presetId) ||
    WEAPON_GRID_PRESETS[0]
  );
}

export function getHelmetPresetById(presetId = DEFAULT_HELMET_PRESET_ID) {
  return (
    HELMET_GRID_PRESETS.find((preset) => preset.id === presetId) ||
    HELMET_GRID_PRESETS[0]
  );
}

export function getDefaultGridForCropType(
  cropType,
  outfitPresetId = DEFAULT_OUTFIT_PRESET_ID,
  weaponPresetId = DEFAULT_WEAPON_PRESET_ID,
  helmetPresetId = DEFAULT_HELMET_PRESET_ID
) {
  if (cropType === 'weapon') {
    return cloneGrid(getWeaponPresetById(weaponPresetId).grid);
  }

  if (cropType === 'helmet') {
    return cloneGrid(getHelmetPresetById(helmetPresetId).grid);
  }

  return cloneGrid(getOutfitPresetById(outfitPresetId).grid);
}

export function getGridStorageKey(
  cropType,
  outfitPresetId = DEFAULT_OUTFIT_PRESET_ID,
  weaponPresetId = DEFAULT_WEAPON_PRESET_ID,
  helmetPresetId = DEFAULT_HELMET_PRESET_ID
) {
  const presetPart = cropType === 'outfit'
    ? outfitPresetId
    : cropType === 'weapon'
      ? weaponPresetId
      : cropType === 'helmet'
        ? helmetPresetId
        : 'default';
  return `pubg_showcase_grid::${cropType}::${presetPart}`;
}

export function loadSavedGrid(
  cropType,
  outfitPresetId = DEFAULT_OUTFIT_PRESET_ID,
  weaponPresetId = DEFAULT_WEAPON_PRESET_ID,
  helmetPresetId = DEFAULT_HELMET_PRESET_ID
) {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(
    getGridStorageKey(cropType, outfitPresetId, weaponPresetId, helmetPresetId)
  );
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

export function saveGrid(
  cropType,
  grid,
  outfitPresetId = DEFAULT_OUTFIT_PRESET_ID,
  weaponPresetId = DEFAULT_WEAPON_PRESET_ID,
  helmetPresetId = DEFAULT_HELMET_PRESET_ID
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    getGridStorageKey(cropType, outfitPresetId, weaponPresetId, helmetPresetId),
    JSON.stringify(cloneGrid(grid))
  );
}

export function clearSavedGrid(
  cropType,
  outfitPresetId = DEFAULT_OUTFIT_PRESET_ID,
  weaponPresetId = DEFAULT_WEAPON_PRESET_ID,
  helmetPresetId = DEFAULT_HELMET_PRESET_ID
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(
    getGridStorageKey(cropType, outfitPresetId, weaponPresetId, helmetPresetId)
  );
}
