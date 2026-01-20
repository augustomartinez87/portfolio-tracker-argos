// src/utils/data912.js
const BASE_URL = 'https://api.data912.com';
const CACHE_PREFIX = 'data912_';
const CACHE_TTL = 60000; // 1 minuto
const RATE_LIMIT = 120; // req/min
const RATE_WINDOW = 60000; // 1 minuto

class Data912Helper {
  constructor() {
    this.rateLimiter = { requests: [] };
  }

  // Rate limiting
  checkRateLimit() {
    const now = Date.now();
    this.rateLimiter.requests = this.rateLimiter.requests.filter(
      time => now - time < RATE_WINDOW
    );

    if (this.rateLimiter.requests.length >= RATE_LIMIT) {
      console.warn('Rate limit alcanzado. Esperando...');
      return false;
    }

    this.rateLimiter.requests.push(now);
    return true;
  }

  // Cache management
  getCache(key) {
    try {
      const cached = localStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_TTL) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  setCache(key, data) {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheItem));
    } catch (error) {
      console.warn('Error guardando cache:', error);
    }
  }

  // API calls
  async fetchEndpoint(endpoint) {
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit excedido. Intenta en unos segundos.');
    }

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Timeout: Request took too long');
      }
      throw new Error(`Error API: ${error.message}`);
    }
  }

  // Get current price
  async getCurrentPrice(ticker) {
    const cacheKey = `price_${ticker}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = this.getEndpointForTicker(ticker);
      const data = await this.fetchEndpoint(endpoint);

      const stockInfo = data[ticker];
      if (!stockInfo) {
        throw new Error(`Ticker ${ticker} no encontrado`);
      }

      const result = { price: parseFloat(stockInfo.price || stockInfo.last || stockInfo.value || 0) };
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw new Error(`Error obteniendo precio de ${ticker}: ${error.message}`);
    }
  }

  // Get daily return
  async getDailyReturn(ticker) {
    const cacheKey = `dr_${ticker}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = this.getEndpointForTicker(ticker);
      const data = await this.fetchEndpoint(endpoint);

      const stockInfo = data[ticker];
      if (!stockInfo) {
        throw new Error(`Ticker ${ticker} no encontrado`);
      }

      const result = { dr: parseFloat(stockInfo.dr || stockInfo.change_pct || 0) };
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw new Error(`Error obteniendo DR de ${ticker}: ${error.message}`);
    }
  }

  // Get historical data
  async getHistorical(ticker, fromDate) {
    const cacheKey = `hist_${ticker}_${fromDate || 'all'}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      let endpoint = `/historical/stocks/${ticker}`;
      if (fromDate) {
        endpoint += `?from=${fromDate}`;
      }

      const data = await this.fetchEndpoint(endpoint);
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      throw new Error(`Error obteniendo históricos de ${ticker}: ${error.message}`);
    }
  }

  // Determinar endpoint según ticker
  getEndpointForTicker(ticker) {
    const cedears = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA'];
    if (cedears.some(c => ticker.startsWith(c)) || ticker.endsWith('.BA')) {
      return '/live/arg_cedears';
    }

    if (ticker.toUpperCase().includes('MEP') || ticker === 'AL30D') {
      return '/live/mep';
    }
    if (ticker.toUpperCase().includes('CCL') || ticker === 'GD30') {
      return '/live/ccl';
    }

    return '/live/arg_stocks';
  }

  // Batch fetch múltiples tickers (optimizado)
  async getBatchPrices(tickers) {
    const results = {};
    const uncached = [];

    // Intentar obtener de cache primero
    for (const ticker of tickers) {
      const cached = this.getCache(`price_${ticker}`);
      if (cached) {
        results[ticker] = cached.price;
      } else {
        uncached.push(ticker);
      }
    }

    if (uncached.length === 0) return results;

    // Agrupar por endpoint para minimizar requests
    const byEndpoint = {};
    for (const ticker of uncached) {
      const endpoint = this.getEndpointForTicker(ticker);
      if (!byEndpoint[endpoint]) byEndpoint[endpoint] = [];
      byEndpoint[endpoint].push(ticker);
    }

    // Fetch por endpoint
    for (const [endpoint, tickersGroup] of Object.entries(byEndpoint)) {
      try {
        const data = await this.fetchEndpoint(endpoint);
        for (const ticker of tickersGroup) {
          const stockInfo = data[ticker];
          if (stockInfo) {
            const price = parseFloat(stockInfo.price || stockInfo.last || stockInfo.value || 0);
            results[ticker] = price;
            this.setCache(`price_${ticker}`, { price });
          }
        }
      } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
      }
    }

    return results;
  }

  // Batch fetch daily returns
  async getBatchDailyReturns(tickers) {
    const results = {};
    const uncached = [];

    for (const ticker of tickers) {
      const cached = this.getCache(`dr_${ticker}`);
      if (cached) {
        results[ticker] = cached.dr;
      } else {
        uncached.push(ticker);
      }
    }

    if (uncached.length === 0) return results;

    const byEndpoint = {};
    for (const ticker of uncached) {
      const endpoint = this.getEndpointForTicker(ticker);
      if (!byEndpoint[endpoint]) byEndpoint[endpoint] = [];
      byEndpoint[endpoint].push(ticker);
    }

    for (const [endpoint, tickersGroup] of Object.entries(byEndpoint)) {
      try {
        const data = await this.fetchEndpoint(endpoint);
        for (const ticker of tickersGroup) {
          const stockInfo = data[ticker];
          if (stockInfo) {
            const dr = parseFloat(stockInfo.dr || stockInfo.change_pct || 0);
            results[ticker] = dr;
            this.setCache(`dr_${ticker}`, { dr });
          }
        }
      } catch (error) {
        console.error(`Error fetching DR from ${endpoint}:`, error);
      }
    }

    return results;
  }

  // Clear cache
  clearCache(ticker) {
    if (ticker) {
      const keys = ['price_', 'dr_', 'hist_'].map(p => CACHE_PREFIX + p + ticker);
      keys.forEach(key => localStorage.removeItem(key));
    } else {
      Object.keys(localStorage)
        .filter(key => key.startsWith(CACHE_PREFIX))
        .forEach(key => localStorage.removeItem(key));
    }
  }
}

export const data912 = new Data912Helper();
