// src/utils/portfolioHelpers.ts

import type { Position, AssetClass, DistributionDataItem } from '@/types';
import { ASSET_CLASS_COLORS } from './constants';

/**
 * Resultado de calcular la distribución de activos
 */
interface DistributionResult {
  distribution: DistributionDataItem[];
  totalValue: number;
}

/**
 * Agrupa posiciones por asset class y calcula distribución porcentual
 *
 * @param positions - Array de posiciones con assetClass y valuacionActual
 * @returns Objeto con distribución y valor total
 */
export function calculateAssetDistribution(positions: Position[]): DistributionResult {
  // Calcular total del portfolio
  const totalValue = positions.reduce((sum, pos) => sum + (pos.valuacionActual || 0), 0);

  if (totalValue === 0 || !positions.length) {
    return { distribution: [], totalValue: 0 };
  }

  // Agrupar por asset class
  const grouped = positions.reduce<Record<string, { name: AssetClass; value: number; count: number; color: string }>>((acc, pos) => {
    const className = (pos.assetClass || 'OTROS') as AssetClass;

    if (!acc[className]) {
      acc[className] = {
        name: className,
        value: 0,
        count: 0,
        color: ASSET_CLASS_COLORS[className] || ASSET_CLASS_COLORS['OTROS']
      };
    }

    acc[className].value += pos.valuacionActual || 0;
    acc[className].count += 1;

    return acc;
  }, {});

  // Convertir a array y calcular porcentajes
  const distribution: DistributionDataItem[] = Object.values(grouped)
    .map(item => ({
      name: item.name,
      value: item.value,
      percentage: (item.value / totalValue) * 100,
      color: item.color
    }))
    .sort((a, b) => b.value - a.value); // Ordenar de mayor a menor

  return { distribution, totalValue };
}

/**
 * Formatea valor en pesos argentinos (sin decimales)
 * @deprecated Use formatARS from formatters.ts instead
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Formatea porcentaje (1 decimal, sin signo)
 * @deprecated Use formatPercent from formatters.ts for signed percentages
 */
export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${value.toFixed(1)}%`;
}

/**
 * Calcula el costo promedio ponderado de un conjunto de trades
 */
export function calculateWeightedAvgCost(
  trades: { quantity: number; price: number }[]
): number {
  const buys = trades.filter(t => t.quantity > 0);
  if (buys.length === 0) return 0;

  const totalQty = buys.reduce((sum, t) => sum + t.quantity, 0);
  const totalCost = buys.reduce((sum, t) => sum + t.quantity * t.price, 0);

  return totalQty > 0 ? totalCost / totalQty : 0;
}

/**
 * Calcula P&L de una posición
 */
export function calculatePnL(
  quantity: number,
  avgCost: number,
  currentPrice: number
): { result: number; resultPct: number } {
  const invested = quantity * avgCost;
  const currentValue = quantity * currentPrice;
  const result = currentValue - invested;
  const resultPct = invested > 0 ? (result / invested) * 100 : 0;

  return { result, resultPct };
}
