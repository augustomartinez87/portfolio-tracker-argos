// src/hooks/useBondPrices.js
import { useState, useCallback } from 'react';

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
  // AL35, AE38, AN29, CO26, GD35, GD38, GD41, GD46 son BONOS PESOS (sin sufijo D/C)
  if (/^(AL|AE|AN|CO|GD)[0-9]{2}$/.test(t)) return true;
  return false;
};

export const isBonoHardDollar = (ticker) => {
  if (!ticker) return false;
  const t = ticker.toUpperCase();
  // Bonos hard dollar: AL30, GD30, AE38D, AN29D, CO26D, etc. (CON sufijo D o C)
  if (/^(AL|GD|AE|AN|CO)[0-9]{2}[DC]$/.test(t)) return true;
  // Bonos específicos hard dollar conocidos
  if (/^(DICA|DICY|DIED|AY24|BU24|BP26)/.test(t)) return true;
  return false;
};

export const getAssetClass = (ticker, panel, isArgStock = false) => {
  if (!ticker) return 'OTROS';
  if (isBonoPesos(ticker)) return 'BONOS PESOS';
  if (isBonoHardDollar(ticker)) return 'BONOS HD';
  if (panel === 'bonds') return 'BONOS HD';
  
  const argyTickers = ['GGAL', 'YPFD', 'VIST', 'PAMP', 'TXAR', 'ALUA', 'BMA', 'SUPV', 'CEPU', 'EDN',
                       'TGSU2', 'TRAN', 'CRES', 'LOMA', 'COME', 'BBAR', 'BYMA', 'MIRG', 'VALO', 'IRSA',
                       'METR', 'TECO2', 'TGNO4', 'HARG', 'CADO', 'MORI', 'SEMI', 'BOLT', 'GARO'];
  if (isArgStock || argyTickers.includes(ticker.toUpperCase())) return 'ARGY';
  if (panel === 'cedear') return 'CEDEAR';
  return 'CEDEAR';
};

export const adjustBondPrice = (ticker, price) => {
  if (!price || price === 0) return 0;
  
  // Verificar si es un bono (pesos o HD)
  const isPesos = isBonoPesos(ticker);
  const isHD = isBonoHardDollar(ticker);
  
  if (isPesos || isHD) {
    return price / 100;
  }
  
  return price;
};

export const useBondPrices = () => {
  const [lastValidPrices, setLastValidPrices] = useState({});

  const getDisplayPrice = useCallback((ticker, price, mepRate = 0) => {
    if (!price || price === 0) return 0;
    
    // Todos los bonos se dividen por 100
    if (isBonoPesos(ticker) || isBonoHardDollar(ticker)) {
      return price / 100;
    }
    
    return price;
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
        // Ignorar errores de localStorage
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
