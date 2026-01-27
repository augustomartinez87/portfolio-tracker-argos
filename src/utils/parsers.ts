// src/utils/parsers.ts

/**
 * Parsea un string con formato ARS a número
 * Maneja formatos como "$1.234.567,89", "1234567.89", "1.234,56"
 *
 * @example parseARSNumber("$1.234.567,89") => 1234567.89
 * @example parseARSNumber("1234.56") => 1234.56
 */
export const parseARSNumber = (str: string | number | null | undefined): number => {
  if (str === null || str === undefined || str === '') return 0;

  const s = str.toString().trim();
  if (!s) return 0;

  // 1. Quitar símbolos de moneda y espacios
  let cleaned = s.replace(/[\$\s]/g, '');

  // 2. Heurística para determinar separadores
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > lastDot) {
    // Caso 1: "1.234,56" -> La coma es decimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Caso 2: "1,234.56" o "4.124356"
    if (lastComma === -1) {
      // Si NO hay comas, y solo hay UN punto:
      // ¿Es separador de miles o decimal?
      // "1.234" (miles) vs "1.2345" (decimal)
      // En contextos financieros/CSV, un solo punto suele ser decimal a menos que sea 
      // exactamente 4 dígitos (N.NNN) y estemos seguros de que es miles.
      // Pero para VCP de 6 decimales, es claramente decimal.
      const dotCount = (cleaned.match(/\./g) || []).length;
      if (dotCount > 1) {
        // "1.234.567" -> Todos son miles
        cleaned = cleaned.replace(/\./g, '');
      } else {
        // "4.124356" o "1234.56" -> Es decimal
        // No hacemos nada, parseFloat lo entiende
      }
    } else {
      // "1,234.56" -> El punto es decimal
      cleaned = cleaned.replace(/,/g, '');
    }
  } else {
    // No hay ni puntos ni comas, o son iguales (imposible si lastIndex != -1)
  }

  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
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
