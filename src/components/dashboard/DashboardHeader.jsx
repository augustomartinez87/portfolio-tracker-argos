import React from 'react';
import { RefreshCw } from 'lucide-react';
import { PortfolioSelector } from '../PortfolioSelector';
import logo from '../../assets/logo.png';
import { formatNumber } from '../../utils/formatters';

export const DashboardHeader = ({ mepRate, lastUpdate, isPricesLoading, refetchPrices, compact = false }) => {
  return (
    <header className={`${compact ? 'lg:flex' : 'hidden lg:flex'} items-center justify-between`}>
      {!compact && <PortfolioSelector />}

      <div className="flex items-center gap-3">
        <img src={logo} alt="Argos Capital" className="w-8 h-8" />
        <h1 className="text-xl font-bold text-text-primary">Argos Capital</h1>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-text-tertiary">MEP: {formatNumber(mepRate, 0)}</span>
        <span className="text-text-tertiary">|</span>
        <span className="text-sm text-text-tertiary">{lastUpdate || '--:--'}</span>
        <button
          onClick={() => refetchPrices()}
          disabled={isPricesLoading}
          className="ml-2 p-2 h-9 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary transition-all border border-border-primary active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Actualizar"
          aria-label="Actualizar precios"
        >
          <RefreshCw className={`w-4 h-4 ${isPricesLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </header>
  );
};

export default DashboardHeader;
