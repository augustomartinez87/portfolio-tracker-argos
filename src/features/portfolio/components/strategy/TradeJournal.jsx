import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, Plus, X, TrendingUp, TrendingDown, Clock, Edit2 } from 'lucide-react';
import { formatARS, formatPercent, formatDateAR, toDateString } from '@/utils/formatters';

const JOURNAL_KEY = 'portfolio_strategy_journal';

const getEmptyForm = () => ({
  ticker: '',
  entryDate: toDateString(),
  entryPrice: '',
  stopLoss: '',
  targetPrice: '',
  result: 'Abierto',
  closingPrice: '',
  notes: '',
});

function ResultBadge({ result }) {
  if (result === 'Win') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-profit/10 text-profit text-xs font-semibold">
        <TrendingUp className="w-3 h-3" /> Win
      </span>
    );
  }
  if (result === 'Loss') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-loss/10 text-loss text-xs font-semibold">
        <TrendingDown className="w-3 h-3" /> Loss
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-info/10 text-info text-xs font-semibold">
      <Clock className="w-3 h-3" /> Abierto
    </span>
  );
}

function JournalModal({ entry, onClose, onSave }) {
  const modalRef = useRef(null);
  const [form, setForm] = useState(() =>
    entry
      ? { ...entry, closingPrice: entry.closingPrice ?? '' }
      : getEmptyForm()
  );

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const pnlPct =
    form.result !== 'Abierto' && form.closingPrice && form.entryPrice
      ? ((Number(form.closingPrice) - Number(form.entryPrice)) / Number(form.entryPrice)) * 100
      : null;

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: entry?.id ?? Date.now(),
      ticker: form.ticker.toUpperCase().trim(),
      entryDate: form.entryDate,
      entryPrice: Number(form.entryPrice) || 0,
      stopLoss: Number(form.stopLoss) || 0,
      targetPrice: Number(form.targetPrice) || 0,
      result: form.result,
      closingPrice: form.result !== 'Abierto' ? (Number(form.closingPrice) || 0) : null,
      pnlPct: pnlPct,
      notes: form.notes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-background-secondary rounded-xl border border-border-primary w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border-primary">
          <h3 className="text-base font-semibold text-text-primary">
            {entry ? 'Editar Operación' : 'Nueva Operación'}
          </h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Ticker *</label>
              <input
                required
                type="text"
                value={form.ticker}
                onChange={(e) => set('ticker', e.target.value)}
                placeholder="YPFD, GGAL, BTC..."
                className="w-full bg-background-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary uppercase"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Fecha de entrada *</label>
              <input
                required
                type="date"
                value={form.entryDate}
                onChange={(e) => set('entryDate', e.target.value)}
                className="w-full bg-background-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Precio entrada *</label>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={form.entryPrice}
                onChange={(e) => set('entryPrice', e.target.value)}
                placeholder="0,00"
                className="w-full bg-background-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Stop Loss</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.stopLoss}
                onChange={(e) => set('stopLoss', e.target.value)}
                placeholder="0,00"
                className="w-full bg-background-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Take Profit</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.targetPrice}
                onChange={(e) => set('targetPrice', e.target.value)}
                placeholder="0,00"
                className="w-full bg-background-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Resultado</label>
              <select
                value={form.result}
                onChange={(e) => set('result', e.target.value)}
                className="w-full bg-background-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="Abierto">Abierto</option>
                <option value="Win">Win</option>
                <option value="Loss">Loss</option>
              </select>
            </div>
            {form.result !== 'Abierto' && (
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Precio cierre</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.closingPrice}
                  onChange={(e) => set('closingPrice', e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-background-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary"
                />
                {pnlPct !== null && (
                  <p className={`text-xs mt-1 font-semibold ${pnlPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                    P&L: {formatPercent(pnlPct)}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-text-secondary mb-1 block">Tesis / Notas</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Setup técnico, razón de la entrada, nivel clave..."
              className="w-full bg-background-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-primary rounded-lg hover:bg-background-tertiary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-profit rounded-lg hover:bg-profit/90 transition-colors"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TradeJournal() {
  const [entries, setEntries] = useState(() => {
    try {
      const stored = localStorage.getItem(JOURNAL_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
  }, [entries]);

  const handleSave = useCallback((entry) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.id === entry.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = entry;
        return updated;
      }
      return [entry, ...prev];
    });
    setModalOpen(false);
    setEditingEntry(null);
  }, []);

  const handleDelete = useCallback((id) => {
    if (window.confirm('¿Eliminar esta operación del journal?')) {
      setEntries(prev => prev.filter(e => e.id !== id));
    }
  }, []);

  const openNew = () => { setEditingEntry(null); setModalOpen(true); };
  const openEdit = (entry) => { setEditingEntry(entry); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingEntry(null); };

  // Stats
  const closed = entries.filter(e => e.result !== 'Abierto');
  const open = entries.filter(e => e.result === 'Abierto');
  const wins = entries.filter(e => e.result === 'Win');
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : null;
  const avgPnl =
    closed.length > 0
      ? closed.reduce((sum, e) => sum + (e.pnlPct || 0), 0) / closed.length
      : null;

  const sorted = [...entries].sort((a, b) => b.entryDate.localeCompare(a.entryDate));

  const stats = [
    {
      label: 'Win Rate',
      value: winRate !== null ? `${winRate.toFixed(0)}%` : '—',
      color: winRate !== null ? (winRate >= 50 ? 'text-profit' : 'text-loss') : 'text-text-tertiary',
    },
    {
      label: 'P&L Promedio',
      value: avgPnl !== null ? formatPercent(avgPnl) : '—',
      color: avgPnl !== null ? (avgPnl >= 0 ? 'text-profit' : 'text-loss') : 'text-text-tertiary',
    },
    { label: 'Abiertas', value: open.length, color: 'text-info' },
    { label: 'Cerradas', value: closed.length, color: 'text-text-secondary' },
  ];

  return (
    <>
      <section className="bg-background-secondary border border-border-primary rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-warning" />
            <h3 className="text-base font-semibold text-text-primary">Trade Journal</h3>
            <span className="text-xs text-text-tertiary ml-1">Timba / Satélite</span>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-profit rounded-lg hover:bg-profit/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva Operación
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {stats.map(stat => (
            <div key={stat.label} className="bg-background-tertiary rounded-lg p-3 text-center">
              <p className="text-xs text-text-tertiary mb-1">{stat.label}</p>
              <p className={`text-lg font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        {sorted.length === 0 ? (
          <div className="text-center py-10 text-text-tertiary">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay operaciones registradas aún</p>
            <p className="text-xs mt-1">Registrá tus operaciones de timba para hacer seguimiento</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-primary">
                  {['Ticker', 'Entrada', 'Precio', 'SL', 'TP', 'Resultado', 'P&L', 'Notas', ''].map(h => (
                    <th
                      key={h}
                      className="text-left text-text-tertiary font-medium pb-2 pr-4 last:pr-0 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {sorted.map(entry => (
                  <tr key={entry.id} className="hover:bg-background-tertiary/50 transition-colors">
                    <td className="py-2.5 pr-4 font-semibold text-text-primary">{entry.ticker}</td>
                    <td className="py-2.5 pr-4 text-text-secondary whitespace-nowrap">
                      {formatDateAR(entry.entryDate)}
                    </td>
                    <td className="py-2.5 pr-4 text-text-secondary tabular-nums">
                      {formatARS(entry.entryPrice)}
                    </td>
                    <td className="py-2.5 pr-4 text-loss tabular-nums">
                      {entry.stopLoss ? formatARS(entry.stopLoss) : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-profit tabular-nums">
                      {entry.targetPrice ? formatARS(entry.targetPrice) : '—'}
                    </td>
                    <td className="py-2.5 pr-4">
                      <ResultBadge result={entry.result} />
                    </td>
                    <td
                      className={`py-2.5 pr-4 font-semibold tabular-nums ${
                        entry.pnlPct != null
                          ? entry.pnlPct >= 0
                            ? 'text-profit'
                            : 'text-loss'
                          : 'text-text-tertiary'
                      }`}
                    >
                      {entry.pnlPct != null ? formatPercent(entry.pnlPct) : '—'}
                    </td>
                    <td
                      className="py-2.5 pr-4 text-text-tertiary max-w-[160px] truncate"
                      title={entry.notes}
                    >
                      {entry.notes || '—'}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(entry)}
                          className="p-1 text-text-tertiary hover:text-text-primary transition-colors rounded"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1 text-text-tertiary hover:text-loss transition-colors rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen && (
        <JournalModal entry={editingEntry} onClose={closeModal} onSave={handleSave} />
      )}
    </>
  );
}
