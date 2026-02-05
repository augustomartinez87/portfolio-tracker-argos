import React, { useMemo } from 'react';
import { Receipt, TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle, Calculator } from 'lucide-react';
import { formatARS, formatPercent } from '@/utils/formatters';
import { Section } from '@/components/common/Section';
import { MetricCard } from '@/components/common/MetricCard';

const formatDateAR = (fechaISO) => {
  if (!fechaISO) return '';
  const [year, month, day] = String(fechaISO).split('T')[0].split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
};

const buildIdentificador = (caucion) => {
  const fecha = String(caucion.fecha_inicio || '').split('T')[0];
  const capital = Number(caucion.capital || 0);
  const capitalFormateado = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(capital);
  const tnaRaw = Number(caucion.tna_real || 0);
  const tnaFormateado = Number.isFinite(tnaRaw) ? tnaRaw.toFixed(2) : '0.00';
  return `${fecha} | $${capitalFormateado} | ${tnaFormateado}%`;
};

/**
 * Pestaña de Operaciones - Cruce real entre FCI y cauciones
 *
 * @param {Object} props
 * @param {Array} props.cauciones - Array de cauciones desde Supabase
 * @param {number} props.fciValuation - Valuación real del FCI (desde fciLotEngine.totals.valuation)
 * @param {number} props.fciTotalPnl - PnL acumulado total del FCI (desde fciLotEngine.totals.pnl)
 * @param {number} props.fciDailyPnl - PnL diario total del FCI (desde fciLotEngine.positions[].pnlDiario)
 * @param {number} props.fciDailyPnlPct - PnL diario % del FCI (pnlDiario / valuation)
 * @param {Date} props.hoy - Fecha de hoy (default: new Date())
 */
