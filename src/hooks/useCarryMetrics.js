import { useMemo } from 'react';
import Decimal from 'decimal.js';
import { toDateString } from '@/utils/formatters';
import {
  calcularSpreadPorCaucion as calcularSpreadLib,
  calcularTotalesOperaciones,
  calcularSpreadsTodasCauciones,
} from '@/lib/finance/carryCalculations';

/**
 * Hook para calcular métricas de carry trade
 *
 * @param {Object} params
 * @param {Array} params.cauciones - Cauciones desde Supabase (con campos: capital, interes, dias, tna_real, fecha_inicio, fecha_fin)
 * @param {Object} params.fciEngine - Resultado de useFciEngine() con totals.valuation
 * @param {number} params.tnaFCI - TNA del FCI como decimal (ej: 0.284849 para 28.48%)
 * @returns {Object|null} Métricas de carry trade o null si no hay datos suficientes
 */

// Re-exportar la función pura desde lib/finance para uso por componentes
export { calcularSpreadPorCaucion } from '@/lib/finance/carryCalculations';
export { calcularTotalesOperaciones, calcularSpreadsTodasCauciones };

export function useCarryMetrics({ cauciones, fciEngine, tnaFCI, caucionCutoffMode = 'auto', vcpPrices = [], dataStartDate = '' }) {
  return useMemo(() => {
    if (!cauciones?.length || !fciEngine?.totals) {
      return null;
    }

    const hoy = new Date();
    const hoyDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    // Filtrar cauciones por fecha mínima de datos confiables
    const caucionesFiltered = dataStartDate
      ? cauciones.filter(c => {
        const fechaInicio = String(c.fecha_inicio || '').split('T')[0];
        return fechaInicio >= dataStartDate;
      })
      : cauciones;

    // Si después del filtro no quedan cauciones, retornar null
    if (caucionesFiltered.length === 0) {
      return null;
    }

    const parseDate = (value) => {
      if (!value) return null;
      const datePart = String(value).split('T')[0];
      const [y, m, d] = datePart.split('-').map(Number);
      if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
        return new Date(y, m - 1, d);
      }
      const fallback = new Date(value);
      return Number.isNaN(fallback.getTime()) ? null : fallback;
    };

    // Calcular TNA FCI al principio (necesario para tieneVCPCompleto)
    const tnaFCIDec = new Decimal(tnaFCI || 0);

    // =========================================================================
    // 1. TOTAL CAUCIÓN ACTIVA (solo cauciones vigentes)
    // =========================================================================
    const caucionesActivasHoy = caucionesFiltered.filter(c => {
      const fechaInicio = parseDate(c.fecha_inicio);
      const fechaFin = parseDate(c.fecha_fin);
      if (!fechaInicio || !fechaFin) return false;
      return fechaInicio <= hoyDate && fechaFin >= hoyDate;
    });

    const ultimaCaucionFecha = caucionesFiltered.length > 0
      ? caucionesFiltered.reduce((max, c) => {
        const fecha = parseDate(c.fecha_fin);
        if (!fecha) return max;
        return !max || fecha > max ? fecha : max;
      }, null)
      : null;

    // Encontrar última caución con VCP completo (ambos datos disponibles)
    // Solo considerar cauciones VENCIDAS con VCP real (sin proyección)
    const tieneVCPCompleto = (caucion) => {
      const fechaInicio = String(caucion.fecha_inicio || '').split('T')[0];
      const fechaFin = String(caucion.fecha_fin || '').split('T')[0];
      const hoyISO = toDateString(hoy);

      // Solo cauciones vencidas (fecha_fin < hoy)
      if (fechaFin >= hoyISO) return false;

      // Verificar directamente si existen los VCP para inicio y fin
      const vcpInicio = vcpPrices.find(p => p.fecha?.split('T')[0] === fechaInicio);
      const vcpFin = vcpPrices.find(p => p.fecha?.split('T')[0] === fechaFin);

      // Solo considerar completa si tiene AMBOS precios VCP (sin proyección)
      return vcpInicio && vcpFin;
    };

    const ultimaCaucionConVCP = caucionesFiltered.reduce((max, c) => {
      const fechaFin = parseDate(c.fecha_fin);
      if (!fechaFin) return max;

      // Verificar si esta caución tiene VCP completo
      if (tieneVCPCompleto(c) && (!max || fechaFin > max)) {
        return fechaFin;
      }
      return max;
    }, null);

    let cutoffFecha = null;
    if (caucionCutoffMode === 'today') {
      cutoffFecha = hoyDate;
    } else if (caucionCutoffMode === 'last-complete') {
      // Última caución con VCP completo (ambos datos)
      cutoffFecha = ultimaCaucionConVCP;
    } else if (caucionCutoffMode === 'auto') {
      cutoffFecha = caucionesActivasHoy.length > 0 ? hoyDate : ultimaCaucionFecha;
    } else if (caucionCutoffMode === 'all') {
      cutoffFecha = null; // Usar todas las cauciones históricas
    }

    // Para 'last-complete': seleccionar directamente la última caución con VCP completo
    // sin filtrar por fecha (evita duplicación cuando se rollea deuda en fechas contiguas)
    let caucionesVigentes;
    if (caucionCutoffMode === 'last-complete') {
      const completeCauciones = caucionesFiltered
        .filter(c => tieneVCPCompleto(c))
        .sort((a, b) => {
          const fa = parseDate(a.fecha_fin);
          const fb = parseDate(b.fecha_fin);
          return (fb?.getTime() || 0) - (fa?.getTime() || 0); // DESC por fecha_fin
        });
      caucionesVigentes = completeCauciones.length > 0 ? [completeCauciones[0]] : [];
    } else if (cutoffFecha) {
      caucionesVigentes = caucionesFiltered.filter(c => {
        const fechaInicio = parseDate(c.fecha_inicio);
        const fechaFin = parseDate(c.fecha_fin);
        if (!fechaInicio || !fechaFin) return false;
        return fechaInicio <= cutoffFecha && fechaFin >= cutoffFecha;
      });
    } else {
      caucionesVigentes = caucionesFiltered;
    }

    const totalCaucion = caucionesVigentes.reduce((sum, c) => {
      return sum.plus(new Decimal(c.capital || 0));
    }, new Decimal(0));

    // =========================================================================
    // 2. SALDO FCI
    // =========================================================================
    const saldoFCI = new Decimal(fciEngine.totals.valuation || 0);

    // =========================================================================
    // 3. FCI MÍNIMO Y ÓPTIMO (CORREGIDO)
    // =========================================================================
    // FCI Mínimo = 1:1 con caución (cobertura total)
    const fciMinimo = totalCaucion;
    // FCI Óptimo = con colchón 15% adicional
    const fciOptimo = totalCaucion.times(new Decimal('1.15'));

    // =========================================================================
    // 4. RATIO COBERTURA (CORREGIDO)
    // =========================================================================
    // Ratio = (Saldo FCI / Total Caución) * 100
    const ratioCobertura = totalCaucion.gt(0)
      ? saldoFCI.dividedBy(totalCaucion).times(100)
      : new Decimal(0);

    // =========================================================================
    // 5. DÉFICIT
    // =========================================================================
    const deficitMinimo = Decimal.max(0, fciMinimo.minus(saldoFCI));
    const deficitOptimo = Decimal.max(0, fciOptimo.minus(saldoFCI));

    // =========================================================================
    // 6. CAPITAL PRODUCTIVO / IMPRODUCTIVO
    // =========================================================================
    // Capital productivo = min(saldo FCI, total caución) - lo que está generando carry
    const capitalProductivo = Decimal.min(saldoFCI, totalCaucion);
    // Capital improductivo = caución no cubierta por FCI
    const capitalImproductivo = Decimal.max(0, totalCaucion.minus(saldoFCI));

    // Porcentajes
    const pctProductivo = totalCaucion.gt(0)
      ? capitalProductivo.dividedBy(totalCaucion).times(100)
      : new Decimal(0);
    const pctImproductivo = totalCaucion.gt(0)
      ? capitalImproductivo.dividedBy(totalCaucion).times(100)
      : new Decimal(0);

    // =========================================================================
    // 7. TNA CAUCIÓN PROMEDIO PONDERADA (solo cauciones vigentes)
    // =========================================================================
    // Ponderado por capital×días - SOLO cauciones vigentes
    const tnaCaucionPonderada = totalCaucion.gt(0)
      ? (() => {
        const { numerator, denominator } = caucionesVigentes.reduce((acc, c) => {
          const capital = new Decimal(c.capital || 0);
          const tna = new Decimal(c.tna_real || 0).dividedBy(100); // Convertir de % a decimal
          const dias = new Decimal(c.dias || 1);
          return {
            numerator: acc.numerator.plus(capital.times(tna).times(dias)),
            denominator: acc.denominator.plus(capital.times(dias)),
          };
        }, { numerator: new Decimal(0), denominator: new Decimal(0) });
        return denominator.gt(0) ? numerator.dividedBy(denominator) : new Decimal(0);
      })()
      : new Decimal(0);

    // TNA promedio simple (para referencia) - SOLO cauciones vigentes
    const tnaCaucionPromedio = caucionesVigentes.length > 0
      ? caucionesVigentes.reduce((sum, c) => sum.plus(new Decimal(c.tna_real || 0)), new Decimal(0))
        .dividedBy(caucionesVigentes.length)
        .dividedBy(100) // Convertir de % a decimal
      : new Decimal(0);

    // =========================================================================
    // 8. BUFFER DE TASA
    // =========================================================================
    // Buffer = TNA FCI - TNA Caución Promedio (tnaFCIDec ya calculado al principio)
    const bufferTasa = tnaFCIDec.minus(tnaCaucionPonderada);

    // =========================================================================
    // 9. CARRY PERDIDO
    // =========================================================================
    // Carry perdido = capital improductivo * buffer de tasa
    const carryPerdidoDia = capitalImproductivo.times(bufferTasa).dividedBy(365);
    const carryPerdidoAnual = carryPerdidoDia.times(365);

    // =========================================================================
    // 9b. GANANCIA DIARIA DEL CAPITAL PRODUCTIVO
    // =========================================================================
    // Ganancia del capital productivo = capitalProductivo * spread / 365
    const gananciaProductivaDia = capitalProductivo.times(bufferTasa).dividedBy(365);

    // =========================================================================
    // 10. SPREAD NETO DIARIO
    // =========================================================================
    // Ganancia FCI por día = saldo FCI * (TNA FCI / 365)
    const gananciaFCIDia = saldoFCI.times(tnaFCIDec).dividedBy(365);

    // Costo caución por día (suma de TODAS las cauciones vigentes)
    const costoCaucionDia = caucionesVigentes.reduce((sum, c) => {
      const interesDiario = new Decimal(c.interes || 0).dividedBy(c.dias || 1);
      return sum.plus(interesDiario);
    }, new Decimal(0));

    // Spread neto diario
    const spreadNetoDia = gananciaFCIDia.minus(costoCaucionDia);

    // ROE Caución (anualizado sobre capital de caución)
    const roeCaucion = totalCaucion.gt(0)
      ? spreadNetoDia.times(365).dividedBy(totalCaucion).times(100)
      : new Decimal(0);

    // =========================================================================
    // 11. SPREAD ACUMULADO (HISTÓRICO) — por caución individual con VCP real
    // =========================================================================
    // Cada caución se evalúa contra el rendimiento real del FCI en su rango de fechas.
    // Cauciones vencidas: VCP real inicio→fin.
    // Cauciones activas: tramo real (inicio→hoy) + proyección con TNA MA-7d (hoy→fin).
    const spreadsPorCaucion = caucionesFiltered.map(c => {
      const resultado = calcularSpreadLib(c, vcpPrices, tnaFCIDec.toNumber(), hoy, saldoFCI.toNumber());
      // Convertir del formato nuevo al formato legacy esperado por el resto del hook
      return resultado ? {
        'spread_$': resultado.spreadPesos,
        'spread_%': resultado.spreadPorcentaje,
        'ganancia_fci_$': resultado.gananciaFCITotal,
      } : null;
    });

    // Detectar cauciones sin VCP completo (spread = null)
    const caucionesSinVCP = spreadsPorCaucion.filter(s => s === null).length;
    const caucionesConVCP = spreadsPorCaucion.filter(s => s !== null).length;

    const spreadAcumulado = spreadsPorCaucion.reduce((sum, s) => {
      if (s === null) return sum;
      return sum.plus(new Decimal(s['spread_$']));
    }, new Decimal(0));

    // Spread promedio ponderado por capital
    const { capitalConDatos, spreadPonderadoSum } = caucionesFiltered.reduce((acc, c, idx) => {
      const s = spreadsPorCaucion[idx];
      if (s === null) return acc;
      const cap = new Decimal(c.capital || 0);
      return {
        capitalConDatos: acc.capitalConDatos.plus(cap),
        spreadPonderadoSum: acc.spreadPonderadoSum.plus(cap.times(s['spread_%'])),
      };
    }, { capitalConDatos: new Decimal(0), spreadPonderadoSum: new Decimal(0) });

    const spreadPromedioPorc = capitalConDatos.gt(0)
      ? spreadPonderadoSum.dividedBy(capitalConDatos)
      : new Decimal(0);

    // =========================================================================
    // 13. PROYECCIONES DE SPREAD
    // =========================================================================
    // Proyecciones mensual y anual basadas en spread diario
    const spreadMensualProyectado = spreadNetoDia.times(30);
    const spreadAnualProyectado = spreadNetoDia.times(365);

    // =========================================================================
    // 14. COSTO POR NO ALCANZAR COBERTURA ÓPTIMA
    // =========================================================================
    // Costo diario y anual por no tener cobertura óptima (115%)
    const costoNoOptimoDia = deficitOptimo.gt(0)
      ? deficitOptimo.times(bufferTasa).dividedBy(365)
      : new Decimal(0);
    const costoNoOptimoAnual = costoNoOptimoDia.times(365);

    // =========================================================================
    // 15. CLASIFICACIONES
    // =========================================================================
    const estadoCobertura =
      ratioCobertura.gte(115) ? 'sobrecapitalizado' :
        ratioCobertura.gte(100) ? 'optimo' :
          ratioCobertura.gte(90) ? 'ajustado' : 'deficit';

    const bufferPct = bufferTasa.times(100).toNumber();
    const estadoBuffer =
      bufferPct > 8 ? 'amplio' :
        bufferPct > 4 ? 'medio' :
          bufferPct > 2 ? 'estrecho' : 'critico';

    // =========================================================================
    // 14. DÍAS PROMEDIO CAUCIÓN
    // =========================================================================
    const diasPromedio = caucionesVigentes.length > 0
      ? caucionesVigentes.reduce((sum, c) => sum + (c.dias || 0), 0) / caucionesVigentes.length
      : 0;

    // =========================================================================
    // 15. METADATA DE CAUCIONES (para UX mejorada)
    // =========================================================================
    const metadata = {
      tieneCaucionesHistoricas: caucionesFiltered.length > 0,
      todasVencidas: caucionesFiltered.length > 0 && caucionesActivasHoy.length === 0,
      ultimaCaucionFecha,
      ultimaCaucionConVCP,
      cutoffFecha,
      cutoffMode: caucionCutoffMode,
      caucionesVencidas: caucionesFiltered.length - caucionesVigentes.length,
      totalCaucionesHistoricas: caucionesFiltered.length,
      totalCaucionesOriginal: cauciones.length,
      dataStartDate: dataStartDate || null,
      // Información de VCP incompleto
      spreadIncompleto: caucionesSinVCP > 0,
      caucionesSinVCP,
      caucionesConVCP,
    };

    // =========================================================================
    // RETURN - Convertir todo a Number para UI
    // =========================================================================
    return {
      // Balances
      totalCaucion: totalCaucion.toNumber(),
      saldoFCI: saldoFCI.toNumber(),
      caucionesVigentes: caucionesVigentes.length,

      // FCI Targets
      fciMinimo: fciMinimo.toNumber(),
      fciOptimo: fciOptimo.toNumber(),

      // Cobertura
      ratioCobertura: ratioCobertura.toNumber(),
      estadoCobertura,
      deficitMinimo: deficitMinimo.toNumber(),
      deficitOptimo: deficitOptimo.toNumber(),

      // Capital
      capitalProductivo: capitalProductivo.toNumber(),
      capitalImproductivo: capitalImproductivo.toNumber(),
      pctProductivo: pctProductivo.toNumber(),
      pctImproductivo: pctImproductivo.toNumber(),

      // Tasas
      tnaFCI: tnaFCIDec.toNumber(),
      tnaCaucionPromedio: tnaCaucionPromedio.toNumber(),
      tnaCaucionPonderada: tnaCaucionPonderada.toNumber(),
      bufferTasa: bufferTasa.toNumber(),
      bufferTasaPct: bufferPct,
      estadoBuffer,

      // Performance
      gananciaFCIDia: gananciaFCIDia.toNumber(),
      costoCaucionDia: costoCaucionDia.toNumber(),
      spreadNetoDia: spreadNetoDia.toNumber(),
      spreadMensualProyectado: spreadMensualProyectado.toNumber(),
      spreadAnualProyectado: spreadAnualProyectado.toNumber(),
      roeCaucion: roeCaucion.toNumber(),
      carryPerdidoDia: carryPerdidoDia.toNumber(),
      carryPerdidoAnual: carryPerdidoAnual.toNumber(),
      gananciaProductivaDia: gananciaProductivaDia.toNumber(),
      spreadAcumulado: spreadAcumulado.toNumber(),
      spreadPromedioPorc: spreadPromedioPorc.toNumber(),
      costoNoOptimoDia: costoNoOptimoDia.toNumber(),
      costoNoOptimoAnual: costoNoOptimoAnual.toNumber(),

      // Metadata
      diasPromedio,
      totalOperaciones: caucionesFiltered.length,
      ultimaActualizacion: new Date().toISOString(),
      metadata,
    };
  }, [cauciones, fciEngine, tnaFCI, caucionCutoffMode, vcpPrices, dataStartDate]);
}

export default useCarryMetrics;
