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
    },

    // =========================================================================
    // LUGARES
    // =========================================================================

    // 9. Obtener lugares del usuario (RLS filtra automáticamente)
    async getLugares() {
        const { data, error } = await supabase
            .from('lugares')
            .select('*')
            .order('nombre');

        if (error) throw error;
        return data;
    },

    // 10. Crear lugar nuevo
    async createLugar({ user_id, nombre }) {
        const { data, error } = await supabase
            .from('lugares')
            .insert([{ user_id, nombre }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // =========================================================================
    // FCI LOTS
    // =========================================================================

    // 11. Obtener todos los lotes (activos + inactivos) para un portfolio
    //     Útil para la vista de historial
    async getLots(portfolioId) {
        const { data, error } = await supabase
            .from('fci_lots')
            .select(`
                *,
                fci_master (
                    nombre,
                    ticker,
                    currency
                ),
                lugares (
                    nombre as lugar_nombre
                )
            `)
            .eq('portfolio_id', portfolioId)
            .order('fci_id')
            .order('fecha_suscripcion', { ascending: true });

        if (error) throw error;
        return data;
    },

    // 12. Obtener solo lotes activos para un portfolio
    //     Esto es lo que el motor de valuación consume
    async getActiveLots(portfolioId) {
        const { data, error } = await supabase
            .from('fci_lots')
            .select(`
                *,
                fci_master (
                    nombre,
                    ticker,
                    currency
                ),
                lugares (
                    nombre as lugar_nombre
                )
            `)
            .eq('portfolio_id', portfolioId)
            .eq('activo', true)
            .order('fci_id')
            .order('fecha_suscripcion', { ascending: true });

        if (error) throw error;
        return data;
    },

    // 13. Crear un lot nuevo (suscripción)
    async createLot(lotData) {
        const { data, error } = await supabase
            .from('fci_lots')
            .insert([lotData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // 14. Actualizar un lot existente
    async updateLot(lotId, updates) {
        const { data, error } = await supabase
            .from('fci_lots')
            .update(updates)
            .eq('id', lotId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // 15. Eliminar un lot (solo para correcciones; los rescates usan FIFO)
    async deleteLot(lotId) {
        const { error } = await supabase
            .from('fci_lots')
            .delete()
            .eq('id', lotId);

        if (error) throw error;
    },

    // 16. Aplicar rescate con lógica FIFO en el cliente
    //     Fetch → calcula mutaciones → ejecuta UPDATEs
    //     Retorna array de { lotId, cuotapartesAntes, cuotapartesDespues, agotado }
    async applyRedemptionFIFO(portfolioId, fciId, cuotapartesToRedeem) {
        const Decimal = (await import('decimal.js')).default;

        // 1. Fetch lotes activos de este fondo, ordenados por fecha ASC (FIFO)
        const { data: activeLots, error } = await supabase
            .from('fci_lots')
            .select('id, cuotapartes, vcp_entrada, fecha_suscripcion')
            .eq('portfolio_id', portfolioId)
            .eq('fci_id', fciId)
            .eq('activo', true)
            .order('fecha_suscripcion', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) throw error;

        // 2. Calcular plan de mutaciones con Decimal.js
        let remaining = new Decimal(cuotapartesToRedeem);
        const mutations = [];

        for (const lot of activeLots) {
            if (remaining.lte(0)) break;

            const lotCp = new Decimal(lot.cuotapartes);
            const consumable = Decimal.min(lotCp, remaining);
            const nuevaCp = lotCp.minus(consumable);
            const agotado = nuevaCp.lt(new Decimal('0.0001'));

            mutations.push({
                lotId: lot.id,
                cuotapartesAntes: lotCp.toNumber(),
                cuotapartesDespues: agotado ? 0 : nuevaCp.toNumber(),
                capitalInvertido: agotado ? 0 : nuevaCp.times(new Decimal(lot.vcp_entrada)).toNumber(),
                agotado
            });

            remaining = remaining.minus(consumable);
        }

        // 3. Ejecutar UPDATEs
        for (const m of mutations) {
            await this.updateLot(m.lotId, {
                cuotapartes: m.cuotapartesDespues,
                capital_invertido: m.capitalInvertido,
                activo: !m.agotado
            });
        }

        // 4. Retornar info de la operación
        return {
            mutations,
            remainingNotApplied: remaining.toNumber()  // > 0 si se intentó rescatar más de lo disponible
        };
    }
};
