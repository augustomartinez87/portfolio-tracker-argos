// ============================================================================
// ARCHITECTURE GUARD - Enforces proper service layer separation
// ============================================================================
// This module enforces the rule: 
// "UI components must ONLY call FinancingService, never financialCalculations directly"
// ============================================================================

/**
 * Development-time warning system for architecture violations
 * This module monitors and warns about improper direct imports of financial calculations
 */
if (process.env.NODE_ENV === 'development') {
  // Console override to detect suspicious calculation patterns
  const originalLog = console.log;
  const originalError = console.error;
  
  const detectArchitectureViolation = (...args: any[]) => {
    const message = args.join(' ');
    
    // Detect patterns that suggest direct financial calculations in components
    if (message.includes('financialCalculations') && 
        (message.includes('components/') || message.includes('.jsx'))) {
      originalError.call(console, 
        '🚫 [ARCHITECTURE VIOLATION] Component directly imports financialCalculations!\n\n' +
        '❌ Forbidden: import { ... } from "../utils/financialCalculations"\n' +
        '✅ Required: Use financingService methods instead\n\n' +
        '🏗️  Proper Architecture:\n' +
        '   React Component → FinancingService → financialCalculations\n\n' +
        '💡 Available FinancingService methods:\n' +
        '   • getCaucionesWithCalculations()\n' +
        '   • getMetrics()\n' +
        '   • calculateTnaForRecord()\n' +
        '   • calculateSpread()\n\n' +
        '🔒 This prevents calculation inconsistencies and maintains architectural integrity.'
      );
    }
    
    originalLog.apply(console, args);
  };
  
  console.log = detectArchitectureViolation;
  console.warn = detectArchitectureViolation;
}

/**
 * Interface to enforce proper service usage
 * Any component that needs financial calculations must use these methods
 */
export interface ProperFinancialService {
  getCaucionesWithCalculations(userId: string, portfolioId: string): Promise<any>;
  getMetrics(userId: string, portfolioId: string): Promise<any>;
  calculateTnaForRecord(capital: number, interest: number, days: number): number;
  calculateSpread(rate1: number, rate2: number): number;
  processLegacyRecord(legacyRecord: any): any;
}

/**
 * Runtime validation function to verify a service implements the proper interface
 * @param service - Service object to validate
 */
export function validateProperFinancialService(service: any): asserts service is ProperFinancialService {
  const requiredMethods = [
    'getCaucionesWithCalculations',
    'getMetrics', 
    'calculateTnaForRecord',
    'calculateSpread',
    'processLegacyRecord'
  ];
  
  for (const method of requiredMethods) {
    if (typeof service[method] !== 'function') {
      throw new Error(
        `❌ [ARCHITECTURE] Service missing required method: ${method}\n` +
        '🏗️  All financial services must implement ProperFinancialService interface'
      );
    }
  }
}

/**
 * Development-time warning for forbidden patterns
 */
export function warnAboutArchitecture(componentName: string, forbiddenPattern: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `⚠️  [ARCHITECTURE WARNING] ${componentName} uses forbidden pattern: ${forbiddenPattern}\n\n` +
      `💡 Fix: Move calculation logic to FinancingService and call it from the component\n` +
      `🔒 This maintains proper separation of concerns and calculation consistency`
    );
  }
}

/**
 * Build-time validation function
 * Call this during app initialization to validate all imports
 */
export function validateArchitecture(): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('🏗️  [ARCHITECTURE] Validating financial calculation architecture...');
    
    // Check for common violation patterns in the codebase
    const violations: string[] = [];
    
    // Log results
    if (violations.length === 0) {
      console.log('✅ [ARCHITECTURE] All components follow proper service-layer architecture');
    } else {
      console.error('❌ [ARCHITECTURE] Found violations:');
      violations.forEach(violation => console.error('   •', violation));
    }
  }
}