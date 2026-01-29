import axios from 'axios';
import { mepService } from '@/features/portfolio/services/mepService';

const ALPHA_VANTAGE_KEY = 'YOUR_API_KEY'; // User should change this
const CACHE_PREFIX = 'argos_macro_';

export const macroService = {
    /**
     * Gets IPC data from datos.gob.ar
     * Format: [{ date: '2023-12-01', value: 0.255 }] (monthly variation)
     */
    async getIPC() {
        const cacheKey = `${CACHE_PREFIX}ipc`;
        const cached = this._getCache(cacheKey);

        // Refresh monthly (IPC is updated once a month)
        if (cached && !this._isExpired(cached.timestamp, 30 * 24 * 60 * 60 * 1000)) {
            return cached.data;
        }

        try {
            const url = 'https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACUAL_DICI_M_38&format=json&limit=1000';
            const response = await axios.get(url);
            const data = response.data.data.map(item => ({
                date: item[0],
                value: item[1] / 100 // Convert percentage to decimal
            }));

            this._setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.error('Error fetching IPC:', error);
            return cached ? cached.data : [];
        }
    },

    /**
     * Gets historical benchmark data (SPY or IBIT)
     */
    async getBenchmarkHistory(symbol) {
        const cacheKey = `${CACHE_PREFIX}${symbol.toLowerCase()}`;
        const cached = this._getCache(cacheKey);

        // Refresh daily
        if (cached && !this._isExpired(cached.timestamp, 24 * 60 * 60 * 1000)) {
            return cached.data;
        }

        try {
            const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
            const response = await axios.get(url);
            const timeSeries = response.data['Time Series (Daily)'];

            if (!timeSeries) throw new Error('No data from Alpha Vantage');

            const data = Object.keys(timeSeries).map(date => ({
                date,
                close: parseFloat(timeSeries[date]['4. close'])
            })).sort((a, b) => a.date.localeCompare(b.date));

            this._setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.error(`Error fetching ${symbol}:`, error);
            return cached ? cached.data : [];
        }
    },

    /**
     * Calculates cumulative IPC between two dates
     */
    calculateAccumulatedIPC(startDate, endDate, ipcData) {
        if (!ipcData || ipcData.length === 0) return 0;

        // Filter IPC data between dates
        // Note: IPC is monthly, so we look for months that have passed
        const relevantIPC = ipcData.filter(item =>
            item.date >= startDate && item.date <= endDate
        );

        // Accumulate: (1 + r1) * (1 + r2) * ...
        let factor = 1;
        relevantIPC.forEach(item => {
            factor *= (1 + item.value);
        });

        return factor - 1;
    },

    /**
     * Helper to get benchmarks in ARS
     */
    async getBenchmarkInARS(symbol, mepHistory) {
        const history = await this.getBenchmarkHistory(symbol);

        return history.map(item => {
            const mepRate = mepService.findClosestRate(item.date, mepHistory);
            return {
                date: item.date,
                priceUSD: item.close,
                priceARS: item.close * (mepRate || 1)
            };
        });
    },

    // Cache Helpers
    _getCache(key) {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    },

    _setCache(key, data) {
        localStorage.setItem(key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    },

    _isExpired(timestamp, ttl) {
        return (Date.now() - timestamp) > ttl;
    }
};
