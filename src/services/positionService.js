import { supabase } from '../lib/supabase'

export const positionService = {
  async getPositions(portfolioId) {
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  async upsertPosition(portfolioId, position) {
    const { data, error } = await supabase
      .from('positions')
      .upsert({
        portfolio_id: portfolioId,
        ticker: position.ticker,
        asset_type: position.asset_type || 'stock',
        quantity: position.quantity,
        average_price: position.average_price,
        current_price: position.current_price || position.average_price,
        currency: position.currency || 'ARS'
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateCurrentPrice(positionId, currentPrice) {
    const { data, error } = await supabase
      .from('positions')
      .update({ current_price: currentPrice })
      .eq('id', positionId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deletePosition(positionId) {
    const { error } = await supabase
      .from('positions')
      .delete()
      .eq('id', positionId)

    if (error) throw error
  }
}
