import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Info, AlertCircle } from 'lucide-react';
import { TRANSACTION_TYPES } from '@/constants';
import { toDateString } from '@/utils/formatters';
import { CryptoTickerAutocomplete } from '@/features/crypto/components/CryptoTickerAutocomplete';
import { cryptoPriceService } from '@/features/crypto/services/cryptoPriceService';

export const CryptoTradeModal = ({ isOpen, onClose, onSave, trade }) => {
  const [formData, setFormData] = useState({
    type: TRANSACTION_TYPES.BUY,
    date: '',
    assetId: '',
    quantity: '',
    price: ''
  });
  const [coinInfo, setCoinInfo] = useState(null);
  const [coinsList, setCoinsList] = useState([]);
  const [error, setError] = useState(null);

  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  const titleId = 'crypto-trade-modal-title';
  const assetDescId = 'asset-description';

  // Cargar lista de criptos para lookup
  useEffect(() => {
    const loadCoins = async () => {
      try {
        const data = await cryptoPriceService.getCoinsList();
        setCoinsList(data || []);
      } catch (err) {
        console.error('Error loading coins:', err);
      }
    };
    if (isOpen) {
      loadCoins();
    }
  }, [isOpen]);

  // Actualizar coinInfo cuando cambia el assetId
  useEffect(() => {
    if (formData.assetId && coinsList.length > 0) {
      const info = cryptoPriceService.getCoinInfo(formData.assetId, coinsList);
      setCoinInfo(info);
    } else {
      setCoinInfo(null);
    }
  }, [formData.assetId, coinsList]);

  useEffect(() => {
    if (trade) {
      setFormData({
        type: trade.type || trade.trade_type || TRANSACTION_TYPES.BUY,
        date: trade.trade_date || trade.date || '',
        assetId: trade.ticker || '',
        quantity: Math.abs(trade.quantity || 0).toString(),
        price: (trade.price || 0).toString()
      });
      setError(null);
    } else {
      setFormData({
        type: TRANSACTION_TYPES.BUY,
        date: toDateString(),
        assetId: '',
        quantity: '',
        price: ''
      });
      setCoinInfo(null);
      setError(null);
    }
  }, [trade, isOpen]);

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
    setError(null);

    const quantity = parseFloat(formData.quantity);
    const price = parseFloat(formData.price);

    if (!formData.date) {
      setError('La fecha es requerida');
      return;
    }

    if (!formData.assetId || formData.assetId.trim() === '') {
      setError('El asset ID es requerido');
      return;
    }

    if (isNaN(quantity) || quantity <= 0) {
      setError('La cantidad debe ser un número mayor a 0');
      return;
    }

    if (isNaN(price) || price <= 0) {
      setError('El precio debe ser un número mayor a 0');
      return;
    }

    const isSell = formData.type === TRANSACTION_TYPES.SELL;
    const normalizedId = cryptoPriceService.resolveId(formData.assetId, coinsList);

    onSave({
      id: trade?.id || crypto.randomUUID(),
      date: formData.date,
      ticker: normalizedId,
      quantity: isSell ? -quantity : quantity,
      price: price,
      type: formData.type
    });
  }, [formData, trade, onSave, coinsList]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
      role="dialog" 
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div 
        ref={modalRef} 
        tabIndex={-1} 
        className="bg-background-secondary rounded-xl p-6 w-full max-w-md border border-border-primary shadow-xl focus:outline-none"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">
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

        {error && (
          <div className="mb-4 bg-danger/10 border border-danger/30 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button" 
                onClick={() => setFormData({ ...formData, type: TRANSACTION_TYPES.BUY })} 
                className={`py-2.5 px-3 h-10 rounded-lg font-medium text-sm transition-all active:scale-95 ${formData.type === TRANSACTION_TYPES.BUY ? 'bg-success text-white' : 'bg-background-tertiary text-text-secondary border border-border-primary hover:border-text-tertiary'}`}
              >
                Compra
              </button>
              <button 
                type="button" 
                onClick={() => setFormData({ ...formData, type: TRANSACTION_TYPES.SELL })} 
                className={`py-2.5 px-3 h-10 rounded-lg font-medium text-sm transition-all active:scale-95 ${formData.type === TRANSACTION_TYPES.SELL ? 'bg-danger text-white' : 'bg-background-tertiary text-text-secondary border border-border-primary hover:border-text-tertiary'}`}
              >
                Venta
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="trade-date" className="block text-sm font-medium text-text-secondary mb-2">
              Fecha
            </label>
            <input 
              id="trade-date"
              type="date" 
              value={formData.date} 
              onChange={(e) => setFormData({ ...formData, date: e.target.value })} 
              className="w-full px-3 py-2.5 h-10 bg-background-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary" 
              required 
            />
          </div>

          <div>
            <label htmlFor="asset-id" className="block text-sm font-medium text-text-secondary mb-2">
              Criptomoneda
            </label>
            <CryptoTickerAutocomplete
              value={formData.assetId}
              onChange={(value) => setFormData({ ...formData, assetId: value })}
              disabled={false}
            />
            
            {coinInfo ? (
              <div id={assetDescId} className="mt-2 flex items-center gap-2 text-xs text-text-tertiary bg-background-tertiary/50 rounded-lg px-3 py-2">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  <span className="font-medium text-text-secondary">{coinInfo.symbol.toUpperCase()}</span>
                  {' — '}
                  {coinInfo.name}
                  {' • ID: '}
                  <span className="font-mono">{coinInfo.id}</span>
                </span>
              </div>
            ) : formData.assetId ? (
              <div id={assetDescId} className="mt-2 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>No se encontró información para este ID. Asegurate de usar un ID válido de CoinGecko.</span>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-text-secondary mb-2">
                Cantidad
              </label>
              <input 
                id="quantity"
                type="number" 
                step="any" 
                min="0" 
                inputMode="decimal" 
                value={formData.quantity} 
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} 
                className="w-full px-3 py-2.5 h-10 bg-background-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary font-mono" 
                placeholder="0" 
                required 
              />
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-text-secondary mb-2">
                Precio (USDT)
              </label>
              <input 
                id="price"
                type="number" 
                step="any" 
                min="0" 
                inputMode="decimal" 
                value={formData.price} 
                onChange={(e) => setFormData({ ...formData, price: e.target.value })} 
                className="w-full px-3 py-2.5 h-10 bg-background-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary font-mono" 
                placeholder="0.00" 
                required 
              />
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-blue-400 text-xs flex items-start gap-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Los precios se obtienen en tiempo real de CoinGecko. 
                Asegurate de ingresar el precio correcto en USDT.
              </span>
            </p>
          </div>

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
              className={`flex-1 px-3 py-2.5 h-10 font-medium rounded-lg transition-all active:scale-95 text-sm ${formData.type === TRANSACTION_TYPES.SELL ? 'bg-danger text-white hover:bg-danger/90' : 'bg-primary text-white hover:bg-primary/90'}`}
            >
              {trade ? 'Guardar' : (formData.type === TRANSACTION_TYPES.SELL ? 'Registrar' : 'Agregar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CryptoTradeModal;
