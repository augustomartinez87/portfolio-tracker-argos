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

// ============================================
// FUNCIONES DE OBLIGACIONES NEGOCIABLES (ONs)
// ============================================

/**
 * Detecta si un ticker es una Obligación Negociable (ON).
 * Verifica primero que NO sea un bono soberano o una acción argentina conocida.
 */
export const isON = (ticker: string | null | undefined): boolean => {
  if (!ticker) return false;
  const t = ticker.toUpperCase();

  // Si es un bono conocido, NO es una ON
  if (isBond(t)) return false;

  // Si es una acción argentina conocida (como YPFD), NO es una ON
  if (ARGY_TICKERS.includes(t as any)) return false;

  // Las ONs suelen terminar en O, D o C
  return t.endsWith('O') || t.endsWith('D') || t.endsWith('C');
};

/**
 * Determina el tipo de moneda de una ON
 */
export const getONCurrencyType = (ticker: string): 'ARS' | 'USD' | 'CABLE' => {
  const t = ticker.toUpperCase();
  if (t.endsWith('O')) return 'ARS';
  if (t.endsWith('D')) return 'USD';
  if (t.endsWith('C')) return 'CABLE';
  return 'USD'; // fallback
};

/**
 * Convierte un ticker ON D/C a su equivalente O (pesos)
 */
export const convertToONPesos = (ticker: string): string => {
  if (!ticker) return ticker;
  const lastChar = ticker.charAt(ticker.length - 1).toUpperCase();
  if (lastChar === 'D' || lastChar === 'C') {
    return ticker.slice(0, -1) + 'O';
  }
  return ticker;
};

/**
 * Valida que exista equivalente O en los precios disponibles
 */
export const hasONPesosEquivalent = (ticker: string, priceMap: any): boolean => {
  const pesosEquivalent = convertToONPesos(ticker);
  return priceMap[pesosEquivalent]?.precio > 0;
};

/**
 * Calcula el valor de una posición ON en ARS
 */
export const calculateONValueInARS = (
  originalTicker: string,
  quantity: number,
  priceMap: any,
  _mepRate: number
): { value: number; priceInARS: number; usesConversion: boolean } => {
  const isDirectON = originalTicker.endsWith('O');

  if (isDirectON) {
    // Ya está en ARS
    const price = priceMap[originalTicker]?.precio || 0;
    return {
      value: price * quantity,
      priceInARS: price,
      usesConversion: false
    };
  } else {
    // Convertir D/C a O para obtener precio ARS
    const pesosEquivalent = convertToONPesos(originalTicker);
    const priceInARS = priceMap[pesosEquivalent]?.precio || 0;

    if (priceInARS === 0) {
      // No existe equivalente O
      throw new Error(`No existe equivalente en pesos para ${originalTicker}`);
    }

    return {
      value: priceInARS * quantity,
      priceInARS,
      usesConversion: true
    };
  }
};

/**
 * Formatea el precio de una posición ON (siempre en ARS)
 */
export const formatONPositionPrice = (
  ticker: string,
  priceMap: any,
  formatARS: (value: number) => string
): string => {
  const pesosEquivalent = convertToONPesos(ticker);
  const priceInARS = priceMap[pesosEquivalent]?.precio || 0;
  return formatARS(priceInARS);
};

/**
 * Formatea el precio de una ON para el selector (moneda original)
 */
export const formatONSelectorPrice = (
  ticker: string,
  price: number,
  formatARS: (value: number) => string,
  formatUSD: (value: number) => string
): string => {
  const currency = getONCurrencyType(ticker);
  switch (currency) {
    case 'ARS':
      return formatARS(price);
    case 'USD':
    case 'CABLE':
      return formatUSD(price);
    default:
      return price.toString();
  }
};

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
 * Determina la clase de activo de un ticker.
 * Aplica una "Jerarquía de Verdad" absoluta para evitar ambigüedades:
 * 1. Prioridad: Lista ARGY_TICKERS (GGAL, TXAR, etc. siempre son acciones).
 * 2. Origen: Panel de la API (corp, arg_stock, cedear, bonds).
 * 3. Fallback: Patrones técnicos.
 *
 * @param ticker - El símbolo del activo
 * @param panel - Panel de data912 (opcional, pero recomendado)
 * @param isArgStock - Flag para forzar ARGY (opcional)
 */
export const getAssetClass = (
  ticker: string | null | undefined,
  panel?: string | null,
  isArgStock = false
): AssetClass => {
  if (!ticker) return 'OTROS';

  const t = ticker.toUpperCase();

  // 1. PRIORIDAD MÁXIMA: Si está en la lista de acciones argentinas, es ARGY
  // Esto previene que TXAR sea confundido con un bono aunque el panel sea erróneo.
  if (isArgStock || ARGY_TICKERS.includes(t as any)) {
    return 'ARGY';
  }

  // 2. PRIORIDAD PANEL: Si tenemos el panel, confiamos en el origen
  if (panel) {
    if (panel === 'arg_stock') return 'ARGY';
    if (panel === 'cedear') return 'CEDEAR';
    if (panel === 'corp') return 'ON';

    if (panel === 'bonds') {
      // Regla de Oro para el panel mixto de bonos:
      // Si tiene variante D/C o es de una familia HD conocida -> BONO HD
      // De lo contrario -> BONOS PESOS (por exclusión)
      const isVariant = t.endsWith('D') || t.endsWith('C');
      const isHDFamily = isBonoHardDollar(t);
      return (isVariant || isHDFamily) ? 'BONO HARD DOLLAR' : 'BONOS PESOS';
    }

    if (panel === 'mep') {
      // El panel MEP suele ser Bonos HD o CEDEARs
      if (isBonoHardDollar(t) || t.endsWith('D')) return 'BONO HARD DOLLAR';
      return 'CEDEAR';
    }
  }

  // 3. FALLBACK (Entrada manual o datos incompletos)
  if (isBonoPesos(t)) return 'BONOS PESOS';
  if (isBonoHardDollar(t)) return 'BONO HARD DOLLAR';

  // Si no es bono y tiene O/D/C es probable que sea una ON (ej: YMCXO)
  if (isON(t)) return 'ON';

  // Por defecto, la mayoría de los activos externos son CEDEARs
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
