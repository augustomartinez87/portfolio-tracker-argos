import { supabase } from '../lib/supabase';
import mepHistoryData from '../data/mepHistory.json';

export interface MepHistoryItem {
    date: string;
    price: number;
}

// Inicializar con datos locales embebidos
const localHistory: MepHistoryItem[] = mepHistoryData;

/**
 * Servicio para gestionar el historial del Dólar MEP
 */
export const mepService = {
    /**
     * Obtiene todo el historial de MEP
     * Combina datos locales con actualizaciones de la BD si existen
     */
    async getHistory(): Promise<MepHistoryItem[]> {
        try {
            const { data, error } = await supabase
                .from('mep_history')
                .select('date, price')
                .order('date', { ascending: false });

            if (error) {
                console.warn('Error fetching MEP history from DB, using local data only:', error.message);
                return localHistory;
            }

            // Mezclar y de-duplicar (prioridad a la BD para días recientes)
            const combined = [...(data || []), ...localHistory];
            const unique = Array.from(new Map(combined.map(item => [item.date, item])).values());

            return unique.sort((a, b) => b.date.localeCompare(a.date));
        } catch (e) {
            return localHistory;
        }
    },

    /**
     * Guarda el precio MEP del día actual (upsert)
     */
    async recordDailyMep(price: number): Promise<void> {
        if (!price || price <= 0) return;

        const today = new Date().toISOString().split('T')[0];

        try {
            const { error } = await supabase
                .from('mep_history')
                .upsert({ date: today, price }, { onConflict: 'date' });

            if (error) {
                console.error('Error recording daily MEP:', error);
            }
        } catch (e) {
            console.error('Exception recording daily MEP:', e);
        }
    },

    /**
     * Busca el MEP más cercano a una fecha específica
     * @param targetDate - Fecha en formato YYYY-MM-DD
     * @param history - Lista de historial opcional (si no se provee, usa local)
     */
    findClosestRate(targetDate: string, history: MepHistoryItem[] = []): number {
        const source = history.length > 0 ? history : localHistory;
        if (!source.length) return 0;

        // Intentar encontrar coincidencia exacta primero
        const exact = source.find(h => h.date === targetDate);
        if (exact) return exact.price;

        // Si no hay exacta, buscar la fecha anterior más cercana
        const sorted = [...source].sort((a, b) => b.date.localeCompare(a.date));
        const older = sorted.find(h => h.date < targetDate);

        return older ? older.price : sorted[sorted.length - 1].price;
    }
};
