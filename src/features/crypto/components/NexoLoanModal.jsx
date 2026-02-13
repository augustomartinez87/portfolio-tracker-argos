import React, { useState, useEffect } from 'react';
import { X, Calendar, Loader2 } from 'lucide-react';
import { toDateString } from '@/utils/formatters';

const NexoLoanModal = ({ isOpen, onClose, onSave, loan = null }) => {
  const isEditing = !!loan;
  const [saving, setSaving] = useState(false);

  const [loanCurrency, setLoanCurrency] = useState('USDT');
  const [principal, setPrincipal] = useState('');
  const [outstanding, setOutstanding] = useState('');
  const [apr, setApr] = useState('');
  const [collateralAsset, setCollateralAsset] = useState('bitcoin');
  const [collateralQty, setCollateralQty] = useState('');
  const [ltvWarning, setLtvWarning] = useState('65');
  const [ltvLiquidation, setLtvLiquidation] = useState('83');
  const [openedAt, setOpenedAt] = useState(toDateString());

  // Reset form when modal opens with loan data
  useEffect(() => {
    if (!isOpen) return;
    if (loan) {
      setLoanCurrency(loan.loan_currency || 'USDT');
      setPrincipal(String(loan.principal || ''));
      setOutstanding(String(loan.outstanding || ''));
      setApr(String(((loan.interest_rate_apr || 0) * 100).toFixed(2)));
      setCollateralAsset(loan.collateral_asset || 'bitcoin');
      setCollateralQty(String(loan.collateral_quantity || ''));
      setLtvWarning(String(((loan.ltv_warning || 0.65) * 100).toFixed(0)));
      setLtvLiquidation(String(((loan.ltv_liquidation || 0.83) * 100).toFixed(0)));
      setOpenedAt(loan.opened_at ? loan.opened_at.split('T')[0] : toDateString());
    } else {
      setLoanCurrency('USDT');
      setPrincipal('');
      setOutstanding('');
      setApr('');
      setCollateralAsset('bitcoin');
      setCollateralQty('');
      setLtvWarning('65');
      setLtvLiquidation('83');
      setOpenedAt(toDateString());
    }
  }, [isOpen, loan]);

  // Auto-sync outstanding with principal when creating
  useEffect(() => {
    if (!isEditing && principal && !outstanding) {
      setOutstanding(principal);
    }
  }, [principal, isEditing]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        id: loan?.id,
        loan_currency: loanCurrency,
        principal: Number(principal),
        outstanding: Number(outstanding || principal),
        interest_rate_apr: Number(apr) / 100,
        collateral_asset: collateralAsset,
        collateral_quantity: Number(collateralQty),
        ltv_warning: Number(ltvWarning) / 100,
        ltv_liquidation: Number(ltvLiquidation) / 100,
        opened_at: openedAt,
      });
      onClose();
    } catch (err) {
      alert('Error guardando prestamo: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const collateralOptions = [
    { id: 'bitcoin', label: 'Bitcoin (BTC)' },
    { id: 'ethereum', label: 'Ethereum (ETH)' },
    { id: 'solana', label: 'Solana (SOL)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background-secondary border border-border-primary rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-border-primary flex justify-between items-center sticky top-0 bg-background-secondary z-10">
          <h2 className="text-lg font-bold text-text-primary">
            {isEditing ? 'Editar Prestamo' : 'Nuevo Prestamo Nexo'}
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Fecha apertura */}
          <div>
            <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Fecha Apertura</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="date"
                required
                value={openedAt}
                onChange={(e) => setOpenedAt(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Seccion: Prestamo */}
          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
            <p className="text-xs font-semibold text-primary uppercase">Prestamo</p>

            {/* Moneda del prestamo */}
            <div>
              <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Moneda</label>
              <select
                value={loanCurrency}
                onChange={(e) => setLoanCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
              >
                <option value="USDT">USDT</option>
                <option value="USDC">USDC</option>
                <option value="USD">USD</option>
              </select>
            </div>

            {/* Principal */}
            <div>
              <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Principal (monto pedido)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className="w-full px-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors font-mono"
              />
            </div>

            {/* Outstanding */}
            <div>
              <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">
                Deuda Vigente
                {!isEditing && <span className="text-[10px] normal-case font-normal opacity-70 ml-1">(= principal al inicio)</span>}
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={outstanding}
                onChange={(e) => setOutstanding(e.target.value)}
                className="w-full px-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors font-mono"
              />
            </div>

            {/* APR */}
            <div>
              <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Tasa Anual (APR %)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="13.90"
                value={apr}
                onChange={(e) => setApr(e.target.value)}
                className="w-full px-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors font-mono"
              />
            </div>
          </div>

          {/* Seccion: Colateral */}
          <div className="p-3 rounded-lg border border-warning/20 bg-warning/5 space-y-3">
            <p className="text-xs font-semibold text-warning uppercase">Colateral</p>

            {/* Activo colateral */}
            <div>
              <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Activo</label>
              <select
                value={collateralAsset}
                onChange={(e) => setCollateralAsset(e.target.value)}
                className="w-full px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
              >
                {collateralOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Cantidad</label>
              <input
                type="number"
                step="0.00000001"
                required
                placeholder="0.00000000"
                value={collateralQty}
                onChange={(e) => setCollateralQty(e.target.value)}
                className="w-full px-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors font-mono"
              />
            </div>
          </div>

          {/* Seccion: Thresholds */}
          <div className="p-3 rounded-lg border border-border-primary bg-background-tertiary space-y-3">
            <p className="text-xs font-semibold text-text-tertiary uppercase">Thresholds de Riesgo</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-warning uppercase mb-1.5">Warning LTV %</label>
                <input
                  type="number"
                  step="1"
                  value={ltvWarning}
                  onChange={(e) => setLtvWarning(e.target.value)}
                  className="w-full px-3 py-2 bg-background-secondary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-warning transition-colors font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-danger uppercase mb-1.5">Liquidacion LTV %</label>
                <input
                  type="number"
                  step="1"
                  value={ltvLiquidation}
                  onChange={(e) => setLtvLiquidation(e.target.value)}
                  className="w-full px-3 py-2 bg-background-secondary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-danger transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !principal || !collateralQty || !apr}
            className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Guardando...' : isEditing ? 'Actualizar Prestamo' : 'Crear Prestamo'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default NexoLoanModal;
