import { useMemo } from 'react';
import Decimal from 'decimal.js';
import type {
  FundingCycleWithChildren,
  FundingCycleMetrics,
} from '../types';

interface LotValuation {
  lotId: string;
  valuation: number;
  pnl: number;
}

interface FundingCycleEngineParams {
  cyclesWithChildren: FundingCycleWithChildren[];
  /** Map of lot id → current valuation + pnl */
  lotValuations: Record<string, LotValuation>;
  /** TC actual (ARS por USDT), typically MEP rate */
  tcActual: number;
}

export interface FundingCycleEngineResult {
  metrics: FundingCycleMetrics[];
  activeCycles: FundingCycleMetrics[];
  closedCycles: FundingCycleMetrics[];
  totalPnlRealARS: number;
  totalPnlNominalARS: number;
  avgRoiPct: number;
  ciclosActivos: number;
  ciclosCerrados: number;
}

export function useFundingCycleEngine(params: FundingCycleEngineParams): FundingCycleEngineResult {
  const { cyclesWithChildren, lotValuations, tcActual } = params;

  return useMemo(() => {
    const ZERO = new Decimal(0);
    const tc = new Decimal(tcActual || 0);

    const metrics: FundingCycleMetrics[] = cyclesWithChildren.map(({ cycle, loan, conversions, lots }) => {
      // ---- Loan side ----
      const loanOutstanding = new Decimal(loan?.outstanding || 0);
      const loanApr = new Decimal(loan?.interest_rate_apr || 0);
      const costoDiarioUSDT = loanOutstanding.mul(loanApr).div(365);

      // ---- Conversions ----
      let totalConvUSDT = ZERO;
      let totalConvARS = ZERO;
      let primeraFecha: Date | null = null;

      for (const c of conversions) {
        totalConvUSDT = totalConvUSDT.plus(new Decimal(c.from_amount || 0));
        totalConvARS = totalConvARS.plus(new Decimal(c.to_amount || 0));
        const d = new Date(c.event_date);
        if (!primeraFecha || d < primeraFecha) primeraFecha = d;
      }

      const tcPromedio = totalConvUSDT.gt(0)
        ? totalConvARS.div(totalConvUSDT)
        : tc;

      const costoDiarioARS = costoDiarioUSDT.mul(tcPromedio);

      // ---- FCI lots ----
      let totalInvertido = ZERO;
      let totalValuacion = ZERO;

      for (const lot of lots) {
        totalInvertido = totalInvertido.plus(new Decimal(lot.capital_invertido || 0));
        const valEntry = lotValuations[lot.id];
        if (valEntry) {
          totalValuacion = totalValuacion.plus(new Decimal(valEntry.valuation || 0));
        } else {
          // If no valuation available, use invested as fallback
          totalValuacion = totalValuacion.plus(new Decimal(lot.capital_invertido || 0));
        }
      }

      const fciPnl = totalValuacion.minus(totalInvertido);

      // ---- Dias en ciclo ----
      const hoy = new Date();
      const openDate = primeraFecha || new Date(cycle.opened_at);
      const diasEnCiclo = Math.max(1, Math.round((hoy.getTime() - openDate.getTime()) / 86400000));

      // ---- Carry ----
      // Rendimiento FCI diario estimado = FCI PnL / dias
      const rendimientoDiarioARS = diasEnCiclo > 0
        ? fciPnl.div(diasEnCiclo)
        : ZERO;
      const carryDiarioARS = rendimientoDiarioARS.minus(costoDiarioARS);

      // ---- FX exposure ----
      // Solo sobre la porcion convertida, no sobre el outstanding completo del loan
      const exposicionCambiaria = totalConvUSDT.mul(tc.minus(tcPromedio));

      // ---- P&L ----
      const costoAcumuladoARS = costoDiarioARS.mul(diasEnCiclo);
      const pnlNominal = fciPnl.minus(costoAcumuladoARS);
      const pnlReal = pnlNominal.minus(exposicionCambiaria);

      const roiPct = totalConvARS.gt(0)
        ? pnlReal.div(totalConvARS).mul(100)
        : ZERO;

      return {
        cycleId: cycle.id,
        label: cycle.label,
        status: cycle.status as 'active' | 'closed',
        loanOutstandingUSDT: loanOutstanding.toNumber(),
        loanApr: loanApr.toNumber(),
        costoDiarioUSDT: costoDiarioUSDT.toNumber(),
        costoDiarioARS: costoDiarioARS.toNumber(),
        totalConvertidoUSDT: totalConvUSDT.toNumber(),
        totalConvertidoARS: totalConvARS.toNumber(),
        tcPromedio: tcPromedio.toNumber(),
        cantConversiones: conversions.length,
        totalInvertidoARS: totalInvertido.toNumber(),
        totalValuacionARS: totalValuacion.toNumber(),
        fciPnlARS: fciPnl.toNumber(),
        cantLots: lots.length,
        carryDiarioARS: carryDiarioARS.toNumber(),
        exposicionCambiariaARS: exposicionCambiaria.toNumber(),
        pnlNominalARS: pnlNominal.toNumber(),
        pnlRealARS: pnlReal.toNumber(),
        roiPct: roiPct.toNumber(),
        diasEnCiclo,
      };
    });

    const activeCycles = metrics.filter(m => m.status === 'active');
    const closedCycles = metrics.filter(m => m.status === 'closed');

    const totalPnlReal = metrics.reduce((sum, m) => sum + m.pnlRealARS, 0);
    const totalPnlNominal = metrics.reduce((sum, m) => sum + m.pnlNominalARS, 0);

    // ROI ponderado por capital convertido (no promedio simple)
    const totalCapital = metrics.reduce((s, m) => s + m.totalConvertidoARS, 0);
    const avgRoi = totalCapital > 0
      ? metrics.reduce((s, m) => s + m.roiPct * m.totalConvertidoARS, 0) / totalCapital
      : 0;

    return {
      metrics,
      activeCycles,
      closedCycles,
      totalPnlRealARS: totalPnlReal,
      totalPnlNominalARS: totalPnlNominal,
      avgRoiPct: avgRoi,
      ciclosActivos: activeCycles.length,
      ciclosCerrados: closedCycles.length,
    };
  }, [cyclesWithChildren, lotValuations, tcActual]);
}

export default useFundingCycleEngine;
