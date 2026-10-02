import axios from 'axios';

// HTTP client with auto-logout on 401
const API_BASE_URL = (() => {
  const env = process.env.REACT_APP_API_URL;
  if (env && env.trim()) return env.startsWith('/') ? env : env;
  // Utiliser le proxy configuré dans package.json au lieu de l'URL absolue
  return '/api';
})();

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

function getToken() {
  return localStorage.getItem('auth_token');
}

http.interceptors.request.use(cfg => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

http.interceptors.response.use(
  res => res,
  async error => {
    const { config, response } = error;
    if (!response) return Promise.reject(error);

    // If unauthorized (401) - Token expiré ou invalide
    if (response.status === 401 && !config.__retry401) {
      config.__retry401 = true;
      
      // Hard logout immédiat
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('user_data');
      
      // Afficher message à l'utilisateur
      if (window.location.pathname !== '/login') {
        // Créer notification toast si disponible
        const toastEvent = new CustomEvent('show-toast', {
          detail: {
            type: 'warning',
            message: '🔐 Session expirée. Veuillez vous reconnecter.',
            duration: 4000
          }
        });
        window.dispatchEvent(toastEvent);
        
        // Rediriger après un court délai pour que l'utilisateur voie le message
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
      }
      
      return Promise.reject(new Error('Session expirée'));
    }

    return Promise.reject(error);
  }
);

// Generic helper to retry a function with delay (exponential backoff light)
export async function retryAsync(fn, { retries = 2, baseDelay = 200 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === retries) break;
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 30;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export default http;
