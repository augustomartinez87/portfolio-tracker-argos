import { supabase } from '@/lib/supabase';
import type {
  NexoLoan,
  NexoLoanInput,
  NexoLoanUpdate,
  NexoLoanEvent,
  LoanEventInput,
  ConversionEvent,
  ConversionEventInput,
} from '../types';

export const nexoLoanService = {
  // ============================================================
  // Loans CRUD
  // ============================================================

  async getLoans(portfolioId: string): Promise<NexoLoan[]> {
    const { data, error } = await supabase
      .from('nexo_loans')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('opened_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getActiveLoans(portfolioId: string): Promise<NexoLoan[]> {
    const { data, error } = await supabase
      .from('nexo_loans')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .eq('status', 'active')
      .order('opened_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createLoan(
    portfolioId: string,
    userId: string,
    input: NexoLoanInput
  ): Promise<NexoLoan> {
    const { data, error } = await supabase
      .from('nexo_loans')
      .insert([{
        portfolio_id: portfolioId,
        user_id: userId,
        loan_currency: input.loan_currency,
        principal: input.principal,
        outstanding: input.outstanding,
        interest_rate_apr: input.interest_rate_apr,
        collateral_asset: input.collateral_asset || 'bitcoin',
        collateral_quantity: input.collateral_quantity,
        ltv_warning: input.ltv_warning ?? 0.65,
        ltv_liquidation: input.ltv_liquidation ?? 0.83,
        status: 'active',
        opened_at: input.opened_at || new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw new Error(`Error creando loan: ${error.message}`);
    return data;
  },

  async updateLoan(loanId: string, updates: NexoLoanUpdate): Promise<NexoLoan> {
    const { data, error } = await supabase
      .from('nexo_loans')
      .update(updates)
      .eq('id', loanId)
      .select()
      .single();

    if (error) throw new Error(`Error actualizando loan: ${error.message}`);
    return data;
  },

  async closeLoan(loanId: string): Promise<void> {
    const { error } = await supabase
      .from('nexo_loans')
      .update({
        status: 'closed',
        outstanding: 0,
        closed_at: new Date().toISOString(),
      })
      .eq('id', loanId);

    if (error) throw new Error(`Error cerrando loan: ${error.message}`);
  },

  async deleteLoan(loanId: string): Promise<void> {
    const { error } = await supabase
      .from('nexo_loans')
      .delete()
      .eq('id', loanId);

    if (error) throw new Error(`Error eliminando loan: ${error.message}`);
  },

  // ============================================================
  // Loan Events
  // ============================================================

  async getEvents(loanId: string): Promise<NexoLoanEvent[]> {
    const { data, error } = await supabase
      .from('nexo_loan_events')
      .select('*')
      .eq('loan_id', loanId)
      .order('event_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addEvent(loanId: string, input: LoanEventInput): Promise<NexoLoanEvent> {
    const { data, error } = await supabase
      .from('nexo_loan_events')
      .insert([{
        loan_id: loanId,
        event_type: input.event_type,
        amount: input.amount,
        asset: input.asset || null,
        event_date: input.event_date || new Date().toISOString(),
        metadata: input.metadata || {},
      }])
      .select()
      .single();

    if (error) throw new Error(`Error agregando evento: ${error.message}`);
    return data;
  },

  /** Agrega evento y actualiza outstanding del loan en una operacion */
  async addRepayment(loanId: string, amount: number): Promise<void> {
    // 1. Leer outstanding actual
    const { data: loan, error: readErr } = await supabase
      .from('nexo_loans')
      .select('outstanding')
      .eq('id', loanId)
      .single();

    if (readErr || !loan) throw new Error('No se pudo leer el loan');

    const newOutstanding = Math.max(0, Number(loan.outstanding) - amount);

    // 2. Insertar evento + actualizar outstanding
    const { error: evtErr } = await supabase
      .from('nexo_loan_events')
      .insert([{
        loan_id: loanId,
        event_type: 'repayment',
        amount,
        asset: 'USDT',
        event_date: new Date().toISOString(),
        metadata: { previous_outstanding: loan.outstanding, new_outstanding: newOutstanding },
      }]);

    if (evtErr) throw new Error(`Error en evento: ${evtErr.message}`);

    const updates: NexoLoanUpdate = { outstanding: newOutstanding };
    if (newOutstanding === 0) {
      updates.status = 'closed';
      updates.closed_at = new Date().toISOString();
    }

    const { error: updErr } = await supabase
      .from('nexo_loans')
      .update(updates)
      .eq('id', loanId);

    if (updErr) throw new Error(`Error actualizando outstanding: ${updErr.message}`);
  },

  /** Agrega interes acumulado al outstanding */
  async addInterestAccrual(loanId: string, amount: number): Promise<void> {
    const { data: loan, error: readErr } = await supabase
      .from('nexo_loans')
      .select('outstanding')
      .eq('id', loanId)
      .single();

    if (readErr || !loan) throw new Error('No se pudo leer el loan');

    await supabase
      .from('nexo_loan_events')
      .insert([{
        loan_id: loanId,
        event_type: 'interest',
        amount,
        asset: 'USDT',
        event_date: new Date().toISOString(),
        metadata: {},
      }]);

    await supabase
      .from('nexo_loans')
      .update({ outstanding: Number(loan.outstanding) + amount })
      .eq('id', loanId);
  },

  // ============================================================
  // Conversion Events (USDT → ARS)
  // ============================================================

  async getConversions(portfolioId: string): Promise<ConversionEvent[]> {
    const { data, error } = await supabase
      .from('conversion_events')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('event_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createConversion(
    portfolioId: string,
    userId: string,
    input: ConversionEventInput
  ): Promise<ConversionEvent> {
    const { data, error } = await supabase
      .from('conversion_events')
      .insert([{
        portfolio_id: portfolioId,
        user_id: userId,
        loan_id: input.loan_id || null,
        cycle_id: input.cycle_id || null,
        from_asset: input.from_asset || 'USDT',
        to_asset: input.to_asset || 'ARS',
        from_amount: input.from_amount,
        to_amount: input.to_amount,
        exchange_rate: input.exchange_rate,
        channel: input.channel || null,
        event_date: input.event_date,
        notes: input.notes || null,
      }])
      .select()
      .single();

    if (error) throw new Error(`Error creando conversion: ${error.message}`);
    return data;
  },

  async deleteConversion(conversionId: string): Promise<void> {
    const { error } = await supabase
      .from('conversion_events')
      .delete()
      .eq('id', conversionId);

    if (error) throw new Error(`Error eliminando conversion: ${error.message}`);
  },
};

export default nexoLoanService;
