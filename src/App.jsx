import React, { useState, useEffect } from 'react';
import { PlusCircle, TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, Filter, Trash2, Edit2, RefreshCw, AlertCircle, Download } from 'lucide-react';

// Base de datos de tickers con información automática
const TICKERS_DATA = {
  // CEDEARs
  'AAPL': { assetClass: 'CEDEAR', industry: 'Technology', country: 'United States' },
  'GOOGL': { assetClass: 'CEDEAR', industry: 'Technology', country: 'United States' },
  'MSFT': { assetClass: 'CEDEAR', industry: 'Technology', country: 'United States' },
  'MELI': { assetClass: 'CEDEAR', industry: 'Consumer Discretionary', country: 'Argentina' },
  'META': { assetClass: 'CEDEAR', industry: 'Technology', country: 'United States' },
  'NFLX': { assetClass: 'CEDEAR', industry: 'Communication', country: 'United States' },
  'SPY': { assetClass: 'CEDEAR', industry: 'ETF', country: 'United States' },
  'IBIT': { assetClass: 'CEDEAR', industry: 'ETF', country: 'United States' },
  'VIST': { assetClass: 'CEDEAR', industry: 'Materials', country: 'United States' },
  'VALE': { assetClass: 'CEDEAR', industry: 'Materials', country: 'Brazil' },
  'NU': { assetClass: 'CEDEAR', industry: 'Financials', country: 'Brazil' },
  'TSLA': { assetClass: 'CEDEAR', industry: 'Consumer Discretionary', country: 'United States' },
  'NVDA': { assetClass: 'CEDEAR', industry: 'Technology', country: 'United States' },
  'AMD': { assetClass: 'CEDEAR', industry: 'Technology', country: 'United States' },
  'AMZN': { assetClass: 'CEDEAR', industry: 'Consumer Discretionary', country: 'United States' },
  'DIS': { assetClass: 'CEDEAR', industry: 'Communication', country: 'United States' },
  'KO': { assetClass: 'CEDEAR', industry: 'Consumer Staples', country: 'United States' },
  'WMT': { assetClass: 'CEDEAR', industry: 'Consumer Staples', country: 'United States' },
  'BA': { assetClass: 'CEDEAR', industry: 'Industrials', country: 'United States' },
  'XOM': { assetClass: 'CEDEAR', industry: 'Energy', country: 'United States' },

  // Acciones Argentinas
  'GGAL': { assetClass: 'Acción Argentina', industry: 'Financials', country: 'Argentina' },
  'YPFD': { assetClass: 'Acción Argentina', industry: 'Energy', country: 'Argentina' },
  'PAMP': { assetClass: 'Acción Argentina', industry: 'Energy', country: 'Argentina' },
  'ALUA': { assetClass: 'Acción Argentina', industry: 'Industrials', country: 'Argentina' },
  'TXAR': { assetClass: 'Acción Argentina', industry: 'Industrials', country: 'Argentina' },
  'LOMA': { assetClass: 'Acción Argentina', industry: 'Energy', country: 'Argentina' },
  'COME': { assetClass: 'Acción Argentina', industry: 'Financials', country: 'Argentina' },
  'SUPV': { assetClass: 'Acción Argentina', industry: 'Consumer Staples', country: 'Argentina' },
  'TGSU2': { assetClass: 'Acción Argentina', industry: 'Utilities', country: 'Argentina' },
  'MIRG': { assetClass: 'Acción Argentina', industry: 'Real Estate', country: 'Argentina' },
  'CRES': { assetClass: 'Acción Argentina', industry: 'Real Estate', country: 'Argentina' },
  'BBAR': { assetClass: 'Acción Argentina', industry: 'Financials', country: 'Argentina' },

  // Bonos Hard Dollar
  'AE38': { assetClass: 'Bonos Hard Dollar', industry: 'Fixed Income', country: 'Argentina' },
  'AL30': { assetClass: 'Bonos Hard Dollar', industry: 'Fixed Income', country: 'Argentina' },
  'AL35': { assetClass: 'Bonos Hard Dollar', industry: 'Fixed Income', country: 'Argentina' },
  'GD30': { assetClass: 'Bonos Hard Dollar', industry: 'Fixed Income', country: 'Argentina' },
  'GD35': { assetClass: 'Bonos Hard Dollar', industry: 'Fixed Income', country: 'Argentina' },
  'GD38': { assetClass: 'Bonos Hard Dollar', industry: 'Fixed Income', country: 'Argentina' },
  'GD41': { assetClass: 'Bonos Hard Dollar', industry: 'Fixed Income', country: 'Argentina' },
  'GD46': { assetClass: 'Bonos Hard Dollar', industry: 'Fixed Income', country: 'Argentina' },

  // Bonos en Pesos
  'T15E7': { assetClass: 'Bonos en Pesos', industry: 'Fixed Income', country: 'Argentina' },
  'TTD26': { assetClass: 'Bonos en Pesos', industry: 'Fixed Income', country: 'Argentina' },
  'S29E5': { assetClass: 'Bonos en Pesos', industry: 'Fixed Income', country: 'Argentina' },
  'TX26': { assetClass: 'Bonos en Pesos', industry: 'Fixed Income', country: 'Argentina' },
  'TZX26': { assetClass: 'Bonos en Pesos', industry: 'Fixed Income', country: 'Argentina' },
};

