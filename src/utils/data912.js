// src/utils/data912.js
const BASE_URL = 'https://data912.com';
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
    const correctedTicker = this.getCorrectTicker(ticker);
    const cacheKey = `price_${correctedTicker}`;
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

  // Lista de tickers conocidos que no existen en data912
  getUnavailableTickers() {
    return {
      'BONOS_PESOS': ['TTD26', 'T15E7', 'S31E5', 'S28F5'], // Ejemplos de bonos que pueden no estar
      'OTROS': []
    };
  }

  // Verificar si un ticker está disponible
  isTickerAvailable(ticker) {
    const unavailable = this.getUnavailableTickers();
    const upperTicker = ticker.toUpperCase();
    
    for (const category of Object.values(unavailable)) {
      if (category.includes(upperTicker)) {
        return false;
      }
    }
    
    return true;
  }

  // Determinar endpoint según ticker
  getEndpointForTicker(ticker) {
    const correctedTicker = this.getCorrectTicker(ticker);
    const cedears = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA'];
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
