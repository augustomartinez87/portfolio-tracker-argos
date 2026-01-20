// src/utils/data912.js
const BASE_URL = 'https://data912.com';
const CACHE_PREFIX = 'data912_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos (was 1 minute)
const RATE_LIMIT = 120; // req/min
const RATE_WINDOW = 60000; // 1 minuto

// Retry constants
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY = 1000; // 1 second

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

  // API calls with retry logic
  async fetchEndpoint(endpoint, options = {}) {
    const { retries = RETRY_MAX_ATTEMPTS, onRetry = () => {} } = options;
    
    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (!this.checkRateLimit()) {
          throw new Error('Rate limit excedido. Intenta en unos segundos.');
        }

        const response = await fetch(`${BASE_URL}${endpoint}`, {
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        
        // Don't retry on 4xx errors (client errors)
        if (error.status && error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        if (attempt < retries) {
          const delay = Math.min(RETRY_BASE_DELAY * Math.pow(2, attempt - 1), 10000);
          onRetry(attempt, retries, delay, error);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  // Get current price
  async getCurrentPrice(ticker) {
    const correctedTicker = this.getCorrectTicker(ticker);
    const cacheKey = `price_${correctedTicker}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = this.getEndpointForTicker(ticker);
      const data = await this.fetchEndpoint(endpoint);

      // Buscar en diferentes estructuras de datos
      let stockInfo = null;
      
      // Para arg_bonds y arrays, buscar por symbol
      if (Array.isArray(data)) {
        stockInfo = data.find(item => 
          (item.symbol && (item.symbol === correctedTicker || item.symbol === ticker)) ||
          (item.ticker && (item.ticker === correctedTicker || item.ticker === ticker))
        );
      } else {
        // Para objetos, buscar por clave
        stockInfo = data[correctedTicker] || data[ticker];
      }

      if (!stockInfo) {
        console.warn(`Ticker ${ticker} (corrected: ${correctedTicker}) no encontrado en endpoint ${endpoint}`);
        throw new Error(`Ticker ${ticker} no encontrado`);
      }

      // Extraer precio de diferentes campos posibles
      let price = 0;
      if (stockInfo.c) price = stockInfo.c;
      else if (stockInfo.price) price = stockInfo.price;
      else if (stockInfo.last) price = stockInfo.last;
      else if (stockInfo.value) price = stockInfo.value;
      else if (stockInfo.ars_bid) price = stockInfo.ars_bid;
      else if (stockInfo.px_ask) price = stockInfo.px_ask;
      else if (stockInfo.px_bid) price = stockInfo.px_bid;
      else if (stockInfo.mark) price = stockInfo.mark;
      else if (stockInfo.close) price = stockInfo.close;

      const result = { 
        price: parseFloat(price) || 0,
        ticker: correctedTicker,
        source: endpoint
      };
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw new Error(`Error obteniendo precio de ${ticker}: ${error.message}`);
    }
  }

  // Get daily return
  async getDailyReturn(ticker) {
    const correctedTicker = this.getCorrectTicker(ticker);
    const cacheKey = `dr_${correctedTicker}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = this.getEndpointForTicker(ticker);
      const data = await this.fetchEndpoint(endpoint);

      // Buscar en diferentes estructuras de datos
      let stockInfo = data[correctedTicker] || data[ticker];
      
      // Si no encuentra el ticker directamente, buscar en el array
      if (!stockInfo && Array.isArray(data)) {
        stockInfo = data.find(item => 
          item.ticker === correctedTicker || 
          item.symbol === correctedTicker ||
          item.ticker === ticker ||
          item.symbol === ticker
        );
      }

      if (!stockInfo) {
        console.warn(`Ticker ${ticker} (corrected: ${correctedTicker}) no encontrado para DR en endpoint ${endpoint}`);
        throw new Error(`Ticker ${ticker} no encontrado`);
      }

      // Extraer porcentaje de diferentes campos posibles
      let dr = 0;
      if (stockInfo.pct_change) dr = stockInfo.pct_change;
      else if (stockInfo.dr) dr = stockInfo.dr;
      else if (stockInfo.change_pct) dr = stockInfo.change_pct;

      const result = { 
        dr: parseFloat(dr) || 0,
        ticker: correctedTicker,
        source: endpoint
      };
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw new Error(`Error obteniendo DR de ${ticker}: ${error.message}`);
    }
  }

  // Get historical data
  async getHistorical(ticker, fromDate) {
    const correctedTicker = this.getCorrectTicker(ticker);
    const cacheKey = `hist_${correctedTicker}_${fromDate || 'all'}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    // Verificar si es un bono en pesos (no tiene históricos)
    if (this.isBonoPesos(correctedTicker)) {
      throw new Error('Los bonos en pesos no tienen datos históricos disponibles');
    }

    try {
      const endpoint = this.getHistoricalEndpoint(correctedTicker);
      if (!endpoint) {
        throw new Error('No hay endpoint de históricos disponible para este ticker');
      }

      if (fromDate) {
        endpoint += `?from=${fromDate}`;
      }

      const data = await this.fetchEndpoint(endpoint);
      
      // Normalizar estructura de datos si es necesario
      let normalizedData = data;
      
      // Los endpoints históricos retornan un array de objetos con:
      // date, o, h, l, c, v, dr, sa
      // Verificar que tenemos la estructura correcta
      if (Array.isArray(data) && data.length > 0) {
        // Los datos ya vienen en el formato correcto
        normalizedData = data;
      }
      
      this.setCache(cacheKey, normalizedData);
      return normalizedData;
    } catch (error) {
      throw new Error(`Error obteniendo históricos de ${ticker}: ${error.message}`);
    }
  }

  // Mapeo de tickers comunes a los correctos
  getCorrectTicker(ticker) {
    const tickerMap = {
      'GOOGLE': 'GOOGL',
      'GOOG': 'GOOGL',
      'ALPHABET': 'GOOGL',
      // Agregar más mapeos si es necesario
    };
    
    const upperTicker = ticker.toUpperCase();
    return tickerMap[upperTicker] || upperTicker;
  }

  // Determinar si es un bono en pesos (sin históricos)
  isBonoPesos(ticker) {
    if (!ticker) return false;
    const t = ticker.toUpperCase();
    // Patrones de bonos en pesos: TX26, T15E7, TTD26, S31E5, etc.
    if (/^T[A-Z0-9]{2,5}$/.test(t)) return true;
    if (/^S[0-9]{2}[A-Z][0-9]$/.test(t)) return true;
    if (/^(DICP|PARP|CUAP|PR13|TC23|TO26|TY24)/.test(t)) return true;
    if (t.startsWith('TTD') || t.startsWith('TTS')) return true;
    return false;
  }

  // Determinar si es un bono hard dollar (con históricos)
  isBonoHardDollar(ticker) {
    if (!ticker) return false;
    const t = ticker.toUpperCase();
    // Bonos hard dollar conocidos: AL30, GD30, AL29, GD29, etc.
    // Patrón: AL o GD seguido de 2 dígitos
    if (/^(AL|GD|AY24|DICA|DICY|DIED|CO26|AA26|AA25|AB26|AC26|AY26|BP26|BU24|Buenos|Buenos Aires)/.test(t)) return true;
    return false;
  }

  // Determinar el endpoint de históricos según el tipo de ticker
  getHistoricalEndpoint(ticker) {
    const correctedTicker = this.getCorrectTicker(ticker);
    
    // Bonos en pesos no tienen endpoint de históricos
    if (this.isBonoPesos(correctedTicker)) {
      return null;
    }
    
    // Bonos hard dollar van a historical/bonds
    if (this.isBonoHardDollar(correctedTicker)) {
      return `/historical/bonds/${correctedTicker}`;
    }
    
    // Acciones y CEDEARs van a historical/stocks
    return `/historical/stocks/${correctedTicker}`;
  }

  // Determinar endpoint según ticker
  getEndpointForTicker(ticker) {
    const correctedTicker = this.getCorrectTicker(ticker);
    const cedears = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA'];
    
    // Bonos en pesos van a arg_bonds
    if (this.isBonoPesos(correctedTicker)) {
      return '/live/arg_bonds';
    }
    
    if (cedears.some(c => correctedTicker.startsWith(c)) || correctedTicker.endsWith('.BA')) {
      return '/live/arg_cedears';
    }

    if (correctedTicker.toUpperCase().includes('MEP') || correctedTicker === 'AL30D') {
      return '/live/mep';
    }
    if (correctedTicker.toUpperCase().includes('CCL') || correctedTicker === 'GD30') {
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
      const correctedTicker = this.getCorrectTicker(ticker);
      const cached = this.getCache(`price_${correctedTicker}`);
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
          const correctedTicker = this.getCorrectTicker(ticker);
          
          // Buscar en diferentes estructuras de datos
          let stockInfo = null;
          
          if (Array.isArray(data)) {
            // Para arg_bonds, arg_cedears, etc. que retornan arrays
            stockInfo = data.find(item => 
              (item.symbol && (item.symbol === correctedTicker || item.symbol === ticker)) ||
              (item.ticker && (item.ticker === correctedTicker || item.ticker === ticker))
            );
          } else {
            // Para objetos
            stockInfo = data[correctedTicker] || data[ticker];
          }

          if (stockInfo) {
            // Extraer precio de diferentes campos posibles
            let price = 0;
            if (stockInfo.c) price = stockInfo.c;
            else if (stockInfo.price) price = stockInfo.price;
            else if (stockInfo.last) price = stockInfo.last;
            else if (stockInfo.value) price = stockInfo.value;
            else if (stockInfo.ars_bid) price = stockInfo.ars_bid;
            else if (stockInfo.px_ask) price = stockInfo.px_ask;
            else if (stockInfo.px_bid) price = stockInfo.px_bid;
            else if (stockInfo.mark) price = stockInfo.mark;
            else if (stockInfo.close) price = stockInfo.close;

            results[ticker] = parseFloat(price) || 0;
            this.setCache(`price_${correctedTicker}`, { price: parseFloat(price) || 0 });
          } else {
            console.warn(`Ticker ${ticker} (corrected: ${correctedTicker}) no encontrado en ${endpoint}`);
            results[ticker] = 0; // Valor por defecto si no se encuentra
          }
        }
      } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        // Asignar 0 a todos los tickers de este endpoint si hay error
        tickersGroup.forEach(ticker => {
          results[ticker] = 0;
        });
      }
    }

    return results;
  }

  // Batch fetch daily returns
  async getBatchDailyReturns(tickers) {
    const results = {};
    const uncached = [];

    for (const ticker of tickers) {
      const correctedTicker = this.getCorrectTicker(ticker);
      const cached = this.getCache(`dr_${correctedTicker}`);
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
          const correctedTicker = this.getCorrectTicker(ticker);
          
          // Buscar en diferentes estructuras de datos
          let stockInfo = null;
          
          if (Array.isArray(data)) {
            // Para arg_bonds, arg_cedears, etc. que retornan arrays
            stockInfo = data.find(item => 
              (item.symbol && (item.symbol === correctedTicker || item.symbol === ticker)) ||
              (item.ticker && (item.ticker === correctedTicker || item.ticker === ticker))
            );
          } else {
            // Para objetos
            stockInfo = data[correctedTicker] || data[ticker];
          }

          if (stockInfo) {
            // Extraer porcentaje de diferentes campos posibles
            let dr = 0;
            if (stockInfo.pct_change) dr = stockInfo.pct_change;
            else if (stockInfo.dr) dr = stockInfo.dr;
            else if (stockInfo.change_pct) dr = stockInfo.change_pct;

            results[ticker] = parseFloat(dr) || 0;
            this.setCache(`dr_${correctedTicker}`, { dr: parseFloat(dr) || 0 });
          } else {
            console.warn(`Ticker ${ticker} (corrected: ${correctedTicker}) no encontrado para DR en ${endpoint}`);
            results[ticker] = 0; // Valor por defecto si no se encuentra
          }
        }
      } catch (error) {
        console.error(`Error fetching DR from ${endpoint}:`, error);
        // Asignar 0 a todos los tickers de este endpoint si hay error
        tickersGroup.forEach(ticker => {
          results[ticker] = 0;
        });
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
