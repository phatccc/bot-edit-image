import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 120000,
});

export function resolveApiUrl(path) {
  if (!path) {
    return path;
  }

  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) {
    return path;
  }

  if (/^https?:\/\//i.test(apiBaseUrl)) {
    return new URL(path, apiBaseUrl).toString();
  }

  return path;
}

export async function uploadImages(files) {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export const processImages = async (
  filenames,
  templateName = 'default',
  cropType = 'outfit',
  customGrid = null,
  outfitPreset = null
) => {
  const payload = {
    filenames,
    template: templateName,
    crop_type: cropType
  };

  if (outfitPreset) {
    payload.outfit_preset = outfitPreset;
  }
  
  if (customGrid) {
    payload.custom_grid = customGrid;
  }
  
  const response = await api.post('/process', payload);
  return response.data;
}

export async function downloadZip(filenames) {
  const response = await api.post('/download-zip', { filenames }, {
    responseType: 'blob',
  });
  
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'pubg_showcase.zip');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function getTemplates() {
  const response = await api.get('/templates');
  return response.data;
}

export default api;
