import React, { useState, useEffect } from 'react';
import { PlusCircle, TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, Filter, Trash2, Edit2, RefreshCw, AlertCircle } from 'lucide-react';

const PortfolioTracker = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [positions, setPositions] = useState([]);
  const [filteredPositions, setFilteredPositions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);
  
  // Filtros
  const [filterAssetClass, setFilterAssetClass] = useState('all');
  const [filterIndustry, setFilterIndustry] = useState('all');
  
  // Cotizaciones
  const [usdMep, setUsdMep] = useState(1468.19);
  const [usdCcl, setUsdCcl] = useState(1511.56);
  
  // Form para nueva posición
  const [newPosition, setNewPosition] = useState({
    ticker: '',
    assetClass: 'CEDEAR',
    quantity: '',
    avgPrice: '',
    currentPrice: '',
    industry: '',
    country: 'Argentina'
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

  useEffect(() => {
    loadPositions();
    loadLastSnapshot();
  }, []);

  useEffect(() => {
    let filtered = [...positions];
    
    if (filterAssetClass !== 'all') {
      filtered = filtered.filter(p => p.assetClass === filterAssetClass);
    }
    
    if (filterIndustry !== 'all') {
      filtered = filtered.filter(p => p.industry === filterIndustry);
    }
    
    setFilteredPositions(filtered);
  }, [positions, filterAssetClass, filterIndustry]);

  const loadPositions = () => {
    try {
      const stored = localStorage.getItem('portfolio-positions');
      if (stored) {
        setPositions(JSON.parse(stored));
      }
    } catch (error) {
      console.log('No hay posiciones guardadas aún');
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

  const savePositions = (updatedPositions) => {
    try {
      localStorage.setItem('portfolio-positions', JSON.stringify(updatedPositions));
      setPositions(updatedPositions);
    } catch (error) {
      console.error('Error guardando posiciones:', error);
    }
  };

  const saveSnapshot = () => {
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
      // Guardar snapshot actual como "ayer" antes de actualizar
      saveSnapshot();
      
      const updatedPositions = await Promise.all(
        positions.map(async (pos) => {
          try {
            // Intentar diferentes endpoints de data912.com
            const endpoints = [
              `https://api.data912.com/quote/${pos.ticker}`,
              `https://data912.com/api/quote/${pos.ticker}`,
              `https://api.data912.com/tickers/${pos.ticker}`
            ];
            
            for (const endpoint of endpoints) {
              try {
                const response = await fetch(endpoint);
                if (response.ok) {
                  const data = await response.json();
                  // Intentar diferentes estructuras de respuesta
                  const price = data.price || data.last || data.close || data.currentPrice || data.lastPrice;
                  if (price) {
                    return { ...pos, currentPrice: parseFloat(price) };
                  }
                }
              } catch (e) {
                continue;
              }
            }
            
            // Si no se pudo actualizar, mantener precio actual
            return pos;
          } catch (error) {
            console.error(`Error actualizando ${pos.ticker}:`, error);
            return pos;
          }
        })
      );
      
      savePositions(updatedPositions);
      alert('Precios actualizados! (Nota: algunos tickers pueden no haberse actualizado si la API no los reconoce)');
    } catch (error) {
      console.error('Error actualizando precios:', error);
      alert('Error actualizando precios. Verificá la consola del navegador.');
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const addPosition = () => {
    if (!newPosition.ticker || !newPosition.quantity || !newPosition.avgPrice || !newPosition.currentPrice) {
      alert('Completá todos los campos obligatorios');
      return;
    }

    const position = {
      id: Date.now(),
      ...newPosition,
      quantity: parseFloat(newPosition.quantity),
      avgPrice: parseFloat(newPosition.avgPrice),
      currentPrice: parseFloat(newPosition.currentPrice)
    };

    savePositions([...positions, position]);
    
    setNewPosition({
      ticker: '',
      assetClass: 'CEDEAR',
      quantity: '',
      avgPrice: '',
      currentPrice: '',
      industry: '',
      country: 'Argentina'
    });
  };

  const deletePosition = (id) => {
    if (window.confirm('¿Seguro que querés eliminar esta posición?')) {
      savePositions(positions.filter(p => p.id !== id));
    }
  };

  const startEdit = (position) => {
    setEditingId(position.id);
    setNewPosition(position);
  };

  const updatePosition = () => {
    savePositions(positions.map(p => p.id === editingId ? { ...newPosition, id: editingId } : p));
    setEditingId(null);
    setNewPosition({
      ticker: '',
      assetClass: 'CEDEAR',
      quantity: '',
      avgPrice: '',
      currentPrice: '',
      industry: '',
      country: 'Argentina'
    });
  };

  const calculatePositionMetrics = (position) => {
    const invested = position.quantity * position.avgPrice;
    const marketValue = position.quantity * position.currentPrice;
    const pnlArs = marketValue - invested;
    const pnlPct = (pnlArs / invested) * 100;
    
    // Comparación con snapshot anterior
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
    percentage: (assetClassBreakdown[key].marketValue / totals.marketValue) * 100
  })).sort((a, b) => b.value - a.value);

  const industries = [...new Set(positions.map(p => p.industry).filter(Boolean))];

  const assetClassColors = {
    'CEDEAR': 'bg-blue-500',
    'BONOS EN PESOS': 'bg-yellow-500',
    'ARGY': 'bg-green-500',
    'BONOS HARDOLLAR': 'bg-purple-500'
  };

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
            onClick={() => setActiveTab('positions')}
            className={`px-6 py-3 font-semibold transition-all relative ${
              activeTab === 'positions'
                ? 'text-emerald-400 bg-slate-900'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            Cargar Operaciones
            {activeTab === 'positions' && (
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
          {!lastPriceUpdate && positions.length > 0 && (
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
                  <option value="BONOS EN PESOS">Bonos en Pesos</option>
                  <option value="ARGY">Acciones Argentinas</option>
                  <option value="BONOS HARDOLLAR">Bonos Hard Dollar</option>
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

          {/* Posiciones Table */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700 shadow-lg overflow-x-auto">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <BarChart3 className="text-emerald-400" size={24} />
              Posiciones
            </h3>
            {filteredPositions.length === 0 ? (
              <p className="text-slate-400 text-center py-12 text-lg">No hay posiciones cargadas. Andá a "Cargar Operaciones" para agregar.</p>
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
                        <tr key={pos.id} className="border-b border-slate-700/50 hover:bg-slate-700/40 transition-colors">
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

      {/* POSITIONS TAB */}
      {activeTab === 'positions' && (
        <div className="space-y-6">
          {/* Form */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 md:p-8 rounded-xl border border-slate-700 shadow-lg">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <PlusCircle className="text-emerald-400" size={28} />
              {editingId ? 'Editar Posición' : 'Nueva Posición'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="text-sm text-slate-300 font-semibold block mb-2">Ticker *</label>
                <input
                  type="text"
                  value={newPosition.ticker}
                  onChange={(e) => setNewPosition({...newPosition, ticker: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white uppercase focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  placeholder="GGAL"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 font-semibold block mb-2">Asset Class *</label>
                <select
                  value={newPosition.assetClass}
                  onChange={(e) => setNewPosition({...newPosition, assetClass: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                >
                  <option value="CEDEAR">CEDEAR</option>
                  <option value="BONOS EN PESOS">Bonos en Pesos</option>
                  <option value="ARGY">Acciones Argentinas</option>
                  <option value="BONOS HARDOLLAR">Bonos Hard Dollar</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-300 font-semibold block mb-2">Cantidad *</label>
                <input
                  type="number"
                  value={newPosition.quantity}
                  onChange={(e) => setNewPosition({...newPosition, quantity: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  placeholder="100"
                  step="0.01"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 font-semibold block mb-2">Precio Promedio Compra (ARS) *</label>
                <input
                  type="number"
                  value={newPosition.avgPrice}
                  onChange={(e) => setNewPosition({...newPosition, avgPrice: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  placeholder="5000.00"
                  step="0.01"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 font-semibold block mb-2">Precio Actual (ARS) *</label>
                <input
                  type="number"
                  value={newPosition.currentPrice}
                  onChange={(e) => setNewPosition({...newPosition, currentPrice: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  placeholder="6000.00"
                  step="0.01"
                />
                <p className="text-xs text-slate-400 mt-2">Podés usar "Actualizar Precios" en el Dashboard para traer automáticamente</p>
              </div>

              <div>
                <label className="text-sm text-slate-300 font-semibold block mb-2">Industria</label>
                <input
                  type="text"
                  value={newPosition.industry}
                  onChange={(e) => setNewPosition({...newPosition, industry: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  placeholder="Financials"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 font-semibold block mb-2">País</label>
                <input
                  type="text"
                  value={newPosition.country}
                  onChange={(e) => setNewPosition({...newPosition, country: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  placeholder="Argentina"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={editingId ? updatePosition : addPosition}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold transition-all hover:scale-105 shadow-lg"
              >
                {editingId ? 'Actualizar' : 'Agregar Posición'}
              </button>
              {editingId && (
                <button
                  onClick={() => {
                    setEditingId(null);
                    setNewPosition({
                      ticker: '',
                      assetClass: 'CEDEAR',
                      quantity: '',
                      avgPrice: '',
                      currentPrice: '',
                      industry: '',
                      country: 'Argentina'
                    });
                  }}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold transition-all hover:scale-105"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {/* Lista de posiciones para editar/eliminar */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700 shadow-lg">
            <h3 className="text-xl font-bold mb-6">Posiciones Cargadas ({positions.length})</h3>
            {positions.length === 0 ? (
              <p className="text-slate-400 text-center py-12 text-lg">No hay posiciones cargadas aún.</p>
            ) : (
              <div className="space-y-3">
                {positions.map((pos) => {
                  const metrics = calculatePositionMetrics(pos);
                  return (
                    <div key={pos.id} className="flex items-center justify-between p-4 bg-slate-900/60 rounded-lg hover:bg-slate-700/60 transition-all border border-slate-700/50">
                      <div className="flex-1">
                        <div className="font-bold text-lg text-white">{pos.ticker}</div>
                        <div className="text-sm text-slate-400 mt-1">
                          <span className="px-2 py-0.5 bg-slate-700 rounded text-xs mr-2">{pos.assetClass}</span>
                          {pos.quantity} @ {formatARS(pos.currentPrice)} ·
                          <span className={`ml-2 font-semibold ${metrics.pnlArs >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            P&L: {metrics.pnlPct >= 0 ? '+' : ''}{metrics.pnlPct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(pos)}
                          className="p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all hover:scale-110"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => deletePosition(pos.id)}
                          className="p-3 bg-red-600 hover:bg-red-700 rounded-lg transition-all hover:scale-110"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
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

