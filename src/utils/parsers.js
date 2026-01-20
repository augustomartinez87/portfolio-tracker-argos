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
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return str;
};