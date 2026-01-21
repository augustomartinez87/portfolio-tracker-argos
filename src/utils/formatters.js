// src/utils/formatters.js
export const formatARS = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  
  if (Math.abs(value) >= 1000000) {
    const formatted = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value / 1000000);
    return `$ ${formatted}M`;
  }
  
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return `$ ${formatted}`;
};

export const formatUSD = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  
  if (Math.abs(value) >= 1000000) {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value / 1000000);
    return `US$ ${formatted}M`;
  }
  
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return `US$ ${formatted}`;
};

export const formatPercent = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

export const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

export const formatDateTime = (date, format = 'time') => {
  if (!date) return '';
  
  const d = new Date(date);
  
  if (format === 'full') {
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  return d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};
