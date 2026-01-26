import { supabase } from '../lib/supabase';
import mepHistoryData from '../data/mepHistory.json';

export interface MepHistoryItem {
    date: string;
    price: number;
}

// Inicializar con datos locales, ordenados cronológicamente inverso (más reciente primero) para consistencia
const localHistory: MepHistoryItem[] = mepHistoryData.length > 0
    ? [...mepHistoryData].sort((a, b) => b.date.localeCompare(a.date))
    : [];

// Cache para O(1) lookups
let mepMapCache: Map<string, number> | null = null;
let cachedHistory: MepHistoryItem[] | null = null;
let lastUpdate = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hora

/**
 * Servicio para gestionar el historial del Dólar MEP
 * Optimizado para O(1) lookups
 */
export const mepService = {
    /**
     * Obtiene todo el historial de MEP
     * Combina datos locales con actualizaciones de la BD si existen
     */
    async getHistory(): Promise<MepHistoryItem[]> {
        const now = Date.now();
        if (cachedHistory && (now - lastUpdate < CACHE_TTL)) {
            return cachedHistory;
        }

        try {
            const { data, error } = await supabase
                .from('mep_history')
                .select('date, price')
                .order('date', { ascending: false });

            if (error) {
                console.warn('Error fetching MEP history from DB, using local data only:', error.message);
                cachedHistory = localHistory;
                this._refreshCache(cachedHistory);
                return cachedHistory;
            }

            // Mezclar y de-duplicar (prioridad a la BD para días recientes)
            // Usar Map para deduplicación eficiente O(N)
            const combinedMap = new Map<string, MepHistoryItem>();

            // Primero insertar local (base)
            localHistory.forEach(item => combinedMap.set(item.date, item));

            // Luego sobreescribir con DB (más reciente/confiable)
            if (data) {
                data.forEach(item => combinedMap.set(item.date, item));
            }

            // Convertir a array y ordenar
            const unique = Array.from(combinedMap.values());
            cachedHistory = unique.sort((a, b) => b.date.localeCompare(a.date));
            this._refreshCache(cachedHistory);
            lastUpdate = now;

            return cachedHistory;
        } catch (e) {
            console.error('Exception in getHistory:', e);
            return localHistory;
        }
    },

    /**
     * Actualiza el cache interno Map para O(1) lookups
     */
    _refreshCache(history: MepHistoryItem[]) {
        mepMapCache = new Map<string, number>();
        history.forEach(h => mepMapCache!.set(h.date, h.price));
    },

    /**
     * Devuelve un Map<DateString, Price> para lookups O(1)
     * Si no está inicializado, lo genera sincrónicamente desde localHistory
     */
    getMepMap(): Map<string, number> {
        if (!mepMapCache) {
            // Fallback síncrono si no se ha llamado a getHistory aún
            this._refreshCache(localHistory);
        }
        return mepMapCache!;
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
            } else {
                // Invalidate cache to force refresh on next read
                cachedHistory = null;
            }
        } catch (e) {
            console.error('Exception recording daily MEP:', e);
        }
    },

    /**
     * Busca el precio MEP para una fecha especifica O(1) o O(log N) apros
     * Versión optimizada que usa Map si está disponible
     */
    findClosestRate(targetDate: string, mapArg?: Map<string, number>): number {
        const map = mapArg || this.getMepMap();

        // Defensive check: Ensure map is actually a Map (Vercel crash fix)
        // If mapArg is passed as a plain object or something else, default to fallback
        if (map && typeof map.has === 'function') {
            // 1. Exact Match O(1)
            if (map.has(targetDate)) {
                return map.get(targetDate)!;
            }

            // 2. Fallback: buscar fecha anterior más cercana.
            const dateObj = new Date(targetDate);
            for (let i = 1; i <= 10; i++) {
                dateObj.setDate(dateObj.getDate() - 1);
                const prevDate = dateObj.toISOString().split('T')[0];
                if (map.has(prevDate)) {
                    return map.get(prevDate)!;
                }
            }
        }

        // 3. Last Resort (or if Map invalid): Linear/Sort search on array
        const source = cachedHistory || localHistory;
        if (!source.length) return 0;

        // Intentar encontrar coincidencia exacta primero
        const exact = source.find(h => h.date === targetDate);
        if (exact) return exact.price;

        const sorted = [...source].sort((a, b) => b.date.localeCompare(a.date));
        const older = sorted.find(h => h.date < targetDate);

        return older ? older.price : sorted[sorted.length - 1].price;
    }
};
