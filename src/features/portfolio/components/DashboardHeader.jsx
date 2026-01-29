import React, { useMemo } from 'react';
import { RefreshCw, Sun, Moon } from 'lucide-react';
import { CurrencySelector } from './CurrencySelector';
import logo from '../../assets/logo.png';
import { formatNumber } from '../../utils/formatters';
import { useTheme } from '../../contexts/ThemeContext';

export const DashboardHeader = ({ mepRate, lastUpdate, isPricesLoading, refetchPrices, compact = false, showLogo = true, hideMep = false, displayCurrency, onCurrencyChange }) => {
  const { theme, toggleTheme } = useTheme();

  // No longer hardcoding time here, using lastUpdate prop

  return (
    <header className={`${compact ? 'lg:grid' : 'hidden lg:grid'} grid-cols-3 items-center gap-4`}>
      {/* Col 1: Portfolio Selector (Left) */}
      <div className="flex items-center justify-start">
        {!compact && <PortfolioSelector />}
      </div>

      {/* Col 2: Logo (Center) */}
      <div className="flex items-center justify-center gap-3">
        {showLogo && (
          <>
            <img src={logo} alt="Argos Capital" className="w-8 h-8" />
            <h1 className="text-xl font-bold text-text-primary">Argos Capital</h1>
          </>
        )}
      </div>

      {/* Col 3: MEP & Prices (Right) */}
      <div className="flex items-center justify-end gap-2">
        {!hideMep && (
          <>
            <span className="text-sm text-text-tertiary">MEP: {formatNumber(mepRate, 0)}</span>
            <span className="text-text-tertiary">|</span>
          </>
        )}
        <span className="text-sm text-text-tertiary">Precios de {lastUpdate || '--:-- hs'}</span>
        {displayCurrency && onCurrencyChange && (
          <CurrencySelector
            currentCurrency={displayCurrency}
            onCurrencyChange={onCurrencyChange}
          />
        )}

        <button
          onClick={refetchPrices}
          disabled={isPricesLoading}
          className="p-2 h-9 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary transition-all border border-border-primary active:scale-95 disabled:opacity-50"
          title="Actualizar precios"
        >
          <RefreshCw className={`w-4 h-4 ${isPricesLoading ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 h-9 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary transition-all border border-border-primary active:scale-95"
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};

export default DashboardHeader;
