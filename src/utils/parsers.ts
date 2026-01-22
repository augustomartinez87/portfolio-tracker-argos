// src/utils/parsers.ts

/**
 * Parsea un string con formato ARS a número
 * Maneja formatos como "$1.234.567,89", "1234567.89", "1.234,56"
 *
 * @example parseARSNumber("$1.234.567,89") => 1234567.89
 * @example parseARSNumber("1234.56") => 1234.56
 */
export const parseARSNumber = (str: string | number | null | undefined): number => {
  if (!str) return 0;

  const cleaned = str.toString()
    .replace(/\$/g, '')     // Quitar símbolo $
    .replace(/\s/g, '')     // Quitar espacios
    .replace(/\./g, '')     // Quitar separadores de miles (puntos)
    .replace(/,/g, '.');    // Convertir coma decimal a punto

  return parseFloat(cleaned) || 0;
};

/**
 * Parsea una fecha en formato DD/MM/YY o DD/MM/YYYY a ISO string (YYYY-MM-DD)
 *
 * @example parseDateDMY("23/12/24") => "2024-12-23"
 * @example parseDateDMY("23/12/2024") => "2024-12-23"
 * @returns ISO date string o null si es inválida
 */
export const parseDateDMY = (str: string | null | undefined): string | null => {
  if (!str) return null;

  const parts = str.split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);

  // Validar que sean números
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  // Validar rangos básicos
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Años de 2 dígitos: 00-50 = 2000-2050, 51-99 = 1951-1999
  if (year < 100) {
    year = year <= 50 ? 2000 + year : 1900 + year;
  }

  // Construir ISO string
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Validar que la fecha sea válida creando un Date object
  const testDate = new Date(dateStr);
  if (isNaN(testDate.getTime())) return null;

  // Verificar que el día realmente existe en ese mes
  // (ej: 31/02/2024 crearía un Date válido pero con día incorrecto)
  if (testDate.getUTCDate() !== day) return null;

  return dateStr;
};

/**
 * Parsea un string de fecha ISO a objeto Date
 *
 * @example parseISODate("2024-12-23") => Date object
 */
export const parseISODate = (str: string | null | undefined): Date | null => {
  if (!str) return null;

  const date = new Date(str);
  if (isNaN(date.getTime())) return null;

  return date;
};

/**
 * Valida formato de email básico
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida que un ticker tenga formato válido (1-10 caracteres alfanuméricos)
 */
export const isValidTicker = (ticker: string): boolean => {
  return /^[A-Z0-9]{1,10}$/i.test(ticker);
};

/**
 * Sanitiza un ticker (mayúsculas, sin espacios)
 */
export const sanitizeTicker = (ticker: string): string => {
  return ticker.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
};
