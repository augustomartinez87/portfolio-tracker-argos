// src/services/priceService.ts
// Servicio centralizado para fetching de precios con React Query

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { API_ENDPOINTS, CONSTANTS, DOLLAR_SUFFIXES } from '../utils/constants';
import { isBonoPesos, isBonoHardDollar, getAssetClass, adjustBondPrice, getONCurrencyType, convertToONPesos } from '../utils/bondUtils';
import { mepService } from './mepService';
import type { PriceMap, TickerInfo, MEPDataItem, StockDataItem, BondDataItem, CorpDataItem, AssetClass } from '../types';

// ============================================
// TIPOS
// ============================================

export interface PriceServiceResult {
  prices: PriceMap;
  mepRate: number;
  tickers: TickerInfo[];
  lastUpdate: Date;
}

interface LastValidPrices {
  [ticker: string]: {
    precio: number;
    precioRaw: number;
  };
}

const CACHE_KEY = 'data912_prices_cache';

interface PriceCache {
  prices: PriceMap;
  mepRate: number;
  lastUpdate: string; // ISO string
}

// ============================================
// FETCH FUNCTIONS
// ============================================

async function fetchWithTimeout<T>(url: string, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Persistencia en localStorage
 */
function saveToLocalStorage(data: PriceServiceResult) {
  try {
    const cache: PriceCache = {
      prices: data.prices,
      mepRate: data.mepRate,
      lastUpdate: data.lastUpdate.toISOString()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Error saving prices to cache:', e);
  }
}

function loadFromLocalStorage(): PriceServiceResult | null {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return null;

    const cache: PriceCache = JSON.parse(stored);
    return {
      prices: cache.prices,
      mepRate: cache.mepRate,
      tickers: Object.keys(cache.prices).map(ticker => ({
        ticker,
        panel: cache.prices[ticker].panel,
        assetClass: cache.prices[ticker].assetClass
      })),
      lastUpdate: new Date(cache.lastUpdate)
    };
  } catch (e) {
    console.warn('Error loading prices from cache:', e);
    return null;
  }
}

/**
 * Fetch principal de todos los precios
 */
async function fetchAllPrices(lastValidPricesRef: React.MutableRefObject<LastValidPrices>): Promise<PriceServiceResult> {
  const priceMap: PriceMap = {};
  const tickerList: TickerInfo[] = [];
  let mepRate = CONSTANTS.MEP_DEFAULT;

  // 1. Fetch MEP (principal)
  const mepData = await fetchWithTimeout<MEPDataItem[]>(API_ENDPOINTS.MEP);

  let avgMep = 0;
  let mepCount = 0;

  mepData.forEach(item => {
    const ticker = item.ticker;
    if (!ticker) return;

    const assetClass = getAssetClass(ticker, item.panel);
    const rawPrice = item.ars_bid || item.mark || item.close || 0;
    const adjustedPrice = adjustBondPrice(ticker, rawPrice, assetClass);

    const isValidPrice = adjustedPrice > 0;
    const lastValid = lastValidPricesRef.current[ticker];
    const finalPrice = isValidPrice ? adjustedPrice : (lastValid?.precio || adjustedPrice);
    const finalRawPrice = isValidPrice ? rawPrice : (lastValid?.precioRaw || rawPrice);

    // Actualizar lastValidPrices si el precio es válido
    if (isValidPrice) {
      lastValidPricesRef.current[ticker] = { precio: adjustedPrice, precioRaw: rawPrice };
    }

    priceMap[ticker] = {
      precio: finalPrice,
      precioRaw: finalRawPrice,
      bid: item.ars_bid,
      ask: item.ars_ask,
      close: item.close,
      panel: item.panel,
      assetClass,
      pctChange: null,
      isBonoPesos: isBonoPesos(ticker),
      isBonoHD: isBonoHardDollar(ticker),
      isStale: !isValidPrice && !!lastValid,
    };

    tickerList.push({ ticker, panel: item.panel, assetClass });

    // Calcular MEP promedio
    if (item.mark && item.mark > 1400 && item.mark < 1600 && item.panel === 'cedear') {
      avgMep += item.mark;
      mepCount++;
    }
  });

  if (mepCount > 0) {
    mepRate = avgMep / mepCount;
    // Registrar el MEP del día automáticamente
    mepService.recordDailyMep(mepRate);
  }

  // 2. Fetch paralelo de stocks, cedears, bonds y corp (ONs)
  const [stocksResult, cedearsResult, bondsResult, corpResult] = await Promise.allSettled([
    fetchWithTimeout<StockDataItem[]>(API_ENDPOINTS.ARG_STOCKS),
    fetchWithTimeout<StockDataItem[]>(API_ENDPOINTS.ARG_CEDEARS),
    fetchWithTimeout<BondDataItem[]>(API_ENDPOINTS.ARG_BONDS),
    fetchWithTimeout<CorpDataItem[]>(API_ENDPOINTS.ARG_CORP),
  ]);

  // Procesar arg_stocks
  if (stocksResult.status === 'fulfilled' && Array.isArray(stocksResult.value)) {
    try {
      stocksResult.value.forEach(item => {
        const ticker = item.symbol;
        if (!ticker) return;

        // Filtrar tickers en dólares
        if (DOLLAR_SUFFIXES.includes(ticker as typeof DOLLAR_SUFFIXES[number])) return;
        if (ticker.endsWith('.D')) return;

        const assetClass = getAssetClass(ticker, 'arg_stock');

        if (!priceMap[ticker]) {
          const rawPrice = item.c || item.px_ask || item.px_bid || 0;
          const adjustedPrice = adjustBondPrice(ticker, rawPrice, assetClass);

          priceMap[ticker] = {
            precio: adjustedPrice,
            precioRaw: rawPrice,
            bid: item.px_bid,
            ask: item.px_ask,
            close: item.c,
            panel: 'arg_stock',
            assetClass,
            pctChange: item.pct_change ?? null,
            isBonoPesos: isBonoPesos(ticker),
            isBonoHD: isBonoHardDollar(ticker),
          };

          tickerList.push({ ticker, panel: 'arg_stock', assetClass });
        } else if (item.pct_change !== undefined) {
          priceMap[ticker].pctChange = item.pct_change;
        }
      });
    } catch (error) {
      console.error('Error procesando arg_stocks:', error);
    }
  }

  // Procesar cedears
  if (cedearsResult.status === 'fulfilled' && Array.isArray(cedearsResult.value)) {
    try {
      cedearsResult.value.forEach(item => {
        const ticker = item.symbol;
        if (!ticker) return;

        // Filtrar tickers D/C
        const isDollarOrCable = ticker.length > 3 &&
          (ticker.endsWith('D') || ticker.endsWith('C')) &&
          /[A-Z]$/.test(ticker.slice(-2, -1));
        if (isDollarOrCable) return;

        if (!priceMap[ticker]) {
          const rawPrice = item.c || item.px_ask || item.px_bid || 0;
          const assetClass = getAssetClass(ticker, 'cedear');

          priceMap[ticker] = {
            precio: rawPrice,
            precioRaw: rawPrice,
            bid: item.px_bid,
            ask: item.px_ask,
            close: item.c,
            panel: 'cedear',
            assetClass,
            pctChange: item.pct_change ?? null,
            isBonoPesos: false,
            isBonoHD: false,
          };

          tickerList.push({ ticker, panel: 'cedear', assetClass });
        } else if (item.pct_change !== undefined) {
          priceMap[ticker].pctChange = item.pct_change;
        }
      });
    } catch (error) {
      console.error('Error procesando cedears:', error);
    }
  }

  // Procesar bonds
  if (bondsResult.status === 'fulfilled' && Array.isArray(bondsResult.value)) {
    try {
      bondsResult.value.forEach(item => {
        const ticker = item.symbol;
        if (!ticker) return;

        // Filtrar tickers D/C que terminan en número
        const len = ticker.length;
        if (len > 3 && (ticker.endsWith('D') || ticker.endsWith('C'))) {
          const prevChar = ticker.charAt(len - 2);
          if (/[0-9]/.test(prevChar)) return;
        }

        if (!priceMap[ticker]) {
          const rawPrice = item.c || item.px_ask || item.px_bid || 0;
          const assetClass = getAssetClass(ticker, 'bonds');
          const adjustedPrice = adjustBondPrice(ticker, rawPrice, assetClass);

          priceMap[ticker] = {
            precio: adjustedPrice,
            precioRaw: rawPrice,
            bid: item.px_bid,
            ask: item.px_ask,
            close: item.c,
            panel: 'bonds',
            assetClass,
            pctChange: item.pct_change ?? null,
            isBonoPesos: isBonoPesos(ticker),
            isBonoHD: isBonoHardDollar(ticker),
          };

          tickerList.push({ ticker, panel: 'bonds', assetClass });
        } else if (item.pct_change !== undefined && item.pct_change !== null) {
          priceMap[ticker].pctChange = item.pct_change;
        }
      });
    } catch (error) {
      console.error('Error procesando bonds:', error);
    }
  }

  // Procesar ONs (corporate bonds) - versión segura
  if (corpResult.status === 'fulfilled' && Array.isArray(corpResult.value)) {
    try {
      corpResult.value.forEach(item => {
        const ticker = item.symbol;
        if (!ticker) return;

        const rawPrice = item.c || item.px_ask || item.px_bid || 0;

        // Crear price entry para ONs
        if (!priceMap[ticker]) {
          priceMap[ticker] = {
            precio: rawPrice, // ONs no necesitan ajuste como bonos
            precioRaw: rawPrice,
            bid: item.px_bid,
            ask: item.px_ask,
            close: item.c,
            panel: 'corp',
            assetClass: 'ON' as AssetClass,
            pctChange: item.pct_change ?? null,
            isBonoPesos: false,
            isBonoHD: false,
            isON: true,
            isONInPesos: ticker.endsWith('O'),
            currencyType: getONCurrencyType(ticker),
          };
        }

        // Agregar a ticker list para que aparezcan en selector
        if (!tickerList.find(t => t.ticker === ticker)) {
          tickerList.push({
            ticker,
            panel: 'corp',
            assetClass: 'ON' as AssetClass,
            originalTicker: ticker,
            pesosEquivalent: convertToONPesos(ticker)
          });
        }

        // Actualizar pctChange si ya existe
        if (item.pct_change !== undefined) {
          priceMap[ticker].pctChange = item.pct_change;
        }
      });
    } catch (error) {
      console.error('Error procesando datos de ONs:', error);
    }
  } else if (corpResult?.status === 'rejected') {
    console.warn('Error en fetch de ONs:', corpResult.reason);
  }

  const result = {
    prices: priceMap,
    mepRate,
    tickers: tickerList.sort((a, b) => a.ticker.localeCompare(b.ticker)),
    lastUpdate: new Date(),
  };

  // Guardar en cache para la próxima carga
  saveToLocalStorage(result);

  return result;
}

// ============================================
// REACT QUERY HOOKS
// ============================================

/**
 * Hook principal para obtener precios con React Query
 */
export function usePrices() {
  const lastValidPricesRef = useRef<LastValidPrices>({});
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['prices'],
    queryFn: () => fetchAllPrices(lastValidPricesRef),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    initialData: () => loadFromLocalStorage() || undefined,
  });

  // Nota: El polling se pausa automáticamente cuando la tab está en background
  // gracias a refetchIntervalInBackground: false. No necesitamos listener de visibilitychange.

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['prices'] });
  }, [queryClient]);

  return {
    prices: (query.data && query.data.prices) ? query.data.prices : {},
    mepRate: query.data?.mepRate ?? CONSTANTS.MEP_DEFAULT,
    tickers: query.data?.tickers ?? [],
    lastUpdate: query.data?.lastUpdate ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
  };
}

/**
 * Hook para obtener el precio de un ticker específico
 */
export function useTickerPrice(ticker: string) {
  const { prices } = usePrices();
  return prices[ticker] ?? null;
}

// ============================================
// QUERY CLIENT CONFIG
// ============================================

export const priceQueryConfig = {
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000, // 5 minutos de garbage collection
      retry: 3,
      refetchOnWindowFocus: false, // No refetch automático al cambiar tabs
    },
  },
};
