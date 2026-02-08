// ============================================
// PORTFOLIO TRACKER - TYPE DEFINITIONS
// ============================================

// ============================================
// ENUMS Y CONSTANTES TIPADAS
// ============================================

export const ASSET_CLASSES = {
  CEDEAR: 'CEDEAR',
  ARGY: 'ARGY',
  BONOS_PESOS: 'BONOS PESOS',
  BONO_HARD_DOLLAR: 'BONO HARD DOLLAR',
  ON: 'ON',
  OTROS: 'OTROS',
} as const;

export type AssetClass = typeof ASSET_CLASSES[keyof typeof ASSET_CLASSES];

export const TRADE_TYPES = {
  BUY: 'buy',
  SELL: 'sell',
} as const;

export type TradeType = typeof TRADE_TYPES[keyof typeof TRADE_TYPES];

export const CURRENCIES = {
  ARS: 'ARS',
  USD: 'USD',
} as const;

export type Currency = typeof CURRENCIES[keyof typeof CURRENCIES];

export const PORTFOLIO_TYPES = {
  BURSATIL: 'bursatil',
  CRIPTO: 'cripto',
} as const;

export type PortfolioType = typeof PORTFOLIO_TYPES[keyof typeof PORTFOLIO_TYPES];

// ============================================
// ENTIDADES DE BASE DE DATOS (Supabase)
// ============================================

/**
 * Portfolio - Colección de trades agrupados
 */
export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  currency: Currency;
  portfolio_type?: PortfolioType;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
}

/**
 * Trade - Transacción individual de compra/venta
 */
export interface Trade {
  id: string;
  portfolio_id: string;
  user_id: string;
  ticker: string;
  trade_type: TradeType;
  quantity: number;
  price: number;
  total_amount: number;
  commission: number;
  currency: Currency;
  trade_date: string;
  notes: string | null;
  created_at?: string;
}

// ============================================
// ENTIDADES DE UI / CALCULADAS
// ============================================

/**
 * Trade con campos de UI (mappeo español)
 */
export interface TradeUI extends Trade {
  fecha: string;
  cantidad: number;
  precioCompra: number;
  tipo: 'compra' | 'venta';
}

/**
 * TradeInput - Formato flexible de entrada para el engine
 * Soporta tanto campos en inglés como en español para compatibilidad con datos legacy
 */
export interface TradeInput {
  ticker: string;
  quantity?: number;
  cantidad?: number;
  price?: number;
  precioCompra?: number;
  trade_type?: string;
  tipo?: string;
  trade_date?: string | Date;
  fecha?: string | Date;
  [key: string]: unknown;
}

/**
 * Position - Agregación de trades por ticker
 */
export interface Position {
  ticker: string;
  trades: Trade[];
  totalQuantity: number;
  totalCost: number;
  avgPrice: number;
  currentPrice: number;
  valuation: number;
  result: number;
  resultPct: number;
  dailyResult: number;
  dailyResultPct: number;
  assetClass: AssetClass;
  pctChange: number | null;
  isBonoPesos: boolean;
  isBonoHD: boolean;
  isON?: boolean;
  usesONConversion?: boolean;
  costUSD: number;
  valuationUSD: number;
  resultUSD: number;
  dailyResultUSD: number;
  resultPctUSD: number;
  dailyResultPctUSD: number;
  // P&L Attribution
  mepPromedioPonderado: number;
  resultadoFX: number;
  resultadoPrecio: number;
}

/**
 * Totales del portfolio
 */
export interface PortfolioTotals {
  invested: number;
  valuation: number;
  result: number;
  resultPct: number;
  dailyResult: number;
  dailyResultPct: number;
  investedUSD: number;
  valuationUSD: number;
  resultUSD: number;
  resultPctUSD: number;
  dailyResultUSD: number;
  dailyResultPctUSD: number;
}

// ============================================
// DATOS DE PRECIOS (API data912)
// ============================================

/**
 * Datos de precio para un ticker
 */
export interface PriceData {
  price: number;
  priceRaw: number;
  bid?: number;
  ask?: number;
  close?: number;
  panel?: string;
  assetClass: AssetClass;
  pctChange: number | null;
  isBonoPesos: boolean;
  isBonoHD: boolean;
  isON?: boolean;
  isONInPesos?: boolean;
  currencyType?: 'ARS' | 'USD' | 'CABLE';
  isStale?: boolean;
  lastUpdate?: number;
}

/**
 * Mapa de precios por ticker
 */
export type PriceMap = Record<string, PriceData>;

/**
 * Info básica de un ticker
 */
export interface TickerInfo {
  ticker: string;
  panel?: string;
  assetClass: AssetClass;
  originalTicker?: string;
  pesosEquivalent?: string;
}

/**
 * Datos históricos de un día
 */
export interface HistoricalDataPoint {
  date: string;
  c: number;  // close
  o?: number; // open
  h?: number; // high
  l?: number; // low
  v?: number; // volume
}

// ============================================
// FORMULARIOS Y MODALES
// ============================================

/**
 * Datos del formulario de trade
 */
export interface TradeFormData {
  tipo: 'compra' | 'venta';
  fecha: string;
  ticker: string;
  cantidad: string;
  precio: string;
}

/**
 * Configuración de columnas de la tabla
 */
export interface ColumnSettings {
  showPPC: boolean;
  showInvertido: boolean;
  showDiario: boolean;
  showDiarioPct: boolean;
  density: 'compact' | 'comfortable';
}

/**
 * Configuración de ordenamiento
 */
export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

// ============================================
// CONTEXTOS
// ============================================

/**
 * Estado del contexto de autenticación
 */
export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<unknown>;
  signIn: (email: string, password: string) => Promise<unknown>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

/**
 * Estado del contexto de portfolios
 */
export interface PortfolioContextValue {
  portfolios: Portfolio[];
  currentPortfolio: Portfolio | null;
  setCurrentPortfolio: (portfolio: Portfolio | null) => void;
  loading: boolean;
  error: string | null;
  createPortfolio: (name: string, description?: string, currency?: Currency, portfolioType?: PortfolioType) => Promise<Portfolio>;
  updatePortfolio: (portfolioId: string, updates: Partial<Portfolio>) => Promise<Portfolio>;
  deletePortfolio: (portfolioId: string) => Promise<void>;
  setDefaultPortfolio: (portfolioId: string) => Promise<Portfolio>;
  refetch: () => Promise<void>;
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Usuario de Supabase (simplificado)
 */
export interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

/**
 * Resultado de operaciones async
 */
export interface AsyncResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/**
 * Cache entry para localStorage
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ============================================
// API RESPONSES (data912)
// ============================================

export interface MEPDataItem {
  ticker: string;
  panel: string;
  ars_bid?: number;
  ars_ask?: number;
  mark?: number;
  close?: number;
}

export interface StockDataItem {
  symbol: string;
  c?: number;
  px_bid?: number;
  px_ask?: number;
  pct_change?: number;
}

export interface BondDataItem extends StockDataItem {
  panel?: string;
}

export interface CorpDataItem {
  symbol: string;
  c: number;
  pct_change?: number;
  px_bid?: number;
  px_ask?: number;
}

// ============================================
// CHART DATA
// ============================================

export interface ChartDataPoint {
  date: string;
  price: number;
  fullDate: string;
}

export interface DistributionDataItem {
  name: AssetClass;
  value: number;
  percentage: number;
  pnlPct?: number;
  color: string;
}
