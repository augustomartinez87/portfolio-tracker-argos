import { useState, useEffect, useMemo } from 'react';
import Decimal from 'decimal.js';
import { fciService } from '@/features/fci/services/fciService';

const TNA_FALLBACK = 0.32;
const MA_WINDOW = 7;

/**
 * Deduplica precios por fecha (último valor por fecha gana) y ordena ascendente.
 */
function deduplicarPrecios(prices) {
  const map = new Map();
  for (const p of prices) {
    map.set(p.fecha, p);
  }
  return [...map.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Calcula TNA diaria entre cada par consecutivo de precios,
 * corrigiendo por los días reales entre fechas.
 * Retorna array de { fecha, tna } donde tna es decimal (0.30 = 30%).
 */
function calcularTnasDiarias(sortedPrices) {
  const result = [];
  for (let i = 1; i < sortedPrices.length; i++) {
    const prev = sortedPrices[i - 1];
    const curr = sortedPrices[i];
    const vcpPrev = new Decimal(prev.vcp || 0);
    const vcpCurr = new Decimal(curr.vcp || 0);
    if (vcpPrev.isZero()) continue;

    const diasReales = Math.round(
      (new Date(curr.fecha) - new Date(prev.fecha)) / (1000 * 60 * 60 * 24)
    );
    if (diasReales <= 0) continue;

    const ratio = vcpCurr.dividedBy(vcpPrev);
    const tna = ratio.pow(new Decimal(365).dividedBy(diasReales)).minus(1);
    result.push({ fecha: curr.fecha, tna: tna.toNumber() });
  }
  return result;
}

/**
 * Aplica Moving Average de ventana fija sobre un array de { fecha, tna }.
 * Retorna array con la misma estructura donde cada tna es el promedio
 * de los últimos min(MA_WINDOW, disponibles) valores.
 */
function aplicarMovingAverage(tnasDiarias, window = MA_WINDOW) {
  return tnasDiarias.map((item, idx) => {
    const start = Math.max(0, idx - window + 1);
    const slice = tnasDiarias.slice(start, idx + 1);
    const avg = slice.reduce((sum, d) => sum + d.tna, 0) / slice.length;
    return { fecha: item.fecha, tna: avg };
  });
}

/**
 * Hook para calcular la TNA dinámica de un FCI basado en el historial de precios (VCP).
 * Usa Moving Average de 7 días para estabilizar la TNA y evitar spikes por ventanas cortas.
 *
 * @param {string} fciId - ID del FCI
 * @returns {Object} { tnaFCI, loading, error, isFallback, ultimaPreciofecha, vcpPrices }
 */
export function useFciTNA(fciId) {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
        // Pedir 21 días de historial: suficiente para MA-7d con margen de gaps
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 21);
        const from = fromDate.toISOString().split('T')[0];

        const data = await fciService.getPrices(fciId, from);

        if (!data || data.length === 0) {
          setError('No hay datos de precios para este FCI');
          setPrices([]);
          return;
        }

        setPrices(data);
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

  // Precios deduplicados y ordenados (para consumo externo por useCarryMetrics)
  const vcpPrices = useMemo(() => deduplicarPrecios(prices), [prices]);

  // Fecha del último precio disponible
  const ultimaPreciofecha = useMemo(() => {
    if (vcpPrices.length === 0) return null;
    return vcpPrices[vcpPrices.length - 1].fecha;
  }, [vcpPrices]);

  // Calcular TNA con MA-7d
  const { tnaFCI, isFallback } = useMemo(() => {
    if (vcpPrices.length < 2) {
      return { tnaFCI: TNA_FALLBACK, isFallback: true };
    }

    try {
      const tnasDiarias = calcularTnasDiarias(vcpPrices);
      if (tnasDiarias.length === 0) {
        return { tnaFCI: TNA_FALLBACK, isFallback: true };
      }

      const maSmoothed = aplicarMovingAverage(tnasDiarias);
      const ultimaTna = maSmoothed[maSmoothed.length - 1].tna;

      if (ultimaTna < -0.5 || ultimaTna > 2.0) {
        return { tnaFCI: TNA_FALLBACK, isFallback: true };
      }

      return { tnaFCI: ultimaTna, isFallback: false };
    } catch (err) {
      console.error('[useFciTNA] Error calculating TNA:', err);
      return { tnaFCI: TNA_FALLBACK, isFallback: true };
    }
  }, [vcpPrices]);

  return {
    tnaFCI,
    loading,
    error,
    isFallback,
    ultimaPreciofecha,
    vcpPrices,
    pricesCount: vcpPrices.length,
  };
}

export default useFciTNA;
