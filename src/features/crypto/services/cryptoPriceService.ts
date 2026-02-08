
import { supabase } from '@/lib/supabase';

const FALLBACK_TOP_COINS = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
  { id: 'tether', symbol: 'usdt', name: 'Tether' },
  { id: 'binancecoin', symbol: 'bnb', name: 'BNB' },
  { id: 'solana', symbol: 'sol', name: 'Solana' },
  { id: 'ripple', symbol: 'xrp', name: 'XRP' },
  { id: 'usd-coin', symbol: 'usdc', name: 'USD Coin' },
  { id: 'cardano', symbol: 'ada', name: 'Cardano' },
  { id: 'dogecoin', symbol: 'doge', name: 'Dogecoin' },
  { id: 'nexo', symbol: 'nexo', name: 'Nexo' }
];

// Cache keys
const COINS_LIST_CACHE_KEY = 'coingecko-coins-list';
const COINS_LIST_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas
const PRICES_CACHE_KEY = 'crypto-prices-cache';
const PRICES_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Top 100 criptos por market cap (para cache de precios)
const TOP_100_IDS = [
  'bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana', 'ripple', 'usd-coin',
  'cardano', 'dogecoin', 'avalanche-2', 'chainlink', 'tron', 'polkadot',
  'polygon', 'wrapped-bitcoin', 'litecoin', 'internet-computer', 'uniswap',
  'bitcoin-cash', ' Cosmos', 'stellar', 'filecoin', 'okb', 'theta-token',
  'dai', 'huobi-token', 'leo-token', 'kucoin-shares', 'monero', 'ethereum-classic',
  'true-usd', 'crypto-com-chain', 'lido-dao', 'near', 'vechain', 'algorand',
  'quant-network', 'aptos', 'blockstack', 'the-graph', 'elrond-erd-2',
  'aave', 'fantom', 'flow', 'chiliz', 'decentraland', 'tezos', 'eos',
  'frax', 'maker', 'curve-dao-token', 'havven', 'paxos-standard', 'neo',
  'klay-token', 'kava', 'arweave', 'compound-governance-token', 'conflux-token',
  'gala', 'rocket-pool', 'trust-wallet-token', 'pancakeswap-token', 'iota',
  'enjincoin', 'ftx-token', 'zcash', 'dash', 'basic-attention-token',
  'loopring', '1inch', 'celsius-degree-token', 'nexo', 'zilliqa',
  'holotoken', 'decred', 'nem', 'ontology', 'qtum', 'ravencoin',
  'icon', 'iostoken', 'theta-fuel', 'digibyte', 'siacoin',
  'bitcoin-gold', 'lisk', 'nano', 'status', 'omisego',
  '0x', 'augur', 'kucoin-shares', 'swipe', 'band-protocol',
  'balancer', 'serum', 'terra-luna', 'waves', 'bitcoin-diamond'
];

// In-memory cache
let cachedCoinsList: any[] = [];
let cachedPrices: Record<string, any> = {};

interface CoinInfo {
  id: string;
  symbol: string;
  name: string;
}

interface PriceCache {
  prices: Record<string, any>;
  timestamp: number;
}

// Helper para manejar localStorage de forma segura
const storage = {
  get: (key: string) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },
  set: (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('localStorage error:', e);
    }
  },
  remove: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage error:', e);
    }
  }
};

// Retry con backoff exponencial
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 2000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

