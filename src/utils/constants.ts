// src/utils/constants.ts

/**
 * Constantes de la aplicación
 */
export const CONSTANTS = {
  /** Valor por defecto del dólar MEP */
  MEP_DEFAULT: 1467,

  /** Tiempo de vida del cache de precios (5 minutos) */
  PRICE_CACHE_TTL: 5 * 60 * 1000,

  /** Intervalo de refresh de precios (30 segundos) */
  REFRESH_INTERVAL: 30 * 1000,

  /** Días por defecto para históricos */
  HISTORICAL_DAYS_DEFAULT: 90,

  /** Máximo intentos de retry */
  RETRY_MAX_ATTEMPTS: 3,

  /** Delay base para retry (1 segundo) */
  RETRY_BASE_DELAY: 1000,

  /** Rate limit de API (requests por minuto) */
  API_RATE_LIMIT: 120,

  /** Ventana de rate limit (1 minuto) */
  API_RATE_WINDOW: 60 * 1000,
} as const;

/**
 * Endpoints de la API de data912
 */
export const API_ENDPOINTS = {
  /** Base URL */
  BASE: 'https://data912.com',

  /** Precios MEP (bonos + CEDEARs con MEP) */
  MEP: 'https://data912.com/live/mep',

  /** Acciones argentinas */
  ARG_STOCKS: 'https://data912.com/live/arg_stocks',

  /** CEDEARs */
  ARG_CEDEARS: 'https://data912.com/live/arg_cedears',

  /** Bonos argentinos */
  ARG_BONDS: 'https://data912.com/live/arg_bonds',

  /** Obligaciones Negociables (ONs) */
  ARG_CORP: 'https://data912.com/live/arg_corp',

  /** Históricos de acciones/CEDEARs */
  HISTORICAL_STOCKS: 'https://data912.com/historical/stocks',

  /** Históricos de bonos */
  HISTORICAL_BONDS: 'https://data912.com/historical/bonds',

  /** Históricos de CEDEARs */
  HISTORICAL_CEDEARS: 'https://data912.com/historical/cedears',
} as const;

/**
 * Colores por clase de activo
 */
export const ASSET_CLASS_COLORS: Record<string, string> = {
  'CEDEAR': '#10b981',      // success/green
  'ARGY': '#6366f1',        // indigo
  'BONOS PESOS': '#a855f7', // purple
  'BONO HARD DOLLAR': '#f59e0b', // amber
  'ON': '#f59e0b',          // amber (similar a bonos hard dollar)
  'OTROS': '#6b7280',       // gray
} as const;

/**
 * Tickers conocidos de acciones argentinas
 */
export const ARGY_TICKERS = [
  'GGAL', 'YPFD', 'PAMP', 'TXAR', 'ALUA', 'BMA', 'SUPV', 'CEPU', 'EDN',
  'TGSU2', 'TRAN', 'CRES', 'LOMA', 'COME', 'BBAR', 'BYMA', 'MIRG', 'VALO', 'IRSA',
  'METR', 'TECO2', 'TGNO4', 'HARG', 'CADO', 'MORI', 'SEMI', 'BOLT', 'GARO'
] as const;

/**
 * CEDEARs conocidos
 */
export const KNOWN_CEDEARS = [
  'AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA', 'KO', 'DIS', 'INTC',
  'CSCO', 'IBM', 'QCOM', 'AMD', 'PYPL', 'V', 'JPM', 'UNH', 'MA', 'PG', 'HD',
  'NFLX', 'ADBE', 'CRM', 'ABNB', 'COST', 'MELI', 'SPY', 'QQQ', 'BABA', 'NKE',
  'WMT', 'PEP', 'MCD', 'SBUX', 'BA', 'GE', 'F', 'GM', 'X', 'GOLD', 'SLV',
  'VALE', 'PBR', 'EC', 'ABEV', 'BSBR', 'ITUB', 'BBD', 'BBVA', 'SAN', 'TX'
] as const;

/**
 * Patrones de bonos en pesos
 */
export const BONO_PESOS_PATTERNS = [
  /^T[A-Z0-9]{2,5}$/,      // T15E7, TTD26, TX26, etc.
  /^S[0-9]{2}[A-Z][0-9]$/, // S31E5, S24DD, etc.
  /^TTD/,                   // TTD bonds
  /^TTS/,                   // TTS bonds
] as const;

/**
 * Tickers específicos de bonos en pesos
 */
export const BONO_PESOS_TICKERS = [
  'DICP', 'PARP', 'CUAP', 'PR13', 'TC23', 'TO26', 'TY24'
] as const;

/**
 * Patrones de bonos hard dollar
 */
export const BONO_HD_PATTERNS = [
  /^(AL|AE|AN|CO|GD)[0-9]{2}$/,    // AL30, AE38, GD30, etc.
  /^(AL|AE|AN|CO|GD)[0-9]{2}[DC]$/, // AL30D, GD30C, etc.
] as const;

/**
 * Patrones de Obligaciones Negociables (ONs)
 */
export const ON_PATTERNS = {
  ON_PESOS: /O$/,    // Termina en O = pesos
  ON_DOLLAR: /D$/,   // Termina en D = dólares
  ON_CABLE: /C$/,    // Termina en C = cable
} as const;

/**
 * Tickers específicos de bonos hard dollar
 */
export const BONO_HD_TICKERS = [
  'DICA', 'DICY', 'DIED', 'AY24', 'BU24', 'BP26'
] as const;

/**
 * Sufijos de tickers dólar a ignorar
 */
export const DOLLAR_SUFFIXES = [
  'ALUAD', 'GGALD', 'PAMPD', 'CEPAD', 'SUPVD', 'TXARD', 'BBARD', 'BYMAD',
  'COMED', 'CRESD', 'EDND', 'IRSAD', 'LOMAD', 'METRD', 'TECOD', 'TGSUD',
  'TRAND', 'VALOD', 'CEPUD', 'ECOGD', 'TGN4D', 'YPFDD'
] as const;

/**
 * Keys de localStorage
 */
export const STORAGE_KEYS = {
  POSITIONS_TABLE_SETTINGS: 'positionsTableSettings',
  PRICE_CACHE_PREFIX: 'data912_',
  PRICE_PREFIX: 'price_',
} as const;
