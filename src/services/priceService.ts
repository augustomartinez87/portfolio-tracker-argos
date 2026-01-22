// src/services/priceService.ts
// Servicio centralizado para fetching de precios con React Query

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useEffect } from 'react';
import { API_ENDPOINTS, CONSTANTS, DOLLAR_SUFFIXES } from '../utils/constants';
import { isBonoPesos, isBonoHardDollar, getAssetClass, adjustBondPrice } from '../utils/bondUtils';
import type { PriceData, PriceMap, TickerInfo, MEPDataItem, StockDataItem, BondDataItem, AssetClass } from '../types';

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
    const adjustedPrice = adjustBondPrice(ticker, rawPrice);

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
  }

  // 2. Fetch paralelo de stocks, cedears y bonds
  const [stocksResult, cedearsResult, bondsResult] = await Promise.allSettled([
    fetchWithTimeout<StockDataItem[]>(API_ENDPOINTS.ARG_STOCKS),
    fetchWithTimeout<StockDataItem[]>(API_ENDPOINTS.ARG_CEDEARS),
    fetchWithTimeout<BondDataItem[]>(API_ENDPOINTS.ARG_BONDS),
  ]);

  // Procesar arg_stocks
  if (stocksResult.status === 'fulfilled') {
    stocksResult.value.forEach(item => {
      const ticker = item.symbol;
      if (!ticker) return;

      // Filtrar tickers en dólares
      if (DOLLAR_SUFFIXES.includes(ticker as typeof DOLLAR_SUFFIXES[number])) return;
      if (ticker.endsWith('.D')) return;

      const assetClass = getAssetClass(ticker, null, true);

      if (!priceMap[ticker]) {
        const rawPrice = item.c || item.px_ask || item.px_bid || 0;
        const adjustedPrice = adjustBondPrice(ticker, rawPrice);

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
  }

  // Procesar cedears
  if (cedearsResult.status === 'fulfilled') {
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

        priceMap[ticker] = {
          precio: rawPrice,
          precioRaw: rawPrice,
          bid: item.px_bid,
          ask: item.px_ask,
          close: item.c,
          panel: 'cedear',
          assetClass: 'CEDEAR' as AssetClass,
          pctChange: item.pct_change ?? null,
          isBonoPesos: false,
          isBonoHD: false,
        };

        tickerList.push({ ticker, panel: 'cedear', assetClass: 'CEDEAR' });
      } else if (item.pct_change !== undefined) {
        priceMap[ticker].pctChange = item.pct_change;
      }
    });
  }

  // Procesar bonds
  if (bondsResult.status === 'fulfilled') {
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
        const adjustedPrice = adjustBondPrice(ticker, rawPrice);

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
  }

  return {
    prices: priceMap,
    mepRate,
    tickers: tickerList.sort((a, b) => a.ticker.localeCompare(b.ticker)),
    lastUpdate: new Date(),
  };
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
    staleTime: 30 * 1000, // 30 segundos
    refetchInterval: 30 * 1000, // Refetch cada 30 segundos
    refetchIntervalInBackground: false, // No refetch cuando tab no está activo (se pausa automáticamente)
    refetchOnWindowFocus: false, // No refetch automático al cambiar tabs - el usuario puede refrescar manualmente
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Nota: El polling se pausa automáticamente cuando la tab está en background
  // gracias a refetchIntervalInBackground: false. No necesitamos listener de visibilitychange.

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['prices'] });
  }, [queryClient]);

  return {
    prices: query.data?.prices ?? {},
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
