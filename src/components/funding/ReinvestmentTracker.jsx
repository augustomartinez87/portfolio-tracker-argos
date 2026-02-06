import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Bar, BarChart, Cell,
} from 'recharts';
import { formatARS, formatCompactNumber, formatNumber, toDateString } from '@/utils/formatters';
import {
  gridProps,
  axisProps,
  legendProps,
  ChartTooltip,
  CHART_COLORS,
} from '@/utils/chartTheme';

const formatDateShort = (fechaISO) => {
  if (!fechaISO) return '';
  const [, month, day] = String(fechaISO).split('T')[0].split('-');
  return `${day}/${month}`;
};

/**
 * Reinvestment Tracker - Analiza evolución del capital deployado
 * Muestra si las ganancias se están reinvirtiendo o retirando
 */
export function ReinvestmentTracker({ cauciones = [], dataStartDate }) {
  const analysis = useMemo(() => {
    if (!cauciones.length) return null;

    const hoyISO = toDateString();

    // Filtrar solo cauciones reales
    const reales = cauciones
      .filter(c => {
        const inicio = String(c.fecha_inicio || '').split('T')[0];
        return inicio > dataStartDate;
      })
      .map(c => ({
        inicio: String(c.fecha_inicio || '').split('T')[0],
        fin: String(c.fecha_fin || '').split('T')[0],
        capital: Number(c.capital || 0),
        interes: Number(c.interes || 0),
        tna: Number(c.tna_real || 0),
      }))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));

    if (!reales.length) return null;

    // Agrupar cauciones por semana para detectar reinversión
    const porSemana = {};
    for (const c of reales) {
      const date = new Date(c.inicio + 'T12:00:00');
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Lunes de la semana
      const weekKey = toDateString(weekStart);
      if (!porSemana[weekKey]) porSemana[weekKey] = { capital: 0, count: 0, tnaSum: 0 };
      porSemana[weekKey].capital += c.capital;
      porSemana[weekKey].count += 1;
      porSemana[weekKey].tnaSum += c.tna;
    }

    // Evolución semanal del capital deployado
    const weeklyData = Object.entries(porSemana)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([semana, data]) => ({
        semana,
        semanaLabel: formatDateShort(semana),
        capital: Math.round(data.capital),
        operaciones: data.count,
        tnaPromedio: data.count > 0 ? data.tnaSum / data.count : 0,
      }));

    // Calcular tendencia de capital (primera mitad vs segunda mitad)
    const half = Math.floor(weeklyData.length / 2);
    const firstHalfAvg = half > 0
      ? weeklyData.slice(0, half).reduce((s, w) => s + w.capital, 0) / half
      : 0;
    const secondHalfAvg = half > 0
      ? weeklyData.slice(half).reduce((s, w) => s + w.capital, 0) / (weeklyData.length - half)
      : 0;
    const capitalTrend = firstHalfAvg > 0
      ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
      : 0;

    // Detectar reinversiones: caución nueva que empieza dentro de ±2 días de que vence otra
    let reinversiones = 0;
    let capitalReinvertido = 0;
    for (const c of reales) {
      const hayVencimientoCercano = reales.some(prev => {
        if (prev === c) return false;
        const diffDias = Math.abs(
          (new Date(c.inicio) - new Date(prev.fin)) / (1000 * 60 * 60 * 24)
        );
        return diffDias <= 2 && prev.fin <= c.inicio;
      });
      if (hayVencimientoCercano) {
        reinversiones++;
        capitalReinvertido += c.capital;
      }
    }

    const tasaReinversion = reales.length > 1
      ? (reinversiones / (reales.length - 1)) * 100
      : 0;

    // Capital promedio por operación
    const capitalPromedio = reales.reduce((s, c) => s + c.capital, 0) / reales.length;

    // Capital máximo en una semana
    const maxWeek = weeklyData.reduce((max, w) => w.capital > max.capital ? w : max, weeklyData[0]);

    return {
      weeklyData,
      totalOps: reales.length,
      capitalPromedio,
      capitalTrend,
      reinversiones,
      tasaReinversion,
      capitalReinvertido,
      maxWeek,
    };
  }, [cauciones, dataStartDate]);

  if (!analysis) {
    return (
      <div className="bg-background-secondary rounded-xl p-8 border border-border-primary text-center">
        <p className="text-text-tertiary text-sm">No hay datos suficientes para el tracker de reinversión.</p>
      </div>
    );
  }

  const { weeklyData, totalOps, capitalPromedio, capitalTrend, reinversiones, tasaReinversion, capitalReinvertido, maxWeek } = analysis;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="text-center p-3 bg-background-tertiary rounded-lg">
          <p className="text-text-tertiary text-xs uppercase tracking-wider">Tasa Reinversión</p>
          <p className={`font-mono font-bold text-xl ${tasaReinversion >= 50 ? 'text-success' : 'text-warning'}`}>
            {formatNumber(tasaReinversion, 0)}%
          </p>
          <p className="text-[10px] text-text-tertiary mt-1">
            {reinversiones}/{totalOps > 1 ? totalOps - 1 : 0} renovaciones
          </p>
        </div>
        <div className="text-center p-3 bg-background-tertiary rounded-lg">
          <p className="text-text-tertiary text-xs uppercase tracking-wider">Capital Promedio</p>
          <p className="font-mono font-bold text-xl text-text-primary">
            {formatARS(capitalPromedio)}
          </p>
          <p className="text-[10px] text-text-tertiary mt-1">por operación</p>
        </div>
        <div className="text-center p-3 bg-background-tertiary rounded-lg">
          <p className="text-text-tertiary text-xs uppercase tracking-wider">Tendencia Capital</p>
          <p className={`font-mono font-bold text-xl ${capitalTrend >= 0 ? 'text-success' : 'text-danger'}`}>
            {capitalTrend >= 0 ? '+' : ''}{formatNumber(capitalTrend, 1)}%
          </p>
          <p className="text-[10px] text-text-tertiary mt-1">2da mitad vs 1ra</p>
        </div>
        <div className="text-center p-3 bg-background-tertiary rounded-lg">
          <p className="text-text-tertiary text-xs uppercase tracking-wider">Pico Semanal</p>
          <p className="font-mono font-bold text-xl text-primary">
            {formatARS(maxWeek.capital)}
          </p>
          <p className="text-[10px] text-text-tertiary mt-1">{maxWeek.semanaLabel}</p>
        </div>
      </div>

      {/* Chart de capital semanal */}
      {weeklyData.length >= 2 && (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis
                {...axisProps}
                dataKey="semanaLabel"
                interval="preserveStartEnd"
              />
              <YAxis
                {...axisProps}
                tickFormatter={(v) => formatCompactNumber(v)}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(label) => `Semana del ${label}`}
                    valueFormatter={(value, name) => {
                      if (name === 'Operaciones') return String(value);
                      return formatARS(Number(value));
                    }}
                  />
                }
              />
              <Bar dataKey="capital" name="Capital Deployado" radius={[4, 4, 0, 0]}>
                {weeklyData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.capital >= capitalPromedio ? CHART_COLORS.success : CHART_COLORS.warning}
                    fillOpacity={0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Interpretación */}
      <div className="p-3 bg-background-tertiary rounded-lg border border-border-secondary">
        <p className="text-xs text-text-tertiary">
          {tasaReinversion >= 70
            ? 'Alta reinversión: el capital se renueva consistentemente al vencer las cauciones.'
            : tasaReinversion >= 40
              ? 'Reinversión moderada: parte del capital se renueva al vencimiento.'
              : 'Baja reinversión: el capital no se renueva frecuentemente al vencimiento.'}
          {capitalTrend > 10 && ' El capital deployado está en tendencia creciente.'}
          {capitalTrend < -10 && ' El capital deployado está en tendencia decreciente.'}
        </p>
      </div>
    </div>
  );
}

export default ReinvestmentTracker;
