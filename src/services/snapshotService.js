import { supabase } from '../lib/supabase'

export const snapshotService = {
  async getSnapshots(portfolioId, startDate = null, endDate = null) {
    let query = supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('snapshot_date', { ascending: true })

    if (startDate) query = query.gte('snapshot_date', startDate)
    if (endDate) query = query.lte('snapshot_date', endDate)

    const { data, error } = await query
    if (error) throw error
    return data
  },

  async createSnapshot(portfolioId, snapshotData) {
    const { data, error } = await supabase
      .from('portfolio_snapshots')
      .insert([{
        portfolio_id: portfolioId,
        snapshot_date: snapshotData.snapshot_date,
        total_invested: snapshotData.total_invested,
        total_value: snapshotData.total_value,
        total_pnl: snapshotData.total_pnl,
        pnl_percentage: snapshotData.pnl_percentage,
        currency: snapshotData.currency || 'ARS'
      }])
      .select()
      .single()

    if (error) throw error
    return data
  }
}
