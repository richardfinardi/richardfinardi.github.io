/**
 * API Configuration & Endpoints
 * Centraliza todas as chamadas de backend
 */

const API = {
  BASE_URL: process.env.API_URL || '/api/v1',
  TIMEOUT: 30000,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutos
  MAX_RETRIES: 3,

  endpoints: {
    // Autenticação
    auth: {
      login: '/auth/login',
      logout: '/auth/logout',
      refresh: '/auth/refresh'
    },
    
    // Clientes
    clients: {
      list: '/clients',
      create: '/clients',
      update: (id) => `/clients/${id}`,
      delete: (id) => `/clients/${id}`,
      toggleAccess: (id) => `/clients/${id}/access`
    },
    
    // Usuários
    users: {
      list: '/users',
      create: '/users',
      update: (id) => `/users/${id}`,
      delete: (id) => `/users/${id}`
    },
    
    // Períodos
    periods: {
      list: (clientId) => `/clients/${clientId}/periods`,
      create: '/periods',
      update: (id) => `/periods/${id}`,
      delete: (id) => `/periods/${id}`,
      duplicate: (id) => `/periods/${id}/duplicate`
    },
    
    // Centros de Custo
    costCenters: {
      list: (periodId) => `/periods/${periodId}/cost-centers`,
      create: '/cost-centers',
      update: (id) => `/cost-centers/${id}`,
      delete: (id) => `/cost-centers/${id}`,
      bulk: '/cost-centers/bulk'
    },
    
    // Recursos
    resources: {
      list: (periodId) => `/periods/${periodId}/resources`,
      create: '/resources',
      update: (id) => `/resources/${id}`,
      delete: (id) => `/resources/${id}`,
      bulk: '/resources/bulk'
    },
    
    // Benefícios
    benefits: {
      list: (periodId) => `/periods/${periodId}/benefits`,
      create: '/benefits',
      update: (id) => `/benefits/${id}`,
      delete: (id) => `/benefits/${id}`
    },
    
    // Funcionários
    employees: {
      list: (periodId) => `/periods/${periodId}/employees`,
      create: '/employees',
      update: (id) => `/employees/${id}`,
      delete: (id) => `/employees/${id}`,
      bulk: '/employees/bulk'
    },
    
    // Plano de Contas
    chartOfAccounts: {
      list: (periodId) => `/periods/${periodId}/chart-of-accounts`,
      create: '/chart-of-accounts',
      update: (id) => `/chart-of-accounts/${id}`,
      delete: (id) => `/chart-of-accounts/${id}`,
      bulk: '/chart-of-accounts/bulk',
      import: '/chart-of-accounts/import'
    },
    
    // Relatórios & Análises
    reports: {
      dre: (periodId) => `/periods/${periodId}/reports/dre`,
      costHour: (periodId) => `/periods/${periodId}/reports/cost-hour`,
      ranking: (periodId) => `/periods/${periodId}/reports/ranking`,
      comparison: (period1, period2) => `/reports/comparison?p1=${period1}&p2=${period2}`
    }
  }
};

/**
 * Cache em memória com TTL
 */
const APICache = {
  store: new Map(),

  set(key, value, ttl = API.CACHE_TTL) {
    this.store.set(key, {
      value,
      expires: Date.now() + ttl
    });
  },

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  },

  clear() {
    this.store.clear();
  },

  invalidate(pattern) {
    for (const [key] of this.store) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }
};

/**
 * HTTP Client com retry, cache e timeout
 */
class HTTPClient {
  constructor(baseURL = API.BASE_URL) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  async request(method, endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const cacheKey = `${method}:${url}`;

    // GET requests usam cache
    if (method === 'GET') {
      const cached = APICache.get(cacheKey);
      if (cached) return cached;
    }

    const requestOptions = {
      method,
      headers: {
        ...this.defaultHeaders,
        ...options.headers
      },
      signal: AbortSignal.timeout(API.TIMEOUT)
    };

    if (options.body) {
      requestOptions.body = JSON.stringify(options.body);
    }

    let lastError;
    for (let attempt = 1; attempt <= API.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, requestOptions);

        if (!response.ok) {
          if (response.status === 401) {
            await this.handleUnauthorized();
          }
          throw new APIError(`HTTP ${response.status}`, response.status, await response.text());
        }

        const data = await response.json();

        // Cache apenas GETs bem-sucedidos
        if (method === 'GET') {
          APICache.set(cacheKey, data);
        }

        return data;
      } catch (error) {
        lastError = error;

        // Não retry em erros de cliente ou autenticação
        if (error instanceof APIError && (error.status < 500 || error.status === 401)) {
          break;
        }

        // Aguarde antes de retry
        if (attempt < API.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError;
  }

  get(endpoint, options = {}) {
    return this.request('GET', endpoint, options);
  }

  post(endpoint, body, options = {}) {
    return this.request('POST', endpoint, { ...options, body });
  }

  put(endpoint, body, options = {}) {
    return this.request('PUT', endpoint, { ...options, body });
  }

  patch(endpoint, body, options = {}) {
    return this.request('PATCH', endpoint, { ...options, body });
  }

  delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, options);
  }

  async handleUnauthorized() {
    // Disparar evento global
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }
}

class APIError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.response = response;
  }
}

// Exportar instância única
const apiClient = new HTTPClient();

export { API, APICache, HTTPClient, APIError, apiClient };
