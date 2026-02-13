import React, { useState, useEffect } from 'react';
import { X, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { toDateString } from '@/utils/formatters';

const CHANNELS = [
  { value: 'binance_p2p', label: 'Binance P2P' },
  { value: 'lemoncash', label: 'Lemon Cash' },
  { value: 'buenbit', label: 'Buenbit' },
  { value: 'belo', label: 'Belo' },
  { value: 'fiwind', label: 'Fiwind' },
  { value: 'otro', label: 'Otro' },
];

const ConversionModal = ({ isOpen, onClose, onSave, loans = [], activeCycles = [] }) => {
  const [saving, setSaving] = useState(false);

  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [channel, setChannel] = useState('binance_p2p');
  const [loanId, setLoanId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [eventDate, setEventDate] = useState(toDateString());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setFromAmount('');
    setToAmount('');
    setExchangeRate('');
    setChannel('binance_p2p');
    setLoanId(loans.length === 1 ? loans[0].id : '');
    setCycleId(activeCycles.length === 1 ? activeCycles[0].id : '');
    setEventDate(toDateString());
    setNotes('');
  }, [isOpen, loans, activeCycles]);

  // Auto-calc exchange rate when both amounts present
  useEffect(() => {
    const from = Number(fromAmount);
    const to = Number(toAmount);
    if (from > 0 && to > 0) {
      setExchangeRate((to / from).toFixed(2));
    }
  }, [fromAmount, toAmount]);

  // Auto-calc toAmount when exchangeRate changes manually
  const handleRateChange = (val) => {
    setExchangeRate(val);
    const from = Number(fromAmount);
    const rate = Number(val);
    if (from > 0 && rate > 0) {
      setToAmount((from * rate).toFixed(2));
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromAmount || !toAmount) return;
    setSaving(true);
    try {
      await onSave({
        from_amount: Number(fromAmount),
        to_amount: Number(toAmount),
        exchange_rate: Number(exchangeRate),
        channel,
        loan_id: loanId || null,
        cycle_id: cycleId || null,
        event_date: eventDate,
        notes: notes || null,
      });
      onClose();
    } catch (err) {
      alert('Error guardando conversion: ' + err.message);
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
            Conversion USDT → ARS
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Fecha */}
          <div>
            <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Fecha</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Montos: USDT → ARS */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">USDT</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="w-full px-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors font-mono"
              />
            </div>
            <div className="pb-2">
              <ArrowRight className="w-5 h-5 text-text-tertiary" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">ARS</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={toAmount}
                onChange={(e) => setToAmount(e.target.value)}
                className="w-full px-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors font-mono"
              />
            </div>
          </div>

          {/* TC resultante */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-text-tertiary uppercase">Tipo de Cambio Efectivo</span>
              <span className="text-[10px] text-text-tertiary">(ARS por USDT)</span>
            </div>
            <input
              type="number"
              step="0.01"
              value={exchangeRate}
              onChange={(e) => handleRateChange(e.target.value)}
              placeholder="0.00"
              className="mt-1 bg-transparent border-b border-dashed border-text-secondary/50 text-lg font-mono font-bold text-text-primary focus:outline-none focus:border-primary w-full"
            />
          </div>

          {/* Canal */}
          <div>
            <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Canal</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
            >
              {CHANNELS.map(ch => (
                <option key={ch.value} value={ch.value}>{ch.label}</option>
              ))}
            </select>
          </div>

          {/* Vincular a prestamo (opcional) */}
          {activeLoans.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">
                Vincular a Prestamo <span className="normal-case font-normal opacity-70">(opcional)</span>
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

          {/* Vincular a ciclo (opcional) */}
          {activeCycles.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">
                Vincular a Ciclo <span className="normal-case font-normal opacity-70">(opcional)</span>
              </label>
              <select
                value={cycleId}
                onChange={(e) => setCycleId(e.target.value)}
                className="w-full px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">Sin vincular</option>
                {activeCycles.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
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
              placeholder="Ej: P2P a MercadoPago"
              className="w-full px-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !fromAmount || !toAmount}
            className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Guardando...' : 'Registrar Conversion'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ConversionModal;