export const cryptoPriceService = {
  // Obtener lista completa de criptos desde CoinGecko
  async getCoinsList(): Promise<CoinInfo[]> {
    // Verificar cache primero
    const cached = storage.get(COINS_LIST_CACHE_KEY);
    if (cached && Date.now() - cached.timestamp < COINS_LIST_CACHE_TTL) {
      cachedCoinsList = cached.data;
      return cached.data;
    }

    try {
      const { data, error } = await supabase.functions.invoke('fetch-crypto-prices', {
        body: { type: 'list' }
      });

      if (error) throw error;

      const coinsList = (data && data.data) ? data.data : [];

      if (coinsList.length > 0) {
        cachedCoinsList = coinsList;
        storage.set(COINS_LIST_CACHE_KEY, {
          data: coinsList,
          timestamp: Date.now()
        });
      }

      return coinsList;
    } catch (err) {
      console.error('Error fetching coins list:', err);
      // Fallback a cache antiguo si existe
      if (cached) return cached.data;
      return [];
    }
  },

  // Obtener precios (con cache y retry)
  async getPrices(ids: string[] = [], vsCurrency = 'usdt'): Promise<Record<string, any>> {
    if (!ids || ids.length === 0) return {};

    const uniqueIds = Array.from(new Set(ids.map(id => String(id).toLowerCase().trim()))).filter(Boolean);
    if (uniqueIds.length === 0) return {};

    // Map usdt -> usd for CoinGecko API compatibility
    // CoinGecko 'simple/price' endpoint often requires 'usd' instead of 'usdt'
    const isUSDT = vsCurrency.toLowerCase() === 'usdt';
    const targetCurrency = isUSDT ? 'usd' : vsCurrency.toLowerCase();

    // Verificar cache de precios (usando el targetCurrency para la clave, o la logica interna)
    // Para simplificar, ignoramos cache complejo de moneda por ahora o asumimos que siempre piden USDT
    // Si quisieramos cachear bien, deberiamos incluir la moneda en la key o estructura.
    // Por ahora, el cache actual guarda "lo que devuelve la API". Si la API devuelve 'usd', cacheamos 'usd'.

    const cachedPricesData: PriceCache = storage.get(PRICES_CACHE_KEY);
    const now = Date.now();

    if (cachedPricesData && now - cachedPricesData.timestamp < PRICES_CACHE_TTL) {
      // Verificar si tenemos todos los IDs solicitados en cache
      const allCached = uniqueIds.every(id => cachedPricesData.prices[id]);
      if (allCached) {
        // Si pedimos USDT pero en cache hay USD (porque mapeamos antes), debemos devolver USDT
        // Pero el cache guarda el objeto completo { bitcoin: { usd: 50000 } }
        // Si queremos devolver { bitcoin: { usdt: 50000 } }, hacemos mapping.
        const prices = cachedPricesData.prices;
        if (isUSDT) {
          const mapped: Record<string, any> = {};
          for (const id of uniqueIds) {
            if (prices[id]) {
              mapped[id] = {
                ...prices[id],
                usdt: prices[id].usd,
                usdt_24h_change: prices[id].usd_24h_change
              };
            }
          }
          return mapped;
        }
        return prices;
      }
    }

    try {
      const data = await retryWithBackoff(async () => {
        const { data, error } = await supabase.functions.invoke('fetch-crypto-prices', {
          body: {
            type: 'simple',
            ids: uniqueIds,
            vs_currency: targetCurrency,
            include_24hr_change: true
          }
        });

        if (error) throw error;
        return (data && data.data) ? data.data : (data || {});
      });

      // Guardar en cache tal cual devuelve la API (probablemente con key 'usd')
      if (cachedPricesData) {
        cachedPrices = { ...cachedPricesData.prices, ...data };
      } else {
        cachedPrices = data;
      }

      storage.set(PRICES_CACHE_KEY, {
        prices: cachedPrices,
        timestamp: now
      });

      // Si pedimos USDT, mapeamos la respuesta de USD a USDT para el frontend
      if (isUSDT) {
        const mapped: Record<string, any> = {};
        for (const key in data) {
          if (data[key]) {
            mapped[key] = {
              ...data[key],
              usdt: data[key].usd,
              usdt_24h_change: data[key].usd_24h_change
            };
          }
        }
        return mapped;
      }

      return data;
    } catch (err) {
      console.error('Error fetching crypto prices:', err);

      // Fallback a cache si existe
      if (cachedPricesData) {
        console.log('Using cached prices (fallback)');
        if (isUSDT) {
          const mapped: Record<string, any> = {};
          // Best effort mapping from cache
          Object.keys(cachedPricesData.prices).forEach(key => {
            const p = cachedPricesData.prices[key];
            mapped[key] = { ...p, usdt: p.usd || p.usdt, usdt_24h_change: p.usd_24h_change || p.usdt_24h_change };
          });
          return mapped;
        }
        return cachedPricesData.prices;
      }

      return {};
    }
  },

  // Obtener top coins (para autocomplete inicial)
  async getTopCoins(_vsCurrency = 'usdt', perPage = 100): Promise<CoinInfo[]> {
    // Usar la lista completa si está disponible
    if (cachedCoinsList.length > 0) {
      return cachedCoinsList.slice(0, perPage);
    }

    const cached = storage.get(COINS_LIST_CACHE_KEY);
    if (cached && cached.data && cached.data.length > 0) {
      return cached.data.slice(0, perPage);
    }

    // Si no hay cache, intentar obtener lista completa
    try {
      const list = await this.getCoinsList();
      if (list && list.length > 0) {
        return list.slice(0, perPage);
      }
    } catch (e) {
      console.warn('Full list fetch failed, falling back to top markets', e);
    }

    // Fallback robusto: pedir markets (top 100) directamente
    try {
      const { data, error } = await supabase.functions.invoke('fetch-crypto-prices', {
        body: {
          type: 'markets',
          vs_currency: _vsCurrency,
          per_page: perPage,
          page: 1
        }
      });

      if (!error && data && data.data) {
        return data.data;
      }
    } catch (err) {
      console.error('Error fetching top markets:', err);
    }

    return FALLBACK_TOP_COINS.slice(0, perPage);
  },

  // Buscar criptos por query (para autocomplete)
  searchCoins(query: string, coinsList: CoinInfo[]): CoinInfo[] {
    const term = query.trim().toLowerCase();
    if (!term) return coinsList.slice(0, 50);

    return coinsList.filter(c =>
      String(c.id).toLowerCase().includes(term) ||
      String(c.symbol).toLowerCase().includes(term) ||
      String(c.name).toLowerCase().includes(term)
    ).slice(0, 50);
  },

  // Obtener info de una cripto específica
  getCoinInfo(input: string, coinsList?: CoinInfo[]): CoinInfo | undefined {
    const value = String(input || '').trim().toLowerCase();
    if (!value) return undefined;

    const list = coinsList || cachedCoinsList;
    if (!list || list.length === 0) {
      // Fallback a top coins
      return FALLBACK_TOP_COINS.find(c =>
        String(c.id).toLowerCase() === value ||
        String(c.symbol).toLowerCase() === value ||
        String(c.name).toLowerCase() === value
      );
    }

    return list.find(c =>
      String(c.id).toLowerCase() === value ||
      String(c.symbol).toLowerCase() === value ||
      String(c.name).toLowerCase() === value
    );
  },

  // Resolver ID de cripto (versión mejorada con soporte universal)
  resolveId(input: string, coinsList?: CoinInfo[]): string {
    const value = String(input || '').trim().toLowerCase();
    if (!value) return '';

    const list = coinsList || cachedCoinsList;
    if (!list || list.length === 0) {
      // Fallback: buscar en top coins
      const fallback = FALLBACK_TOP_COINS.find(c =>
        String(c.id).toLowerCase() === value ||
        String(c.symbol).toLowerCase() === value ||
        String(c.name).toLowerCase() === value
      );
      return fallback ? fallback.id : value;
    }

    // Buscar por ID exacto
    const byId = list.find(c => String(c.id).toLowerCase() === value);
    if (byId) return byId.id;

    // Buscar por symbol (BTC, ETH)
    const bySymbol = list.find(c => String(c.symbol).toLowerCase() === value);
    if (bySymbol) return bySymbol.id;

    // Buscar por nombre (Bitcoin)
    const byName = list.find(c => String(c.name).toLowerCase() === value);
    if (byName) return byName.id;

    // Si no encuentra, devolver el input limpio
    return value;
  },

  // Verificar si los precios están desactualizados
  arePricesStale(): boolean {
    const cached = storage.get(PRICES_CACHE_KEY);
    if (!cached) return true;
    return Date.now() - cached.timestamp > PRICES_CACHE_TTL;
  },

  // Obtener timestamp del último precio
  getLastPriceUpdate(): number | null {
    const cached = storage.get(PRICES_CACHE_KEY);
    return cached ? cached.timestamp : null;
  },

  getFallbackTopCoins(perPage = 10) {
    return FALLBACK_TOP_COINS.slice(0, perPage);
  },

  // Obtener top 100 IDs para cache
  getTop100Ids(): string[] {
    return TOP_100_IDS;
  }
};

export default cryptoPriceService;
