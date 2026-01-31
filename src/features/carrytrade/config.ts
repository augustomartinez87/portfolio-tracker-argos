/**
 * Carry Trade Configuration
 * Configuración hardcodeada de bonos para análisis de carry trade
 * 
 * NOTA: Estos datos son estáticos y deben actualizarse manualmente
 * según la información oficial del Ministerio de Economía/BCRA
 * Última actualización: 26/01/2026 (datos de Docta)
 */

import type { BondConfig, CarryTradeConfig, BondType } from './models';

/**
 * Configuración global del módulo carry trade
 * Valores por defecto para cálculos
 */
export const DEFAULT_CONFIG: CarryTradeConfig = {
  monthlyInflation: 0.01,      // 1% mensual esperado
  lowerBandTolerance: 0.95,    // 5% de margen inferior
  upperBandMultiplier: 1.05    // 5% de margen superior
};

/**
 * Tickers de bonos soportados para análisis de carry trade
 * Organizados por tipo: LECAPs, BONCAPs, DUALs
 */
export const SUPPORTED_BOND_TICKERS: string[] = [
  // LECAPs (Letras Capitalizables) - Patrón: [S|T][día][mes][año]
  'T30E6', 'T13F6', 'S27F6', 'S17A6', 'S30A6', 'S29Y6',
  
  // BONCAPs (Bonos Capitalizables) - Mayor plazo, pagos semestrales
  'T30J6', 'S31G6', 'S30O6', 'S30N6', 'T15E7', 'T30A7', 'T31Y7', 'T30J7',
  
  // DUALs (Bonos Duales - tasa fija o TAMAR)
  'TTM26', 'TTJ26', 'TTS26', 'TTD26'
];

/**
 * Configuración detallada de cada bono soportado
 * Incluye fecha de vencimiento, payoff y tipo
 */
export const BOND_CONFIG: Record<string, BondConfig> = {
  // ============================================================================
  // LECAPs (Letras Capitalizables)
  // ============================================================================
  
  'T30E6': {
    maturity: '2026-01-30',
    payoff: 142.22,
    type: 'LECAP'
  },
  
  'T13F6': {
    maturity: '2026-02-13',
    payoff: 144.97,
    type: 'LECAP'
  },
  
  'S27F6': {
    maturity: '2026-02-27',
    payoff: 125.84,
    type: 'LECAP'
  },
  
  'S17A6': {
    maturity: '2026-04-17',
    payoff: 109.94,
    type: 'LECAP'
  },
  
  'S30A6': {
    maturity: '2026-04-30',
    payoff: 127.49,
    type: 'LECAP'
  },
  
  'S29Y6': {
    maturity: '2026-05-29',
    payoff: 132.04,
    type: 'LECAP'
  },
  
  // ============================================================================
  // BONCAPs (Bonos Capitalizables)
  // ============================================================================
  
  'T30J6': {
    maturity: '2026-06-30',
    payoff: 144.90,
    type: 'BONCAP'
  },
  
  'S31G6': {
    maturity: '2026-08-31',
    payoff: 127.06,
    type: 'BONCAP'
  },
  
  'S30O6': {
    maturity: '2026-10-30',
    payoff: 135.28,
    type: 'BONCAP'
  },
  
  'S30N6': {
    maturity: '2026-11-30',
    payoff: 129.89,
    type: 'BONCAP'
  },
  
  'T15E7': {
    maturity: '2027-01-15',
    payoff: 161.10,
    type: 'BONCAP'
  },
  
  'T30A7': {
    maturity: '2027-04-30',
    payoff: 157.34,
    type: 'BONCAP'
  },
  
  'T31Y7': {
    maturity: '2027-05-31',
    payoff: 152.18,
    type: 'BONCAP'
  },
  
  'T30J7': {
    maturity: '2027-06-30',
    payoff: 156.04,
    type: 'BONCAP'
  },
  
  // ============================================================================
  // DUALs (Bonos Duales)
  // Nota: Por ahora usamos solo la tasa fija. 
  // TODO: Implementar proyección TAMAR usando API BCRA
  // ============================================================================
  
  'TTM26': {
    maturity: '2026-03-16',
    payoff: 135.24,
    type: 'DUAL'
  },
  
  'TTJ26': {
    maturity: '2026-06-30',
    payoff: 144.63,
    type: 'DUAL'
  },
  
  'TTS26': {
    maturity: '2026-09-15',
    payoff: 152.10,
    type: 'DUAL'
  },
  
  'TTD26': {
    maturity: '2026-12-15',
    payoff: 161.14,
    type: 'DUAL'
  }
};

/**
 * Agrupa los bonos por tipo
 * @returns Objeto con arrays de tickers por tipo
 */
export function getBondsByType(): Record<BondType, string[]> {
  const result: Record<BondType, string[]> = {
    LECAP: [],
    BONCAP: [],
    DUAL: []
  };
  
  for (const [ticker, config] of Object.entries(BOND_CONFIG)) {
    result[config.type].push(ticker);
  }
  
  return result;
}

/**
 * Obtiene la configuración de un bono específico
 * @param ticker Código del bono
 * @returns Configuración del bono o null si no existe
 */
export function getBondConfig(ticker: string): BondConfig | null {
  return BOND_CONFIG[ticker] || null;
}

/**
 * Verifica si un ticker es soportado
 * @param ticker Código del bono
 * @returns true si el bono está configurado
 */
export function isSupportedBond(ticker: string): boolean {
  return ticker in BOND_CONFIG;
}

/**
 * Obtiene todos los tickers soportados
 * @returns Array de tickers
 */
export function getAllSupportedTickers(): string[] {
  return Object.keys(BOND_CONFIG);
}

/**
 * Información de versión y actualización
 */
export const CONFIG_METADATA = {
  version: '1.0.0',
  lastUpdated: '2026-01-26',
  dataSource: 'Docta Capital',
  notes: 'Datos de vencimiento y payoff actualizados manualmente'
};
