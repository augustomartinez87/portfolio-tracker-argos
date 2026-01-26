// src/components/common/TickerAutocomplete.jsx
import { useState, useEffect, useMemo, useRef } from 'react';

const ASSET_CLASS_COLORS = {
  'CEDEAR': 'text-success',
  'ARGY': 'text-primary',
  'BONO HARD DOLLAR': 'text-amber-400',
  'BONOS PESOS': 'text-purple-400',
  'ON': 'text-amber-400',
  'OTROS': 'text-text-tertiary'
};

export const TickerAutocomplete = ({ value, onChange, tickers, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const filteredTickers = useMemo(() => {
    if (!search) return tickers.slice(0, 50);
    const searchUpper = search.toUpperCase();
    return tickers
      .filter(t => t.ticker.toUpperCase().includes(searchUpper))
      .slice(0, 50);
  }, [search, tickers]);

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

  const handleSelect = (ticker) => {
    setSearch(ticker.ticker);
    onChange(ticker.ticker);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value.toUpperCase());
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        disabled={disabled}
        placeholder="Buscar ticker..."
        className="w-full px-3 py-2.5 h-10 bg-background-tertiary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary transition-all font-mono text-sm"
      />
      {isOpen && filteredTickers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-background-secondary border border-border-primary rounded-lg shadow-lg"
        >
          {filteredTickers.map((ticker) => (
            <button
              key={ticker.ticker}
              onClick={() => handleSelect(ticker)}
              className="w-full px-3 py-2.5 h-10 text-left hover:bg-background-tertiary transition-colors flex justify-between items-center border-b border-border-primary/50 last:border-0"
            >
              <span className="text-text-primary font-mono font-medium text-sm">{ticker.ticker}</span>
              <span className={`text-xs font-medium ${ASSET_CLASS_COLORS[ticker.assetClass] || 'text-text-tertiary'}`}>
                {ticker.assetClass}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TickerAutocomplete;
