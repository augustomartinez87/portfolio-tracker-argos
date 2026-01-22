// src/utils/bondUtils.ts
// FUENTE ÚNICA DE VERDAD para detección y manejo de bonos

import type { AssetClass } from '@/types';
import {
  BONO_PESOS_PATTERNS,
  BONO_PESOS_TICKERS,
  BONO_HD_PATTERNS,
  BONO_HD_TICKERS,
  ARGY_TICKERS,
} from './constants';

/**
 * Detecta si un ticker es un bono en pesos argentinos
 *
 * @example isBonoPesos('TTD26') // true
 * @example isBonoPesos('AAPL') // false
 */
export const isBonoPesos = (ticker: string | null | undefined): boolean => {
  if (!ticker) return false;

  const t = ticker.toUpperCase();

  // Verificar tickers específicos
  if (BONO_PESOS_TICKERS.some(bp => t.startsWith(bp))) return true;

  // Verificar patrones regex
  return BONO_PESOS_PATTERNS.some(pattern => pattern.test(t));
};

/**
 * Detecta si un ticker es un bono hard dollar (dólar linked)
 *
 * @example isBonoHardDollar('AL30') // true
 * @example isBonoHardDollar('GD30D') // true
 * @example isBonoHardDollar('AAPL') // false
 */
export const isBonoHardDollar = (ticker: string | null | undefined): boolean => {
  if (!ticker) return false;

  const t = ticker.toUpperCase();

  // Verificar tickers específicos
  if (BONO_HD_TICKERS.some(bh => t.startsWith(bh))) return true;

  // Verificar patrones regex
  return BONO_HD_PATTERNS.some(pattern => pattern.test(t));
};

/**
 * Detecta si un ticker es un bono (pesos o hard dollar)
 */
export const isBond = (ticker: string | null | undefined): boolean => {
  return isBonoPesos(ticker) || isBonoHardDollar(ticker);
};

/**
 * Determina la clase de activo de un ticker
 *
 * @param ticker - El símbolo del activo
 * @param panel - Panel de data912 (opcional)
 * @param isArgStock - Flag para forzar ARGY (opcional)
 */
export const getAssetClass = (
  ticker: string | null | undefined,
  panel?: string | null,
  isArgStock = false
): AssetClass => {
  if (!ticker) return 'OTROS';

  const t = ticker.toUpperCase();

  // Bonos primero (más específicos)
  if (isBonoPesos(t)) return 'BONOS PESOS';
  if (isBonoHardDollar(t)) return 'BONO HARD DOLLAR';

  // Panel de bonds
  if (panel === 'bonds') return 'BONO HARD DOLLAR';

  // Acciones argentinas
  if (isArgStock || ARGY_TICKERS.includes(t as typeof ARGY_TICKERS[number])) {
    return 'ARGY';
  }

  // CEDEARs
  if (panel === 'cedear') return 'CEDEAR';

  // Default: CEDEAR (mayoría de tickers internacionales)
  return 'CEDEAR';
};

/**
 * Ajusta el precio del bono según su tipo.
 * Los precios de data912 vienen multiplicados por 100:
 * - Bonos pesos: precio * 100, hay que dividir por 100
 * - Bonos hard dollar: precio * 100, hay que dividir por 100
 *
 * @param ticker - El símbolo del bono
 * @param price - El precio raw de la API
 * @returns Precio ajustado
 */
export const adjustBondPrice = (
  ticker: string | null | undefined,
  price: number | null | undefined
): number => {
  if (!price || price === 0) return 0;

  // Bonos en pesos: dividir por 100
  if (isBonoPesos(ticker)) {
    return price / 100;
  }

  // Bonos hard dollar: dividir por 100
  if (isBonoHardDollar(ticker)) {
    return price / 100;
  }

  return price;
};

/**
 * Formatea el precio de un bono según su tipo
 *
 * @param ticker - El símbolo del activo
 * @param price - El precio a formatear
 * @param formatARS - Función de formato para no-bonos
 */
export const formatBondPrice = (
  ticker: string | null | undefined,
  price: number,
  formatARS: (value: number) => string
): string => {
  if (isBonoPesos(ticker) || isBonoHardDollar(ticker)) {
    return `$${price.toFixed(2)}`;
  }
  return formatARS(price);
};

/**
 * Determina el endpoint histórico correcto para un ticker
 */
export const getHistoricalEndpoint = (ticker: string): string => {
  const t = ticker.toUpperCase();

  if (isBonoPesos(t) || isBonoHardDollar(t)) {
    // Remover sufijo D si existe para bonos
    const cleanTicker = t.replace(/D$/, '');
    return `/historical/bonds/${cleanTicker}`;
  }

  // Por defecto, stocks (incluye CEDEARs y ARGY)
  return `/historical/stocks/${ticker}`;
};