const PortfolioTracker = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [trades, setTrades] = useState([]);
  const [currentPrices, setCurrentPrices] = useState({});
  const [filteredPositions, setFilteredPositions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);

  // Filtros
  const [filterAssetClass, setFilterAssetClass] = useState('all');
  const [filterIndustry, setFilterIndustry] = useState('all');

  // Cotizaciones
  const [usdMep, setUsdMep] = useState(1468.19);
  const [usdCcl, setUsdCcl] = useState(1511.56);

  // Form para nuevo trade
  const [newTrade, setNewTrade] = useState({
    date: new Date().toISOString().split('T')[0],
    ticker: '',
    quantity: '',
    buyPrice: ''
  });

  // Formato peso argentino
  const formatARS = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Agrupar trades por ticker para el dashboard
  const groupTradesByTicker = () => {
    const grouped = {};

    trades.forEach(trade => {
      if (!grouped[trade.ticker]) {
        grouped[trade.ticker] = {
          ticker: trade.ticker,
          assetClass: trade.assetClass,
          industry: trade.industry,
          country: trade.country,
          totalQuantity: 0,
          totalInvested: 0,
          trades: []
        };
      }

      grouped[trade.ticker].totalQuantity += trade.quantity;
      grouped[trade.ticker].totalInvested += trade.quantity * trade.buyPrice;
      grouped[trade.ticker].trades.push(trade);
    });

    // Calcular PPC y crear posiciones
    return Object.values(grouped).map(group => ({
      ticker: group.ticker,
      assetClass: group.assetClass,
      industry: group.industry,
      country: group.country,
      quantity: group.totalQuantity,
      avgPrice: group.totalInvested / group.totalQuantity, // PPC ponderado
      currentPrice: currentPrices[group.ticker] || group.totalInvested / group.totalQuantity,
      trades: group.trades
    }));
  };

  useEffect(() => {
    loadTrades();
    loadCurrentPrices();
    loadLastSnapshot();
  }, []);

  useEffect(() => {
    const positions = groupTradesByTicker();
    let filtered = [...positions];

    if (filterAssetClass !== 'all') {
      filtered = filtered.filter(p => p.assetClass === filterAssetClass);
    }

    if (filterIndustry !== 'all') {
      filtered = filtered.filter(p => p.industry === filterIndustry);
    }

    setFilteredPositions(filtered);
  }, [trades, currentPrices, filterAssetClass, filterIndustry]);

  const loadTrades = () => {
    try {
      const stored = localStorage.getItem('portfolio-trades');
      if (stored) {
        const loadedTrades = JSON.parse(stored);
        setTrades(loadedTrades);
      }
    } catch (error) {
      console.log('No hay trades guardados aún');
    }
  };

  const loadCurrentPrices = () => {
    try {
      const stored = localStorage.getItem('portfolio-current-prices');
      if (stored) {
        setCurrentPrices(JSON.parse(stored));
      }
    } catch (error) {
      console.log('No hay precios guardados');
    }
  };

  const loadLastSnapshot = () => {
    try {
      const stored = localStorage.getItem('portfolio-snapshot-yesterday');
      if (stored) {
        setLastPriceUpdate(JSON.parse(stored));
      }
    } catch (error) {
      console.log('No hay snapshot anterior');
    }
  };

  const saveTrades = (updatedTrades) => {
    try {
      localStorage.setItem('portfolio-trades', JSON.stringify(updatedTrades));
      setTrades(updatedTrades);
    } catch (error) {
      console.error('Error guardando trades:', error);
    }
  };

  const saveCurrentPrices = (prices) => {
    try {
      localStorage.setItem('portfolio-current-prices', JSON.stringify(prices));
      setCurrentPrices(prices);
    } catch (error) {
      console.error('Error guardando precios:', error);
    }
  };

  const saveSnapshot = () => {
    const positions = groupTradesByTicker();
    const snapshot = {
      date: new Date().toISOString(),
      positions: positions.map(p => ({
        ticker: p.ticker,
        marketValue: p.quantity * p.currentPrice,
        pnl: (p.quantity * p.currentPrice) - (p.quantity * p.avgPrice)
      }))
    };

    try {
      localStorage.setItem('portfolio-snapshot-yesterday', JSON.stringify(snapshot));
      setLastPriceUpdate(snapshot);
    } catch (error) {
      console.error('Error guardando snapshot:', error);
    }
  };

  const updatePricesFromAPI = async () => {
    setIsUpdatingPrices(true);

    try {
      saveSnapshot();

      const uniqueTickers = [...new Set(trades.map(t => t.ticker))];
      const newPrices = { ...currentPrices };

      for (const ticker of uniqueTickers) {
        try {
          const endpoints = [
            `https://api.data912.com/quote/${ticker}`,
            `https://data912.com/api/quote/${ticker}`,
            `https://api.data912.com/tickers/${ticker}`
          ];

          for (const endpoint of endpoints) {
            try {
              const response = await fetch(endpoint);
              if (response.ok) {
                const data = await response.json();
                const price = data.price || data.last || data.close || data.currentPrice || data.lastPrice;
                if (price) {
                  newPrices[ticker] = parseFloat(price);
                  break;
                }
              }
            } catch (e) {
              continue;
            }
          }
        } catch (error) {
          console.error(`Error actualizando ${ticker}:`, error);
        }
      }

      saveCurrentPrices(newPrices);
      alert('Precios actualizados! (Nota: algunos tickers pueden no haberse actualizado si la API no los reconoce)');
    } catch (error) {
      console.error('Error actualizando precios:', error);
      alert('Error actualizando precios. Verificá la consola del navegador.');
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const parseCSVNumber = (value) => {
    if (!value) return NaN;
    // Eliminar puntos de miles y reemplazar coma decimal por punto
    const cleaned = value.toString().replace(/\./g, '').replace(',', '.');
    const number = parseFloat(cleaned);
    return isNaN(number) ? NaN : number;
  };

  const parseCSVDate = (dateStr) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];

    // Intentar diferentes formatos de fecha
    // Formato DD/MM/YYYY
    const ddmmyyyyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Formato YYYY-MM-DD (ya está correcto)
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }

    // Si no se puede parsear, usar fecha actual
    return new Date().toISOString().split('T')[0];
  };

  const importFromGoogleSheets = async () => {
    setIsImporting(true);
    try {
      const url = 'https://docs.google.com/spreadsheets/d/14kSIrwStgETRML-_1qCOl4F_F-tdXRHTKch5PdwUMLM/gviz/tq?tqx=out:csv&sheet=Trades';
      const response = await fetch(url);
      const csvText = await response.text();

      // Parsear CSV - manejar comas dentro de comillas
      const lines = csvText.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

      console.log('Headers encontrados:', headers);

      const importedTrades = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        // Parsear línea respetando comillas
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let char of lines[i]) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        const dateIdx = headers.findIndex(h => h.toLowerCase().includes('fecha'));
        const tickerIdx = headers.findIndex(h => h.toLowerCase().includes('ticker'));
        const quantityIdx = headers.findIndex(h => h.toLowerCase().includes('cantidad'));
        const priceIdx = headers.findIndex(h => h.toLowerCase().includes('precio'));

        if (values[tickerIdx] && values[quantityIdx] && values[priceIdx]) {
          const ticker = values[tickerIdx].toUpperCase().trim();
          const quantity = parseCSVNumber(values[quantityIdx]);
          const buyPrice = parseCSVNumber(values[priceIdx]);
          const date = parseCSVDate(values[dateIdx]);

          // Validar que los números sean válidos
          if (isNaN(quantity) || isNaN(buyPrice) || quantity <= 0 || buyPrice <= 0) {
            errors.push(`Fila ${i + 1}: ${ticker} - cantidad o precio inválido`);
            continue;
          }

          const tickerData = TICKERS_DATA[ticker] || {
            assetClass: 'CEDEAR',
            industry: 'Unknown',
            country: 'Unknown'
          };

          importedTrades.push({
            id: Date.now() + i,
            date: date,
            ticker: ticker,
            quantity: quantity,
            buyPrice: buyPrice,
            assetClass: tickerData.assetClass,
            industry: tickerData.industry,
            country: tickerData.country
          });
        }
      }

      if (importedTrades.length > 0) {
        saveTrades([...trades, ...importedTrades]);
        let message = `${importedTrades.length} trades importados exitosamente!`;
        if (errors.length > 0) {
          message += `\n\nErrores encontrados (${errors.length}):\n${errors.slice(0, 5).join('\n')}`;
          if (errors.length > 5) message += `\n... y ${errors.length - 5} más`;
        }
        alert(message);
      } else {
        alert('No se encontraron trades válidos para importar.\n\n' + (errors.length > 0 ? errors.join('\n') : ''));
      }
    } catch (error) {
      console.error('Error importando:', error);
      alert('Error al importar desde Google Sheets. Verificá la URL y que la hoja sea pública.');
    } finally {
      setIsImporting(false);
    }
  };

  const addTrade = () => {
    if (!newTrade.ticker || !newTrade.quantity || !newTrade.buyPrice || !newTrade.date) {
      alert('Completá todos los campos obligatorios');
      return;
    }

    const ticker = newTrade.ticker.toUpperCase();
    const tickerData = TICKERS_DATA[ticker] || {
      assetClass: 'CEDEAR',
      industry: 'Unknown',
      country: 'Unknown'
    };

    const trade = {
      id: Date.now(),
      date: newTrade.date,
      ticker: ticker,
      quantity: parseFloat(newTrade.quantity),
      buyPrice: parseFloat(newTrade.buyPrice),
      assetClass: tickerData.assetClass,
      industry: tickerData.industry,
      country: tickerData.country
    };

    saveTrades([...trades, trade]);

    setNewTrade({
      date: new Date().toISOString().split('T')[0],
      ticker: '',
      quantity: '',
      buyPrice: ''
    });
  };

  const deleteTrade = (id) => {
    if (window.confirm('¿Seguro que querés eliminar este trade?')) {
      saveTrades(trades.filter(t => t.id !== id));
    }
  };

  const deleteAllTrades = () => {
    if (window.confirm(`¿Seguro que querés eliminar TODOS los ${trades.length} trades? Esta acción no se puede deshacer.`)) {
      if (window.confirm('Confirmá nuevamente: ¿Eliminar todos los trades?')) {
        saveTrades([]);
        saveCurrentPrices({});
        alert('Todos los trades han sido eliminados.');
      }
    }
  };

  const startEdit = (trade) => {
    setEditingId(trade.id);
    setNewTrade({
      date: trade.date,
      ticker: trade.ticker,
      quantity: trade.quantity.toString(),
      buyPrice: trade.buyPrice.toString()
    });
  };

  const updateTrade = () => {
    const ticker = newTrade.ticker.toUpperCase();
    const tickerData = TICKERS_DATA[ticker] || {
      assetClass: 'CEDEAR',
      industry: 'Unknown',
      country: 'Unknown'
    };

    const updatedTrade = {
      id: editingId,
      date: newTrade.date,
      ticker: ticker,
      quantity: parseFloat(newTrade.quantity),
      buyPrice: parseFloat(newTrade.buyPrice),
      assetClass: tickerData.assetClass,
      industry: tickerData.industry,
      country: tickerData.country
    };

    saveTrades(trades.map(t => t.id === editingId ? updatedTrade : t));
    setEditingId(null);
    setNewTrade({
      date: new Date().toISOString().split('T')[0],
      ticker: '',
      quantity: '',
      buyPrice: ''
    });
  };

  const calculatePositionMetrics = (position) => {
    const invested = position.quantity * position.avgPrice;
    const marketValue = position.quantity * position.currentPrice;
    const pnlArs = marketValue - invested;
    const pnlPct = (pnlArs / invested) * 100;

    let yesterdayValue = null;
    let changeVsYesterday = null;

    if (lastPriceUpdate && lastPriceUpdate.positions) {
      const yesterdayPos = lastPriceUpdate.positions.find(p => p.ticker === position.ticker);
      if (yesterdayPos) {
        yesterdayValue = yesterdayPos.marketValue;
        changeVsYesterday = marketValue - yesterdayValue;
      }
    }

    return { invested, marketValue, pnlArs, pnlPct, yesterdayValue, changeVsYesterday };
  };

  const calculateTotals = (positionsList) => {
    return positionsList.reduce((acc, pos) => {
      const metrics = calculatePositionMetrics(pos);
      return {
        invested: acc.invested + metrics.invested,
        marketValue: acc.marketValue + metrics.marketValue,
        pnlArs: acc.pnlArs + metrics.pnlArs,
        changeVsYesterday: acc.changeVsYesterday + (metrics.changeVsYesterday || 0)
      };
    }, { invested: 0, marketValue: 0, pnlArs: 0, changeVsYesterday: 0 });
  };

  const positions = groupTradesByTicker();
  const totals = calculateTotals(filteredPositions);
  const totalPnlPct = totals.invested > 0 ? (totals.pnlArs / totals.invested) * 100 : 0;

  const assetClassBreakdown = filteredPositions.reduce((acc, pos) => {
    const metrics = calculatePositionMetrics(pos);
    if (!acc[pos.assetClass]) {
      acc[pos.assetClass] = { marketValue: 0, pnl: 0 };
    }
    acc[pos.assetClass].marketValue += metrics.marketValue;
    acc[pos.assetClass].pnl += metrics.pnlArs;
    return acc;
  }, {});

  const assetClasses = Object.keys(assetClassBreakdown).map(key => ({
    name: key,
    value: assetClassBreakdown[key].marketValue,
    pnl: assetClassBreakdown[key].pnl,
    percentage: totals.marketValue > 0 ? (assetClassBreakdown[key].marketValue / totals.marketValue) * 100 : 0
  })).sort((a, b) => b.value - a.value);

  const industries = [...new Set(positions.map(p => p.industry).filter(Boolean))];

  const assetClassColors = {
    'CEDEAR': 'bg-blue-500',
    'Bonos en Pesos': 'bg-yellow-500',
    'Acción Argentina': 'bg-green-500',
    'Bonos Hard Dollar': 'bg-purple-500'
  };

  // Ordenar trades por fecha (más recientes primero)
  const sortedTrades = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-emerald-400" size={32} />
            <div>
              <h1 className="text-2xl font-bold">Portfolio Tracker</h1>
              <p className="text-xs text-slate-400">Gestión Profesional de Inversiones</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-right">
              <div className="text-slate-400 text-xs">USD MEP</div>
              <div className="font-semibold text-emerald-400">{formatARS(usdMep)}</div>
            </div>
            <div className="text-right">
              <div className="text-slate-400 text-xs">USD CCL</div>
              <div className="font-semibold text-blue-400">{formatARS(usdCcl)}</div>
            </div>
            {lastPriceUpdate && (
              <div className="text-right">
                <div className="text-slate-400 text-xs">Último Update</div>
                <div className="font-semibold text-slate-300">
                  {new Date(lastPriceUpdate.date).toLocaleDateString('es-AR')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800">
        <div className="px-6 flex gap-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 font-semibold transition-all relative ${
              activeTab === 'dashboard'
                ? 'text-emerald-400 bg-slate-900'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            Dashboard
            {activeTab === 'dashboard' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`px-6 py-3 font-semibold transition-all relative ${
              activeTab === 'trades'
                ? 'text-emerald-400 bg-slate-900'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            Trades
            {activeTab === 'trades' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"></div>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Botón actualizar precios */}
          <div className="flex justify-end">
            <button
              onClick={updatePricesFromAPI}
              disabled={isUpdatingPrices}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg font-bold transition-all hover:scale-105 shadow-lg disabled:hover:scale-100"
            >
              <RefreshCw className={isUpdatingPrices ? 'animate-spin' : ''} size={20} />
              {isUpdatingPrices ? 'Actualizando...' : 'Actualizar Precios'}
            </button>
          </div>

          {/* Alert si no hay snapshot */}
          {!lastPriceUpdate && trades.length > 0 && (
            <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-l-4 border-yellow-500 p-5 rounded-lg flex items-start gap-4 shadow-lg">
              <AlertCircle className="text-yellow-400 flex-shrink-0 mt-1" size={24} />
              <div>
                <strong className="text-yellow-300 text-base block mb-1">Primera vez usando el tracker</strong>
                <p className="text-slate-300 text-sm">
                  No hay datos del día anterior. Clickeá "Actualizar Precios" para crear el primer snapshot y empezar a comparar variaciones diarias.
                </p>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-slate-400 font-semibold">Market Value</div>
                <DollarSign className="text-blue-400" size={20} />
              </div>
              <div className="text-2xl md:text-3xl font-bold mb-2">{formatARS(totals.marketValue)}</div>
              <div className="text-xs text-slate-400">
                USD: {formatARS(totals.marketValue / usdMep)} MEP
              </div>
              {lastPriceUpdate && totals.changeVsYesterday !== 0 && (
                <div className={`text-sm mt-3 flex items-center gap-1 font-semibold ${totals.changeVsYesterday >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totals.changeVsYesterday >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {formatARS(Math.abs(totals.changeVsYesterday))} vs ayer
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-slate-400 font-semibold">Invertido</div>
                <DollarSign className="text-slate-400" size={20} />
              </div>
              <div className="text-2xl md:text-3xl font-bold mb-2">{formatARS(totals.invested)}</div>
              <div className="text-xs text-slate-400">
                USD: {formatARS(totals.invested / usdMep)} MEP
              </div>
            </div>

            <div className={`p-6 rounded-xl border-2 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] ${totals.pnlArs >= 0 ? 'bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 border-emerald-500' : 'bg-gradient-to-br from-red-900/40 to-red-950/40 border-red-500'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-slate-300 font-semibold">P&L Total</div>
                {totals.pnlArs >= 0 ? <TrendingUp className="text-emerald-400" size={20} /> : <TrendingDown className="text-red-400" size={20} />}
              </div>
              <div className={`text-2xl md:text-3xl font-bold mb-2 ${totals.pnlArs >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatARS(totals.pnlArs)}
              </div>
              <div className="text-xs text-slate-400">
                USD: {formatARS(totals.pnlArs / usdMep)} MEP
              </div>
            </div>

            <div className={`p-6 rounded-xl border-2 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] ${totalPnlPct >= 0 ? 'bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 border-emerald-500' : 'bg-gradient-to-br from-red-900/40 to-red-950/40 border-red-500'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-slate-300 font-semibold">Retorno %</div>
              </div>
              <div className={`text-3xl md:text-4xl font-bold flex items-center gap-2 ${totalPnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalPnlPct >= 0 ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
                {totalPnlPct.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={22} className="text-emerald-400" />
              <span className="font-bold text-lg">Filtros</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-slate-300 font-semibold block mb-2">Asset Class</label>
                <select
                  value={filterAssetClass}
                  onChange={(e) => setFilterAssetClass(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                >
                  <option value="all">Todas</option>
                  <option value="CEDEAR">CEDEARs</option>
                  <option value="Bonos en Pesos">Bonos en Pesos</option>
                  <option value="Acción Argentina">Acciones Argentinas</option>
                  <option value="Bonos Hard Dollar">Bonos Hard Dollar</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-300 font-semibold block mb-2">Industria</label>
                <select
                  value={filterIndustry}
                  onChange={(e) => setFilterIndustry(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                >
                  <option value="all">Todas</option>
                  {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Asset Class Breakdown */}
          {assetClasses.length > 0 && (
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700 shadow-lg">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <PieChart className="text-emerald-400" size={24} />
                Breakdown por Asset Class
              </h3>
              <div className="space-y-3">
                {assetClasses.map((ac) => (
                  <div key={ac.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{ac.name}</span>
                      <span className="font-semibold">{ac.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-700 rounded-full h-3">
                        <div
                          className={`${assetClassColors[ac.name] || 'bg-slate-500'} h-3 rounded-full transition-all`}
                          style={{ width: `${ac.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-slate-400 min-w-[120px] text-right">
                        {formatARS(ac.value)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      P&L: <span className={ac.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {formatARS(ac.pnl)} ({((ac.pnl / (ac.value - ac.pnl)) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Posiciones Table - AGRUPADAS */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700 shadow-lg overflow-x-auto">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <BarChart3 className="text-emerald-400" size={24} />
              Posiciones Consolidadas
            </h3>
            {filteredPositions.length === 0 ? (
              <p className="text-slate-400 text-center py-12 text-lg">No hay posiciones cargadas. Andá a "Trades" para agregar.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b-2 border-slate-700">
                      <th className="pb-4 font-semibold">Ticker</th>
                      <th className="pb-4 font-semibold hidden md:table-cell">Clase</th>
                      <th className="pb-4 text-right font-semibold">Cant.</th>
                      <th className="pb-4 text-right font-semibold hidden lg:table-cell">PPC</th>
                      <th className="pb-4 text-right font-semibold">Precio</th>
                      <th className="pb-4 text-right font-semibold">Market Value</th>
                      <th className="pb-4 text-right font-semibold">P&L</th>
                      <th className="pb-4 text-right font-semibold hidden md:table-cell">vs Ayer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPositions.map((pos) => {
                      const metrics = calculatePositionMetrics(pos);
                      return (
                        <tr key={pos.ticker} className="border-b border-slate-700/50 hover:bg-slate-700/40 transition-colors">
                          <td className="py-4 font-bold text-white">{pos.ticker}</td>
                          <td className="py-4 text-slate-400 hidden md:table-cell">
                            <span className="px-2 py-1 bg-slate-700 rounded text-xs">{pos.assetClass}</span>
                          </td>
                          <td className="py-4 text-right text-slate-300">{pos.quantity}</td>
                          <td className="py-4 text-right text-slate-400 hidden lg:table-cell">{formatARS(pos.avgPrice)}</td>
                          <td className="py-4 text-right text-slate-300 font-semibold">{formatARS(pos.currentPrice)}</td>
                          <td className="py-4 text-right font-bold text-white">{formatARS(metrics.marketValue)}</td>
                          <td className={`py-4 text-right font-bold text-lg ${metrics.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {metrics.pnlPct >= 0 ? '+' : ''}{metrics.pnlPct.toFixed(2)}%
                          </td>
                          <td className={`py-4 text-right font-semibold hidden md:table-cell ${
                            !metrics.changeVsYesterday ? 'text-slate-500' :
                            metrics.changeVsYesterday >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {metrics.changeVsYesterday ? (metrics.changeVsYesterday >= 0 ? '+' : '') + formatARS(metrics.changeVsYesterday) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TRADES TAB */}
      {activeTab === 'trades' && (
        <div className="space-y-6">
          {/* Header con botones */}
          <div className="flex justify-between items-center flex-wrap gap-4">
            <h2 className="text-2xl font-bold">Gestión de Trades</h2>
            <div className="flex gap-3">
              <button
                onClick={deleteAllTrades}
                disabled={trades.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:opacity-50 rounded-lg font-bold transition-all hover:scale-105 shadow-lg disabled:hover:scale-100"
              >
                <Trash2 size={20} />
                Eliminar Todos ({trades.length})
              </button>
              <button
                onClick={importFromGoogleSheets}
                disabled={isImporting}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 rounded-lg font-bold transition-all hover:scale-105 shadow-lg disabled:hover:scale-100"
              >
                <Download className={isImporting ? 'animate-bounce' : ''} size={20} />
                {isImporting ? 'Importando...' : 'Importar Google Sheets'}
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 md:p-8 rounded-xl border border-slate-700 shadow-lg">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <PlusCircle className="text-emerald-400" size={28} />
              {editingId ? 'Editar Trade' : 'Nuevo Trade'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="text-sm text-slate-300 font-semibold block mb-2">Fecha *</label>
                <input
                  type="date"
                  value={newTrade.date}
                  onChange={(e) => setNewTrade({...newTrade, date: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 font-semibold block mb-2">Ticker *</label>
                <input
                  type="text"
                  value={newTrade.ticker}
                  onChange={(e) => setNewTrade({...newTrade, ticker: e.target.value.toUpperCase()})}
                  list="tickers-list"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white uppercase focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  placeholder="AAPL"
                />
                <datalist id="tickers-list">
                  {Object.keys(TICKERS_DATA).map(ticker => (
                    <option key={ticker} value={ticker} />
                  ))}
                </datalist>
                {newTrade.ticker && TICKERS_DATA[newTrade.ticker] && (
                  <p className="text-xs text-emerald-400 mt-1">
                    {TICKERS_DATA[newTrade.ticker].assetClass} - {TICKERS_DATA[newTrade.ticker].industry}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm text-slate-300 font-semibold block mb-2">Cantidad *</label>
                <input
                  type="number"
                  value={newTrade.quantity}
                  onChange={(e) => setNewTrade({...newTrade, quantity: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  placeholder="100"
                  step="0.01"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 font-semibold block mb-2">Precio de Compra (ARS) *</label>
                <input
                  type="number"
                  value={newTrade.buyPrice}
                  onChange={(e) => setNewTrade({...newTrade, buyPrice: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  placeholder="5000.00"
                  step="0.01"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={editingId ? updateTrade : addTrade}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold transition-all hover:scale-105 shadow-lg"
              >
                {editingId ? 'Actualizar' : 'Agregar Trade'}
              </button>
              {editingId && (
                <button
                  onClick={() => {
                    setEditingId(null);
                    setNewTrade({
                      date: new Date().toISOString().split('T')[0],
                      ticker: '',
                      quantity: '',
                      buyPrice: ''
                    });
                  }}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold transition-all hover:scale-105"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Trades */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700 shadow-lg">
            <h3 className="text-xl font-bold mb-6">Todos los Trades ({trades.length})</h3>
            {trades.length === 0 ? (
              <p className="text-slate-400 text-center py-12 text-lg">No hay trades cargados aún.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b-2 border-slate-700">
                      <th className="pb-4 font-semibold">Fecha</th>
                      <th className="pb-4 font-semibold">Ticker</th>
                      <th className="pb-4 font-semibold hidden md:table-cell">Clase</th>
                      <th className="pb-4 text-right font-semibold">Cantidad</th>
                      <th className="pb-4 text-right font-semibold">Precio Compra</th>
                      <th className="pb-4 text-right font-semibold">Precio Actual</th>
                      <th className="pb-4 text-right font-semibold">P&L Trade</th>
                      <th className="pb-4 text-center font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTrades.map((trade) => {
                      const currentPrice = currentPrices[trade.ticker] || trade.buyPrice;
                      const pnl = (currentPrice - trade.buyPrice) * trade.quantity;
                      const pnlPct = ((currentPrice - trade.buyPrice) / trade.buyPrice) * 100;

                      return (
                        <tr key={trade.id} className="border-b border-slate-700/50 hover:bg-slate-700/40 transition-colors">
                          <td className="py-4 text-slate-300">{new Date(trade.date).toLocaleDateString('es-AR')}</td>
                          <td className="py-4 font-bold text-white">{trade.ticker}</td>
                          <td className="py-4 text-slate-400 hidden md:table-cell">
                            <span className="px-2 py-1 bg-slate-700 rounded text-xs">{trade.assetClass}</span>
                          </td>
                          <td className="py-4 text-right text-slate-300">{trade.quantity}</td>
                          <td className="py-4 text-right text-slate-400">{formatARS(trade.buyPrice)}</td>
                          <td className="py-4 text-right text-slate-300 font-semibold">{formatARS(currentPrice)}</td>
                          <td className={`py-4 text-right font-bold ${pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                            <div className="text-xs font-normal">
                              {formatARS(pnl)}
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => startEdit(trade)}
                                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all hover:scale-110"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => deleteTrade(trade.id)}
                                className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-all hover:scale-110"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default PortfolioTracker;