// src/utils/parsers.js

export const parseARSNumber = (str) => {
  if (!str) return 0;
  const cleaned = str.toString()
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  return parseFloat(cleaned) || 0;
};

export const parseDateDMY = (str) => {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    // Validar rangos
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    // Años de 2 dígitos: 00-50 = 2000-2050, 51-99 = 1951-1999
    if (year < 100) {
      year = year <= 50 ? 2000 + year : 1900 + year;
    }

    // Validar que la fecha sea válida creando un Date object
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const testDate = new Date(dateStr);

    // Verificar que la fecha es válida y no es futura
    if (isNaN(testDate.getTime())) return null;

    // Verificar que el día realmente existe en ese mes
    if (testDate.getUTCDate() !== day) return null;

    return dateStr;
  }
  return null;
};