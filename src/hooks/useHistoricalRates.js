import { useState, useEffect, useMemo } from 'react';
import { fciService } from '@/features/fci/services/fciService';
import { FinancingService } from '@/features/financing/services/financingService';
import { startOfDay, subDays, format, isAfter, isBefore, isEqual, eachDayOfInterval } from 'date-fns';

const financingService = new FinancingService();

export function useHistoricalRates(fciId, portfolioId, userId, days = 30) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function fetchData() {
      if (!fciId || !userId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const fromDate = format(subDays(new Date(), days + 14), 'yyyy-MM-dd'); // Extra days for 7-day moving average
        
        // 1. Fetch data in parallel
        const [prices, caucionesResult] = await Promise.all([
          fciService.getPrices(fciId, fromDate),
          financingService.getCauciones(userId, portfolioId)
        ]);

        if (caucionesResult.error) throw caucionesResult.error;
        const cauciones = caucionesResult.data;

        // 2. Process FCI TNA
        // tnaFCI = ((vcp_hoy / vcp_ayer) - 1) * 365 * 100
        const fciTnaMap = new Map();
        for (let i = 1; i < prices.length; i++) {
          const hoy = prices[i];
          const ayer = prices[i - 1];
          const factor = (hoy.vcp / ayer.vcp) - 1;
          const tna = factor * 365 * 100;
          fciTnaMap.set(hoy.fecha, tna);
        }

        // 3. Process Cauciones daily TNA
        const dateRange = eachDayOfInterval({
          start: subDays(new Date(), days),
          end: new Date()
        });

        const combinedData = dateRange.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          
          // FCI TNA (with 7-day moving average smoothing)
          let tnaFCI = null;
          const movingAvgDays = 7;
          let sum = 0;
          let count = 0;
          for (let i = 0; i < movingAvgDays; i++) {
            const d = format(subDays(date, i), 'yyyy-MM-dd');
            if (fciTnaMap.has(d)) {
              sum += fciTnaMap.get(d);
              count++;
            }
          }
          if (count > 0) tnaFCI = sum / count;

          // Caucion TNA
          // Buscar cauciones vigentes en esa fecha (fecha_inicio <= fecha <= fecha_fin)
          const activeCauciones = cauciones.filter(c => {
            const start = startOfDay(new Date(c.fecha_inicio));
            const end = startOfDay(new Date(c.fecha_fin));
            const current = startOfDay(date);
            return (isAfter(current, start) || isEqual(current, start)) && 
                   (isBefore(current, end) || isEqual(current, end));
          });

          let tnaCaucion = null;
          if (activeCauciones.length > 0) {
            const totalCapital = activeCauciones.reduce((acc, c) => acc + c.capital, 0);
            const weightedTnaSum = activeCauciones.reduce((acc, c) => acc + (c.tna_real * c.capital), 0);
            tnaCaucion = weightedTnaSum / totalCapital;
          } else {
            // Find most recent past caucion if none active
            const pastCauciones = cauciones
              .filter(c => isAfter(startOfDay(date), startOfDay(new Date(c.fecha_fin))))
              .sort((a, b) => new Date(b.fecha_fin) - new Date(a.fecha_fin));
            
            if (pastCauciones.length > 0) {
              tnaCaucion = pastCauciones[0].tna_real;
            }
          }

          const spread = (tnaFCI !== null && tnaCaucion !== null) ? (tnaFCI - tnaCaucion) : null;

          return {
            fecha: dateStr,
            tnaFCI: tnaFCI !== null ? Number(tnaFCI.toFixed(2)) : null,
            tnaCaucion: tnaCaucion !== null ? Number(tnaCaucion.toFixed(2)) : null,
            spread: spread !== null ? Number(spread.toFixed(2)) : null
          };
        }).filter(d => d.tnaFCI !== null || d.tnaCaucion !== null);

        // 4. Calculate stats
        const validSpreads = combinedData.filter(d => d.spread !== null).map(d => d.spread);
        
        if (validSpreads.length > 0) {
          const spreadPromedio = validSpreads.reduce((a, b) => a + b, 0) / validSpreads.length;
          
          let maxSpread = { valor: -Infinity, fecha: '' };
          let minSpread = { valor: Infinity, fecha: '' };
          
          combinedData.forEach(d => {
            if (d.spread !== null) {
              if (d.spread > maxSpread.valor) maxSpread = { valor: d.spread, fecha: d.fecha };
              if (d.spread < minSpread.valor) minSpread = { valor: d.spread, fecha: d.fecha };
            }
          });

          const spreadActual = combinedData[combinedData.length - 1]?.spread || 0;
          
          // Percentil actual
          const sortedSpreads = [...validSpreads].sort((a, b) => a - b);
          const index = sortedSpreads.indexOf(spreadActual);
          const percentilActual = Math.round((index / sortedSpreads.length) * 100);

          setStats({
            spreadPromedio: Number(spreadPromedio.toFixed(2)),
            spreadMax: maxSpread,
            spreadMin: minSpread,
            spreadActual: Number(spreadActual.toFixed(2)),
            percentilActual
          });
        }

        setData(combinedData);
      } catch (err) {
        console.error('Error in useHistoricalRates:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [fciId, portfolioId, userId, days]);

  return { data, loading, error, stats };
}
