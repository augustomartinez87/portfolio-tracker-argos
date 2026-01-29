import { supabase } from '@/lib/supabase';

export const fciService = {
    // 1. Obtener lista de FCIs disponibles
    async getFcis() {
        const { data, error } = await supabase
            .from('fci_master')
            .select('*')
            .order('nombre');

        if (error) throw error;
        return data;
    },

    // 2. Obtener historial de precios para un FCI
    // Opcional: fromDate para limitar la carga
    async getPrices(fciId, fromDate = null) {
        let query = supabase
            .from('fci_prices')
            .select('*')
            .eq('fci_id', fciId)
            .order('fecha', { ascending: true }); // Orden ascendente para gráficas/cálculos

        if (fromDate) {
            query = query.gte('fecha', fromDate);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    },

    // 3. Obtener el último precio conocido (para valuación actual rápida)
    async getLatestPrice(fciId) {
        const { data, error } = await supabase
            .from('fci_prices')
            .select('*')
            .eq('fci_id', fciId)
            .order('fecha', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // Ignorar not found
        return data;
    },

    // 4. Obtener transacciones de FCI para un portfolio
    async getTransactions(portfolioId) {
        const { data, error } = await supabase
            .from('fci_transactions')
            .select(`
        *,
        fci_master (
          nombre,
          ticker,
          currency
        )
      `)
            .eq('portfolio_id', portfolioId)
            .order('fecha', { ascending: false });

        if (error) throw error;
        return data;
    },

    // 5. Crear nueva transacción (Suscripción/Rescate)
    async createTransaction(transaction) {
        const { data, error } = await supabase
            .from('fci_transactions')
            .insert([transaction])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // 6. Eliminar transacción
    async deleteTransaction(transactionId) {
        const { error } = await supabase
            .from('fci_transactions')
            .delete()
            .eq('id', transactionId);

        if (error) throw error;
    },

    // 7. Actualizar transacción
    async updateTransaction(transactionId, updates) {
        const { data, error } = await supabase
            .from('fci_transactions')
            .update(updates)
            .eq('id', transactionId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // 8. Carga masiva e idempotente de precios (VCP)
    async upsertPrices(fciId, prices) {
        // prices: Array de { fecha, vcp }
        const rows = prices.map(p => ({
            fci_id: fciId,
            fecha: p.fecha,
            vcp: p.vcp
        }));

        const { data, error } = await supabase
            .from('fci_prices')
            .upsert(rows, { onConflict: 'fci_id,fecha' })
            .select();

        if (error) throw error;
        return data;
    }
};
