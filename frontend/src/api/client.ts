import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Home Stock API
export const homeStockApi = {
  getAll: () => api.get('/home-stock'),
  get: (id: string) => api.get(`/home-stock/${id}`),
  create: (data: any) => api.post('/home-stock', data),
  update: (id: string, data: any) => api.put(`/home-stock/${id}`, data),
  delete: (id: string) => api.delete(`/home-stock/${id}`),
  quickAdd: (item_id: string, quantity_change: number) =>
    api.post('/home-stock/quick-add', { item_id, quantity_change }),
  getLocations: () => api.get('/locations'),
  createLocation: (name: string) => api.post('/home-stock/locations', { name }),
};

// Emergency Stock API
export const emergencyStockApi = {
  getAll: () => api.get('/emergency-stock'),
  get: (id: string) => api.get(`/emergency-stock/${id}`),
  create: (data: any) => api.post('/emergency-stock', data),
  update: (id: string, data: any) => api.put(`/emergency-stock/${id}`, data),
  delete: (id: string) => api.delete(`/emergency-stock/${id}`),
};

// Recipes API
export const recipesApi = {
  getAll: () => api.get('/recipes'),
  get: (id: string) => api.get(`/recipes/${id}`),
  create: (data: any) => api.post('/recipes', data),
  update: (id: string, data: any) => api.put(`/recipes/${id}`, data),
  delete: (id: string) => api.delete(`/recipes/${id}`),
  checkAvailability: (id: string) => api.get(`/recipes/${id}/availability`),
  cook: (id: string, use_emergency: boolean = false) =>
    api.post(`/recipes/${id}/cook`, { recipe_id: id, use_emergency_stock: use_emergency }),
  whatCanICook: () => api.get('/recipes/suggestions/what-can-i-cook'),
};

// Shopping List API
export const shoppingListApi = {
  getAll: () => api.get('/shopping-list'),
  create: (data: any) => api.post('/shopping-list', data),
  update: (id: string, data: any) => api.put(`/shopping-list/${id}`, data),
  delete: (id: string) => api.delete(`/shopping-list/${id}`),
  moveToStock: () => api.post('/shopping-list/move-to-stock'),
  addMissing: (ingredients: any[]) => api.post('/shopping-list/add-missing', ingredients),
};

// Dashboard API
export const dashboardApi = {
  get: () => api.get('/dashboard'),
};
