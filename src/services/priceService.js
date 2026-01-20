// src/services/priceService.js
import { API_ENDPOINTS, CONSTANTS } from '../utils/constants';
import { isBonoPesos, isBonoHardDollar, getAssetClass, adjustBondPrice } from '../hooks/useBondPrices';
import { data912 } from '../utils/data912';

export class PriceService {
  constructor() {
    this.cache = new Map();
    this.lastFetch = null;
  }

  async fetchAllPrices() {
    const startTime = Date.now();
    const priceMap = {};
    const tickerList = [];
    let mepRate = CONSTANTS.MEP_DEFAULT;
    let mepCount = 0;

    try {
      // Fetch from MEP endpoint (bonds + cedears)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const mepResponse = await fetch(API_ENDPOINTS.MEP, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      if (!mepResponse.ok) throw new Error('Failed to fetch MEP data');
      const mepData = await mepResponse.json();

      mepData.forEach(item => {
        const ticker = item.ticker;
        const assetClass = getAssetClass(ticker, item.panel);
        let rawPrice = item.ars_bid || item.mark || item.close || 0;
        const adjustedPrice = adjustBondPrice(ticker, rawPrice);

        priceMap[ticker] = {
          precio: adjustedPrice,
          precioRaw: rawPrice,
          bid: item.ars_bid,
          ask: item.ars_ask,
          close: item.close,
          panel: item.panel,
          assetClass,
          pctChange: null,
          isBonoPesos: isBonoPesos(ticker),
          isBonoHD: isBonoHardDollar(ticker)
        };

        tickerList.push({ ticker, panel: item.panel, assetClass });

        // Calculate MEP from liquid cedears
        if (item.mark > 1400 && item.mark < 1600 && item.panel === 'cedear') {
          mepRate += item.mark;
          mepCount++;
        }
      });

      if (mepCount > 0) {
        mepRate = mepRate / mepCount;
      }

      // Fetch Argentine stocks
      await this.fetchStocks(priceMap, tickerList);

      // Fetch CEDEARs
      await this.fetchCedears(priceMap);

      this.lastFetch = Date.now();
      
      return {
        prices: priceMap,
        tickers: tickerList.sort((a, b) => a.ticker.localeCompare(b.ticker)),
        mepRate,
        success: true
      };

    } catch (error) {
      console.error('Error fetching prices:', error);
      return {
        prices: priceMap,
        tickers: tickerList,
        mepRate,
        success: false,
        error: error.message
      };
    }
  }

  async fetchStocks(priceMap, tickerList) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(API_ENDPOINTS.ARG_STOCKS, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('Failed to fetch arg_stocks');
      const data = await response.json();

      data.forEach(item => {
        const ticker = item.symbol;
        if (ticker.endsWith('D')) return;

        const assetClass = getAssetClass(ticker, null, true);

        if (!priceMap[ticker]) {
          priceMap[ticker] = {
            precio: item.c || item.px_ask || item.px_bid,
            bid: item.px_bid,
            ask: item.px_ask,
            close: item.c,
            panel: 'arg_stock',
            assetClass,
            pctChange: item.pct_change
          };
          tickerList.push({ ticker, panel: 'arg_stock', assetClass });
        } else {
          priceMap[ticker].pctChange = item.pct_change;
        }
      });
    } catch (e) {
      console.warn('Could not fetch arg_stocks:', e);
    }
  }

  async fetchCedears(priceMap) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(API_ENDPOINTS.ARG_CEDEARs, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('Failed to fetch arg_cedears');
      const data = await response.json();

      data.forEach(item => {
        const ticker = item.symbol;
        if (ticker.endsWith('D') || ticker.endsWith('C')) return;

        if (priceMap[ticker]) {
          priceMap[ticker].pctChange = item.pct_change;
          if (item.c && item.c > 0) {
            priceMap[ticker].precio = item.c;
            priceMap[ticker].close = item.c;
          }
        }
      });
    } catch (e) {
      console.warn('Could not fetch arg_cedears:', e);
    }
  }

  async refreshPrices(existingPrices, tickers) {
    if (!tickers || tickers.length === 0) return existingPrices;

    const updated = { ...existingPrices };
    
    try {
      const prices = await data912.getBatchPrices(tickers);
      const returns = await data912.getBatchDailyReturns(tickers);

      Object.keys(prices).forEach(ticker => {
        const newPrice = prices[ticker];
        if (newPrice > 0 && updated[ticker]) {
          const adjustedPrice = adjustBondPrice(ticker, newPrice);
          updated[ticker] = {
            ...updated[ticker],
            precio: adjustedPrice,
            precioRaw: newPrice,
            pctChange: returns[ticker] || updated[ticker].pctChange
          };
        }
      });

      return updated;
    } catch (error) {
      console.error('Error refreshing prices:', error);
      return existingPrices;
    }
  }
}

export const priceService = new PriceService();
