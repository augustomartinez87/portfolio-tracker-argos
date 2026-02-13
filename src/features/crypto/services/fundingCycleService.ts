import { supabase } from '@/lib/supabase';
import type {
  FundingCycle,
  FundingCycleInput,
  FundingCycleUpdate,
  FundingCycleWithChildren,
  ConversionEvent,
  FciLotSummary,
  NexoLoan,
} from '../types';

export const fundingCycleService = {
  // ============================================================
  // Cycles CRUD
  // ============================================================

  async getCycles(portfolioId: string): Promise<FundingCycle[]> {
    const { data, error } = await supabase
      .from('funding_cycles')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('opened_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getActiveCycles(portfolioId: string): Promise<FundingCycle[]> {
    const { data, error } = await supabase
      .from('funding_cycles')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .eq('status', 'active')
      .order('opened_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getCycleWithChildren(cycleId: string): Promise<FundingCycleWithChildren> {
    // Fetch cycle
    const { data: cycle, error: cycleErr } = await supabase
      .from('funding_cycles')
      .select('*')
      .eq('id', cycleId)
      .single();

    if (cycleErr || !cycle) throw new Error(`Error cargando ciclo: ${cycleErr?.message}`);

    // Fetch linked loan
    let loan: NexoLoan | null = null;
    if (cycle.loan_id) {
      const { data } = await supabase
        .from('nexo_loans')
        .select('*')
        .eq('id', cycle.loan_id)
        .single();
      loan = data;
    }

    // Fetch linked conversions
    const { data: conversions } = await supabase
      .from('conversion_events')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('event_date', { ascending: false });

    // Fetch linked lots
    const { data: lots } = await supabase
      .from('fci_lots')
      .select('id, fci_id, cycle_id, fecha_suscripcion, capital_invertido, cuotapartes, vcp_entrada, activo, notes')
      .eq('cycle_id', cycleId)
      .order('fecha_suscripcion', { ascending: false });

    return {
      cycle,
      loan,
      conversions: (conversions || []) as ConversionEvent[],
      lots: (lots || []) as FciLotSummary[],
    };
  },

  async createCycle(
    portfolioId: string,
    userId: string,
    input: FundingCycleInput
  ): Promise<FundingCycle> {
    const { data, error } = await supabase
      .from('funding_cycles')
      .insert([{
        portfolio_id: portfolioId,
        user_id: userId,
        label: input.label,
        loan_id: input.loan_id || null,
        status: 'active',
        opened_at: input.opened_at || new Date().toISOString().split('T')[0],
        notes: input.notes || null,
      }])
      .select()
      .single();

    if (error) throw new Error(`Error creando ciclo: ${error.message}`);
    return data;
  },

  async updateCycle(cycleId: string, updates: FundingCycleUpdate): Promise<FundingCycle> {
    const { data, error } = await supabase
      .from('funding_cycles')
      .update(updates)
      .eq('id', cycleId)
      .select()
      .single();

    if (error) throw new Error(`Error actualizando ciclo: ${error.message}`);
    return data;
  },

  /** Close a cycle and snapshot its metrics */
  async closeCycle(
    cycleId: string,
    snapshot: {
      pnlNominalARS: number;
      pnlRealARS: number;
      roiPct: number;
      tcPromedio: number;
      dias: number;
    }
  ): Promise<FundingCycle> {
    const { data, error } = await supabase
      .from('funding_cycles')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString().split('T')[0],
        snapshot_pnl_nominal_ars: snapshot.pnlNominalARS,
        snapshot_pnl_real_ars: snapshot.pnlRealARS,
        snapshot_roi_pct: snapshot.roiPct,
        snapshot_tc_promedio: snapshot.tcPromedio,
        snapshot_dias: snapshot.dias,
      })
      .eq('id', cycleId)
      .select()
      .single();

    if (error) throw new Error(`Error cerrando ciclo: ${error.message}`);
    return data;
  },

  /** Delete a cycle, unlinking children first (not deleting them) */
  async deleteCycle(cycleId: string): Promise<void> {
    // Unlink conversions
    await supabase
      .from('conversion_events')
      .update({ cycle_id: null })
      .eq('cycle_id', cycleId);

    // Unlink lots
    await supabase
      .from('fci_lots')
      .update({ cycle_id: null })
      .eq('cycle_id', cycleId);

    // Delete the cycle
    const { error } = await supabase
      .from('funding_cycles')
      .delete()
      .eq('id', cycleId);

    if (error) throw new Error(`Error eliminando ciclo: ${error.message}`);
  },

  // ============================================================
  // Link / Unlink children
  // ============================================================

  async linkConversion(conversionId: string, cycleId: string): Promise<void> {
    const { error } = await supabase
      .from('conversion_events')
      .update({ cycle_id: cycleId })
      .eq('id', conversionId);

    if (error) throw new Error(`Error vinculando conversion: ${error.message}`);
  },

  async unlinkConversion(conversionId: string): Promise<void> {
    const { error } = await supabase
      .from('conversion_events')
      .update({ cycle_id: null })
      .eq('id', conversionId);

    if (error) throw new Error(`Error desvinculando conversion: ${error.message}`);
  },

  async linkLot(lotId: string, cycleId: string): Promise<void> {
    const { error } = await supabase
      .from('fci_lots')
      .update({ cycle_id: cycleId })
      .eq('id', lotId);

    if (error) throw new Error(`Error vinculando lote: ${error.message}`);
  },

  async unlinkLot(lotId: string): Promise<void> {
    const { error } = await supabase
      .from('fci_lots')
      .update({ cycle_id: null })
      .eq('id', lotId);

    if (error) throw new Error(`Error desvinculando lote: ${error.message}`);
  },

  // ============================================================
  // Helpers: unlinked records for the picker UI
  // ============================================================

  async getUnlinkedConversions(portfolioId: string): Promise<ConversionEvent[]> {
    const { data, error } = await supabase
      .from('conversion_events')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .is('cycle_id', null)
      .order('event_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getUnlinkedLots(portfolioId: string): Promise<FciLotSummary[]> {
    const { data, error } = await supabase
      .from('fci_lots')
      .select('id, fci_id, cycle_id, fecha_suscripcion, capital_invertido, cuotapartes, vcp_entrada, activo, notes')
      .eq('portfolio_id', portfolioId)
      .is('cycle_id', null)
      .eq('activo', true)
      .order('fecha_suscripcion', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};

export default fundingCycleService;
