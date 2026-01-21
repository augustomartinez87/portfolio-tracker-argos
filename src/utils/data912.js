// src/utils/data912.js
const BASE_URL = 'https://data912.com';
const CACHE_PREFIX = 'data912_';
const CACHE_TTL = 5 * 60 * 1000;
const RATE_LIMIT = 120;
const RATE_WINDOW = 60000;

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY = 1000;

const KNOWN_CEDEARS = ['AAPL','GOOGL','MSFT','TSLA','AMZN','META','NVDA','KO','DIS','INTC','CSCO','IBM','QCOM','AMD','PYPL','V','JPM','UNH','MA','PG','HD','NFLX','ADBE','CRM','ABNB','COST','MELI'];

function isCedear(ticker) {
  const upper = ticker.toUpperCase();
  
  if (upper.endsWith('.BA')) {
    return true;
  }
  
  const tickerBase = upper.replace('.BA', '');
  if (KNOWN_CEDEARS.includes(tickerBase)) {
    return true;
  }
  
  return false;
}

function isBonoPesos(ticker) {
  if (!ticker) return false;
  const t = ticker.toUpperCase();
  if (/^T[A-Z0-9]{2,5}$/.test(t)) return true;
  if (/^S[0-9]{2}[A-Z][0-9]$/.test(t)) return true;
  if (/^(DICP|PARP|CUAP|PR13|TC23|TO26|TY24)/.test(t)) return true;
  if (t.startsWith('TTD') || t.startsWith('TTS')) return true;
  if (/^(AL|AE|AN|CO|GD)[0-9]{2}$/.test(t)) return true;
  return false;
}

function isBonoHardDollar(ticker) {
  if (!ticker) return false;
  const t = ticker.toUpperCase();
  if (/^(AL|GD|AE|AN|CO)[0-9]{2}[DC]$/.test(t)) return true;
  if (/^(DICA|DICY|DIED|AY24|BU24|BP26)/.test(t)) return true;
  return false;
}

function getEndpointForTicker(ticker, assetTag) {
  const upper = ticker.toUpperCase();

  if (assetTag) {
    if (assetTag.includes('CEDEAR')) return '/live/arg_cedears';
    if (assetTag.includes('BONOS EN PESOS')) return '/live/arg_bonds';
    if (assetTag.includes('BONO HARD DOLLAR') || assetTag.includes('CORP')) return '/live/arg_corp';
    if (assetTag.includes('ARGY') || assetTag.includes('ACCIONES')) return '/live/arg_stocks';
  }

  if (upper.endsWith('.BA')) return '/live/arg_cedears';
  if (KNOWN_CEDEARS.includes(upper)) return '/live/arg_cedears';
  if (upper.includes('MEP')) return '/live/mep';
  if (upper.includes('CCL')) return '/live/ccl';
  if (upper.endsWith('D') && (upper.startsWith('AL') || upper.startsWith('GD'))) return '/live/mep';
  if (/^[A-Z]{2,4}\d{2}[A-Z]?D?$/.test(upper)) return '/live/arg_bonds';
  if (/^T[A-Z0-9]{2,5}$/.test(upper)) return '/live/arg_bonds';
  if (upper.startsWith('TTD') || upper.startsWith('TTS')) return '/live/arg_bonds';
  
  return '/live/arg_stocks';
}

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

  // Safe setItem con manejo de quota excedida
  safeSetItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
        this.handleQuotaExceeded();
      }
      return false;
    }
  }

  // Limpiar cache cuando se excede quota
  handleQuotaExceeded() {
    console.warn('LocalStorage quota exceeded, clearing cached prices...');
    Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_PREFIX) || key.startsWith('price_'))
      .forEach(key => localStorage.removeItem(key));
  }

  // Clear cache for bonds only
  clearBondCache() {
    Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_PREFIX))
      .forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            const { data } = JSON.parse(value);
            // Check if it's a bond price by looking at the ticker pattern
            const ticker = key.replace(CACHE_PREFIX + 'price_', '');
            if (isBonoPesos(ticker) || isBonoHardDollar(ticker)) {
              localStorage.removeItem(key);
            }
          } catch {
            // Ignore parse errors
          }
        }
      });
  }

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

  async getHistorical(ticker, fromDate) {
    const cacheKey = CACHE_PREFIX + 'hist_' + ticker + '_' + fromDate;
    const cached = this.getCache('hist_' + ticker + '_' + fromDate);
    if (cached) return cached;

    if (!this.checkRateLimit()) {
      throw new Error('Rate limit alcanzado');
    }

    const endpoint = this.getHistoricalEndpoint(ticker);
    const url = `${BASE_URL}${endpoint}?from=${fromDate}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Cache the result
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Could not cache historical data:', e);
      }

      return data;
    } catch (error) {
      console.error('Error fetching historical data:', error);
      throw error;
    }
  }

  getHistoricalEndpoint(ticker) {
    const upper = ticker.toUpperCase();
    
    if (isCedear(upper)) {
      const cleanTicker = upper.replace('.BA', '');
      return `/historical/cedears/${cleanTicker}`;
    }
    
    if (isBonoHardDollar(upper) || isBonoPesos(upper)) {
      const cleanTicker = upper.replace('D', '');
      return `/historical/bonds/${cleanTicker}`;
    }
    
    return `/historical/stocks/${ticker}`;
  }

  async getBatchHistorical(tickers, fromDate) {
    const results = {};
    const errors = {};

    const batchSize = 10;
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      const promises = batch.map(async ({ ticker }) => {
        try {
          const data = await this.getHistorical(ticker, fromDate);
          return { ticker, data, success: true };
        } catch (error) {
          return { ticker, data: [], success: false, error: error.message };
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(result => {
        if (result.success) {
          results[result.ticker] = result.data;
        } else {
          errors[result.ticker] = result.error;
        }
      });

      // Rate limit delay between batches
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return { data: results, errors };
  }
}

export const data912 = new Data912Helper();
