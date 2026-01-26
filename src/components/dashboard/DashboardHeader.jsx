import React from 'react';
import { RefreshCw, Sun, Moon } from 'lucide-react';
import { PortfolioSelector } from '../PortfolioSelector';
import logo from '../../assets/logo.png';
import { formatNumber } from '../../utils/formatters';
import { useTheme } from '../../contexts/ThemeContext';

export const DashboardHeader = ({ mepRate, lastUpdate, isPricesLoading, refetchPrices, compact = false, showLogo = true, hideMep = false }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className={`${compact ? 'lg:flex' : 'hidden lg:flex'} items-center justify-between gap-4`}>
      {!compact && <PortfolioSelector />}

      {showLogo && (
        <div className="flex items-center gap-3">
          <img src={logo} alt="Argos Capital" className="w-8 h-8" />
          <h1 className="text-xl font-bold text-text-primary">Argos Capital</h1>
        </div>
      )}

      <div className="flex items-center gap-2">
        {!hideMep && (
          <>
            <span className="text-sm text-text-tertiary">MEP: {formatNumber(mepRate, 0)}</span>
            <span className="text-text-tertiary">|</span>
          </>
        )}
        <span className="text-sm text-text-tertiary">Precios: {lastUpdate || '--:--'}</span>

        <button
          onClick={toggleTheme}
          className="ml-2 p-2 h-9 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary transition-all border border-border-primary active:scale-95"
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
