import { useMemo } from 'react';
import Decimal from 'decimal.js';
import { cryptoPriceService } from '@/features/crypto/services/cryptoPriceService';

export const useCryptoPortfolioEngine = (trades = [], prices = {}) => {
  return useMemo(() => {
    const positionsMap = new Map();

    const sortedTrades = [...trades].sort((a, b) => {
      const da = new Date(a.trade_date || a.date || a.fecha || 0).getTime();
      const db = new Date(b.trade_date || b.date || b.fecha || 0).getTime();
      return da - db;
    });

    for (const trade of sortedTrades) {
      const assetId = cryptoPriceService.resolveId(trade.ticker || trade.asset || '');
      if (!assetId) continue;

      const qty = new Decimal(trade.quantity || 0);
      const price = new Decimal(trade.price || 0);

      if (!positionsMap.has(assetId)) {
        positionsMap.set(assetId, {
          assetId,
          quantity: new Decimal(0),
          totalCost: new Decimal(0)
        });
      }

      const pos = positionsMap.get(assetId);

      if (String(trade.trade_type || trade.type).toLowerCase() === 'sell' || qty.isNegative()) {
        const sellQty = qty.abs();
        if (pos.quantity.gt(0)) {
          const costReduction = pos.totalCost.mul(sellQty.div(pos.quantity));
          pos.quantity = pos.quantity.minus(sellQty);
          pos.totalCost = pos.totalCost.minus(costReduction);
        }
      } else {
        pos.quantity = pos.quantity.plus(qty);
        pos.totalCost = pos.totalCost.plus(qty.mul(price));
      }
    }

    const positions = Array.from(positionsMap.values()).map(pos => {
      const priceData = prices[pos.assetId] || {};
      const currentPrice = new Decimal(priceData.usdt || 0);
      const valuation = pos.quantity.mul(currentPrice);
      const pnl = valuation.minus(pos.totalCost);
      const pnlPct = pos.totalCost.gt(0) ? pnl.div(pos.totalCost).mul(100) : new Decimal(0);
      const change24h = priceData.usdt_24h_change ?? null;
      const dailyPnlPct = (change24h === null || change24h === undefined) ? null : Number(change24h);
      const dailyPnl = dailyPnlPct === null
        ? new Decimal(0)
        : valuation.mul(new Decimal(dailyPnlPct).div(100));

      // Obtener info de la cripto (symbol y name)
      const coinInfo = cryptoPriceService.getCoinInfo(pos.assetId);

      return {
        assetId: pos.assetId,
        symbol: coinInfo?.symbol?.toUpperCase() || pos.assetId.substring(0, 6).toUpperCase(),
        name: coinInfo?.name || 'Desconocido',
        quantity: pos.quantity.toNumber(),
        avgPrice: pos.quantity.gt(0) ? pos.totalCost.div(pos.quantity).toNumber() : 0,
        currentPrice: currentPrice.toNumber(),
        valuation: valuation.toNumber(),
        totalCost: pos.totalCost.toNumber(),
        pnl: pnl.toNumber(),
        pnlPct: pnlPct.toNumber(),
        change24h,
        dailyPnl: dailyPnl.toNumber(),
        dailyPnlPct
      };
    }).filter(p => p.quantity > 0.00000001);

    const totals = positions.reduce((acc, p) => {
      acc.totalCost = acc.totalCost.plus(p.totalCost);
      acc.valuation = acc.valuation.plus(p.valuation);
      return acc;
    }, { totalCost: new Decimal(0), valuation: new Decimal(0) });

    const totalPnl = totals.valuation.minus(totals.totalCost);
    const totalPnlPct = totals.totalCost.gt(0) ? totalPnl.div(totals.totalCost).mul(100) : new Decimal(0);

    return {
      positions,
      totals: {
        invested: totals.totalCost.toNumber(),
        valuation: totals.valuation.toNumber(),
        pnl: totalPnl.toNumber(),
        pnlPct: totalPnlPct.toNumber()
      }
    };
  }, [trades, prices]);
};

export default useCryptoPortfolioEngine;
