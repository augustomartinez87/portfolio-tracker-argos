import React, { useState, useEffect, useCallback } from 'react';
import { Link2, Unlink, Plus, ArrowRight, Loader2 } from 'lucide-react';
import { formatARS, formatUSDT, formatNumber, formatDateAR } from '@/utils/formatters';
import { fundingCycleService } from '@/features/crypto/services/fundingCycleService';

const CHANNEL_LABELS = {
  binance_p2p: 'Binance P2P',
  lemoncash: 'Lemon Cash',
  buenbit: 'Buenbit',
  belo: 'Belo',
  fiwind: 'Fiwind',
  otro: 'Otro',
};

// ============================================================
// Mini flow diagram scoped to cycle data
// ============================================================
function CycleFlowDiagram({ metrics }) {
  const steps = [
    {
      label: 'Prestamo',
      value: formatUSDT(metrics.loanOutstandingUSDT),
      sub: `APR ${formatNumber(metrics.loanApr * 100, 2)}%`,
      color: 'text-danger',
      bgColor: 'bg-danger/10 border-danger/20',
    },
    {
      label: 'Conversiones',
      value: formatUSDT(metrics.totalConvertidoUSDT),
      sub: `TC ${formatNumber(metrics.tcPromedio, 2)}`,
      color: 'text-primary',
      bgColor: 'bg-primary/10 border-primary/20',
    },
    {
      label: 'FCI',
      value: formatARS(metrics.totalValuacionARS),
      sub: `P&L ${formatARS(metrics.fciPnlARS)}`,
      color: 'text-success',
      bgColor: 'bg-success/10 border-success/20',
    },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <div className={`flex-1 min-w-[100px] p-2 rounded-lg border ${step.bgColor} text-center`}>
            <p className={`text-[10px] font-semibold uppercase ${step.color}`}>{step.label}</p>
            <p className="text-xs font-mono font-bold text-text-primary mt-0.5">{step.value}</p>
            <p className="text-[9px] text-text-tertiary mt-0.5">{step.sub}</p>
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================
// Link Picker - shows unlinked records to pick from
// ============================================================
function LinkPicker({ items, onLink, onCancel, type }) {
  if (!items.length) {
    return (
      <div className="p-3 text-center text-xs text-text-tertiary">
        No hay {type === 'conversion' ? 'conversiones' : 'lotes'} sin vincular.
        <button onClick={onCancel} className="ml-2 text-primary hover:underline">Cerrar</button>
      </div>
    );
  }

  return (
    <div className="border border-border-secondary rounded-lg overflow-hidden">
      <div className="p-2 bg-background-tertiary flex justify-between items-center">
        <span className="text-[10px] font-semibold text-text-tertiary uppercase">
          Seleccionar {type === 'conversion' ? 'Conversion' : 'Lote FCI'}
        </span>
        <button onClick={onCancel} className="text-[10px] text-text-tertiary hover:text-text-primary">Cancelar</button>
      </div>
      <div className="max-h-40 overflow-y-auto divide-y divide-border-primary">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onLink(item.id)}
            className="w-full px-3 py-2 text-left hover:bg-background-tertiary/50 transition-colors flex justify-between items-center text-xs"
          >
            {type === 'conversion' ? (
              <>
                <span className="text-text-secondary">{formatDateAR(item.event_date)}</span>
                <span className="font-mono text-text-primary">{formatUSDT(item.from_amount)} → {formatARS(item.to_amount)}</span>
              </>
            ) : (
              <>
                <span className="text-text-secondary">{formatDateAR(item.fecha_suscripcion)}</span>
                <span className="font-mono text-text-primary">{formatARS(item.capital_invertido)}</span>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main CycleDetailView
// ============================================================
const CycleDetailView = ({
  cycleId,
  metrics,
  portfolioId,
  onRefresh,
}) => {
  const [cycleData, setCycleData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Link picker state
  const [showConvPicker, setShowConvPicker] = useState(false);
  const [showLotPicker, setShowLotPicker] = useState(false);
  const [unlinkedConversions, setUnlinkedConversions] = useState([]);
  const [unlinkedLots, setUnlinkedLots] = useState([]);
  const [linking, setLinking] = useState(false);

  const loadCycleData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fundingCycleService.getCycleWithChildren(cycleId);
      setCycleData(data);
    } catch (err) {
      console.error('Error loading cycle data:', err);
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    loadCycleData();
  }, [loadCycleData]);

  const loadUnlinkedConversions = useCallback(async () => {
    if (!portfolioId) return;
    const data = await fundingCycleService.getUnlinkedConversions(portfolioId);
    setUnlinkedConversions(data);
    setShowConvPicker(true);
  }, [portfolioId]);

  const loadUnlinkedLots = useCallback(async () => {
    if (!portfolioId) return;
    const data = await fundingCycleService.getUnlinkedLots(portfolioId);
    setUnlinkedLots(data);
    setShowLotPicker(true);
  }, [portfolioId]);

  const handleLinkConversion = useCallback(async (convId) => {
    setLinking(true);
    try {
      await fundingCycleService.linkConversion(convId, cycleId);
      setShowConvPicker(false);
      await loadCycleData();
      onRefresh?.();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLinking(false);
    }
  }, [cycleId, loadCycleData, onRefresh]);

  const handleUnlinkConversion = useCallback(async (convId) => {
    setLinking(true);
    try {
      await fundingCycleService.unlinkConversion(convId);
      await loadCycleData();
      onRefresh?.();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLinking(false);
    }
  }, [loadCycleData, onRefresh]);

  const handleLinkLot = useCallback(async (lotId) => {
    setLinking(true);
    try {
      await fundingCycleService.linkLot(lotId, cycleId);
      setShowLotPicker(false);
      await loadCycleData();
      onRefresh?.();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLinking(false);
    }
  }, [cycleId, loadCycleData, onRefresh]);

  const handleUnlinkLot = useCallback(async (lotId) => {
    setLinking(true);
    try {
      await fundingCycleService.unlinkLot(lotId);
      await loadCycleData();
      onRefresh?.();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLinking(false);
    }
  }, [loadCycleData, onRefresh]);

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (!cycleData) return null;

  const { conversions, lots } = cycleData;

  return (
    <div className="border-t border-border-primary bg-background-tertiary/30 p-4 space-y-4">
      {/* Mini flow */}
      <CycleFlowDiagram metrics={metrics} />

      {/* Linked Conversions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-text-tertiary uppercase">
            Conversiones Vinculadas ({conversions.length})
          </h4>
          <button
            onClick={loadUnlinkedConversions}
            disabled={linking}
            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <Plus className="w-3 h-3" />
            Vincular
          </button>
        </div>

        {showConvPicker && (
          <div className="mb-2">
            <LinkPicker
              items={unlinkedConversions}
              onLink={handleLinkConversion}
              onCancel={() => setShowConvPicker(false)}
              type="conversion"
            />
          </div>
        )}

        {conversions.length > 0 ? (
          <div className="border border-border-primary rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-primary bg-background-tertiary/50">
                  <th className="text-left px-2 py-1.5 text-[9px] text-text-tertiary uppercase">Fecha</th>
                  <th className="text-right px-2 py-1.5 text-[9px] text-text-tertiary uppercase">USDT</th>
                  <th className="text-right px-2 py-1.5 text-[9px] text-text-tertiary uppercase">ARS</th>
                  <th className="text-right px-2 py-1.5 text-[9px] text-text-tertiary uppercase">TC</th>
                  <th className="text-left px-2 py-1.5 text-[9px] text-text-tertiary uppercase">Canal</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {conversions.map(c => (
                  <tr key={c.id} className="border-b border-border-primary/50 hover:bg-background-tertiary/30">
                    <td className="px-2 py-1.5 text-text-secondary font-mono">{formatDateAR(c.event_date)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-text-primary">{formatUSDT(c.from_amount)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-text-primary">{formatARS(c.to_amount)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-text-secondary">{formatNumber(c.exchange_rate, 2)}</td>
                    <td className="px-2 py-1.5 text-text-tertiary">{CHANNEL_LABELS[c.channel] || c.channel || '-'}</td>
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => handleUnlinkConversion(c.id)}
                        disabled={linking}
                        className="p-0.5 text-text-tertiary hover:text-danger transition-colors"
                        title="Desvincular"
                      >
                        <Unlink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-text-tertiary italic">Sin conversiones vinculadas.</p>
        )}
      </div>

      {/* Linked FCI Lots */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-text-tertiary uppercase">
            Lotes FCI Vinculados ({lots.length})
          </h4>
          <button
            onClick={loadUnlinkedLots}
            disabled={linking}
            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <Plus className="w-3 h-3" />
            Vincular
          </button>
        </div>

        {showLotPicker && (
          <div className="mb-2">
            <LinkPicker
              items={unlinkedLots}
              onLink={handleLinkLot}
              onCancel={() => setShowLotPicker(false)}
              type="lot"
            />
          </div>
        )}

        {lots.length > 0 ? (
          <div className="border border-border-primary rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-primary bg-background-tertiary/50">
                  <th className="text-left px-2 py-1.5 text-[9px] text-text-tertiary uppercase">Fecha</th>
                  <th className="text-right px-2 py-1.5 text-[9px] text-text-tertiary uppercase">Capital</th>
                  <th className="text-right px-2 py-1.5 text-[9px] text-text-tertiary uppercase">Cuotapartes</th>
                  <th className="text-right px-2 py-1.5 text-[9px] text-text-tertiary uppercase">VCP Entrada</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lots.map(lot => (
                  <tr key={lot.id} className="border-b border-border-primary/50 hover:bg-background-tertiary/30">
                    <td className="px-2 py-1.5 text-text-secondary font-mono">{formatDateAR(lot.fecha_suscripcion)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-text-primary">{formatARS(lot.capital_invertido)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-text-secondary">{formatNumber(lot.cuotapartes, 4)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-text-secondary">{formatNumber(lot.vcp_entrada, 6)}</td>
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => handleUnlinkLot(lot.id)}
                        disabled={linking}
                        className="p-0.5 text-text-tertiary hover:text-danger transition-colors"
                        title="Desvincular"
                      >
                        <Unlink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-text-tertiary italic">Sin lotes FCI vinculados.</p>
        )}
      </div>
    </div>
  );
};

export default CycleDetailView;
