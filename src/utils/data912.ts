// src/utils/data912.ts
// Helper para la API de data912.com

import { isBonoPesos, isBonoHardDollar } from './bondUtils';
import { CONSTANTS, API_ENDPOINTS, KNOWN_CEDEARS, STORAGE_KEYS } from './constants';
import type { HistoricalDataPoint, TickerInfo, CacheEntry } from '@/types';

const { API_RATE_LIMIT, API_RATE_WINDOW, PRICE_CACHE_TTL } = CONSTANTS;
const CACHE_PREFIX = STORAGE_KEYS.PRICE_CACHE_PREFIX;

// ============================================
// TIPOS
// ============================================

interface RateLimiter {
  requests: number[];
}

interface BatchResult<T> {
  ticker: string;
  data: T;
  success: boolean;
  error?: string;
}

interface BatchHistoricalResult {
  data: Record<string, HistoricalDataPoint[]>;
  errors: Record<string, string>;
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Detecta si un ticker es un CEDEAR
 */
function isCedear(ticker: string, panel?: string): boolean {
  const upper = ticker.toUpperCase();

  if (upper.endsWith('.BA')) return true;
  if (panel === 'cedear') return true;

  const tickerBase = upper.replace('.BA', '');
  return KNOWN_CEDEARS.includes(tickerBase as typeof KNOWN_CEDEARS[number]);
}

/**
 * Determina el endpoint live correcto para un ticker
 */
function getEndpointForTicker(ticker: string, assetTag?: string): string {
  const upper = ticker.toUpperCase();

  if (assetTag) {
    if (assetTag.includes('CEDEAR')) return '/live/arg_cedears';
    if (assetTag.includes('BONOS EN PESOS')) return '/live/arg_bonds';
    if (assetTag.includes('BONO HARD DOLLAR') || assetTag.includes('CORP')) return '/live/arg_corp';
    if (assetTag.includes('ARGY') || assetTag.includes('ACCIONES')) return '/live/arg_stocks';
  }

  if (upper.endsWith('.BA')) return '/live/arg_cedears';
  if (isCedear(upper)) return '/live/arg_cedears';
  if (upper.includes('MEP')) return '/live/mep';
  if (upper.includes('CCL')) return '/live/ccl';
  if (upper.endsWith('D') && (upper.startsWith('AL') || upper.startsWith('GD'))) return '/live/mep';
  if (/^[A-Z]{2,4}\d{2}[A-Z]?D?$/.test(upper)) return '/live/arg_bonds';
  if (/^T[A-Z0-9]{2,5}$/.test(upper)) return '/live/arg_bonds';
  if (upper.startsWith('TTD') || upper.startsWith('TTS')) return '/live/arg_bonds';

  return '/live/arg_stocks';
}

// ============================================
// CLASE PRINCIPAL
// ============================================

class Data912Helper {
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = { requests: [] };
  }

  // ============================================
  // RATE LIMITING
  // ============================================

  /**
   * Verifica y registra una request en el rate limiter
   * @returns true si la request está permitida
   */
  checkRateLimit(): boolean {
    const now = Date.now();

    // Limpiar requests viejas
    this.rateLimiter.requests = this.rateLimiter.requests.filter(
      time => now - time < API_RATE_WINDOW
    );

    if (this.rateLimiter.requests.length >= API_RATE_LIMIT) {
      console.warn('[data912] Rate limit alcanzado. Esperando...');
      return false;
    }

    this.rateLimiter.requests.push(now);
    return true;
  }

  // ============================================
  // CACHE MANAGEMENT
  // ============================================

