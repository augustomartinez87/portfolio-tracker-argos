// src/utils/portfolioHelpers.js

// Paleta de colores por asset class
export const ASSET_CLASS_COLORS = {
  'CEDEAR': '#10b981',      // emerald-500
  'ARGY': '#3b82f6',        // blue-500
  'BONO HARD DOLLAR': '#f97316',    // orange-500
  'BONOS PESOS': '#8b5cf6', // violet-500
  'OTROS': '#6b7280'        // gray-500
};

/**
 * Agrupa posiciones por asset class y calcula distribución
 * @param {Array} positions - Array de posiciones con assetClass y valuacionActual
 * @returns {Object} { distribution, totalValue }
 */
export function calculateAssetDistribution(positions) {
  // Calcular total del portfolio
  const totalValue = positions.reduce((sum, pos) => sum + (pos.valuacionActual || 0), 0);

  if (totalValue === 0 || !positions.length) {
    return { distribution: [], totalValue: 0 };
  }

  // Agrupar por asset class
  const grouped = positions.reduce((acc, pos) => {
    const className = pos.assetClass || 'OTROS';

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
  const distribution = Object.values(grouped)
    .map(item => ({
      ...item,
      percentage: (item.value / totalValue) * 100
    }))
    .sort((a, b) => b.value - a.value); // Ordenar de mayor a menor

  return { distribution, totalValue };
}

/**
 * Formatea valor en pesos argentinos
 * @param {number} value
 * @returns {string}
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Formatea porcentaje
 * @param {number} value
 * @returns {string}
 */
export function formatPercentage(value) {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${value.toFixed(1)}%`;
}
