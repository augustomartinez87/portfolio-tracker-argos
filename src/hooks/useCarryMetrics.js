import { useMemo } from 'react';
import Decimal from 'decimal.js';

/**
 * Hook para calcular métricas de carry trade
 *
 * @param {Object} params
 * @param {Array} params.cauciones - Cauciones desde Supabase (con campos: capital, interes, dias, tna_real, fecha_inicio, fecha_fin)
 * @param {Object} params.fciEngine - Resultado de useFciEngine() con totals.valuation
 * @param {number} params.tnaFCI - TNA del FCI como decimal (ej: 0.284849 para 28.48%)
 * @returns {Object|null} Métricas de carry trade o null si no hay datos suficientes
 */
/**
 * Busca el último VCP con fecha <= fechaObjetivo en un array ordenado ascendente.
 * Retorna el registro o null si no existe.
 */
function buscarVcpAnteriorOIgual(vcpPrices, fechaObjetivo) {
  let resultado = null;
  for (const p of vcpPrices) {
    if (p.fecha <= fechaObjetivo) {
      resultado = p;
    } else {
      break; // array ordenado ascendente, ya no hay más <= fechaObjetivo
    }
  }
  return resultado;
}

/**
 * Calcula el spread de una caución individual contra el rendimiento real del FCI.
 *
 * - Cauciones vencidas: usa VCP real en fecha_inicio y fecha_fin.
 * - Cauciones activas: tramo real (inicio→hoy) + tramo proyectado (hoy→fin) con tnaMA7.
 *
 * @returns {{ spread_$: number, spread_%: number, ganancia_fci_$: number }} | null si no hay datos suficientes
 */
function calcularSpreadPorCaucion(caucion, vcpPrices, tnaMA7, hoy) {
  if (!vcpPrices || vcpPrices.length === 0) return null;

  const capital = new Decimal(caucion.capital || 0);
  const interes = new Decimal(caucion.interes || 0);
  if (capital.isZero()) return null;

  const fechaInicio = String(caucion.fecha_inicio).split('T')[0];
  const fechaFin = String(caucion.fecha_fin).split('T')[0];
  const fechaHoy = hoy.toISOString().split('T')[0];

  const vcpInicio = buscarVcpAnteriorOIgual(vcpPrices, fechaInicio);
  if (!vcpInicio || new Decimal(vcpInicio.vcp || 0).isZero()) return null;

  const vcpInicioDec = new Decimal(vcpInicio.vcp);
  const esVencida = fechaFin < fechaHoy;

  if (esVencida) {
    // Caución vencida: solo datos reales
    const vcpFin = buscarVcpAnteriorOIgual(vcpPrices, fechaFin);
    if (!vcpFin || new Decimal(vcpFin.vcp || 0).isZero()) return null;

    const vcpFinDec = new Decimal(vcpFin.vcp);
    const ratioFci = vcpFinDec.dividedBy(vcpInicioDec);
    const gananciaDolares = capital.times(ratioFci.minus(1));
    const rendimientoPct = ratioFci.minus(1);
    const costoPct = interes.dividedBy(capital);

    return {
      'spread_$': gananciaDolares.minus(interes).toNumber(),
      'spread_%': rendimientoPct.minus(costoPct).toNumber(),
      'ganancia_fci_$': gananciaDolares.toNumber(),
    };
  } else {
    // Caución activa: tramo real + tramo proyectado
    // a) Tramo real: fecha_inicio → hoy
    const vcpHoy = vcpPrices[vcpPrices.length - 1]; // último precio disponible
    if (!vcpHoy || new Decimal(vcpHoy.vcp || 0).isZero()) return null;

    const vcpHoyDec = new Decimal(vcpHoy.vcp);
    const ratioReal = vcpHoyDec.dividedBy(vcpInicioDec);
    const gananciaDolaresReal = capital.times(ratioReal.minus(1));

    // b) Tramo proyectado: hoy → fecha_fin
    const diasRestantes = Math.round(
      (new Date(fechaFin) - new Date(fechaHoy)) / (1000 * 60 * 60 * 24)
    );
    let gananciaDolaresProy = new Decimal(0);
    if (diasRestantes > 0 && tnaMA7 > 0) {
      const tasaDiaria = new Decimal(1 + tnaMA7).pow(new Decimal(1).dividedBy(365)).minus(1);
      const ratioProy = new Decimal(1).plus(tasaDiaria).pow(diasRestantes);
      gananciaDolaresProy = capital.times(ratioProy.minus(1));
    }

    // c) Total
    const gananciaDolaresTotal = gananciaDolaresReal.plus(gananciaDolaresProy);
    const rendimientoPct = gananciaDolaresTotal.dividedBy(capital);
    const costoPct = interes.dividedBy(capital);

    return {
      'spread_$': gananciaDolaresTotal.minus(interes).toNumber(),
      'spread_%': rendimientoPct.minus(costoPct).toNumber(),
      'ganancia_fci_$': gananciaDolaresTotal.toNumber(),
    };
  }
}

