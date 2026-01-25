// ============================================================================
// SUPABASE DATABASE TYPES - Type definitions for Supabase database schema
// ============================================================================

import { DatabaseCaucion } from './finance';

// ============================================================================
// MAIN DATABASE SCHEMA
// ============================================================================

export type Database = {
  public: {
    Tables: {
      // Core cauciones table - single source of truth for financing data
      cauciones: {
        Row: DatabaseCaucion;
        Insert: Omit<DatabaseCaucion, 'id' | 'created_at'>;
        Update: Partial<DatabaseCaucion>;
      };

      // Portfolios table (from existing system)
      portfolios: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          currency: 'ARS' | 'USD';
          is_default: boolean;
          created_at: string;
          updated_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['portfolios']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['portfolios']['Row']>;
      };

      // Trades table (from existing system)
      trades: {
        Row: {
          id: string;
          portfolio_id: string;
          user_id: string;
          ticker: string;
          trade_type: 'buy' | 'sell';
          quantity: number;
          price: number;
          total_amount: number;
          commission: number;
          currency: 'ARS' | 'USD';
          trade_date: string;
          notes: string | null;
          created_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['trades']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['trades']['Row']>;
      };
    };

    Views: {
      // Summary view for cauciones - pre-calculated aggregates
      cauciones_resumen: {
        Row: {
          user_id: string;
          portfolio_id: string;
          total_operaciones: number;
          capital_total: number;
          interes_total: number;
          tna_promedio_ponderada: number;
          primera_operacion: string;
          ultima_operacion: string;
          dias_totales: number;
        };
      };
    };

    Functions: {
      // Database functions if any
    };
  };
};

// ============================================================================
// TYPE HELPERS FOR COMMON OPERATIONS
// ============================================================================

// Helper type for table rows
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

// Helper type for table inserts
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

// Helper type for table updates
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// Helper type for view rows
export type ViewRow<V extends keyof Database['public']['Views']> =
  Database['public']['Views'][V]['Row'];

// ============================================================================
// COMMONLY USED TYPE ALIASES
// ============================================================================

export type CauccionRow = TableRow<'cauciones'>;
export type CauccionInsert = TableInsert<'cauciones'>;
export type CauccionUpdate = TableUpdate<'cauciones'>;

export type PortfolioRow = TableRow<'portfolios'>;
export type PortfolioInsert = TableInsert<'portfolios'>;
export type PortfolioUpdate = TableUpdate<'portfolios'>;

export type TradeRow = TableRow<'trades'>;
export type TradeInsert = TableInsert<'trades'>;
export type TradeUpdate = TableUpdate<'trades'>;

export type CauccionSummaryRow = ViewRow<'cauciones_resumen'>;

// ============================================================================
// QUERY RESULT TYPES
// ============================================================================

export interface CauccionQueryResult {
  data: CauccionRow[] | null;
  error: any;
  count: number | null;
}

export interface CauccionMetricsQueryResult {
  data: CauccionSummaryRow[] | null;
  error: any;
}

// ============================================================================
// POSTGREST FILTER TYPES (for type-safe queries)
// ============================================================================

export type CauccionFilter = {
  id?: string;
  user_id?: string;
  portfolio_id?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  capital?: number;
  monto_devolver?: number;
  interes?: number;
  dias?: number;
  tna_real?: number;
  archivo?: string;
  created_at?: string;
};

export type PortfolioFilter = {
  id?: string;
  user_id?: string;
  name?: string;
  description?: string;
  currency?: 'ARS' | 'USD';
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TradeFilter = {
  id?: string;
  portfolio_id?: string;
  user_id?: string;
  ticker?: string;
  trade_type?: 'buy' | 'sell';
  quantity?: number;
  price?: number;
  total_amount?: number;
  commission?: number;
  currency?: 'ARS' | 'USD';
  trade_date?: string;
  notes?: string;
  created_at?: string;
};