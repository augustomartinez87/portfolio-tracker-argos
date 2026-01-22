// src/hooks/useBondPrices.ts
// Re-export de utilidades de bonos + hook para persistencia de precios

import { useState, useCallback } from 'react';

// Re-exportar funciones de bondUtils (para compatibilidad con imports existentes)
export {
  isBonoPesos,
  isBonoHardDollar,
  isBond,
  getAssetClass,
  adjustBondPrice,
  formatBondPrice,
  getHistoricalEndpoint,
} from '../utils/bondUtils';

// ============================================
// TIPOS
// ============================================

interface PriceEntry {
  precio: number;
  precioRaw?: number;
  timestamp: number;
}

interface UseBondPricesReturn {
  lastValidPrices: Record<string, PriceEntry>;
  getDisplayPrice: (ticker: string, price: number, mepRate?: number) => number;
  persistPrice: (ticker: string, price: number, precioRaw?: number) => void;
  getLastValidPrice: (ticker: string) => PriceEntry | null;
}

// ============================================
// HOOK
// ============================================

/**
 * Hook para manejar persistencia de precios válidos.
 * Guarda el último precio válido para cada ticker en caso de que
 * la API retorne 0 o un valor inválido.
 */
export const useBondPrices = (): UseBondPricesReturn => {
  const [lastValidPrices, setLastValidPrices] = useState<Record<string, PriceEntry>>({});

  /**
   * Obtiene el precio ajustado para mostrar
   */
  const getDisplayPrice = useCallback((ticker: string, price: number, _mepRate = 0): number => {
    if (!price || price === 0) return 0;
    // La lógica de ajuste ahora está en adjustBondPrice de bondUtils
    return price;
  }, []);

  /**
   * Persiste un precio válido en estado y localStorage
   */
  const persistPrice = useCallback((ticker: string, precio: number, precioRaw?: number): void => {
    if (precio > 0) {
      const entry: PriceEntry = {
        precio,
        precioRaw: precioRaw || precio,
        timestamp: Date.now()
      };

      setLastValidPrices(prev => ({
        ...prev,
        [ticker]: entry
      }));

      // Persistir en localStorage
      try {
        localStorage.setItem(`price_${ticker}`, JSON.stringify(entry));
      } catch (e) {
        if ((e as Error).name === 'QuotaExceededError') {
          console.warn('[useBondPrices] LocalStorage full, clearing old prices...');
          // Limpiar precios viejos
          Object.keys(localStorage)
            .filter(key => key.startsWith('price_'))
            .forEach(key => localStorage.removeItem(key));
        }
      }
    }
  }, []);

  /**
   * Obtiene el último precio válido para un ticker
   */
  const getLastValidPrice = useCallback((ticker: string): PriceEntry | null => {
    // Primero buscar en estado
    if (lastValidPrices[ticker]) {
      return lastValidPrices[ticker];
    }

    // Luego buscar en localStorage
    try {
      const stored = localStorage.getItem(`price_${ticker}`);
      if (stored) {
        return JSON.parse(stored) as PriceEntry;
      }
    } catch {
      // Ignore parse errors
    }

    return null;
  }, [lastValidPrices]);

  return {
    lastValidPrices,
    getDisplayPrice,
    persistPrice,
    getLastValidPrice,
  };
};

export default useBondPrices;