export function useCarryMetrics({ cauciones, fciEngine, tnaFCI, caucionCutoffMode = 'auto', vcpPrices = [] }) {
  return useMemo(() => {
    if (!cauciones?.length || !fciEngine?.totals) {
      return null;
    }

    const hoy = new Date();
    const hoyDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

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

    // =========================================================================
    // 1. TOTAL CAUCIÓN ACTIVA (solo cauciones vigentes)
    // =========================================================================
    const caucionesActivasHoy = cauciones.filter(c => {
      const fechaInicio = parseDate(c.fecha_inicio);
      const fechaFin = parseDate(c.fecha_fin);
      if (!fechaInicio || !fechaFin) return false;
      return fechaInicio <= hoyDate && fechaFin >= hoyDate;
    });

    const ultimaCaucionFecha = cauciones.length > 0
      ? cauciones.reduce((max, c) => {
          const fecha = parseDate(c.fecha_fin);
          if (!fecha) return max;
          return !max || fecha > max ? fecha : max;
        }, null)
      : null;

    let cutoffFecha = null;
    if (caucionCutoffMode === 'today') {
      cutoffFecha = hoyDate;
    } else if (caucionCutoffMode === 'last') {
      cutoffFecha = ultimaCaucionFecha;
    } else if (caucionCutoffMode === 'auto') {
      cutoffFecha = caucionesActivasHoy.length > 0 ? hoyDate : ultimaCaucionFecha;
    }

    const caucionesVigentes = cutoffFecha
      ? cauciones.filter(c => {
          const fechaInicio = parseDate(c.fecha_inicio);
          const fechaFin = parseDate(c.fecha_fin);
          if (!fechaInicio || !fechaFin) return false;
          return fechaInicio <= cutoffFecha && fechaFin >= cutoffFecha;
        })
      : cauciones;

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
    // Buffer = TNA FCI - TNA Caución Promedio
    const tnaFCIDec = new Decimal(tnaFCI || 0);
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
    const spreadsPorCaucion = cauciones.map(c => calcularSpreadPorCaucion(c, vcpPrices, tnaFCIDec.toNumber(), hoy));

    const spreadAcumulado = spreadsPorCaucion.reduce((sum, s) => {
      if (s === null) return sum;
      return sum.plus(new Decimal(s['spread_$']));
    }, new Decimal(0));

    // Spread promedio ponderado por capital
    const { capitalConDatos, spreadPonderadoSum } = cauciones.reduce((acc, c, idx) => {
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
      tieneCaucionesHistoricas: cauciones.length > 0,
      todasVencidas: cauciones.length > 0 && caucionesActivasHoy.length === 0,
      ultimaCaucionFecha,
      cutoffFecha,
      cutoffMode: caucionCutoffMode,
      caucionesVencidas: cauciones.length - caucionesVigentes.length,
      totalCaucionesHistoricas: cauciones.length,
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
      totalOperaciones: cauciones.length,
      ultimaActualizacion: new Date().toISOString(),
      metadata,
    };
  }, [cauciones, fciEngine, tnaFCI, caucionCutoffMode, vcpPrices]);
}

export default useCarryMetrics;
