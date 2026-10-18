export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ms_bah_api_url');
    if (saved && saved.trim() !== '') {
      return saved.replace(/\/+$/, '');
    }
    // Si on tourne dans Capacitor natif sans URL configurée, utiliser l'IP Wi-Fi du PC
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      return 'http://172.20.10.2:5050/api';
    }
  }
  return '/api';
}

export function setApiBaseUrl(url: string) {
  if (typeof window !== 'undefined') {
    if (!url || url.trim() === '') {
      localStorage.removeItem('ms_bah_api_url');
    } else {
      localStorage.setItem('ms_bah_api_url', url.trim());
    }
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiBase = getApiBaseUrl();
  const token = localStorage.getItem('seydou_auth_token');

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBase}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('seydou_auth_token');
    localStorage.removeItem('seydou_auth_user');
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Une erreur est survenue lors de l\'opération.');
    }
    return data;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Erreur HTTP: ${response.status}`);
  }

  return response as any;
}

export const api = {
  // Auth
  login: (credentials: any) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => apiRequest('/auth/me'),
  getUsers: () => apiRequest('/auth/users'),
  createUser: (user: any) => apiRequest('/auth/users', { method: 'POST', body: JSON.stringify(user) }),
  updateUser: (id: number, user: any) => apiRequest(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(user) }),

  // Dashboard
  getDashboard: () => apiRequest('/dashboard'),

  // Categories
  getCategories: () => apiRequest('/categories'),
  loadDefaultCategories: () => apiRequest('/categories/load-defaults', { method: 'POST' }),
  createCategory: (cat: any) => apiRequest('/categories', { method: 'POST', body: JSON.stringify(cat) }),
  updateCategory: (id: number, cat: any) => apiRequest(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(cat) }),
  deleteCategory: (id: number) => apiRequest(`/categories/${id}`, { method: 'DELETE' }),

  // Products
  getProducts: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return apiRequest(`/products${query ? `?${query}` : ''}`);
  },
  getProduct: (id: number) => apiRequest(`/products/${id}`),
  createProduct: (product: any) => apiRequest('/products', { method: 'POST', body: JSON.stringify(product) }),
  updateProduct: (id: number, product: any) => apiRequest(`/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),
  deleteProduct: (id: number) => apiRequest(`/products/${id}`, { method: 'DELETE' }),
  toggleArchiveProduct: (id: number) => apiRequest(`/products/${id}/archive`, { method: 'PATCH' }),

  // Excel Catalogue Import
  checkDefaultExcelFile: () => apiRequest('/products/import-excel/default-file'),
  importExcelPreview: (source: File | string) => {
    if (typeof source === 'string') {
      return apiRequest('/products/import-excel/preview', {
        method: 'POST',
        body: JSON.stringify({ filePath: source })
      });
    } else {
      const formData = new FormData();
      formData.append('file', source);
      return apiRequest('/products/import-excel/preview', {
        method: 'POST',
        body: formData
      });
    }
  },
  importExcelConfirm: (products: any[], sourceName?: string) =>
    apiRequest('/products/import-excel/confirm', {
      method: 'POST',
      body: JSON.stringify({ products, sourceName })
    }),

  // Stock
  getStockMovements: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return apiRequest(`/stock/movements${query ? `?${query}` : ''}`);
  },
  recordReception: (data: any) => apiRequest('/stock/receptions', { method: 'POST', body: JSON.stringify(data) }),
  recordOutflow: (data: any) => apiRequest('/stock/outflows', { method: 'POST', body: JSON.stringify(data) }),
  deleteStockMovement: (id: number) => apiRequest(`/stock/movements/${id}`, { method: 'DELETE' }),
  clearStockMovements: () => apiRequest('/stock/movements/clear', { method: 'POST' }),

  // Sales (POS)
  getSales: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return apiRequest(`/sales${query ? `?${query}` : ''}`);
  },
  getSale: (id: number) => apiRequest(`/sales/${id}`),
  createSale: (saleData: any) => apiRequest('/sales', { method: 'POST', body: JSON.stringify(saleData) }),
  cancelSale: (id: number, reason: string) => apiRequest(`/sales/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  deleteSale: (id: number) => apiRequest(`/sales/${id}`, { method: 'DELETE' }),
  clearSalesHistory: () => apiRequest('/sales/clear-history', { method: 'POST' }),

  // Money Transfers (Orange Money / MTN MoMo)
  getTransfers: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return apiRequest(`/transfers${query ? `?${query}` : ''}`);
  },
  getTransfersSummary: () => apiRequest('/transfers/summary'),
  createTransfer: (data: any) => apiRequest('/transfers', { method: 'POST', body: JSON.stringify(data) }),
  cancelTransfer: (id: number, reason: string) => apiRequest(`/transfers/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  deleteTransfer: (id: number) => apiRequest(`/transfers/${id}`, { method: 'DELETE' }),
  clearTransfers: () => apiRequest('/transfers/clear', { method: 'POST' }),

  // Cash Registers & Sessions
  getCashRegisters: () => apiRequest('/cash/registers'),
  createCashRegister: (data: any) => apiRequest('/cash/registers', { method: 'POST', body: JSON.stringify(data) }),
  getCurrentSession: () => apiRequest('/cash/sessions/current'),
  getCashSessions: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return apiRequest(`/cash/sessions${query ? `?${query}` : ''}`);
  },
  openCashSession: (data: any) => apiRequest('/cash/sessions/open', { method: 'POST', body: JSON.stringify(data) }),
  closeCashSession: (id: number, data: any) => apiRequest(`/cash/sessions/${id}/close`, { method: 'POST', body: JSON.stringify(data) }),
  deleteCashSession: (id: number) => apiRequest(`/cash/sessions/${id}`, { method: 'DELETE' }),
  clearCashSessions: () => apiRequest('/cash/sessions/clear', { method: 'POST' }),

  // Finances
  getFinancialMovements: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return apiRequest(`/finances/movements${query ? `?${query}` : ''}`);
  },
  recordExpense: (data: any) => apiRequest('/finances/expenses', { method: 'POST', body: JSON.stringify(data) }),
  recordIncome: (data: any) => apiRequest('/finances/incomes', { method: 'POST', body: JSON.stringify(data) }),
  transferBetweenRegisters: (data: any) => apiRequest('/finances/transfers', { method: 'POST', body: JSON.stringify(data) }),
  deleteFinancialMovement: (id: number) => apiRequest(`/finances/movements/${id}`, { method: 'DELETE' }),
  clearFinancialMovements: () => apiRequest('/finances/movements/clear', { method: 'POST' }),

  // Clients
  getClients: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return apiRequest(`/clients${query ? `?${query}` : ''}`);
  },
  getClientHistory: (id: number) => apiRequest(`/clients/${id}/history`),
  createClient: (data: any) => apiRequest('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: number, data: any) => apiRequest(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id: number) => apiRequest(`/clients/${id}`, { method: 'DELETE' }),
  payClientDebt: (id: number, data: any) => apiRequest(`/clients/${id}/pay-debt`, { method: 'POST', body: JSON.stringify(data) }),

  // Suppliers
  getSuppliers: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return apiRequest(`/suppliers${query ? `?${query}` : ''}`);
  },
  getSupplierHistory: (id: number) => apiRequest(`/suppliers/${id}/history`),
  createSupplier: (data: any) => apiRequest('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: number, data: any) => apiRequest(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: number) => apiRequest(`/suppliers/${id}`, { method: 'DELETE' }),
  paySupplierDebt: (id: number, data: any) => apiRequest(`/suppliers/${id}/pay-debt`, { method: 'POST', body: JSON.stringify(data) }),

  // Inventory & Alerts
  getInventoryAudits: () => apiRequest('/inventory'),
  getInventoryAudit: (id: number) => apiRequest(`/inventory/${id}`),
  recordInventoryAudit: (data: any) => apiRequest('/inventory', { method: 'POST', body: JSON.stringify(data) }),
  getAlerts: () => apiRequest('/alerts'),

  // Reports
  getReports: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return apiRequest(`/reports/comprehensive${query ? `?${query}` : ''}`);
  },

  // Audit Logs
  getAuditLogs: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return apiRequest(`/audit${query ? `?${query}` : ''}`);
  },
  deleteAuditLog: (id: number) => apiRequest(`/audit/${id}`, { method: 'DELETE' }),
  clearAuditLogs: () => apiRequest('/audit/clear', { method: 'POST' }),

  // Settings & Backups
  getSettings: () => apiRequest('/settings'),
  getBackupInfo: () => apiRequest('/backup/info'),
  backupToPath: (targetFolder: string) => apiRequest('/backup/save-to-path', { method: 'POST', body: JSON.stringify({ targetFolder }) }),
  restoreFromPath: (sourcePath: string, confirmation: string) => apiRequest('/backup/restore-from-path', { method: 'POST', body: JSON.stringify({ sourcePath, confirmation }) }),
  resetDemoData: (confirmation: string) => apiRequest('/backup/reset-demo', { method: 'POST', body: JSON.stringify({ confirmation }) }),
  cleanForProduction: (confirmation: string) => apiRequest('/backup/clean-for-production', { method: 'POST', body: JSON.stringify({ confirmation }) }),
  cleanEverything: (confirmation: string, keepCategories?: boolean) => apiRequest('/backup/clean-everything', { method: 'POST', body: JSON.stringify({ confirmation, keepCategories }) }),

  // Synchronization (Offline / Cloud Sync)
  getSyncStatus: () => apiRequest('/sync/status'),
  syncPull: (since?: string) => apiRequest(`/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`),
  syncPush: (mutations: any[], clientId?: string, deviceName?: string) =>
    apiRequest('/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId || 'web-client',
        device_name: deviceName || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Terminal'),
        mutations
      })
    })
};
