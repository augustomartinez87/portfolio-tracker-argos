// src/components/PositionDetailModal.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { X, TrendingUp, TrendingDown, Calendar, BarChart3, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { data912 } from '../utils/data912';
import { isBonoPesos } from '../hooks/useBondPrices';

const formatDateSafe = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

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

export default function PositionDetailModal({ open, onClose, position, trades }) {
  const [historical, setHistorical] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [componentError, setComponentError] = useState(null);
  const [selectedDays, setSelectedDays] = useState(90);

  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  if (componentError) {
    console.error('PositionDetailModal error:', componentError);
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-background-secondary rounded-lg p-6 text-center max-w-md border border-border-primary">
          <p className="text-danger mb-4">Error inesperado al cargar el detalle</p>
          <p className="text-text-tertiary text-sm mb-4">{componentError.message}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-background-tertiary text-text-primary rounded-lg hover:bg-border-primary"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const positionTrades = useMemo(() => {
    try {
      if (!position) return [];
      if (!trades || !Array.isArray(trades)) return [];

      const filtered = trades
        .filter(t => t && t.ticker === position.ticker)
        .sort((a, b) => {
          const dateA = new Date(a.fecha || a.trade_date).getTime();
          const dateB = new Date(b.fecha || b.trade_date).getTime();
          return dateB - dateA;
        });

      // Mapear campos de Supabase al formato esperado por la UI
      return filtered.map(trade => ({
        ...trade,
        fecha: trade.fecha || trade.trade_date,
        cantidad: trade.quantity,
        precioCompra: trade.price,
        tipo: trade.trade_type === 'buy' ? 'compra' : 'venta'
      }));
    } catch (err) {
      console.error('Error filtering trades:', err);
      return [];
    }
  }, [trades, position]);

  // Focus management and ESC key handler
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      modalRef.current?.focus();

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    } else {
      previousFocusRef.current?.focus();
    }
  }, [open, onClose]);

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
          
          if (!Array.isArray(data) || data.length === 0) {
            throw new Error('No hay datos históricos disponibles');
          }

          const validData = data.filter(item => 
            item && 
            item.date && 
            typeof item.c === 'number' && 
            item.c > 0
          );

          if (validData.length === 0) {
            throw new Error('Datos históricos inválidos');
          }

          const sortedData = validData.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA.getTime() - dateB.getTime();
          });

          const cutoffTime = Date.now() - (selectedDays * 24 * 60 * 60 * 1000);
          
          const filteredData = sortedData.filter(item => {
            const itemTime = new Date(item.date).getTime();
            return itemTime >= cutoffTime;
          });

          setHistorical(filteredData);
          setLoading(false);
          return;
          
        } catch (err) {
          lastError = err;
          if (isBonoPesos(position.ticker)) {
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

      console.error('Error fetching historical data after retries:', lastError);
      setError(lastError instanceof Error ? lastError.message : 'Error cargando históricos después de múltiples intentos');
      setHistorical([]);
      setLoading(false);
    };

    fetchHistorical();
  }, [open, position, selectedDays]);

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
    }).filter(Boolean);
  }, [historical]);

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

  if (!position.ticker) {
    console.error('Invalid position data:', position);
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-background-secondary rounded-lg p-6 text-center border border-border-primary">
          <p className="text-danger mb-4">Error al cargar los datos de la posición</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-background-tertiary text-text-primary rounded-lg hover:bg-border-primary"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const invested = position?.costoTotal || 0;
  const getColorClass = (value) => (value >= 0 ? 'text-success' : 'text-danger');
  const isPositionUnavailable = position && (!position.precioActual || position.precioActual === 0);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="position-detail-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-background-secondary rounded-lg w-full max-w-5xl border border-border-primary shadow-2xl my-8 max-h-[90vh] flex flex-col focus:outline-none"
      >
        <div className="p-6 border-b border-border-primary flex justify-between items-start">
          <div>
            <h2 id="position-detail-title" className="text-2xl font-bold text-text-primary font-mono">{position.ticker}</h2>
            {position.assetClass && (
              <span className="inline-block mt-2 px-3 py-1 bg-success/20 text-success rounded-full text-xs font-semibold">
                {position.assetClass}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors p-2" aria-label="Cerrar detalle">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-background-tertiary/50 rounded-lg p-4 border border-border-primary">
              <p className="text-text-tertiary text-xs mb-1">Cantidad</p>
              <p className="text-text-primary font-mono text-lg font-semibold">{position.cantidadTotal}</p>
            </div>

            <div className="bg-background-tertiary/50 rounded-lg p-4 border border-border-primary">
              <p className="text-text-tertiary text-xs mb-1">Precio Prom.</p>
              <p className="text-text-primary font-mono text-lg font-semibold">
                {isBonoPesos(position.ticker)
                  ? `$${position.precioPromedio.toFixed(4)}`
                  : formatCurrency(position.precioPromedio)
                }
              </p>
            </div>

            <div className="bg-background-tertiary/50 rounded-lg p-4 border border-border-primary">
              <p className="text-text-tertiary text-xs mb-1">Precio Actual</p>
              <p className="text-text-primary font-mono text-lg font-bold">
                {isBonoPesos(position.ticker)
                  ? `$${position.precioActual.toFixed(4)}`
                  : formatCurrency(position.precioActual)
                }
              </p>
            </div>

            <div className="bg-background-tertiary/50 rounded-lg p-4 border border-border-primary">
              <p className="text-text-tertiary text-xs mb-1">Invertido</p>
              <p className="text-text-primary font-mono text-lg font-semibold">
                {formatCurrency(invested)}
              </p>
            </div>

            <div className="bg-background-tertiary/50 rounded-lg p-4 border border-border-primary">
              <p className="text-text-tertiary text-xs mb-1">Valuación Actual</p>
              <p className="text-text-primary font-mono text-lg font-bold">
                {formatCurrency(position.valuacionActual)}
              </p>
            </div>

            <div className={`rounded-lg p-4 border ${
              position.resultado >= 0
                ? 'bg-success/10 border-success/30'
                : 'bg-danger/10 border-danger/30'
            }`}>
              <p className="text-text-tertiary text-xs mb-1">P&L Acumulado</p>
              <p className={`font-mono text-lg font-bold ${getColorClass(position.resultado)}`}>
                {formatCurrency(position.resultado)}
              </p>
              <p className={`text-sm ${getColorClass(position.resultadoPct)}`}>
                {formatPercentage(position.resultadoPct)}
              </p>
            </div>

            <div className="bg-background-tertiary/50 rounded-lg p-4 border border-border-primary col-span-2">
              <p className="text-text-tertiary text-xs mb-1">Variación Diaria</p>
              <div className="flex items-center gap-2">
                {position.resultadoDiario >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-success" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-danger" />
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

          <div className="bg-background-tertiary/50 rounded-lg p-5 border border-border-primary mb-6">
            <div className="mb-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-success" />
                    Precio Histórico
                  </h3>
                  {chartData.length > 0 && (
                    <p className="text-xs text-text-tertiary mt-1">
                      Mostrando {chartData.length} días de datos
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary flex items-center gap-1">
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
                            ? 'bg-success text-white'
                            : 'bg-background-tertiary text-text-secondary hover:text-text-primary'
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
                    <p className="text-text-tertiary text-xs">Máximo</p>
                    <p className="text-text-primary font-mono font-medium">{formatCurrency(stats.high)}</p>
                  </div>
                  <div>
                    <p className="text-text-tertiary text-xs">Mínimo</p>
                    <p className="text-text-primary font-mono font-medium">{formatCurrency(stats.low)}</p>
                  </div>
                  <div>
                    <p className="text-text-tertiary text-xs">Variación 90d</p>
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
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
                {error}
              </div>
            ) : isBonoPesos(position.ticker) && (!chartData || chartData.length === 0) ? (
              <div className="flex justify-center items-center h-72">
                <div className="text-center">
                  <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                  <p className="text-amber-300 font-medium">Precio histórico no disponible</p>
                  <p className="text-amber-400 text-sm mt-2">Este bono no tiene datos históricos en data912.com</p>
                </div>
              </div>
            ) : (!chartData || chartData.length === 0) ? (
              <div className="flex justify-center items-center h-72">
                <p className="text-text-tertiary">No hay datos históricos disponibles</p>
              </div>
            ) : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#6b6b6b' }}
                      stroke="#2a2a2a"
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6b6b6b' }}
                      tickFormatter={(value) => {
                        try {
                          return `$${Number(value).toFixed(0)}`;
                        } catch {
                          return '$0';
                        }
                      }}
                      stroke="#2a2a2a"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #1a1a1a',
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

          <div className="bg-background-tertiary/50 rounded-lg p-5 border border-border-primary">
            <h3 className="text-lg font-bold text-text-primary mb-4">
              Historial de Operaciones ({positionTrades.length})
            </h3>

            {positionTrades.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-text-tertiary">No hay operaciones registradas para esta posición</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-primary">
                      <th className="text-left px-3 py-2 text-xs font-medium text-text-tertiary uppercase">Fecha</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-text-tertiary uppercase">Tipo</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-text-tertiary uppercase">Cantidad</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-text-tertiary uppercase">Precio</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-text-tertiary uppercase">Invertido</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-text-tertiary uppercase">Valor Actual</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-text-tertiary uppercase">Resultado</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-text-tertiary uppercase">% Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-primary">
                    {tradesWithResults.map((trade) => (
                      <tr key={trade.id} className="hover:bg-background-tertiary transition-colors">
                        <td className="px-3 py-3 text-text-secondary text-sm">
                          {formatDateSafe(trade.fecha)}
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-block px-2 py-1 bg-success/20 text-success rounded text-xs font-semibold">
                            Compra
                          </span>
                        </td>
                        <td className="text-right px-3 py-3 text-text-primary font-mono">{trade.cantidad}</td>
                        <td className="text-right px-3 py-3 text-text-primary font-mono">
                          {isBonoPesos(trade.ticker)
                            ? `$${trade.precioCompra.toFixed(4)}`
                            : formatCurrency(trade.precioCompra)
                          }
                        </td>
                        <td className="text-right px-3 py-3 text-text-tertiary font-mono text-sm">
                          {formatCurrency(trade.investedAmount)}
                        </td>
                        <td className="text-right px-3 py-3 text-text-primary font-mono">
                          {formatCurrency(trade.currentValue)}
                        </td>
                        <td className="text-right px-3 py-3 font-mono">
                          <div className={`font-medium ${trade.result >= 0 ? 'text-success' : 'text-danger'}`}>
                            {formatCurrency(trade.result)}
                          </div>
                        </td>
                        <td className="text-right px-3 py-3 font-mono">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            trade.resultPct >= 0
                              ? 'bg-success/20 text-success'
                              : 'bg-danger/20 text-danger'
                          }`}>
                            {formatPercentage(trade.resultPct)}
                          </span>
                        </td>
                      </tr>
                    ))}
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
