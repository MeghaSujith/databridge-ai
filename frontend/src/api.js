import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 60000 });

api.interceptors.response.use(
  r => r,
  err => {
    const msg = err.response?.data?.detail || err.message || 'Unknown error';
    return Promise.reject(new Error(msg));
  }
);

export const uploadDataset = (file, onProgress) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/datasets/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress && onProgress(Math.round((e.loaded / e.total) * 100)),
  }).then(r => r.data);
};

export const getDatasets = () => api.get('/datasets').then(r => r.data);
export const previewDataset = (id, rows = 10) => api.get(`/datasets/${id}/preview?rows=${rows}`).then(r => r.data);
export const deleteDataset = (id) => api.delete(`/datasets/${id}`).then(r => r.data);
export const getDataQuality = (id) => api.get(`/quality/${id}`).then(r => r.data);
export const getSamples = () => api.get('/samples').then(r => r.data);
export const loadSample = (sampleId) => api.post(`/datasets/load-sample/${sampleId}`).then(r => r.data);
export const analyzeSchema = (body) => api.post('/schema/analyze', body).then(r => r.data);
export const applySchemaMapping = (body) => api.post('/schema/map', body).then(r => r.data);
export const getAIPlan = (body) => api.post('/ai/plan', body).then(r => r.data);
export const transformPreview = (body) => api.post('/transform/preview', body).then(r => r.data);
export const transformExecute = (body) => api.post('/transform/execute', body).then(r => r.data);
export const getIntegrations = () => api.get('/integrations').then(r => r.data);
export const getIntegration = (id) => api.get(`/integrations/${id}`).then(r => r.data);
export const exportIntegration = (id, fmt) => `/api/integrations/${id}/export?fmt=${fmt}`;
export const getOverviewStats = () => api.get('/overview/stats').then(r => r.data);
export const getAIStatus = () => api.get('/ai/status').then(r => r.data);

export default api;

