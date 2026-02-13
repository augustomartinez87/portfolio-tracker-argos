// ============================================================
// Nexo Loans
// ============================================================

export interface NexoLoan {
  id: string;
  user_id: string;
  portfolio_id: string;
  loan_currency: string;          // 'USDT', 'USDC', etc.
  principal: number;              // Monto original prestado
  outstanding: number;            // Deuda vigente
  interest_rate_apr: number;      // Tasa anual (0.1390 = 13.9%)
  collateral_asset: string;       // CoinGecko ID: 'bitcoin', 'ethereum'
  collateral_quantity: number;    // BTC depositados como colateral
  ltv: number | null;             // LTV snapshot al momento de crear
  ltv_warning: number;            // Threshold de alerta (default 0.65)
  ltv_liquidation: number;        // Threshold de liquidacion (default 0.83)
  status: 'active' | 'closed' | 'liquidated';
  opened_at: string;
  closed_at: string | null;
}

export interface NexoLoanInput {
  loan_currency: string;
  principal: number;
  outstanding: number;
  interest_rate_apr: number;
  collateral_asset: string;
  collateral_quantity: number;
  ltv_warning?: number;
  ltv_liquidation?: number;
  opened_at?: string;
}

export interface NexoLoanUpdate {
  outstanding?: number;
  interest_rate_apr?: number;
  collateral_quantity?: number;
  ltv_warning?: number;
  ltv_liquidation?: number;
  status?: 'active' | 'closed' | 'liquidated';
  closed_at?: string;
}

// ============================================================
// Loan Events
// ============================================================

export type LoanEventType =
  | 'drawdown'        // Nuevo retiro de fondos
  | 'repayment'       // Pago parcial/total
  | 'interest'        // Acumulacion de intereses
  | 'collateral_add'  // Agregado de colateral
  | 'collateral_remove' // Retiro de colateral
  | 'liquidation';    // Liquidacion forzada

export interface NexoLoanEvent {
  id: string;
  loan_id: string;
  event_type: LoanEventType;
  amount: number;
  asset: string | null;           // BTC, USDT, etc.
  event_date: string;
  metadata: Record<string, unknown>;
}

export interface LoanEventInput {
  event_type: LoanEventType;
  amount: number;
  asset?: string;
  event_date?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Conversion Events (USDT → ARS)
// ============================================================

export interface ConversionEvent {
  id: string;
  user_id: string;
  portfolio_id: string;
  loan_id: string | null;
  cycle_id: string | null;
  from_asset: string;             // 'USDT'
  to_asset: string;               // 'ARS'
  from_amount: number;
  to_amount: number;
  exchange_rate: number;          // TC efectivo (ARS por USDT)
  channel: string | null;         // 'binance_p2p', 'lemoncash', etc.
  event_date: string;
  notes: string | null;
  created_at: string;
}

export interface ConversionEventInput {
  loan_id?: string | null;
  cycle_id?: string | null;
  from_asset?: string;
  to_asset?: string;
  from_amount: number;
  to_amount: number;
  exchange_rate: number;
  channel?: string;
  event_date: string;
  notes?: string;
}

// ============================================================
// Computed Metrics (from useNexoEngine)
// ============================================================

export interface LoanMetrics {
  loan: NexoLoan;
  ltvActual: number;              // outstanding / (collateral_qty * price)
  ltvWarningDist: number;         // % que falta para warning
  ltvLiquidationDist: number;     // % que falta para liquidacion
  btcLiquidationPrice: number;    // Precio BTC que dispara liquidacion
  btcWarningPrice: number;        // Precio BTC que dispara warning
  collateralValueUSDT: number;    // collateral_qty * btc_price
  dailyCostUSDT: number;          // outstanding * apr / 365
  riskLevel: 'safe' | 'warning' | 'danger'; // Segun LTV actual
}

export interface NexoEngineResult {
  loans: LoanMetrics[];
  totalOutstanding: number;
  totalCollateralUSDT: number;
  ltvPonderado: number;           // Weighted LTV across all loans
  dailyCostTotal: number;         // Costo diario total USDT
  annualCostTotal: number;        // Costo anual total USDT
  worstRiskLevel: 'safe' | 'warning' | 'danger';
}

// ============================================================
// Funding Cycles
// ============================================================

export interface FundingCycle {
  id: string;
  user_id: string;
  portfolio_id: string;
  loan_id: string | null;
  label: string;
  status: 'active' | 'closed';
  opened_at: string;
  closed_at: string | null;
  snapshot_pnl_nominal_ars: number | null;
  snapshot_pnl_real_ars: number | null;
  snapshot_roi_pct: number | null;
  snapshot_tc_promedio: number | null;
  snapshot_dias: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FundingCycleInput {
  label: string;
  loan_id?: string | null;
  opened_at?: string;
  notes?: string;
}

export interface FundingCycleUpdate {
  label?: string;
  loan_id?: string | null;
  status?: 'active' | 'closed';
  closed_at?: string | null;
  notes?: string;
  snapshot_pnl_nominal_ars?: number;
  snapshot_pnl_real_ars?: number;
  snapshot_roi_pct?: number;
  snapshot_tc_promedio?: number;
  snapshot_dias?: number;
}

/** Cycle with its linked children loaded via joins */
export interface FundingCycleWithChildren {
  cycle: FundingCycle;
  loan: NexoLoan | null;
  conversions: ConversionEvent[];
  lots: FciLotSummary[];
}

/** Minimal FCI lot info needed by the cycle engine */
export interface FciLotSummary {
  id: string;
  fci_id: string;
  cycle_id: string | null;
  fecha_suscripcion: string;
  capital_invertido: number;
  cuotapartes: number;
  vcp_entrada: number;
  activo: boolean;
  notes: string | null;
}

/** Computed metrics for a single funding cycle */
export interface FundingCycleMetrics {
  cycleId: string;
  label: string;
  status: 'active' | 'closed';
  // Loan side
  loanOutstandingUSDT: number;
  loanApr: number;
  costoDiarioUSDT: number;
  costoDiarioARS: number;
  // Conversion side
  totalConvertidoUSDT: number;
  totalConvertidoARS: number;
  tcPromedio: number;
  cantConversiones: number;
  // FCI side
  totalInvertidoARS: number;
  totalValuacionARS: number;
  fciPnlARS: number;
  cantLots: number;
  // Carry
  carryDiarioARS: number;
  // FX
  exposicionCambiariaARS: number;
  // Cycle P&L
  pnlNominalARS: number;
  pnlRealARS: number;
  roiPct: number;
  diasEnCiclo: number;
}
