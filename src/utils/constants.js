// src/utils/constants.js
export const CONSTANTS = {
  MEP_DEFAULT: 1467,
  PRICE_CACHE_TTL: 5 * 60 * 1000, // 5 minutos
  REFRESH_INTERVAL: 30 * 1000, // 30 segundos
  HISTORICAL_DAYS_DEFAULT: 90,
};

export const API_ENDPOINTS = {
  MEP: 'https://data912.com/live/mep',
  ARG_STOCKS: 'https://data912.com/live/arg_stocks',
  ARG_CEDEARs: 'https://data912.com/live/arg_cedears',
  ARG_BONDS: 'https://data912.com/live/arg_bonds',
  HISTORICAL_STOCKS: 'https://data912.com/historical/stocks',
  HISTORICAL_BONDS: 'https://data912.com/historical/bonds',
};
