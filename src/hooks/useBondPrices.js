// src/hooks/useBondPrices.js
// FUENTE ÚNICA DE VERDAD para detección de bonos
// Todos los demás archivos deben importar estas funciones desde aquí
import { useState, useCallback } from 'react';

/**
 * Detecta si un ticker es un bono en pesos argentinos
 * Ejemplos: T15E7, TTD26, TX26, S31E5, DICP, PARP
 */
export const isBonoPesos = (ticker) => {
  if (!ticker) return false;
  const t = ticker.toUpperCase();
  // Patrones T: T15E7, TTD26, TX26, T30J7, etc.
  if (/^T[A-Z0-9]{2,5}$/.test(t)) return true;
  // Patrones S: S31E5, S24DD, etc.
  if (/^S[0-9]{2}[A-Z][0-9]$/.test(t)) return true;
  // Bonos pesos específicos: DICP, PARP, CUAP, TO26, etc.
  if (/^(DICP|PARP|CUAP|PR13|TC23|TO26|TY24)/.test(t)) return true;
  // TTD/TTS son siempre pesos
  if (t.startsWith('TTD') || t.startsWith('TTS')) return true;
  return false;
};

/**
 * Detecta si un ticker es un bono hard dollar (dólar linked)
 * Ejemplos: AL30, GD30, AE38, AL30D, GD30C
 */
export const isBonoHardDollar = (ticker) => {
  if (!ticker) return false;
  const t = ticker.toUpperCase();
  // Bonos hard dollar SIN sufijo: AL30, AE38, GD30, etc.
  if (/^(AL|AE|AN|CO|GD)[0-9]{2}$/.test(t)) return true;
  // Bonos hard dollar CON sufijo D/C: AL30D, GD30C, etc.
  if (/^(AL|AE|AN|CO|GD)[0-9]{2}[DC]$/.test(t)) return true;
  // Otros bonos hard dollar específicos
  if (/^(DICA|DICY|DIED|AY24|BU24|BP26)/.test(t)) return true;
  return false;
};

export const getAssetClass = (ticker, panel, isArgStock = false) => {
  if (!ticker) return 'OTROS';
  if (isBonoPesos(ticker)) return 'BONOS PESOS';
  if (isBonoHardDollar(ticker)) return 'BONO HARD DOLLAR';
  if (panel === 'bonds') return 'BONO HARD DOLLAR';

  const argyTickers = ['GGAL', 'YPFD', 'VIST', 'PAMP', 'TXAR', 'ALUA', 'BMA', 'SUPV', 'CEPU', 'EDN',
                        'TGSU2', 'TRAN', 'CRES', 'LOMA', 'COME', 'BBAR', 'BYMA', 'MIRG', 'VALO', 'IRSA',
                        'METR', 'TECO2', 'TGNO4', 'HARG', 'CADO', 'MORI', 'SEMI', 'BOLT', 'GARO'];
  if (isArgStock || argyTickers.includes(ticker.toUpperCase())) return 'ARGY';
  if (panel === 'cedear') return 'CEDEAR';
  return 'CEDEAR';
};

/**
 * Ajusta el precio del bono según su tipo
 * Los precios de data912 vienen en formatos diferentes:
 * - Bonos pesos: el precio viene multiplicado, hay que dividir
 * - Bonos hard dollar: precio por USD 100 VN
 *
 * NOTA: Esta función se usa para normalizar precios al guardar/mostrar
 */
export const adjustBondPrice = (ticker, price) => {
  if (!price || price === 0) return 0;

  // Bonos en pesos: precio por $1 VN (típicamente 0.8 a 1.5)
  // Si el precio viene > 10, probablemente está en centavos
  if (isBonoPesos(ticker)) {
    return price > 10 ? price / 100 : price;
  }

  // Bonos hard dollar: precio por USD 100 VN
  if (isBonoHardDollar(ticker)) {
    return price;
  }

  return price;
};

export const useBondPrices = () => {
  const [lastValidPrices, setLastValidPrices] = useState({});

  // getDisplayPrice usa la misma lógica que adjustBondPrice para consistencia
  const getDisplayPrice = useCallback((ticker, price, mepRate = 0) => {
    if (!price || price === 0) return 0;
    return adjustBondPrice(ticker, price);
  }, []);

  const persistPrice = useCallback((ticker, price) => {
    if (price > 0) {
      setLastValidPrices(prev => ({
        ...prev,
        [ticker]: {
          precio: price,
          timestamp: Date.now()
        }
      }));
      
      try {
        localStorage.setItem(`price_${ticker}`, JSON.stringify({
          precio: price,
          timestamp: Date.now()
        }));
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          console.warn('LocalStorage full, clearing old prices...');
          this.clearOldPrices?.();
        }
      }
    }
  }, []);

  const getLastValidPrice = useCallback((ticker) => {
    return lastValidPrices[ticker] || null;
  }, [lastValidPrices]);

  return {
    isBonoPesos,
    isBonoHardDollar,
    getAssetClass,
    adjustBondPrice,
    getDisplayPrice,
    persistPrice,
    getLastValidPrice,
    lastValidPrices
  };
};

export default useBondPrices;
