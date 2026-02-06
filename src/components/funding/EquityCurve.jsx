import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { formatARS, formatCompactNumber } from '@/utils/formatters';
import {
  gridProps,
  axisProps,
  legendProps,
  ChartTooltip,
} from '@/utils/chartTheme';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Encuentra VCP en una fecha, o el más cercano anterior
 */
const findVcp = (vcpMap, date) => {
  if (!vcpMap) return null;
  if (vcpMap[date]) return Number(vcpMap[date]);
  const dates = Object.keys(vcpMap).sort();
  let closest = null;
  for (const d of dates) {
    if (d <= date) closest = d;
    else break;
  }
  return closest ? Number(vcpMap[closest]) : null;
};

/**
 * Genera array de fechas YYYY-MM-DD entre start y end (inclusive)
 */
const dateRange = (startStr, endStr) => {
  const dates = [];
  const current = new Date(startStr + 'T12:00:00');
  const end = new Date(endStr + 'T12:00:00');
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

/**
 * Equity Curve del Carry Trade
 * Muestra evolución diaria de: Ganancia FCI, Costo Cauciones, P&L Neto
 * Soporta filtros por período (30d, 90d, Todo) y por mes
 */
export function EquityCurve({ fciLots = [], cauciones = [], vcpHistoricos = {}, dataStartDate }) {
  const [filterType, setFilterType] = useState('days'); // 'days' | 'month'
  const [daysPeriod, setDaysPeriod] = useState(90);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Generar opciones de meses disponibles desde dataStartDate hasta hoy
  const availableMonths = useMemo(() => {
    const months = [];
    const start = new Date((dataStartDate || '2026-01-16') + 'T12:00:00');
    const now = new Date();
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= now) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        key,
        label: `${MONTH_NAMES[current.getMonth()]} ${current.getFullYear().toString().slice(2)}`,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  }, [dataStartDate]);

  // Calcular TODOS los datos (sin filtrar por período) para tener la serie completa
  const allChartData = useMemo(() => {
    if (!fciLots.length || !cauciones.length || !Object.keys(vcpHistoricos).length) return [];

    const todayStr = new Date().toISOString().split('T')[0];
    const startDate = dataStartDate || '2026-01-16';
    const allDates = dateRange(startDate, todayStr);

    // Pre-procesar cauciones
    const caucionesProcessed = (cauciones || []).map(c => {
      const inicio = String(c.fecha_inicio || '').split('T')[0];
      const fin = String(c.fecha_fin || '').split('T')[0];
      const dias = Number(c.dias || 0) || Math.max(1, Math.round((new Date(fin) - new Date(inicio)) / (1000 * 60 * 60 * 24)));
      const interes = Number(c.interes || 0);
      const interesDiario = dias > 0 ? interes / dias : 0;
      return { inicio, fin, interesDiario, interes };
    }).filter(c => c.inicio > dataStartDate);

    return allDates.map(fecha => {
      let fciPnl = 0;
      for (const lot of fciLots) {
        const fechaSub = String(lot.fecha_suscripcion || '').split('T')[0];
        if (fechaSub > fecha) continue;

        const fciId = lot.fci_id || lot.fciId;
        const vcpMap = vcpHistoricos[fciId];
        if (!vcpMap) continue;

        const vcpHoy = findVcp(vcpMap, fecha);
        const cuotapartes = Number(lot.cuotapartes || 0);
        if (!vcpHoy || !cuotapartes) continue;

        const baseDate = fechaSub > startDate ? fechaSub : startDate;
        const vcpBase = findVcp(vcpMap, baseDate);
        if (!vcpBase) continue;

        fciPnl += cuotapartes * (vcpHoy - vcpBase);
      }

      let interesAcumulado = 0;
      for (const c of caucionesProcessed) {
        if (c.inicio > fecha) continue;
        if (fecha >= c.fin) {
          interesAcumulado += c.interes;
        } else {
          const diasTranscurridos = Math.max(0, Math.round(
            (new Date(fecha) - new Date(c.inicio)) / (1000 * 60 * 60 * 24)
          ));
          interesAcumulado += c.interesDiario * diasTranscurridos;
        }
      }

      const carryPnl = fciPnl - interesAcumulado;

      return {
        fecha,
        fechaLabel: fecha.slice(5),
        fciPnl: Math.round(fciPnl),
        costoIntereses: Math.round(-interesAcumulado),
        carryPnl: Math.round(carryPnl),
      };
    });
  }, [fciLots, cauciones, vcpHistoricos, dataStartDate]);

  // Filtrar datos según el período/mes seleccionado
  const chartData = useMemo(() => {
    if (!allChartData.length) return [];
    if (filterType === 'month') {
      return allChartData.filter(d => d.fecha.startsWith(selectedMonth));
    }
    return daysPeriod >= 9999 ? allChartData : allChartData.slice(-daysPeriod);
  }, [allChartData, filterType, daysPeriod, selectedMonth]);

  // Métricas del período seleccionado (DELTA, no acumulado)
  const periodMetrics = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    const deltaFci = last.fciPnl - first.fciPnl;
    const deltaCosto = last.costoIntereses - first.costoIntereses; // negativo
    const deltaPnl = last.carryPnl - first.carryPnl;
    const dias = chartData.length;
    const promedioDiario = dias > 0 ? deltaPnl / dias : 0;

    return { deltaFci, deltaCosto, deltaPnl, promedioDiario, dias };
  }, [chartData]);

  if (!chartData.length) {
    return (
      <div className="bg-background-secondary rounded-xl p-8 border border-border-primary text-center">
        <p className="text-text-tertiary text-sm">No hay datos suficientes para generar la equity curve.</p>
      </div>
    );
  }

  const lastPoint = chartData[chartData.length - 1];

  // Label del período activo
  const periodLabel = filterType === 'month'
    ? availableMonths.find(m => m.key === selectedMonth)?.label || selectedMonth
    : daysPeriod >= 9999 ? 'Todo' : `${daysPeriod}d`;

  return (
    <div className="space-y-4">
      {/* Header con P&L acumulado total */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className={`font-mono font-bold text-lg ${lastPoint.carryPnl >= 0 ? 'text-success' : 'text-danger'}`}>
            {lastPoint.carryPnl >= 0 ? '+' : ''}{formatARS(lastPoint.carryPnl)}
          </p>
          <p className="text-xs text-text-tertiary">P&L neto acumulado</p>
        </div>

        {/* Selectores de período */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Días */}
          <div className="flex bg-background-tertiary p-1 rounded-lg border border-border-secondary">
            {[
              { label: '30d', value: 30 },
              { label: '90d', value: 90 },
              { label: 'Todo', value: 9999 },
            ].map(p => (
              <button
                key={p.value}
                onClick={() => { setFilterType('days'); setDaysPeriod(p.value); }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  filterType === 'days' && daysPeriod === p.value
                    ? 'bg-primary text-background-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Meses */}
          <div className="flex bg-background-tertiary p-1 rounded-lg border border-border-secondary">
            {availableMonths.map(m => (
              <button
                key={m.key}
                onClick={() => { setFilterType('month'); setSelectedMonth(m.key); }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  filterType === 'month' && selectedMonth === m.key
                    ? 'bg-primary text-background-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorFciGain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.1} />
                <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorInteres" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-danger)" stopOpacity={0.1} />
                <stop offset="95%" stopColor="var(--color-danger)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis
              {...axisProps}
              dataKey="fechaLabel"
              minTickGap={30}
            />
            <YAxis
              {...axisProps}
              tickFormatter={(v) => formatCompactNumber(v)}
            />
            <Tooltip
              content={
                <ChartTooltip
                  labelFormatter={(label) => `${label}`}
                  valueFormatter={(value) => formatARS(Number(value))}
                />
              }
            />
            <Legend {...legendProps} />
            <Area
              type="monotone"
              dataKey="fciPnl"
              name="Ganancia FCI"
              stroke="var(--color-success)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorFciGain)"
              activeDot={{ r: 4, stroke: 'var(--color-success)', strokeWidth: 2, fill: 'var(--bg-primary)' }}
            />
            <Area
              type="monotone"
              dataKey="costoIntereses"
              name="Costo Intereses"
              stroke="var(--color-danger)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorInteres)"
              activeDot={{ r: 4, stroke: 'var(--color-danger)', strokeWidth: 2, fill: 'var(--bg-primary)' }}
            />
            <Area
              type="monotone"
              dataKey="carryPnl"
              name="P&L Neto"
              stroke="var(--color-primary)"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorPnl)"
              activeDot={{ r: 5, stroke: 'var(--color-primary)', strokeWidth: 2, fill: 'var(--bg-primary)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Cards del período seleccionado - DELTA */}
      {periodMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex flex-col items-center justify-center text-center p-3 bg-background-tertiary rounded-lg">
            <p className="text-[10px] text-text-tertiary uppercase">Ganancia FCI</p>
            <p className={`font-mono font-bold text-sm ${periodMetrics.deltaFci >= 0 ? 'text-success' : 'text-danger'}`}>
              {periodMetrics.deltaFci >= 0 ? '+' : ''}{formatARS(periodMetrics.deltaFci)}
            </p>
            <p className="text-[10px] text-text-tertiary mt-0.5">{periodLabel}</p>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-3 bg-background-tertiary rounded-lg">
            <p className="text-[10px] text-text-tertiary uppercase">Costo Intereses</p>
            <p className="font-mono font-bold text-danger text-sm">
              {formatARS(periodMetrics.deltaCosto)}
            </p>
            <p className="text-[10px] text-text-tertiary mt-0.5">{periodLabel}</p>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-3 bg-background-tertiary rounded-lg">
            <p className="text-[10px] text-text-tertiary uppercase">P&L Neto</p>
            <p className={`font-mono font-bold text-sm ${periodMetrics.deltaPnl >= 0 ? 'text-success' : 'text-danger'}`}>
              {periodMetrics.deltaPnl >= 0 ? '+' : ''}{formatARS(periodMetrics.deltaPnl)}
            </p>
            <p className="text-[10px] text-text-tertiary mt-0.5">{periodLabel}</p>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-3 bg-background-tertiary rounded-lg">
            <p className="text-[10px] text-text-tertiary uppercase">Promedio Diario</p>
            <p className={`font-mono font-bold text-sm ${periodMetrics.promedioDiario >= 0 ? 'text-success' : 'text-danger'}`}>
              {periodMetrics.promedioDiario >= 0 ? '+' : ''}{formatARS(Math.round(periodMetrics.promedioDiario))}
            </p>
            <p className="text-[10px] text-text-tertiary mt-0.5">{periodMetrics.dias} días</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default EquityCurve;
