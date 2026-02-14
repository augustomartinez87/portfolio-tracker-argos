import { useMemo } from 'react';
import Decimal from 'decimal.js';
import type { NexoLoan, ConversionEvent } from '../types';

interface FciPosition {
  fciId: string;
  name: string;
  valuation: number;
  capitalInvertido: number;
  pnlAcumulado: number;
  pnlDiario: number;
  quantity: number;
  vcpActual: number;
  priceDate: string | null;
}

interface FciTotals {
  invested: number;
  valuation: number;
  pnl: number;
  pnlPct: number;
}

interface CryptoFundingParams {
  /** Prestamos Nexo activos */
  loans: NexoLoan[];
  /** Precios de colateral: { bitcoin: 97000 } */
  collateralPrices: Record<string, number>;
  /** Posiciones FCI (del fciLotEngine) */
  fciPositions: FciPosition[];
  /** Totales FCI */
  fciTotals: FciTotals;
  /** TNA del FCI principal (como decimal, ej 0.35 = 35%) */
  tnaFci: number;
  /** Conversiones USDT→ARS */
  conversions: ConversionEvent[];
  /** MEP rate actual (ARS por USD) - fallback si no hay tcUsdtArs */
  mepRate: number;
  /** TC USDT/ARS real de CriptoYa (ask = costo de recompra) */
  tcUsdtArs?: { ask: number; bid: number; mid: number } | null;
}

export interface CryptoFundingResult {
  // ---- Lado Costo (Nexo) ----
  totalOutstandingUSDT: number;
  totalCollateralUSDT: number;
  ltvPonderado: number;
  aprPromedio: number;            // APR ponderado por outstanding
  costoDiarioUSDT: number;        // outstanding * apr / 365
  costoDiarioARS: number;         // costoDiarioUSDT * tcPromedio
  costoAnualUSDT: number;

  // ---- Lado Rendimiento (FCI) ----
  fciValuacionARS: number;
  fciPnlDiarioARS: number;
  fciTnaAnual: number;            // TNA del FCI como decimal
  rendimientoDiarioARS: number;   // fciValuacion * tna / 365

  // ---- Carry Spread ----
  carrySpreadDiarioARS: number;   // rendimiento - costo (en ARS)
  carrySpreadAnualPct: number;    // (tna_fci - apr_nexo_ajustado) como %
  carryPositivo: boolean;

  // ---- Conversiones ----
  totalConvertidoUSDT: number;
  totalConvertidoARS: number;
  tcPromedioConversiones: number; // TC promedio ponderado de conversiones
  cantidadConversiones: number;

  // ---- Riesgo Cambiario ----
  tcActual: number;                // TC actual (dolar MEP como proxy)
  variacionTCPct: number;          // % cambio TC: (actual - promedio) / promedio * 100
  costoRecompraARS: number;        // outstanding * tcActual: cuanto costaria recomprar USDT hoy
  exposicionCambiariaARS: number;  // outstanding * (tcActual - tcPromedio): ganancia/perdida cambiaria
                                   // positivo = TC subio = perdida (necesitas mas ARS para devolver)

  // ---- Ciclo completo ----
  /** P&L nominal del ciclo = ganancia FCI - costo acumulado Nexo (sin riesgo cambiario) */
  pnlCicloNominalARS: number;
  /** P&L real del ciclo = ganancia FCI - costo intereses - exposicion cambiaria */
  pnlCicloARS: number;
  /** Dias desde la primera conversion */
  diasEnCiclo: number;
  /** ROI real del ciclo = pnlCicloReal / capital convertido */
  roiCicloPct: number;
}

/**
 * Calcula interés compuesto diario (como cobra Nexo).
 * Formula: outstanding × ((1 + apr/365)^dias - 1)
 */
export function calcularInteresCompuesto(
  outstanding: InstanceType<typeof Decimal>,
  apr: InstanceType<typeof Decimal>,
  dias: number
): InstanceType<typeof Decimal> {
  if (outstanding.isZero() || apr.isZero() || dias <= 0) return new Decimal(0);
  const dailyRate = apr.div(365);
  const factor = dailyRate.plus(1).pow(dias);
  return outstanding.mul(factor.minus(1));
}

