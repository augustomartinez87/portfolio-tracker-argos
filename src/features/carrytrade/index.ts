/**
 * Carry Trade Module - Argos Capital
 * Módulo completo para análisis de carry trade en bonos argentinos
 * 
 * @module carrytrade
 * @description Motor de cálculo preciso para operaciones de carry trade
 * @version 1.0.0
 * @author Argos Capital
 * 
 * ## Uso Rápido
 * ```typescript
 * import { useCarryTrade } from '@/features/carrytrade';
 * 
 * function MyComponent() {
 *   const { state, refresh } = useCarryTrade({
 *     autoRefresh: true,
 *     refreshInterval: 30000
 *   });
 * 
 *   if (state.loading) return <div>Cargando...</div>;
 *   if (state.error) return <div>Error: {state.error}</div>;
 * 
 *   return (
 *     <div>
 *       <h2>Análisis Carry Trade</h2>
 *       <p>MEP: ${state.mepRate}</p>
 *       <p>Mejor retorno: {state.summary?.bestBondByReturn?.bond.ticker}</p>
 *     </div>
 *   );
 * }
 * ```
 * 
 * ## Características
 * - Cálculos matemáticos precisos y verificados
 * - Integración en tiempo real con data912.com
 * - Hooks de React para fácil integración
 * - Manejo robusto de errores
 * - TypeScript estricto para seguridad de tipos
 */

// ============================================================================
// MODELOS Y TIPOS
// ============================================================================

export type {
  Bond,
  BondConfig,
  BondType,
  CarryTradeConfig,
  CarryTradeOperationResult,
  CarryTradeResult,
  CarryTradeSummary
} from './models';

export { CarryTradeError } from './models';

// ============================================================================
// CALCULADOR
// ============================================================================

export { 
  CarryTradeCalculator,
  createCalculator,
  quickAnalyze,
  parseDate
} from './calculator';

// ============================================================================
// SERVICIO DE DATOS
// ============================================================================

export { 
  Data912Service,
  DataServiceError,
  createData912Service,
  getMepRate,
  getAllBonds
} from './dataService';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

export {
  DEFAULT_CONFIG,
  SUPPORTED_BOND_TICKERS,
  BOND_CONFIG,
  CONFIG_METADATA,
  getBondsByType,
  getBondConfig,
  isSupportedBond,
  getAllSupportedTickers
} from './config';

// ============================================================================
// VALIDADORES
// ============================================================================

export {
  validateBond,
  validateMepRate,
  validateCarryTradeResult,
  validateConfig,
  safeExecute,
  validateBondList,
  validateScenarioRates
} from './validators';

// ============================================================================
// HOOKS DE REACT
// ============================================================================

export {
  useCarryTrade,
  useSingleBondCarry,
  useMepRate
} from './hooks/useCarryTrade';

// ============================================================================
// FUNCIONES AUXILIARES (RE-EXPORT)
// ============================================================================

/**
 * Análisis completo de carry trade con todos los bonos disponibles
 * Función de conveniencia que combina servicio de datos y calculador
 * 
 * @param config Configuración opcional del calculador
 * @returns Resultados completos del análisis
 */
export async function analyzeAllBonds(config?: import('./models').CarryTradeConfig) {
  const { Data912Service } = await import('./dataService');
  const { CarryTradeCalculator } = await import('./calculator');
  
  const dataService = new Data912Service();
  const calculator = new CarryTradeCalculator(config);
  
  const [mepRate, bonds] = await Promise.all([
    dataService.getMepRate(),
    dataService.getBonds()
  ]);
  
  const results = calculator.analyzeBonds(bonds, mepRate);
  const summary = calculator.calculateSummary(results, mepRate);
  
  return {
    results,
    summary,
    mepRate,
    timestamp: new Date()
  };
}
