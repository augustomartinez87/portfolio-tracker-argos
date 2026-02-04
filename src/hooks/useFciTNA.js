import { useState, useEffect, useMemo } from 'react';
import Decimal from 'decimal.js';
import { fciService } from '@/features/fci/services/fciService';

/**
 * Hook para calcular la TNA dinámica de un FCI basado en el historial de precios (VCP)
 * 
 * @param {string} fciId - ID del FCI
 * @param {number} minRecords - Mínimo de registros necesarios para calcular TNA (default: 2)
 * @returns {Object} { tnaFCI: number, loading: boolean, error: string|null, isFallback: boolean }
 */
export function useFciTNA(fciId, minRecords = 2) {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // TNA fallback cuando no hay datos suficientes (32%)
  const TNA_FALLBACK = 0.32;

  useEffect(() => {
    if (!fciId) {
      setPrices([]);
      setError(null);
      return;
    }

    const fetchPrices = async () => {
      setLoading(true);
      setError(null);

      try {
        // Obtener los últimos 7 registros de precios
        const data = await fciService.getPrices(fciId);
        
        if (!data || data.length === 0) {
          setError('No hay datos de precios para este FCI');
          setPrices([]);
          return;
        }

        // Tomar los últimos 7 registros (o menos si no hay suficientes)
        const last7Records = data.slice(-7);
        setPrices(last7Records);
      } catch (err) {
        console.error('[useFciTNA] Error fetching prices:', err);
        setError(err.message || 'Error al cargar precios del FCI');
        setPrices([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, [fciId]);

  // Calcular TNA anualizada
  const tnaFCI = useMemo(() => {
    if (!prices || prices.length < minRecords) {
      return TNA_FALLBACK;
    }

    try {
      // Ordenar por fecha ascendente
      const sortedPrices = [...prices].sort((a, b) => 
        new Date(a.fecha) - new Date(b.fecha)
      );

      const firstPrice = sortedPrices[0];
      const lastPrice = sortedPrices[sortedPrices.length - 1];

      const vcpInicial = new Decimal(firstPrice.vcp || 0);
      const vcpFinal = new Decimal(lastPrice.vcp || 0);

      if (vcpInicial.isZero() || vcpFinal.isZero()) {
        return TNA_FALLBACK;
      }

      // Calcular días entre el primer y último registro
      const fechaInicial = new Date(firstPrice.fecha);
      const fechaFinal = new Date(lastPrice.fecha);

      // Validar que las fechas sean válidas
      if (isNaN(fechaInicial.getTime()) || isNaN(fechaFinal.getTime())) {
        console.warn('[useFciTNA] Fechas inválidas:', { fechaInicial, fechaFinal });
        return TNA_FALLBACK;
      }

      const dias = Math.max(1, Math.floor((fechaFinal - fechaInicial) / (1000 * 60 * 60 * 24)));

      // Calcular ratio de crecimiento
      const ratio = vcpFinal.dividedBy(vcpInicial);

      // Anualizar con fórmula compuesta: (ratio ^ (365/dias)) - 1
      const exponent = new Decimal(365).dividedBy(dias);
      const tna = ratio.pow(exponent).minus(1);

      // Validar que la TNA sea razonable (entre -50% y 200%)
      const tnaNum = tna.toNumber();
      if (tnaNum < -0.5 || tnaNum > 2.0) {
        console.warn('[useFciTNA] TNA calculada fuera de rango razonable:', tnaNum);
        return TNA_FALLBACK;
      }

      return tnaNum;
    } catch (err) {
      console.error('[useFciTNA] Error calculating TNA:', err);
      return TNA_FALLBACK;
    }
  }, [prices, minRecords]);

  // Determinar si estamos usando el fallback
  const isFallback = useMemo(() => {
    return !prices || prices.length < minRecords;
  }, [prices, minRecords]);

  return {
    tnaFCI,
    loading,
    error,
    isFallback,
    pricesCount: prices?.length || 0,
  };
}

export default useFciTNA;