  /**
   * Obtiene datos del cache si existen y no están expirados
   */
  getCache<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached) as CacheEntry<T>;

      if (Date.now() - timestamp > PRICE_CACHE_TTL) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  /**
   * Guarda datos en cache de forma segura
   */
  setCache<T>(key: string, data: T): boolean {
    try {
      const entry: CacheEntry<T> = { data, timestamp: Date.now() };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
      return true;
    } catch (e) {
      if ((e as Error).name === 'QuotaExceededError') {
        this.handleQuotaExceeded();
      }
      return false;
    }
  }

  /**
   * Limpia cache cuando se excede la quota de localStorage
   */
  private handleQuotaExceeded(): void {
    console.warn('[data912] localStorage quota exceeded, clearing cached prices...');
    Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_PREFIX) || key.startsWith(STORAGE_KEYS.PRICE_PREFIX))
      .forEach(key => localStorage.removeItem(key));
  }

  /**
   * Limpia cache de bonos específicamente
   */
  clearBondCache(): void {
    Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_PREFIX))
      .forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          try {
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

  /**
   * Limpia cache para un ticker específico o todo
   */
  clearCache(ticker?: string): void {
    if (ticker) {
      const keys = ['price_', 'dr_', 'hist_'].map(p => CACHE_PREFIX + p + ticker);
      keys.forEach(key => localStorage.removeItem(key));
    } else {
      Object.keys(localStorage)
        .filter(key => key.startsWith(CACHE_PREFIX))
        .forEach(key => localStorage.removeItem(key));
    }
  }

  // ============================================
  // API CALLS
  // ============================================

  /**
   * Determina el endpoint histórico correcto para un ticker
   */
  getHistoricalEndpoint(ticker: string, panel?: string): string {
    const upper = ticker.toUpperCase();

    if (isCedear(upper, panel)) {
      const cleanTicker = upper.replace('.BA', '');
      return `/historical/cedears/${cleanTicker}`;
    }

    if (isBonoHardDollar(upper) || isBonoPesos(upper)) {
      const cleanTicker = upper.replace('D', '');
      return `/historical/bonds/${cleanTicker}`;
    }

    return `/historical/stocks/${ticker}`;
  }

  /**
   * Obtiene datos históricos de un ticker
   */
  async getHistorical(ticker: string, fromDate: string): Promise<HistoricalDataPoint[]> {
    const cacheKey = `hist_${ticker}_${fromDate}`;

    // Check cache
    const cached = this.getCache<HistoricalDataPoint[]>(cacheKey);
    if (cached) return cached;

    // Check rate limit
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit alcanzado');
    }

    const endpoint = this.getHistoricalEndpoint(ticker);
    const url = `${API_ENDPOINTS.BASE}${endpoint}?from=${fromDate}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as HistoricalDataPoint[];

      // Cache result
      this.setCache(cacheKey, data);

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[data912] Error fetching historical data:', error);
      throw error;
    }
  }

  /**
   * Obtiene datos históricos en batch
   */
  async getBatchHistorical(
    tickers: TickerInfo[],
    fromDate: string
  ): Promise<BatchHistoricalResult> {
    const results: Record<string, HistoricalDataPoint[]> = {};
    const errors: Record<string, string> = {};

    const batchSize = 10;

    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);

      const promises = batch.map(async ({ ticker }): Promise<BatchResult<HistoricalDataPoint[]>> => {
        try {
          const data = await this.getHistorical(ticker, fromDate);
          return { ticker, data, success: true };
        } catch (error) {
          return {
            ticker,
            data: [],
            success: false,
            error: (error as Error).message
          };
        }
      });

      const batchResults = await Promise.all(promises);

      batchResults.forEach(result => {
        if (result.success) {
          results[result.ticker] = result.data;
        } else if (result.error) {
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

  /**
   * Obtiene precios en batch (placeholder - necesita implementación)
   */
  async getBatchPrices(tickers: TickerInfo[]): Promise<Record<string, number>> {
    // TODO: Implementar fetching de precios por batch
    // Por ahora retorna objeto vacío
    console.warn('[data912] getBatchPrices not fully implemented');
    return {};
  }

  /**
   * Obtiene retornos diarios en batch (placeholder - necesita implementación)
   */
  async getBatchDailyReturns(tickers: TickerInfo[]): Promise<Record<string, number | null>> {
    // TODO: Implementar fetching de retornos diarios
    // Por ahora retorna objeto vacío
    console.warn('[data912] getBatchDailyReturns not fully implemented');
    return {};
  }
}

// Singleton export
export const data912 = new Data912Helper();

// Type export
export type { Data912Helper };
