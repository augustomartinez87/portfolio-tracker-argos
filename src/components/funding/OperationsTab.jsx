import React, { useMemo } from 'react';
import { Receipt, TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle, Calculator, Info } from 'lucide-react';
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
 * Helper: Busca VCP en fecha específica, o el más cercano anterior si no existe
 */
const findVcpAtDate = (vcpMap, targetDate) => {
  if (!vcpMap || Object.keys(vcpMap).length === 0) return null;

  // Primero buscar fecha exacta
  if (vcpMap[targetDate]) return vcpMap[targetDate];

  // Si no existe, buscar el precio más cercano anterior
  const dates = Object.keys(vcpMap).sort();
  let closestDate = null;

  for (const date of dates) {
    if (date <= targetDate) {
      closestDate = date;
    } else {
      break;
    }
  }

  return closestDate ? vcpMap[closestDate] : null;
};

/**
 * Calcula PnL de lotes FCI durante un período específico
 */
const calculatePnlForPeriod = (fciLots, vcpHistoricos, fechaInicio, fechaFin) => {
  let totalPnl = 0;

  for (const lot of fciLots) {
    const fciId = lot.fci_id || lot.fciId;
    const vcpMap = vcpHistoricos[fciId];

    if (!vcpMap) continue;

    // Si el lote empezó después del inicio del período, usar fecha_suscripcion
    const startDate = lot.fecha_suscripcion > fechaInicio ? lot.fecha_suscripcion : fechaInicio;

    // VCP al inicio del período (o vcp_entrada si es posterior)
    const vcpInicio = lot.fecha_suscripcion > fechaInicio
      ? lot.vcp_entrada
      : findVcpAtDate(vcpMap, startDate);

    // VCP al final del período
    const vcpFin = findVcpAtDate(vcpMap, fechaFin);

    if (vcpInicio && vcpFin && lot.cuotapartes) {
      const pnl = lot.cuotapartes * (vcpFin - vcpInicio);
      totalPnl += pnl;
    }
  }

  return totalPnl;
};

/**
 * Pestaña de Operaciones - Cruce real entre FCI y cauciones
 *
 * @param {Object} props
 * @param {Array} props.cauciones - Array de cauciones desde Supabase
 * @param {Array} props.fciLots - Array de lotes FCI activos con sus PnL
 * @param {number} props.fciValuation - Valuación real del FCI (desde fciLotEngine.totals.valuation)
 * @param {number} props.fciTotalPnl - PnL acumulado total del FCI (desde fciLotEngine.totals.pnl)
 * @param {number} props.fciDailyPnl - PnL diario total del FCI (desde fciLotEngine.positions[].pnlDiario)
 * @param {number} props.fciDailyPnlPct - PnL diario % del FCI (pnlDiario / valuation)
 * @param {Date} props.hoy - Fecha de hoy (default: new Date())
 */
export function OperationsTab({
  cauciones,
  fciLots = [],
  fciValuation,
  fciTotalPnl = 0,
  fciDailyPnl = 0,
  fciDailyPnlPct = 0,
  hasTodayPrice = true,
  vcpHistoricos = {},
  hoy = new Date()
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const totals = useMemo(() => {
    const hoyISO = hoy.toISOString().split('T')[0];

    // Capital financiado: SUMA de todas las cauciones activas (visión consolidada)
    const capitalFinanciado = (cauciones || []).reduce(
      (sum, c) => sum + Number(c.capital || 0),
      0
    );

    const interesesAcumulados = (cauciones || []).reduce(
      (sum, c) => sum + Number(c.interes || 0),
      0
    );
    // Calcular valuación total de lotes como referencia
    const lotesValuation = (fciLots || []).reduce(
      (sum, lot) => sum + Number(lot.valuation || 0),
      0
    );
    // Calcular PnL total de lotes (debe coincidir con fciTotalPnl)
    const lotesTotalPnl = (fciLots || []).reduce(
      (sum, lot) => sum + Number(lot.pnlAcumulado || 0),
      0
    );
    const valuation = Number(fciValuation || 0);
    const resultado = valuation - capitalFinanciado;
    const spreadNeto = resultado - interesesAcumulados;
    const spreadPct = capitalFinanciado > 0 ? spreadNeto / capitalFinanciado : 0;

    return {
      todayStr,
      valuation,
      capitalFinanciado,
      interesesAcumulados,
      resultado,
      spreadNeto,
      spreadPct,
      fciTotalPnl: Number(fciTotalPnl || 0),
      fciDailyPnl: Number(fciDailyPnl || 0),
      fciDailyPnlPct: Number(fciDailyPnlPct || 0),
      lotesValuation,
      lotesTotalPnl,
    };
  }, [cauciones, fciValuation, fciTotalPnl, fciDailyPnl, fciDailyPnlPct, fciLots]);

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

      // Calcular ganancia FCI real durante el per?odo de la cauci?n
      // usando precios hist?ricos de VCP
      const fechaFinPeriodo = esVencida ? fechaFinRaw : hoyISO;
      const gananciaFCIAsignada = calculatePnlForPeriod(
        fciLots,
        vcpHistoricos,
        fechaInicioRaw,
        fechaFinPeriodo
      );

      const gananciaPct = capital > 0 ? gananciaFCIAsignada / capital : 0;
      const costoPct = capital > 0 ? interesPagado / capital : 0;
      const spreadPesos = gananciaFCIAsignada - interesPagado;
      const spreadPorcentaje = gananciaPct - costoPct;

      return {
        caucionId: caucion.id,
        identificadorHumano: buildIdentificador(caucion),
        fechaInicio: formatDateAR(fechaInicioRaw),
        fechaFin: formatDateAR(fechaFinRaw),
        capital,
        interesPagado,
        gananciaFCIAsignada,
        spreadPesos,
        spreadPorcentaje,
        estado: esVencida ? 'vencida' : 'activa',
        diasRestantes,
      };
    });
  }, [cauciones, hoy, totals, fciLots, vcpHistoricos]);

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

          {!hasTodayPrice && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
              <Info className="w-4 h-4" />
              <span>No hay VCP de hoy ({todayStr}). El PnL diario se muestra en 0.</span>
            </div>
          )}

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
              subtitle="Total cauciones activas"
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
          <li><strong>Ganancia FCI:</strong> PnL real del FCI durante el período específico de la caución (usando VCP históricos)</li>
          <li><strong>Spread ($):</strong> Ganancia FCI - Interés pagado</li>
          <li><strong>Spread (%):</strong> (Ganancia FCI / Capital) - (Interés / Capital)</li>
        </ul>
      </div>
    </div>
  );
}

export default OperationsTab;
