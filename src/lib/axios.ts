import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined') {
      const status = error.response?.status;
      const token = localStorage.getItem('token');
      const currentPath = window.location.pathname;
      const isAuthPage =
        currentPath === '/login' || currentPath === '/register';
      const requestUrl = String(error.config?.url ?? '');
      const isAuthEndpoint =
        requestUrl.startsWith('/api/auth/') ||
        requestUrl === '/api/auth' ||
        requestUrl.includes('/api/auth/');

      // Kegagalan 401 dari /api/auth/* tidak boleh mengalihkan ke /login
      const skipRedirect = isAuthPage || (status === 401 && isAuthEndpoint);

      // Arahkan ke /login hanya jika 401, atau 403 karena token memang belum ada
      if ((status === 401 || (status === 403 && !token)) && !skipRedirect) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);