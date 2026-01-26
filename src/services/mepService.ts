import { supabase } from '../lib/supabase';

export interface MepHistoryItem {
    date: string;
    price: number;
}

/**
 * Servicio para gestionar el historial del Dólar MEP
 */
export const mepService = {
    /**
     * Obtiene todo el historial de MEP
     */
    async getHistory(): Promise<MepHistoryItem[]> {
        const { data, error } = await supabase
            .from('mep_history')
            .select('date, price')
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching MEP history:', error);
            return [];
        }

        return data || [];
    },

    /**
     * Guarda el precio MEP del día actual (upsert)
     */
    async recordDailyMep(price: number): Promise<void> {
        if (!price || price <= 0) return;

        const today = new Date().toISOString().split('T')[0];

        const { error } = await supabase
            .from('mep_history')
            .upsert({ date: today, price }, { onConflict: 'date' });

        if (error) {
            console.error('Error recording daily MEP:', error);
        }
    },

    /**
     * Busca el MEP más cercano a una fecha específica
     * @param targetDate - Fecha en formato YYYY-MM-DD
     * @param history - Lista de historial ya cargada para evitar re-fetch
     */
    findClosestRate(targetDate: string, history: MepHistoryItem[]): number {
        if (!history.length) return 0;

        // Intentar encontrar coincidencia exacta primero
        const exact = history.find(h => h.date === targetDate);
        if (exact) return exact.price;

        // Si no hay exacta, buscar la fecha anterior más cercana
        const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
        const older = sorted.find(h => h.date < targetDate);

        return older ? older.price : sorted[sorted.length - 1].price;
    }
};
