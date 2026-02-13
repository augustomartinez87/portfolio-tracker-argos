import React, { useState, useEffect } from 'react';
import { X, Calendar, Loader2 } from 'lucide-react';
import { toDateString } from '@/utils/formatters';

const CycleModal = ({ isOpen, onClose, onSave, cycle = null, loans = [] }) => {
  const isEditing = !!cycle;
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState('');
  const [loanId, setLoanId] = useState('');
  const [openedAt, setOpenedAt] = useState(toDateString());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (cycle) {
      setLabel(cycle.label || '');
      setLoanId(cycle.loan_id || '');
      setOpenedAt(cycle.opened_at ? cycle.opened_at.split('T')[0] : toDateString());
      setNotes(cycle.notes || '');
    } else {
      setLabel('');
      setLoanId(loans.length === 1 ? loans[0].id : '');
      setOpenedAt(toDateString());
      setNotes('');
    }
  }, [isOpen, cycle, loans]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: cycle?.id,
        label: label.trim(),
        loan_id: loanId || null,
        opened_at: openedAt,
        notes: notes || null,
      });
      onClose();
    } catch (err) {
      alert('Error guardando ciclo: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const activeLoans = loans.filter(l => l.status === 'active');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background-secondary border border-border-primary rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">
        {/* Header */}
        <div className="p-5 border-b border-border-primary flex justify-between items-center">
          <h2 className="text-lg font-bold text-text-primary">
            {isEditing ? 'Editar Ciclo' : 'Nuevo Ciclo de Funding'}
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Label */}
          <div>
            <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Nombre del Ciclo</label>
            <input
              type="text"
              required
              placeholder="Ej: Ciclo Feb 2026"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
            />
          </div>

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

          {/* Vincular prestamo */}
          {activeLoans.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">
                Vincular Prestamo <span className="normal-case font-normal opacity-70">(opcional)</span>
              </label>
              <select
                value={loanId}
                onChange={(e) => setLoanId(e.target.value)}
                className="w-full px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">Sin vincular</option>
                {activeLoans.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.loan_currency} {Number(l.outstanding).toLocaleString('es-AR', { maximumFractionDigits: 2 })} - APR {(l.interest_rate_apr * 100).toFixed(1)}%
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">
              Notas <span className="normal-case font-normal opacity-70">(opcional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: BTC colateral 0.05 → Nexo → FCI MM"
              className="w-full px-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !label.trim()}
            className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Guardando...' : isEditing ? 'Actualizar Ciclo' : 'Crear Ciclo'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CycleModal;
