import React, { useMemo, useState } from 'react';
import { Receipt, Clock, CheckCircle, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { formatARS, formatPercent, formatDateAR, toDateString } from '@/utils/formatters';
import { calculatePnlForPeriod } from '@/utils/vcpHelpers';
import { CONSTANTS } from '@/utils/constants';
import { Section } from '@/components/common/Section';
import { OperationsPositionCards } from './OperationsPositionCards';
import { OperationsPerformance } from './OperationsPerformance';

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
 */
export function OperationsTab({
  cauciones,
  fciLots = [],
  fciValuation,
  fciTotalPnl = 0,
  fciDailyPnl = 0,
  fciDailyPnlPct = 0,
  lastPriceDate = null,
  vcpHistoricos = {},
  dataStartDate = CONSTANTS.DATA_START_DATE,
  hoy = new Date()
}) {
  const todayStr = toDateString();
  const [showSyntheticData, setShowSyntheticData] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState('todas'); // 'todas' | 'activa' | 'vencida'
  const [sortConfig, setSortConfig] = useState({ key: 'fechaInicioRaw', dir: 'desc' });

  // Calcular rows con spread por operación
  const rows = useMemo(() => {
    const hoyISO = toDateString(hoy);

    return (cauciones || []).map((caucion) => {
      const fechaInicioRaw = String(caucion.fecha_inicio || '').split('T')[0];
      const fechaFinRaw = String(caucion.fecha_fin || '').split('T')[0];
      const esVencida = fechaFinRaw && fechaFinRaw < hoyISO;
      const esDatoReal = fechaInicioRaw > dataStartDate;
      const diasRestantes = fechaFinRaw
        ? Math.max(0, Math.round((new Date(fechaFinRaw).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      const capital = Number(caucion.capital || 0);
      const interesPagado = Number(caucion.interes || 0);

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
        fechaInicioRaw,
        fechaFinRaw,
        fechaInicio: formatDateAR(fechaInicioRaw),
        fechaFin: formatDateAR(fechaFinRaw),
        capital,
        interesPagado,
        gananciaFCIAsignada,
        spreadPesos,
        spreadPorcentaje,
        estado: esVencida ? 'vencida' : 'activa',
        esDatoReal,
        diasRestantes,
      };
    });
  }, [cauciones, hoy, fciLots, vcpHistoricos, dataStartDate]);

  // Bug 1 Fix: Totales solo de cauciones VIGENTES
  const totals = useMemo(() => {
    const vigentes = rows.filter(r => r.estado === 'activa');
    const capitalVigente = vigentes.reduce((sum, r) => sum + r.capital, 0);
    const interesesVigentes = vigentes.reduce((sum, r) => sum + r.interesPagado, 0);
    const valuation = Number(fciValuation || 0);
    const cobertura = capitalVigente > 0 ? valuation - capitalVigente : valuation;
    const coberturaRatio = capitalVigente > 0 ? (valuation / capitalVigente) * 100 : 0;

    return {
      valuation,
      capitalVigente,
      interesesVigentes,
      cobertura,
      coberturaRatio,
      cantVigentes: vigentes.length,
    };
  }, [rows, fciValuation]);

  // Mejora 2: Métricas de P&L agregadas (solo datos reales post-16/01)
  const pnlMetrics = useMemo(() => {
    const vencidasReales = rows.filter(r => r.estado === 'vencida' && r.esDatoReal);

    if (vencidasReales.length === 0) return null;

    const pnlTotal = vencidasReales.reduce((sum, r) => sum + r.spreadPesos, 0);
    const ganadoras = vencidasReales.filter(r => r.spreadPesos > 0);
    const winRate = (ganadoras.length / vencidasReales.length) * 100;
    const spreadPromedio = pnlTotal / vencidasReales.length;

    // Mejor y peor operación
    let mejor = vencidasReales[0];
    let peor = vencidasReales[0];
    for (const r of vencidasReales) {
      if (r.spreadPesos > mejor.spreadPesos) mejor = r;
      if (r.spreadPesos < peor.spreadPesos) peor = r;
    }

    // P&L mes actual y mes anterior
    const now = new Date();
    const mesActualStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const mesAnteriorDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const mesAnteriorStr = `${mesAnteriorDate.getFullYear()}-${String(mesAnteriorDate.getMonth() + 1).padStart(2, '0')}`;

    const pnlMesActual = vencidasReales
      .filter(r => r.fechaFinRaw?.startsWith(mesActualStr))
      .reduce((sum, r) => sum + r.spreadPesos, 0);

    const pnlMesAnterior = vencidasReales
      .filter(r => r.fechaFinRaw?.startsWith(mesAnteriorStr))
      .reduce((sum, r) => sum + r.spreadPesos, 0);

    return {
      pnlTotal,
      pnlMesActual,
      pnlMesAnterior,
      winRate,
      spreadPromedio,
      totalOps: vencidasReales.length,
      mejor: { spread: mejor.spreadPesos, fecha: mejor.fechaInicio },
      peor: { spread: peor.spreadPesos, fecha: peor.fechaInicio },
    };
  }, [rows]);

  // Filas filtradas y ordenadas para la tabla
  const displayRows = useMemo(() => {
    let filtered = showSyntheticData ? rows : rows.filter(r => r.esDatoReal);
    if (estadoFilter !== 'todas') {
      filtered = filtered.filter(r => r.estado === estadoFilter);
    }

    // Ordenar
    const { key, dir } = sortConfig;
    const sorted = [...filtered].sort((a, b) => {
      const va = a[key] ?? 0;
      const vb = b[key] ?? 0;
      if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return dir === 'asc' ? va - vb : vb - va;
    });
    return sorted;
  }, [rows, showSyntheticData, estadoFilter, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'desc' }
    );
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortConfig.dir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

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
      {/* Posición Actual - Solo cauciones vigentes */}
      <div className="bg-background-secondary rounded-xl border border-border-primary shadow-lg">
        <OperationsPositionCards
          totals={totals}
          lastPriceDate={lastPriceDate}
          fciDailyPnl={fciDailyPnl}
          fciDailyPnlPct={fciDailyPnlPct}
        />
      </div>

      {/* Panel de P&L Real */}
      <OperationsPerformance pnlMetrics={pnlMetrics} dataStartDate={dataStartDate} />

      {/* Tabla de detalle */}
      <Section title="Detalle por Caución" icon={Receipt}>
        <div className="bg-background-secondary rounded-xl border border-border-primary overflow-hidden">
          {/* Filtros y controles */}
          <div className="px-4 py-3 border-b border-border-secondary flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Filter className="w-3.5 h-3.5 text-text-tertiary" />
              <div className="flex rounded-lg border border-border-secondary overflow-hidden">
                {[
                  { id: 'todas', label: 'Todas' },
                  { id: 'activa', label: 'Activas' },
                  { id: 'vencida', label: 'Vencidas' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setEstadoFilter(opt.id)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${estadoFilter === opt.id
                        ? 'bg-primary text-white'
                        : 'bg-background-tertiary text-text-secondary hover:text-text-primary'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-text-tertiary">
                {displayRows.length} resultado{displayRows.length !== 1 ? 's' : ''}
              </span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-text-tertiary">Pre-{formatDateAR(dataStartDate)}</span>
              <button
                onClick={() => setShowSyntheticData(!showSyntheticData)}
                className={`relative w-9 h-5 rounded-full transition-colors ${showSyntheticData ? 'bg-primary' : 'bg-background-tertiary border border-border-secondary'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${showSyntheticData ? 'translate-x-4 bg-white' : 'translate-x-0.5 bg-text-tertiary'}`} />
              </button>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-background-tertiary border-b border-border-secondary">
                  <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">Caución</th>
                  <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('fechaInicioRaw')}>
                    <span className="inline-flex items-center gap-1">Inicio <SortIcon columnKey="fechaInicioRaw" /></span>
                  </th>
                  <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('fechaFinRaw')}>
                    <span className="inline-flex items-center gap-1">Fin <SortIcon columnKey="fechaFinRaw" /></span>
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('capital')}>
                    <span className="inline-flex items-center gap-1 justify-end">Capital <SortIcon columnKey="capital" /></span>
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('interesPagado')}>
                    <span className="inline-flex items-center gap-1 justify-end">Interés <SortIcon columnKey="interesPagado" /></span>
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('gananciaFCIAsignada')}>
                    <span className="inline-flex items-center gap-1 justify-end">Ganancia FCI <SortIcon columnKey="gananciaFCIAsignada" /></span>
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('spreadPesos')}>
                    <span className="inline-flex items-center gap-1 justify-end">Spread ($) <SortIcon columnKey="spreadPesos" /></span>
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('spreadPorcentaje')}>
                    <span className="inline-flex items-center gap-1 justify-end">Spread (%) <SortIcon columnKey="spreadPorcentaje" /></span>
                  </th>
                  <th className="text-center text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-secondary">
                {displayRows.map((row, index) => (
                  <tr
                    key={row.caucionId}
                    className={`${index % 2 === 0 ? 'bg-background-secondary' : 'bg-background-primary'} ${!row.esDatoReal ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-mono text-text-primary">{row.identificadorHumano}</div>
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

      {/* Metodología */}
      <div className="bg-background-tertiary rounded-xl p-4 border border-border-secondary">
        <h4 className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Metodología de cálculo
        </h4>
        <ul className="text-xs text-text-tertiary space-y-1 list-disc list-inside">
          <li><strong>Ganancia FCI:</strong> PnL real del FCI durante el período específico de la caución (usando VCP históricos)</li>
          <li><strong>Spread ($):</strong> Ganancia FCI - Interés pagado</li>
          <li><strong>Spread (%):</strong> (Ganancia FCI / Capital) - (Interés / Capital)</li>
          <li><strong>Datos reales:</strong> Solo operaciones posteriores al {formatDateAR(dataStartDate)} tienen suscripciones FCI reales</li>
        </ul>
      </div>
    </div>
  );
}

export default OperationsTab;
