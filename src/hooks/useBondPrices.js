// src/hooks/useBondPrices.js
import { useState, useCallback } from 'react';

export const isBonoPesos = (ticker) => {
  if (!ticker) return false;
  const t = ticker.toUpperCase();
  if (/^T[A-Z0-9]{2,5}$/.test(t)) return true;
  if (/^S[0-9]{2}[A-Z][0-9]$/.test(t)) return true;
  if (/^(DICP|PARP|CUAP|PR13|TC23|TO26|TY24)/.test(t)) return true;
  if (t.startsWith('TTD') || t.startsWith('TTS')) return true;
  return false;
};

export const isBonoHardDollar = (ticker) => {
  if (!ticker) return false;
  const t = ticker.toUpperCase();
  // Patrones de bonos hard dollar: AL30, GD30, AE38, AN26, CO26, etc.
  // También incluye variantes con D o C al final (versión dólar/cable)
  if (/^(AL|GD|AE|AN|CO)[0-9]{2}[DC]?$/.test(t)) return true;
  // Bonos específicos conocidos
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
  
  // Bonos en pesos: data912 da precio por $1000 VN, convertir a precio por $1 VN
  if (isBonoPesos(ticker)) {
    return price / 1000;
  }
  
  // Bonos HD: data912 da precio por $100 USD VN, convertir a precio por $1 USD VN
  if (isBonoHardDollar(ticker)) {
    return price / 100;
  }
  
  return price;
};

export const useBondPrices = () => {
  const [lastValidPrices, setLastValidPrices] = useState({});

  const getDisplayPrice = useCallback((ticker, price, mepRate = 0) => {
    if (!price || price === 0) return 0;
    
    if (isBonoPesos(ticker)) {
      return price;
    }
    
    if (isBonoHardDollar(ticker)) {
      return mepRate > 0 ? (price / 100) * mepRate : price;
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
