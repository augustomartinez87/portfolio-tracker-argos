import { supabase } from '@/lib/supabase'

export const tradeService = {
  async getTrades(portfolioId) {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('trade_date', { ascending: false })

    if (error) throw error
    return data
  },

  async createTrade(portfolioId, userId, trade) {
    const { data, error } = await supabase
      .from('trades')
      .insert([{
        portfolio_id: portfolioId,
        user_id: userId,
        ticker: trade.ticker,
        trade_type: trade.trade_type || 'buy',
        quantity: trade.quantity,
        price: trade.price,
        total_amount: trade.total_amount || (trade.quantity * trade.price),
        commission: trade.commission || 0,
        currency: trade.currency || 'ARS',
        trade_date: trade.trade_date,
        notes: trade.notes || ''
      }])
      .select()

    if (error) {
      throw new Error(`Supabase error: ${error.message} (code: ${error.code})`);
    }
    return data;
  },

  async updateTrade(tradeId, updates) {
    const { data, error } = await supabase
      .from('trades')
      .update(updates)
      .eq('id', tradeId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteTrade(tradeId) {
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', tradeId)

    if (error) throw error
  }
}
