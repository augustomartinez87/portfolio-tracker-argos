// src/utils/formatters.ts

/**
 * Formatea un número como moneda ARS (pesos argentinos)
 * @example formatARS(1234567.89) => "$ 1.234.567,89"
 */
export const formatARS = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return `$ ${formatted}`;
};

/**
 * Formatea un número como moneda USD (dólares estadounidenses)
 * @example formatUSD(1234.56) => "US$ 1,234.56"
 */
export const formatUSD = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return `US$ ${formatted}`;
};

/**
 * Formatea un numero como moneda USDT (formato argentino)
 * @example formatUSDT(1234.56) => "USDT 1.234,56"
 */
export const formatUSDT = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return `USDT ${formatted}`;
};

/**
 * Formatea un número como porcentaje con signo
 * @example formatPercent(5.25) => "+5.25%"
 * @example formatPercent(-3.14) => "-3.14%"
 */
export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const sign = value >= 0 ? '+' : '';
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return `${sign}${formatted}%`;
};

/**
 * Formatea un número con separadores de miles
 * @example formatNumber(1234567, 0) => "1.234.567"
 * @example formatNumber(1234.5678, 2) => "1.234,57"
 */
export const formatNumber = (value: number | null | undefined, decimals = 0): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

/**
 * Formatea una fecha en formato argentino DD/MM/AAAA
 * @param date - Fecha a formatear (Date, string ISO, o undefined)
 * @returns string en formato DD/MM/AAAA
 * @example formatDateAR('2024-01-15') => '15/01/2024'
 */
export const formatDateAR = (date: Date | string | null | undefined): string => {
  if (!date) return '';

  // Fast path: if it's a YYYY-MM-DD string, parse directly to avoid UTC/timezone issues.
  // new Date("2026-02-27") is interpreted as UTC midnight, which in UTC-3 becomes the
  // previous day. Parsing components directly avoids this entirely.
  if (typeof date === 'string') {
    const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';

  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
};

/**
 * Convierte una fecha a string ISO (YYYY-MM-DD)
 * Reemplaza el patrón .toISOString().split('T')[0]
 * @param date - Fecha a convertir (por defecto hoy)
 * @returns string en formato YYYY-MM-DD
 * @example toDateString(new Date('2024-01-15')) => '2024-01-15'
 */
export const toDateString = (date: Date = new Date()): string => {
  // toISOString() returns UTC, so after 21:00 AR time it would return the next day.
  // Use local date methods instead.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Formatea un número en formato compacto (K, M) con locale es-AR
 * @example formatCompactNumber(1234567) => "1,2M"
 * @example formatCompactNumber(12345) => "12,3K"
 * @example formatCompactNumber(123) => "123"
 */
export const formatCompactNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  if (value >= 1000000) {
    return formatNumber(value / 1000000, 1) + 'M';
  }
  if (value >= 1000) {
    return formatNumber(value / 1000, 1) + 'K';
  }
  return formatNumber(value, 0);
};

/**
 * Formatea un porcentaje sin signo (para uso en contextos no-PnL)
 * @example formatPercentNoSign(5.25) => "5,25%"
 * @example formatPercentNoSign(0) => "0,00%"
 */
export const formatPercentNoSign = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return `${formatted}%`;
};
