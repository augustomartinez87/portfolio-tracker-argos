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
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-lg min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
          <BarChart3 className="text-emerald-400" />
          Portfolio Tracker
        </h1>
        <div className="flex flex-wrap gap-2 text-xs md:text-sm text-slate-300">
          <span>MEP: {formatARS(usdMep)}</span>
          <span>·</span>
          <span>CCL: {formatARS(usdCcl)}</span>
          {lastPriceUpdate && (
            <>
              <span>·</span>
              <span className="text-slate-400">
                Último snapshot: {new Date(lastPriceUpdate.date).toLocaleDateString('es-AR')}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'dashboard' 
              ? 'text-emerald-400 border-b-2 border-emerald-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-4 py-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'positions' 
              ? 'text-emerald-400 border-b-2 border-emerald-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Cargar Operaciones
        </button>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Botón actualizar precios */}
          <div className="flex justify-end">
            <button
              onClick={updatePricesFromAPI}
              disabled={isUpdatingPrices}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 rounded font-semibold transition-colors"
            >
              <RefreshCw className={isUpdatingPrices ? 'animate-spin' : ''} size={18} />
              {isUpdatingPrices ? 'Actualizando...' : 'Actualizar Precios'}
            </button>
          </div>

          {/* Alert si no hay snapshot */}
          {!lastPriceUpdate && positions.length > 0 && (
            <div className="bg-yellow-900/30 border border-yellow-600 p-4 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm">
                <strong>Primera vez usando el tracker:</strong> No hay datos del día anterior. 
                Clickeá "Actualizar Precios" para crear el primer snapshot y empezar a comparar variaciones diarias.
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Market Value</div>
              <div className="text-xl md:text-2xl font-bold">{formatARS(totals.marketValue)}</div>
              <div className="text-xs text-slate-400 mt-1">
                USD: {formatARS(totals.marketValue / usdMep)} MEP
              </div>
              {lastPriceUpdate && totals.changeVsYesterday !== 0 && (
                <div className={`text-xs mt-1 flex items-center gap-1 ${totals.changeVsYesterday >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totals.changeVsYesterday >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {formatARS(Math.abs(totals.changeVsYesterday))} vs ayer
                </div>
              )}
            </div>
            
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Invertido</div>
              <div className="text-xl md:text-2xl font-bold">{formatARS(totals.invested)}</div>
              <div className="text-xs text-slate-400 mt-1">
                USD: {formatARS(totals.invested / usdMep)} MEP
              </div>
            </div>

            <div className={`p-4 rounded-lg border-2 ${totals.pnlArs >= 0 ? 'bg-emerald-900/30 border-emerald-600' : 'bg-red-900/30 border-red-600'}`}>
              <div className="text-sm text-slate-400 mb-1">P&L Total</div>
              <div className={`text-xl md:text-2xl font-bold ${totals.pnlArs >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatARS(totals.pnlArs)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                USD: {formatARS(totals.pnlArs / usdMep)} MEP
              </div>
            </div>

            <div className={`p-4 rounded-lg border-2 ${totalPnlPct >= 0 ? 'bg-emerald-900/30 border-emerald-600' : 'bg-red-900/30 border-red-600'}`}>
              <div className="text-sm text-slate-400 mb-1">Retorno %</div>
              <div className={`text-xl md:text-2xl font-bold flex items-center gap-2 ${totalPnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalPnlPct >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                {totalPnlPct.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={20} className="text-slate-400" />
              <span className="font-semibold">Filtros</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-300 block mb-2">Asset Class</label>
                <select
                  value={filterAssetClass}
                  onChange={(e) => setFilterAssetClass(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                >
                  <option value="all">Todas</option>
                  <option value="CEDEAR">CEDEARs</option>
                  <option value="BONOS EN PESOS">Bonos en Pesos</option>
                  <option value="ARGY">Acciones Argentinas</option>
                  <option value="BONOS HARDOLLAR">Bonos Hard Dollar</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-300 block mb-2">Industria</label>
                <select
                  value={filterIndustry}
                  onChange={(e) => setFilterIndustry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                >
                  <option value="all">Todas</option>
                  {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Asset Class Breakdown */}
          {assetClasses.length > 0 && (
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <PieChart className="text-emerald-400" />
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
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 overflow-x-auto">
            <h3 className="text-lg font-semibold mb-4">Posiciones</h3>
            {filteredPositions.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No hay posiciones cargadas. Andá a "Cargar Operaciones" para agregar.</p>
            ) : (
              <table className="w-full text-xs md:text-sm">
                <thead className="border-b border-slate-700">
                  <tr className="text-left text-slate-400">
                    <th className="pb-2">Ticker</th>
                    <th className="pb-2 hidden md:table-cell">Clase</th>
                    <th className="pb-2 text-right">Cant.</th>
                    <th className="pb-2 text-right hidden lg:table-cell">PPC</th>
                    <th className="pb-2 text-right">Precio</th>
                    <th className="pb-2 text-right">Market Value</th>
                    <th className="pb-2 text-right">P&L</th>
                    <th className="pb-2 text-right hidden md:table-cell">vs Ayer</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPositions.map((pos) => {
                    const metrics = calculatePositionMetrics(pos);
                    return (
                      <tr key={pos.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-2 font-semibold">{pos.ticker}</td>
                        <td className="py-2 text-slate-400 text-xs hidden md:table-cell">{pos.assetClass}</td>
                        <td className="py-2 text-right">{pos.quantity}</td>
                        <td className="py-2 text-right text-slate-400 hidden lg:table-cell">{formatARS(pos.avgPrice)}</td>
                        <td className="py-2 text-right">{formatARS(pos.currentPrice)}</td>
                        <td className="py-2 text-right font-semibold">{formatARS(metrics.marketValue)}</td>
                        <td className={`py-2 text-right font-semibold ${metrics.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {metrics.pnlPct.toFixed(2)}%
                        </td>
                        <td className={`py-2 text-right text-xs hidden md:table-cell ${
                          !metrics.changeVsYesterday ? 'text-slate-500' :
                          metrics.changeVsYesterday >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {metrics.changeVsYesterday ? formatARS(metrics.changeVsYesterday) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* POSITIONS TAB */}
      {activeTab === 'positions' && (
        <div className="space-y-6">
          {/* Form */}
          <div className="bg-slate-800 p-4 md:p-6 rounded-lg border border-slate-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <PlusCircle className="text-emerald-400" />
              {editingId ? 'Editar Posición' : 'Nueva Posición'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-300 block mb-2">Ticker *</label>
                <input
                  type="text"
                  value={newPosition.ticker}
                  onChange={(e) => setNewPosition({...newPosition, ticker: e.target.value.toUpperCase()})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white uppercase"
                  placeholder="GGAL"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 block mb-2">Asset Class *</label>
                <select
                  value={newPosition.assetClass}
                  onChange={(e) => setNewPosition({...newPosition, assetClass: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                >
                  <option value="CEDEAR">CEDEAR</option>
                  <option value="BONOS EN PESOS">Bonos en Pesos</option>
                  <option value="ARGY">Acciones Argentinas</option>
                  <option value="BONOS HARDOLLAR">Bonos Hard Dollar</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-300 block mb-2">Cantidad *</label>
                <input
                  type="number"
                  value={newPosition.quantity}
                  onChange={(e) => setNewPosition({...newPosition, quantity: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  placeholder="100"
                  step="0.01"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 block mb-2">Precio Promedio Compra (ARS) *</label>
                <input
                  type="number"
                  value={newPosition.avgPrice}
                  onChange={(e) => setNewPosition({...newPosition, avgPrice: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  placeholder="5000.00"
                  step="0.01"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 block mb-2">Precio Actual (ARS) *</label>
                <input
                  type="number"
                  value={newPosition.currentPrice}
                  onChange={(e) => setNewPosition({...newPosition, currentPrice: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  placeholder="6000.00"
                  step="0.01"
                />
                <p className="text-xs text-slate-400 mt-1">Podés usar "Actualizar Precios" en el Dashboard para traer automáticamente</p>
              </div>

              <div>
                <label className="text-sm text-slate-300 block mb-2">Industria</label>
                <input
                  type="text"
                  value={newPosition.industry}
                  onChange={(e) => setNewPosition({...newPosition, industry: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  placeholder="Financials"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300 block mb-2">País</label>
                <input
                  type="text"
                  value={newPosition.country}
                  onChange={(e) => setNewPosition({...newPosition, country: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  placeholder="Argentina"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={editingId ? updatePosition : addPosition}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded font-semibold transition-colors"
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
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded font-semibold transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {/* Lista de posiciones para editar/eliminar */}
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold mb-4">Posiciones Cargadas ({positions.length})</h3>
            {positions.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No hay posiciones cargadas aún.</p>
            ) : (
              <div className="space-y-2">
                {positions.map((pos) => {
                  const metrics = calculatePositionMetrics(pos);
                  return (
                    <div key={pos.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded hover:bg-slate-700">
                      <div className="flex-1">
                        <div className="font-semibold">{pos.ticker}</div>
                        <div className="text-xs text-slate-400">
                          {pos.assetClass} · {pos.quantity} @ {formatARS(pos.currentPrice)} ·
                          <span className={metrics.pnlArs >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {' '}P&L: {metrics.pnlPct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(pos)}
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deletePosition(pos.id)}
                          className="p-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
                        >
                          <Trash2 size={16} />
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
  );
};

export default PortfolioTracker;

