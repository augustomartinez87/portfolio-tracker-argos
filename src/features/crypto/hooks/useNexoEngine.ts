import { useMemo } from 'react';
import Decimal from 'decimal.js';
import type { NexoLoan, LoanMetrics, NexoEngineResult } from '../types';

/**
 * Motor de calculo en tiempo real para prestamos Nexo.
 *
 * Dado un array de loans y el precio actual del colateral (en USDT),
 * calcula LTV real, costo diario, distancia a margin call, etc.
 *
 * @param loans - Prestamos activos desde nexoLoanService
 * @param collateralPrices - Map de coingecko_id → precio USDT (ej: { bitcoin: 97500 })
 */
export function useNexoEngine(
  loans: NexoLoan[],
  collateralPrices: Record<string, number>
): NexoEngineResult {
  return useMemo(() => {
    if (!loans || loans.length === 0) {
      return {
        loans: [],
        totalOutstanding: 0,
        totalCollateralUSDT: 0,
        ltvPonderado: 0,
        dailyCostTotal: 0,
        annualCostTotal: 0,
        worstRiskLevel: 'safe' as const,
      };
    }

    let totalOutstanding = new Decimal(0);
    let totalCollateral = new Decimal(0);
    let totalDailyCost = new Decimal(0);
    let worstRisk: 'safe' | 'warning' | 'danger' = 'safe';

    const loanMetrics: LoanMetrics[] = loans.map((loan) => {
      const outstanding = new Decimal(loan.outstanding || 0);
      const apr = new Decimal(loan.interest_rate_apr || 0);
      const collateralQty = new Decimal(loan.collateral_quantity || 0);
      const collateralPrice = new Decimal(
        collateralPrices[loan.collateral_asset] || 0
      );
      const ltvWarning = new Decimal(loan.ltv_warning || 0.65);
      const ltvLiquidation = new Decimal(loan.ltv_liquidation || 0.83);

      // Valor del colateral en USDT
      const collateralValue = collateralQty.mul(collateralPrice);

      // LTV actual = deuda / valor_colateral
      const ltvActual = collateralValue.gt(0)
        ? outstanding.div(collateralValue)
        : new Decimal(outstanding.gt(0) ? 1 : 0);

      // Distancia a thresholds (positivo = todavia seguro, negativo = ya paso)
      const ltvWarningDist = ltvWarning.minus(ltvActual);
      const ltvLiquidationDist = ltvLiquidation.minus(ltvActual);

      // Precio de BTC que dispara cada threshold
      // ltv_threshold = outstanding / (qty * price) → price = outstanding / (qty * ltv_threshold)
      const btcLiquidationPrice = collateralQty.gt(0)
        ? outstanding.div(collateralQty.mul(ltvLiquidation))
        : new Decimal(0);

      const btcWarningPrice = collateralQty.gt(0)
        ? outstanding.div(collateralQty.mul(ltvWarning))
        : new Decimal(0);

      // Costo diario = outstanding * APR / 365
      const dailyCost = outstanding.mul(apr).div(365);

      // Risk level
      let riskLevel: 'safe' | 'warning' | 'danger' = 'safe';
      if (ltvActual.gte(ltvLiquidation)) {
        riskLevel = 'danger';
      } else if (ltvActual.gte(ltvWarning)) {
        riskLevel = 'warning';
      }

      // Track worst risk
      if (riskLevel === 'danger') worstRisk = 'danger';
      else if (riskLevel === 'warning' && worstRisk !== 'danger') worstRisk = 'warning';

      // Acumular totales
      totalOutstanding = totalOutstanding.plus(outstanding);
      totalCollateral = totalCollateral.plus(collateralValue);
      totalDailyCost = totalDailyCost.plus(dailyCost);

      return {
        loan,
        ltvActual: ltvActual.toNumber(),
        ltvWarningDist: ltvWarningDist.toNumber(),
        ltvLiquidationDist: ltvLiquidationDist.toNumber(),
        btcLiquidationPrice: btcLiquidationPrice.toNumber(),
        btcWarningPrice: btcWarningPrice.toNumber(),
        collateralValueUSDT: collateralValue.toNumber(),
        dailyCostUSDT: dailyCost.toNumber(),
        riskLevel,
      };
    });

    // LTV ponderado = total_outstanding / total_collateral
    const ltvPonderado = totalCollateral.gt(0)
      ? totalOutstanding.div(totalCollateral)
      : new Decimal(0);

    return {
      loans: loanMetrics,
      totalOutstanding: totalOutstanding.toNumber(),
      totalCollateralUSDT: totalCollateral.toNumber(),
      ltvPonderado: ltvPonderado.toNumber(),
      dailyCostTotal: totalDailyCost.toNumber(),
      annualCostTotal: totalDailyCost.mul(365).toNumber(),
      worstRiskLevel: worstRisk,
    };
  }, [loans, collateralPrices]);
}

export default useNexoEngine;
