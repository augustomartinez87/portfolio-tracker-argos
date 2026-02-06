import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { data912 } from '@/utils/data912';
import { CONSTANTS, API_ENDPOINTS } from '@/utils/constants';
import { isBonoPesos, isBonoHardDollar, getAssetClass, adjustBondPrice } from '@/utils/bondUtils';
import { mepService } from './mepService';
import { supabase } from '@/lib/supabase';
import type { PriceMap, TickerInfo } from '@/types';

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
    price: number;
    priceRaw: number;
  };
}

const CACHE_KEY = 'data912_prices_cache';

interface PriceCache {
  prices: PriceMap;
  mepRate: number;
  lastUpdate: string; // ISO string
}

// ============================================
// PERSISTENCE FUNCTIONS
// ============================================

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
    // Silently ignore cache save errors
  }
}

function loadFromLocalStorage(): PriceServiceResult | null {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return null;

    const cache: PriceCache = JSON.parse(stored);

    // Validar antigüedad del cache (max 2 horas)
    const cacheAge = Date.now() - new Date(cache.lastUpdate).getTime();
    if (cacheAge > 1000 * 60 * 60 * 2) {
      return null;
    }

    return {
      prices: cache.prices,
      mepRate: cache.mepRate || CONSTANTS.MEP_DEFAULT,
      tickers: Object.keys(cache.prices).map(ticker => ({
        ticker,
        panel: cache.prices[ticker]?.panel,
        assetClass: cache.prices[ticker]?.assetClass
      })),
      lastUpdate: new Date(cache.lastUpdate)
    };
  } catch (e) {
    return null;
  }
}

/**
 * Fetch principal de todos los precios
 */
/**
 * Fetch principal de todos los precios (VERSION SERVER-SIDE CACHED)
 * Lee de la tabla 'market_prices' de Supabase para latencia cero.
 */
async function fetchAllPrices(lastValidPricesRef: React.MutableRefObject<LastValidPrices>): Promise<PriceServiceResult> {
  const priceMap: PriceMap = {};
  const tickerList: TickerInfo[] = [];
  let mepRate: number = CONSTANTS.MEP_DEFAULT;
  let latestUpdate: Date | null = null;

  try {
    // 1. Fetch único y rápido a Supabase
    const { data: rows, error } = await supabase
      .from('market_prices')
      .select('*')
      .limit(5000); // Override default 1000 row limit

    if (error) throw error;
    if (!rows || rows.length === 0) throw new Error('No prices in cache');

    let avgMep = 0;
    let mepCount = 0;

    // 2. Procesar filas
    rows.forEach((row: any) => {
      const ticker = row.ticker;
      const rawPrice = Number(row.price);
      const panel = row.panel;
      const metadata = row.metadata || {};

      if (!ticker) return;

      // MEP Logic
      if (ticker === 'MEP') {
        mepRate = rawPrice;
        mepService.recordDailyMep(mepRate);
        return; // No lo agregamos como activo tradeable
      }

      // Asset Identification
      const assetClass = getAssetClass(ticker, panel);

      // Bond Adjustment
      const adjustedPrice = panel === 'bonds'
        ? adjustBondPrice(ticker, rawPrice, assetClass)
        : rawPrice;

      // Last Valid Logic (Resilience)
      const isValidPrice = adjustedPrice > 0;
      const lastValid = lastValidPricesRef.current[ticker];
      const finalPrice = isValidPrice ? adjustedPrice : (lastValid?.price || adjustedPrice);
      const finalRawPrice = isValidPrice ? rawPrice : (lastValid?.priceRaw || rawPrice);

      if (isValidPrice) {
        lastValidPricesRef.current[ticker] = { price: adjustedPrice, priceRaw: rawPrice };
      }

      // Track latest update
      if (row.last_update) {
        const rowDate = new Date(row.last_update);
        if (!latestUpdate || rowDate > latestUpdate) {
          latestUpdate = rowDate;
        }
      }

      // Build Price Entry
      priceMap[ticker] = {
        price: finalPrice,
        priceRaw: finalRawPrice,
        bid: metadata.bid || null,
        ask: metadata.ask || null,
        close: rawPrice,
        panel: panel,
        assetClass: assetClass,
        pctChange: metadata.pct_change || null,
        isBonoPesos: isBonoPesos(ticker),
        isBonoHD: isBonoHardDollar(ticker),
        lastUpdate: row.last_update
      };

      // Build Ticker Info
      tickerList.push({ ticker, panel, assetClass });

      // Fallback MEP calculation (if 'MEP' row missing)
      if (panel === 'cedear' && rawPrice > 1400 && rawPrice < 2000) {
        avgMep += rawPrice; // Crude approx if needed
        mepCount++;
      }
    });

    // Fallback MEP if 'MEP' ticker wasn't in DB
    if (mepRate === CONSTANTS.MEP_DEFAULT && mepCount > 0) {
      // mepRate = avgMep / mepCount; // Optional: Enable if strictly needed
    }

  } catch (err) {
    console.error('Error fetching cached prices:', err);
    // Fail gracefully -> React Query will keep showing stale data thanks to placeholderData
  }

  const result = {
    prices: priceMap,
    mepRate,
    tickers: tickerList.sort((a, b) => a.ticker.localeCompare(b.ticker)),
    lastUpdate: latestUpdate || new Date(),
  };

  saveToLocalStorage(result);
  return result;
}

/**
 * Invoca la Edge Function de Supabase para forzar el fetch de precios.
 * Incluye timeout de 15 segundos para evitar bloqueos indefinidos.
 */
export async function invokeFetchPrices(): Promise<unknown> {
  const TIMEOUT_MS = 15000; // 15 seconds timeout

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Edge Function timeout: fetch-prices tardó más de 15 segundos'));
    }, TIMEOUT_MS);
  });

  try {
    const fetchPromise = supabase.functions.invoke('fetch-prices');

    // Race between the actual fetch and the timeout
    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

    if (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Error en Edge Function fetch-prices: ${errorMessage}`);
    }

    return data;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
    console.error('Error invoking fetch-prices:', errorMessage);
    // Re-throw with clear message for UI to handle
    throw new Error(`No se pudieron actualizar los precios: ${errorMessage}`);
  }
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
    placeholderData: (previousData) => previousData, // KEY FIX: Keep showing old data while fetching new
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
