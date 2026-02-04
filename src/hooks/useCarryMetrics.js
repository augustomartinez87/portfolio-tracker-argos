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
export function useCarryMetrics({ cauciones, fciEngine, tnaFCI }) {
  return useMemo(() => {
    if (!cauciones?.length || !fciEngine?.totals) {
      return null;
    }

    const hoy = new Date();

    // =========================================================================
    // 1. TOTAL CAUCIÓN ACTIVA (solo cauciones vigentes)
    // =========================================================================
    const caucionesVigentes = cauciones.filter(c => {
      const fechaFin = new Date(c.fecha_fin);
      return fechaFin >= hoy;
    });

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
    // 11. SPREAD ACUMULADO (HISTÓRICO)
    // =========================================================================
    // Suma de (ganancia FCI - costo caución) para cada caución histórica
    // Usa el capital de cada caución como proxy del capital desplegado en FCI
    const spreadAcumulado = cauciones.reduce((sum, c) => {
      const dias = c.dias || 0;
      const capitalCaucion = new Decimal(c.capital || 0);
      const gananciaFCI = capitalCaucion.times(tnaFCIDec).dividedBy(365).times(dias);
      const costoCaucion = new Decimal(c.interes || 0);
      return sum.plus(gananciaFCI.minus(costoCaucion));
    }, new Decimal(0));

    // =========================================================================
    // 12. FULL DEPLOYMENT TEÓRICO
    // =========================================================================
    // Si todo el capital de caución estuviera desplegado en FCI
    const fullDeploymentAcumulado = cauciones.reduce((sum, c) => {
      const dias = c.dias || 0;
      const capitalCaucion = new Decimal(c.capital || 0);
      const gananciaTeórica = capitalCaucion.times(tnaFCIDec).dividedBy(365).times(dias);
      const costoCaucion = new Decimal(c.interes || 0);
      return sum.plus(gananciaTeórica.minus(costoCaucion));
    }, new Decimal(0));

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
    const ultimaCaucionFecha = cauciones.length > 0
      ? cauciones.reduce((max, c) => {
          const fecha = new Date(c.fecha_fin);
          return fecha > max ? fecha : max;
        }, new Date(0))
      : null;

    const metadata = {
      tieneCaucionesHistoricas: cauciones.length > 0,
      todasVencidas: cauciones.length > 0 && caucionesVigentes.length === 0,
      ultimaCaucionFecha,
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
      fullDeploymentAcumulado: fullDeploymentAcumulado.toNumber(),
      costoNoOptimoDia: costoNoOptimoDia.toNumber(),
      costoNoOptimoAnual: costoNoOptimoAnual.toNumber(),

      // Metadata
      diasPromedio,
      totalOperaciones: cauciones.length,
      ultimaActualizacion: new Date().toISOString(),
      metadata,
    };
  }, [cauciones, fciEngine, tnaFCI]);
}

export default useCarryMetrics;
