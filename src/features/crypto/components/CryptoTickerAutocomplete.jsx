import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { cryptoPriceService } from '@/features/crypto/services/cryptoPriceService';

export const CryptoTickerAutocomplete = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');
  const [coinsList, setCoinsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Cargar lista completa al montar
  useEffect(() => {
    const loadCoins = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await cryptoPriceService.getCoinsList();
        if (data && data.length > 0) {
          setCoinsList(data);
        } else {
          // Fallback a top coins
          const fallback = await cryptoPriceService.getTopCoins('usdt', 100);
          setCoinsList(fallback);
        }
      } catch (err) {
        console.error('Error loading coins list:', err);
        setError('Error cargando lista de criptos');
        // Fallback
        const fallback = cryptoPriceService.getFallbackTopCoins(100);
        setCoinsList(fallback);
      } finally {
        setIsLoading(false);
      }
    };
    loadCoins();
  }, []);

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCoins = useMemo(() => {
    return cryptoPriceService.searchCoins(search, coinsList);
  }, [coinsList, search]);

  const handleSelect = (coin) => {
    setSearch(coin.symbol.toUpperCase());
    onChange(coin.id);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            const v = e.target.value.toLowerCase();
            setSearch(v);
            onChange(v);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled || isLoading}
          placeholder={isLoading ? "Cargando criptos..." : "Buscar cripto (BTC, Bitcoin...)"}
          className="w-full px-3 py-2.5 h-10 bg-background-tertiary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary transition-all font-mono text-sm disabled:opacity-50"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-text-tertiary animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-text-tertiary" />
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-danger mt-1">{error}</p>
      )}

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-background-secondary border border-border-primary rounded-lg shadow-lg"
        >
          {filteredCoins.length === 0 ? (
            <div className="px-3 py-3 text-sm text-text-tertiary">
              No se encontraron criptos. Intentá con otro término.
            </div>
          ) : (
            filteredCoins.map((coin) => (
              <button
                key={coin.id}
                onClick={() => handleSelect(coin)}
                className="w-full px-3 py-2.5 text-left hover:bg-background-tertiary transition-colors flex justify-between items-center border-b border-border-primary/50 last:border-0"
              >
                <span className="text-text-primary font-mono font-medium text-sm">
                  {coin.symbol?.toUpperCase()}
                </span>
                <span className="text-xs text-text-tertiary truncate ml-2 flex-1 text-right">
                  {coin.name} • {coin.id}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CryptoTickerAutocomplete;