export function OperationsTab({
  cauciones,
  fciValuation,
  fciTotalPnl = 0,
  fciDailyPnl = 0,
  fciDailyPnlPct = 0,
  hoy = new Date()
}) {
  const totals = useMemo(() => {
    const capitalFinanciado = (cauciones || []).reduce(
      (sum, c) => sum + Number(c.capital || 0),
      0
    );
    const interesesAcumulados = (cauciones || []).reduce(
      (sum, c) => sum + Number(c.interes || 0),
      0
    );
    const valuation = Number(fciValuation || 0);
    const resultado = valuation - capitalFinanciado;
    const spreadNeto = resultado - interesesAcumulados;
    const spreadPct = capitalFinanciado > 0 ? spreadNeto / capitalFinanciado : 0;

    return {
      valuation,
      capitalFinanciado,
      interesesAcumulados,
      resultado,
      spreadNeto,
      spreadPct,
      fciTotalPnl: Number(fciTotalPnl || 0),
      fciDailyPnl: Number(fciDailyPnl || 0),
      fciDailyPnlPct: Number(fciDailyPnlPct || 0),
    };
  }, [cauciones, fciValuation, fciTotalPnl, fciDailyPnl, fciDailyPnlPct]);

  const rows = useMemo(() => {
    const hoyISO = hoy.toISOString().split('T')[0];

    return (cauciones || []).map((caucion) => {
      const fechaInicioRaw = String(caucion.fecha_inicio || '').split('T')[0];
      const fechaFinRaw = String(caucion.fecha_fin || '').split('T')[0];
      const esVencida = fechaFinRaw && fechaFinRaw < hoyISO;
      const diasRestantes = fechaFinRaw
        ? Math.max(0, Math.round((new Date(fechaFinRaw).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      const capital = Number(caucion.capital || 0);
      const interesPagado = Number(caucion.interes || 0);

      const gananciaFCIAsignada = totals.capitalFinanciado > 0
        ? (capital / totals.capitalFinanciado) * totals.fciTotalPnl
        : 0;
      const pnlDiarioAsignado = totals.capitalFinanciado > 0
        ? (capital / totals.capitalFinanciado) * totals.fciDailyPnl
        : 0;

      const gananciaPct = capital > 0 ? gananciaFCIAsignada / capital : 0;
      const costoPct = capital > 0 ? interesPagado / capital : 0;
      const spreadPesos = gananciaFCIAsignada - interesPagado;
      const spreadPorcentaje = gananciaPct - costoPct;
      const pnlDiarioPct = capital > 0 ? pnlDiarioAsignado / capital : 0;

      return {
        caucionId: caucion.id,
        identificadorHumano: buildIdentificador(caucion),
        fechaInicio: formatDateAR(fechaInicioRaw),
        fechaFin: formatDateAR(fechaFinRaw),
        capital,
        interesPagado,
        gananciaFCIAsignada,
        pnlDiarioAsignado,
        pnlDiarioPct,
        spreadPesos,
        spreadPorcentaje,
        estado: esVencida ? 'vencida' : 'activa',
        diasRestantes,
      };
    });
  }, [cauciones, hoy, totals]);

  if (!cauciones?.length) {
    return (
      <div className="bg-background-secondary rounded-xl p-8 border border-border-primary text-center">
        <Receipt className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">Sin operaciones</h3>
        <p className="text-text-secondary text-sm">
          No hay cauciones cargadas. Cargá operaciones desde la sección de Financiación.
        </p>
      </div>
    );
  }

  if (!fciValuation && fciValuation !== 0) {
    return (
      <div className="bg-background-secondary rounded-xl p-8 border border-border-primary text-center">
        <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">Sin valuación FCI</h3>
        <p className="text-text-secondary text-sm">
          No hay valuación FCI disponible desde el motor de lotes. Verificá el módulo FCI.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-background-secondary rounded-xl border border-border-primary shadow-lg">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-text-primary">Totales</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Valuación FCI"
              value={formatARS(totals.valuation)}
              subtitle="Fuente: FCI Lot Engine"
              icon={TrendingUp}
              status="info"
            />
            <MetricCard
              title="Capital financiado"
              value={formatARS(totals.capitalFinanciado)}
              subtitle="Sumatoria de cauciones"
              icon={Receipt}
              status="info"
            />
            <MetricCard
              title="Intereses acumulados"
              value={formatARS(totals.interesesAcumulados)}
              subtitle="Costo total cauciones"
              icon={TrendingDown}
              status="warning"
            />
            <MetricCard
              title="Spread neto"
              value={formatARS(totals.spreadNeto)}
              subtitle={`Resultado: ${formatARS(totals.resultado)} | ${formatPercent(totals.spreadPct * 100)}`}
              icon={Calculator}
              status={totals.spreadNeto >= 0 ? 'success' : 'danger'}
            />
          </div>
        </div>
      </div>

      <Section title="Detalle por Caución" icon={Receipt}>
        <div className="bg-background-secondary rounded-xl border border-border-primary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-background-tertiary border-b border-border-secondary">
                  <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Caución
                  </th>
                  <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Inicio
                  </th>
                  <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Fin
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Capital
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Interés pagado
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Ganancia FCI
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    PnL diario
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    PnL diario (%)
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Spread ($)
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Spread (%)
                  </th>
                  <th className="text-center text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-secondary">
                {rows.map((row, index) => (
                  <tr
                    key={row.caucionId}
                    className={index % 2 === 0 ? 'bg-background-secondary' : 'bg-background-primary'}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-mono text-text-primary">
                        {row.identificadorHumano}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-text-secondary">{row.fechaInicio}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-text-secondary">{row.fechaFin}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono text-text-primary">{formatARS(row.capital)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono text-danger">{formatARS(row.interesPagado)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-mono ${row.gananciaFCIAsignada >= 0 ? 'text-success' : 'text-danger'}`}>
                        {row.gananciaFCIAsignada >= 0 ? '+' : ''}{formatARS(row.gananciaFCIAsignada)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-mono ${row.pnlDiarioAsignado >= 0 ? 'text-success' : 'text-danger'}`}>
                        {row.pnlDiarioAsignado >= 0 ? '+' : ''}{formatARS(row.pnlDiarioAsignado)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-mono ${row.pnlDiarioPct >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatPercent(row.pnlDiarioPct * 100)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-mono font-semibold ${row.spreadPesos >= 0 ? 'text-success' : 'text-danger'}`}>
                        {row.spreadPesos >= 0 ? '+' : ''}{formatARS(row.spreadPesos)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-mono ${row.spreadPorcentaje >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatPercent(row.spreadPorcentaje * 100)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.estado === 'vencida' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-text-tertiary/10 text-text-tertiary">
                          <CheckCircle className="w-3 h-3" />
                          Vencida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          <Clock className="w-3 h-3" />
                          Activa
                          {row.diasRestantes > 0 && (
                            <span className="text-text-tertiary">({row.diasRestantes}d)</span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <div className="bg-background-tertiary rounded-xl p-4 border border-border-secondary">
        <h4 className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Metodología de cálculo
        </h4>
        <ul className="text-xs text-text-tertiary space-y-1 list-disc list-inside">
          <li><strong>Ganancia FCI:</strong> Se asigna proporcional al capital financiado</li>
          <li><strong>PnL diario:</strong> Se distribuye proporcionalmente por capital financiado</li>
          <li><strong>Spread ($):</strong> Ganancia FCI - Interés pagado</li>
          <li><strong>Spread (%):</strong> Ganancia % - Costo % (ambos sobre capital)</li>
        </ul>
      </div>
    </div>
  );
}

export default OperationsTab;