/**
 * Motor unificado de Funding Crypto.
 *
 * Combina costos de prestamos Nexo con rendimientos de FCI
 * para calcular el carry spread en tiempo real.
 */
export function useCryptoFundingEngine(params: CryptoFundingParams): CryptoFundingResult {
  const {
    loans,
    collateralPrices,
    fciPositions,
    fciTotals,
    tnaFci,
    conversions,
    mepRate,
    tcUsdtArs,
  } = params;

  return useMemo(() => {
    const ZERO = new Decimal(0);

    // ================================================================
    // LADO COSTO: Nexo Loans
    // ================================================================
    let totalOutstanding = ZERO;
    let totalCollateral = ZERO;
    let weightedApr = ZERO; // para calcular APR ponderado

    for (const loan of loans) {
      const out = new Decimal(loan.outstanding || 0);
      const apr = new Decimal(loan.interest_rate_apr || 0);
      const colQty = new Decimal(loan.collateral_quantity || 0);
      const colPrice = new Decimal(collateralPrices[loan.collateral_asset] || 0);

      totalOutstanding = totalOutstanding.plus(out);
      totalCollateral = totalCollateral.plus(colQty.mul(colPrice));
      weightedApr = weightedApr.plus(out.mul(apr));
    }

    const aprPromedio = totalOutstanding.gt(0)
      ? weightedApr.div(totalOutstanding)
      : ZERO;

    const ltvPonderado = totalCollateral.gt(0)
      ? totalOutstanding.div(totalCollateral)
      : ZERO;

    const costoDiarioUSDT = totalOutstanding.mul(aprPromedio).div(365);
    const costoAnualUSDT = totalOutstanding.mul(aprPromedio);

    // ================================================================
    // CONVERSIONES: USDT → ARS
    // ================================================================
    let totalConvUSDT = ZERO;
    let totalConvARS = ZERO;
    let primeraConversionDate: Date | null = null;

    for (const c of conversions) {
      totalConvUSDT = totalConvUSDT.plus(new Decimal(c.from_amount || 0));
      totalConvARS = totalConvARS.plus(new Decimal(c.to_amount || 0));

      const d = new Date(c.event_date);
      if (!primeraConversionDate || d < primeraConversionDate) {
        primeraConversionDate = d;
      }
    }

    const tcPromedio = totalConvUSDT.gt(0)
      ? totalConvARS.div(totalConvUSDT)
      : new Decimal(mepRate || 1);

    // Costo diario en ARS usando TC promedio de conversiones
    const costoDiarioARS = costoDiarioUSDT.mul(tcPromedio);

    // ================================================================
    // LADO RENDIMIENTO: FCI
    // ================================================================
    const fciValuacion = new Decimal(fciTotals?.valuation || 0);
    const fciPnlDiario = new Decimal(
      fciPositions.reduce((sum, p) => sum + (p.pnlDiario || 0), 0)
    );
    const tna = new Decimal(tnaFci || 0);
    const rendimientoDiarioARS = fciValuacion.mul(tna).div(365);

    // ================================================================
    // CARRY SPREAD
    // ================================================================
    const carryDiarioARS = rendimientoDiarioARS.minus(costoDiarioARS);
    const carryPositivo = carryDiarioARS.gte(0);

    // Spread anualizado: TNA_FCI - APR_Nexo (ajustado a ARS)
    // Simplificacion: si ambos estan en terminos anuales, el spread es la diferencia
    // En realidad el APR Nexo esta en USDT y la TNA FCI en ARS, pero al estar
    // el ciclo cerrado (USDT→ARS→FCI), se puede comparar directamente
    const carrySpreadAnual = tna.minus(aprPromedio).mul(100);

    // ================================================================
    // RIESGO CAMBIARIO
    // ================================================================
    // TC actual: usar ask de CriptoYa (costo real de recomprar USDT), fallback a MEP
    const tcActual = new Decimal(tcUsdtArs?.ask || mepRate || 0);

    // Variacion TC: cuanto cambio el dolar desde que vendiste los USDT
    // Positivo = TC subio = necesitas mas ARS para recomprar USDT = malo
    const variacionTC = tcPromedio.gt(0)
      ? tcActual.minus(tcPromedio).div(tcPromedio).mul(100)
      : ZERO;

    // Costo de recompra: cuantos ARS necesitas HOY para comprar outstanding USDT
    const costoRecompra = totalOutstanding.mul(tcActual);

    // Exposicion cambiaria: diferencia entre lo que costaria hoy vs lo que pagaste
    // Solo aplica sobre la porcion convertida (no sobre USDT no convertidos)
    // Si es positivo, el TC subio y perdes (necesitas mas ARS para recomprar)
    // Si es negativo, el TC bajo y ganas
    const exposicionCambiaria = totalConvUSDT.mul(tcActual.minus(tcPromedio));

    // ================================================================
    // P&L DEL CICLO
    // ================================================================
    const fciPnl = new Decimal(fciTotals?.pnl || 0);

    // Dias en ciclo
    const hoy = new Date();
    const diasEnCiclo = primeraConversionDate
      ? Math.max(1, Math.round((hoy.getTime() - primeraConversionDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    // Costo acumulado Nexo con interés compuesto diario
    const costoAcumuladoUSDT = calcularInteresCompuesto(totalOutstanding, aprPromedio, diasEnCiclo);
    const costoAcumuladoARS = costoAcumuladoUSDT.mul(tcPromedio);

    // P&L nominal: FCI ganancia - intereses Nexo (ignora TC)
    const pnlCicloNominal = fciPnl.minus(costoAcumuladoARS);

    // P&L real: FCI ganancia - intereses Nexo - exposicion cambiaria
    // Este es el P&L que realmente importa, porque incluye lo que
    // costaria devolver el prestamo al TC actual
    const pnlCicloReal = fciPnl.minus(costoAcumuladoARS).minus(exposicionCambiaria);

    const roiCiclo = totalConvARS.gt(0)
      ? pnlCicloReal.div(totalConvARS).mul(100)
      : ZERO;

    return {
      // Costo
      totalOutstandingUSDT: totalOutstanding.toNumber(),
      totalCollateralUSDT: totalCollateral.toNumber(),
      ltvPonderado: ltvPonderado.toNumber(),
      aprPromedio: aprPromedio.toNumber(),
      costoDiarioUSDT: costoDiarioUSDT.toNumber(),
      costoDiarioARS: costoDiarioARS.toNumber(),
      costoAnualUSDT: costoAnualUSDT.toNumber(),

      // Rendimiento
      fciValuacionARS: fciValuacion.toNumber(),
      fciPnlDiarioARS: fciPnlDiario.toNumber(),
      fciTnaAnual: tna.toNumber(),
      rendimientoDiarioARS: rendimientoDiarioARS.toNumber(),

      // Carry
      carrySpreadDiarioARS: carryDiarioARS.toNumber(),
      carrySpreadAnualPct: carrySpreadAnual.toNumber(),
      carryPositivo,

      // Conversiones
      totalConvertidoUSDT: totalConvUSDT.toNumber(),
      totalConvertidoARS: totalConvARS.toNumber(),
      tcPromedioConversiones: tcPromedio.toNumber(),
      cantidadConversiones: conversions.length,

      // Riesgo Cambiario
      tcActual: tcActual.toNumber(),
      variacionTCPct: variacionTC.toNumber(),
      costoRecompraARS: costoRecompra.toNumber(),
      exposicionCambiariaARS: exposicionCambiaria.toNumber(),

      // Ciclo
      pnlCicloNominalARS: pnlCicloNominal.toNumber(),
      pnlCicloARS: pnlCicloReal.toNumber(),
      diasEnCiclo,
      roiCicloPct: roiCiclo.toNumber(),
    };
  }, [loans, collateralPrices, fciPositions, fciTotals, tnaFci, conversions, mepRate, tcUsdtArs]);
}

export default useCryptoFundingEngine;
