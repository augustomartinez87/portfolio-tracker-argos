// src/components/PositionDetailModal.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Calendar, BarChart3, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { data912 } from '../utils/data912';

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatPercentage = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const isBonoPesos = (ticker) => {
  if (!ticker) return false;
  const t = ticker.toUpperCase();
  if (/^T[A-Z0-9]{2,5}$/.test(t)) return true;
  if (/^S[0-9]{2}[A-Z][0-9]$/.test(t)) return true;
  if (/^(DICP|PARP|CUAP|PR13|TC23|TO26|TY24)/.test(t)) return true;
  if (t.startsWith('TTD') || t.startsWith('TTS')) return true;
  if (/^(AL|AE|AN|CO|GD)[0-9]{2}$/.test(t)) return true;
  return false;
};

export default function PositionDetailModal({ open, onClose, position, trades }) {
  const [historical, setHistorical] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [componentError, setComponentError] = useState(null);
  const [selectedDays, setSelectedDays] = useState(90);

  // Error boundary for component crashes
  if (componentError) {
    console.error('PositionDetailModal error:', componentError);
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-lg p-6 text-center max-w-md">
          <p className="text-red-400 mb-4">Error inesperado al cargar el detalle</p>
          <p className="text-slate-400 text-sm mb-4">{componentError.message}</p>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  // Filter trades for this position
  const positionTrades = useMemo(() => {
    try {
      if (!position) return [];
      if (!trades || !Array.isArray(trades)) return [];
      return trades
        .filter(t => t && t.ticker === position.ticker)
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    } catch (err) {
      console.error('Error filtering trades:', err);
      return [];
    }
  }, [trades, position]);

  // Fetch historical data with retry
  useEffect(() => {
    if (!open || !position) return;

    const fetchHistorical = async () => {
      setLoading(true);
      setError(null);

      let attempts = 0;
      const maxAttempts = 3;
      let lastError = null;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          const fromDate = new Date();
          fromDate.setDate(fromDate.getDate() - selectedDays);
          const dateStr = fromDate.toISOString().split('T')[0];

          const data = await data912.getHistorical(position.ticker, dateStr);
          
          // Validate data structure
          if (!Array.isArray(data) || data.length === 0) {
            throw new Error('No hay datos históricos disponibles');
          }

          // Filter out invalid entries
          const validData = data.filter(item => 
            item && 
            item.date && 
            typeof item.c === 'number' && 
            item.c > 0
          );

          if (validData.length === 0) {
            throw new Error('Datos históricos inválidos');
          }

          // Sort by date (oldest first) for proper chart display
          const sortedData = validData.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA.getTime() - dateB.getTime();
          });

          // Take only selected days if we have more data
          const daysAgo = new Date();
          daysAgo.setDate(daysAgo.getDate() - selectedDays);
          
          const filteredData = sortedData.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= daysAgo;
          });

          setHistorical(filteredData);
          setLoading(false);
          return;
          
        } catch (err) {
          lastError = err;
          // Check if it's a peso bond without historical data - don't retry
          if (isBonoPesos(position.ticker)) {
            setError('data912 no tiene almacenado este precio histórico :(');
            setHistorical([]);
            setLoading(false);
            return;
          }
          
          if (attempts < maxAttempts) {
            const delay = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All retries exhausted
      console.error('Error fetching historical data after retries:', lastError);
      setError(lastError instanceof Error ? lastError.message : 'Error cargando históricos después de múltiples intentos');
      setHistorical([]);
      setLoading(false);
    };

    fetchHistorical();
  }, [open, position, selectedDays]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!Array.isArray(historical) || historical.length === 0) {
      return [];
    }
    
    return historical.map(day => {
      try {
        const date = new Date(day.date);
        return {
          date: date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' }),
          price: day.c,
          fullDate: day.date
        };
      } catch (err) {
        console.error('Error processing historical date:', err);
        return null;
      }
    }).filter(Boolean); // Remove null entries
  }, [historical]);

  // Calculate historical stats
  const stats = useMemo(() => {
    if (!Array.isArray(historical) || historical.length === 0) {
      return null;
    }

    try {
      const prices = historical.map(h => h.c).filter(p => typeof p === 'number' && p > 0);
      
      if (prices.length === 0) return null;

      const high = Math.max(...prices);
      const low = Math.min(...prices);
      const first = prices[0];
      const last = prices[prices.length - 1];
      const change = first > 0 ? ((last - first) / first) * 100 : 0;

      return { high, low, change };
    } catch (err) {
      console.error('Error calculating stats:', err);
      return null;
    }
  }, [historical]);

  // Calculate individual trade results with current prices
  const tradesWithResults = useMemo(() => {
    try {
      if (!position) return positionTrades;
      const currentPrice = position.precioActual || 0;
      
      return positionTrades.map(trade => {
        const investedAmount = (trade.cantidad || 0) * (trade.precioCompra || 0);
        const currentValue = (trade.cantidad || 0) * currentPrice;
        const result = currentValue - investedAmount;
        const resultPct = trade.precioCompra > 0 ? (result / investedAmount) * 100 : 0;
        
        return {
          ...trade,
          investedAmount,
          currentValue,
          result,
          resultPct
        };
      });
    } catch (err) {
      console.error('Error calculating trade results:', err);
      return positionTrades;
    }
  }, [position, positionTrades]);

  if (!open) return null;
  
  if (!position) {
    console.error('Position is null or undefined');
    return null;
  }

  // Validate position has required fields
  if (!position.ticker) {
    console.error('Invalid position data:', position);
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-lg p-6 text-center">
          <p className="text-red-400 mb-4">Error al cargar los datos de la posición</p>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const invested = position?.costoTotal || 0;
  const getColorClass = (value) => (value >= 0 ? 'text-emerald-400' : 'text-red-400');

  // Check if position has valid price data
  const isPositionUnavailable = position && (!position.precioActual || position.precioActual === 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl w-full max-w-5xl border border-slate-700 shadow-2xl my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-white font-mono">{position.ticker}</h2>
            {position.assetClass && (
              <span className="inline-block mt-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
                {position.assetClass}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs mb-1">Cantidad</p>
              <p className="text-white font-mono text-lg font-semibold">{position.cantidadTotal}</p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs mb-1">Precio Prom.</p>
              <p className="text-white font-mono text-lg font-semibold">
                {isBonoPesos(position.ticker)
                  ? `$${position.precioPromedio.toFixed(4)}`
                  : formatCurrency(position.precioPromedio)
                }
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs mb-1">Precio Actual</p>
              <p className="text-white font-mono text-lg font-bold">
                {isBonoPesos(position.ticker)
                  ? `$${position.precioActual.toFixed(4)}`
                  : formatCurrency(position.precioActual)
                }
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs mb-1">Invertido</p>
              <p className="text-white font-mono text-lg font-semibold">
                {formatCurrency(invested)}
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-slate-400 text-xs mb-1">Valuación Actual</p>
              <p className="text-white font-mono text-lg font-bold">
                {formatCurrency(position.valuacionActual)}
              </p>
            </div>

            <div className={`rounded-lg p-4 border ${
              position.resultado >= 0
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <p className="text-slate-400 text-xs mb-1">P&L Acumulado</p>
              <p className={`font-mono text-lg font-bold ${getColorClass(position.resultado)}`}>
                {formatCurrency(position.resultado)}
              </p>
              <p className={`text-sm ${getColorClass(position.resultadoPct)}`}>
                {formatPercentage(position.resultadoPct)}
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 col-span-2">
              <p className="text-slate-400 text-xs mb-1">Variación Diaria</p>
              <div className="flex items-center gap-2">
                {position.resultadoDiario >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                <p className={`font-mono text-lg font-bold ${getColorClass(position.resultadoDiario)}`}>
                  {formatCurrency(position.resultadoDiario || 0)}
                </p>
              </div>
              <p className={`text-sm ${getColorClass(position.resultadoDiarioPct)}`}>
                {formatPercentage(position.resultadoDiarioPct || 0)}
              </p>
            </div>
          </div>

          {isPositionUnavailable && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-amber-400 font-medium text-sm">Datos no disponibles</p>
                  <p className="text-amber-300 text-xs mt-1">
                    El ticker <span className="font-mono font-semibold">{position.ticker}</span> no está disponible en data912.com. 
                    Los valores mostrados se basan en el precio de compra.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Historical Price Chart */}
          <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50 mb-6">
            <div className="mb-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                    Precio Histórico
                  </h3>
                  {chartData.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Mostrando {chartData.length} días de datos
                    </p>
                  )}
                </div>

                {/* Filtros de días */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Período:
                  </span>
                  <div className="flex gap-1">
                    {[30, 60, 90, 120, 365].map(days => (
                      <button
                        key={days}
                        onClick={() => setSelectedDays(days)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                          selectedDays === days
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-white'
                        }`}
                      >
                        {days === 365 ? '1A' : `${days}d`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {stats && (
                <div className="flex gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs">Máximo</p>
                    <p className="text-white font-mono font-medium">{formatCurrency(stats.high)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Mínimo</p>
                    <p className="text-white font-mono font-medium">{formatCurrency(stats.low)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Variación 90d</p>
                    <p className={`font-mono font-medium ${getColorClass(stats.change)}`}>
                      {formatPercentage(stats.change)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {isPositionUnavailable ? (
              <div className="flex justify-center items-center h-72">
                <div className="text-center">
                  <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                  <p className="text-amber-300 font-medium">Gráfico no disponible</p>
                  <p className="text-amber-400 text-sm mt-2">Datos históricos no encontrados para este ticker</p>
                </div>
              </div>
            ) : loading ? (
              <div className="flex justify-center items-center h-72">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
                {error}
              </div>
            ) : (!chartData || chartData.length === 0) ? (
              <div className="flex justify-center items-center h-72">
                <p className="text-slate-500">No hay datos históricos disponibles</p>
              </div>
            ) : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      stroke="#475569"
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      tickFormatter={(value) => {
                        try {
                          return `$${Number(value).toFixed(0)}`;
                        } catch {
                          return '$0';
                        }
                      }}
                      stroke="#475569"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                      formatter={(value) => {
                        try {
                          return [formatCurrency(Number(value)), 'Precio'];
                        } catch {
                          return ['Error', 'Precio'];
                        }
                      }}
                      labelFormatter={(label, payload) => {
                        try {
                          if (payload && payload[0] && payload[0].payload) {
                            return payload[0].payload.fullDate || label;
                          }
                          return label;
                        } catch {
                          return label;
                        }
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, fill: '#10b981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Trades Table */}
          <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50">
            <h3 className="text-lg font-bold text-white mb-4">
              Historial de Operaciones ({positionTrades.length})
            </h3>

            {positionTrades.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-500">No hay operaciones registradas para esta posición</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Fecha</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Tipo</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Cantidad</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Precio</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Invertido</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Valor Actual</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Resultado</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-400 uppercase">% Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {tradesWithResults.map((trade) => (
                      <tr key={trade.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-3 py-3 text-slate-300 text-sm">
                          {new Date(trade.fecha).toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-block px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-semibold">
                            Compra
                          </span>
                        </td>
                        <td className="text-right px-3 py-3 text-white font-mono">{trade.cantidad}</td>
                        <td className="text-right px-3 py-3 text-white font-mono">
                          {isBonoPesos(trade.ticker)
                            ? `$${trade.precioCompra.toFixed(4)}`
                            : formatCurrency(trade.precioCompra)
                          }
                        </td>
                        <td className="text-right px-3 py-3 text-slate-400 font-mono text-sm">
                          {formatCurrency(trade.investedAmount)}
                        </td>
                        <td className="text-right px-3 py-3 text-white font-mono">
                          {formatCurrency(trade.currentValue)}
                        </td>
                        <td className="text-right px-3 py-3 font-mono">
                          <div className={`font-medium ${trade.result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(trade.result)}
                          </div>
                        </td>
                        <td className="text-right px-3 py-3 font-mono">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            trade.resultPct >= 0 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {formatPercentage(trade.resultPct)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    
                    {/* Fila de totales */}
                    {tradesWithResults.length > 0 && (
                      <tr className="bg-slate-900/80 border-t-2 border-emerald-500/30">
                        <td colSpan={4} className="px-3 py-4 text-left">
                          <span className="font-bold text-emerald-400 uppercase tracking-wide text-sm">TOTAL TRADES</span>
                        </td>
                        <td className="text-right px-3 py-4 text-white font-mono font-bold text-sm">
                          {formatCurrency(tradesWithResults.reduce((sum, t) => sum + t.investedAmount, 0))}
                        </td>
                        <td className="text-right px-3 py-4 text-white font-mono font-bold text-sm">
                          {formatCurrency(tradesWithResults.reduce((sum, t) => sum + t.currentValue, 0))}
                        </td>
                        <td className="text-right px-3 py-4 font-mono font-bold">
                          <div className={`font-bold ${tradesWithResults.reduce((sum, t) => sum + t.result, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(tradesWithResults.reduce((sum, t) => sum + t.result, 0))}
                          </div>
                        </td>
                        <td className="text-right px-3 py-4">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            tradesWithResults.reduce((sum, t) => sum + t.result, 0) >= 0 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {formatPercentage(
                              tradesWithResults.reduce((sum, t) => sum + t.investedAmount, 0) > 0
                                ? ((tradesWithResults.reduce((sum, t) => sum + t.result, 0) / tradesWithResults.reduce((sum, t) => sum + t.investedAmount, 0)) * 100)
                                : 0
                            )}
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


