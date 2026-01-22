// src/components/modals/TradeModal.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { isBonoPesos, isBonoHardDollar } from '../../hooks/useBondPrices';
import { TickerAutocomplete } from '../common/TickerAutocomplete';

export const TradeModal = ({ isOpen, onClose, onSave, trade, tickers }) => {
  const [formData, setFormData] = useState({
    tipo: 'compra',
    fecha: '',
    ticker: '',
    cantidad: '',
    precio: ''
  });

  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Reset form when modal opens or trade changes
  useEffect(() => {
    if (trade) {
      setFormData({
        tipo: trade.tipo || 'compra',
        fecha: trade.fecha || '',
        ticker: trade.ticker || '',
        cantidad: Math.abs(trade.cantidad)?.toString() || '',
        precio: trade.precioCompra?.toString() || ''
      });
    } else {
      setFormData({
        tipo: 'compra',
        fecha: new Date().toISOString().split('T')[0],
        ticker: '',
        cantidad: '',
        precio: ''
      });
    }
  }, [trade, isOpen]);

  // Focus management and ESC key handler
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      modalRef.current?.focus();

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen, onClose]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    const cantidad = parseFloat(formData.cantidad);
    const precio = parseFloat(formData.precio);

    if (!formData.fecha) {
      alert('La fecha es requerida');
      return;
    }

    if (!formData.ticker || formData.ticker.trim() === '') {
      alert('El ticker es requerido');
      return;
    }

    if (isNaN(cantidad) || cantidad <= 0) {
      alert('La cantidad debe ser un número mayor a 0');
      return;
    }

    if (isNaN(precio) || precio <= 0) {
      alert('El precio debe ser un número mayor a 0');
      return;
    }

    const isVenta = formData.tipo === 'venta';

    onSave({
      id: trade?.id || crypto.randomUUID(),
      fecha: formData.fecha,
      ticker: formData.ticker.toUpperCase().trim(),
      cantidad: isVenta ? -cantidad : cantidad,
      precioCompra: precio,
      tipo: formData.tipo
    });
  }, [formData, trade, onSave]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-background-secondary rounded-xl p-6 w-full max-w-md border border-border-primary shadow-xl focus:outline-none"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="trade-modal-title" className="text-lg font-semibold text-text-primary">
            {trade ? 'Editar transacción' : 'Nueva transacción'}
          </h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-background-tertiary"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({...formData, tipo: 'compra'})}
                className={`py-2.5 px-3 h-10 rounded-lg font-medium text-sm transition-all active:scale-95 ${
                  formData.tipo === 'compra'
                    ? 'bg-success text-white'
                    : 'bg-background-tertiary text-text-secondary border border-border-primary hover:border-text-tertiary'
                }`}
              >
                Compra
              </button>
              <button
                type="button"
                onClick={() => setFormData({...formData, tipo: 'venta'})}
                className={`py-2.5 px-3 h-10 rounded-lg font-medium text-sm transition-all active:scale-95 ${
                  formData.tipo === 'venta'
                    ? 'bg-danger text-white'
                    : 'bg-background-tertiary text-text-secondary border border-border-primary hover:border-text-tertiary'
                }`}
              >
                Venta
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Fecha</label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({...formData, fecha: e.target.value})}
              className="w-full px-3 py-2.5 h-10 bg-background-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Ticker</label>
            <TickerAutocomplete
              value={formData.ticker}
              onChange={(ticker) => setFormData({...formData, ticker})}
              tickers={tickers}
              disabled={false}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Cantidad</label>
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={formData.cantidad}
                onChange={(e) => setFormData({...formData, cantidad: e.target.value})}
                className="w-full px-3 py-2.5 h-10 bg-background-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary font-mono"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Precio (ARS)</label>
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={formData.precio}
                onChange={(e) => setFormData({...formData, precio: e.target.value})}
                className="w-full px-3 py-2.5 h-10 bg-background-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary font-mono"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {(isBonoPesos(formData.ticker) || isBonoHardDollar(formData.ticker)) && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-amber-400 text-xs">
                {isBonoPesos(formData.ticker)
                  ? 'Bonos en pesos: ingresá el precio por cada $1 de VN (ej: 1.03)'
                  : 'Bonos HD: ingresá el precio por cada lamina de 100 USD VN (ej: 1155)'}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2.5 h-10 bg-background-tertiary text-text-secondary rounded-lg hover:bg-border-primary transition-colors font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex-1 px-3 py-2.5 h-10 font-medium rounded-lg transition-all active:scale-95 text-sm ${
                formData.tipo === 'venta'
                  ? 'bg-danger text-white hover:bg-danger/90'
                  : 'bg-primary text-white hover:bg-primary/90'
              }`}
            >
              {trade ? 'Guardar' : (formData.tipo === 'venta' ? 'Registrar' : 'Agregar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TradeModal;
