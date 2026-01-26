import React from 'react';
import { DollarSign } from 'lucide-react';

export const CurrencySelector = ({ currentCurrency, onCurrencyChange }) => {
    return (
        <div className="flex items-center bg-background-tertiary rounded-lg p-0.5 border border-border-primary overflow-hidden">
            <button
                onClick={() => onCurrencyChange('ARS')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${currentCurrency === 'ARS'
                        ? 'bg-text-primary text-background-primary shadow-sm'
                        : 'text-text-tertiary hover:text-text-secondary'
                    }`}
            >
                ARS
            </button>
            <button
                onClick={() => onCurrencyChange('USD')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${currentCurrency === 'USD'
                        ? 'bg-text-primary text-background-primary shadow-sm'
                        : 'text-text-tertiary hover:text-text-secondary'
                    }`}
            >
                USD
            </button>
        </div>
    );
};
