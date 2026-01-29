import React from 'react';
import { RefreshCw, HelpCircle, Shield } from 'lucide-react';
import { PortfolioSelector } from '@/features/portfolio/components/PortfolioSelector';
import { CurrencySelector } from '@/features/portfolio/components/CurrencySelector';

/**
 * PageHeader Unificado
 * @param {string} title - Título de la página
 * @param {string} subtitle - Subtítulo opcional (se muestra en mayúsculas pequeñas)
 * @param {React.ReactNode} icon - Icono de la página
 * @param {boolean} loading - Estado de carga global de la página
 * @param {function} onRefresh - Función de actualización
 * @param {string} displayCurrency - Moneda actual ('ARS' | 'USD')
 * @param {function} onCurrencyChange - Callback de cambio de moneda
 * @param {boolean} showCurrencySelector - Si debe mostrar el selector de moneda
 * @param {React.ReactNode} extraActions - Acciones adicionales a la derecha
 * @param {function} onHelpClick - Callback para el botón de ayuda
 */
export const PageHeader = ({
    title,
    subtitle,
    icon: Icon,
    loading,
    onRefresh,
    displayCurrency,
    onCurrencyChange,
    showCurrencySelector = true,
    extraActions,
    onHelpClick
}) => {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 lg:mb-6">
            <div className="flex items-center gap-3">
                {Icon && (
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="w-6 h-6 text-primary" />
                    </div>
                )}
                <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl lg:text-2xl font-bold text-text-primary tracking-tight">
                            {title}
                        </h1>
                        <div className="hidden lg:block border-l border-border-primary h-6 mx-1"></div>
                        <div className="hidden lg:block">
                            <PortfolioSelector />
                        </div>
                    </div>
                    {subtitle && (
                        <p className="text-text-tertiary text-[10px] uppercase font-bold tracking-widest mt-0.5 ml-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
                {/* Mobile Portfolio Selector */}
                <div className="lg:hidden">
                    <PortfolioSelector />
                </div>

                {showCurrencySelector && onCurrencyChange && (
                    <CurrencySelector
                        currentCurrency={displayCurrency}
                        onCurrencyChange={onCurrencyChange}
                    />
                )}

                {extraActions}

                <div className="flex items-center bg-background-secondary border border-border-primary rounded-lg p-1 shadow-sm">
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-background-tertiary rounded-md transition-all disabled:opacity-50"
                            title="Actualizar datos"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    )}

                    {onHelpClick && (
                        <button
                            onClick={onHelpClick}
                            className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-background-tertiary rounded-md transition-all border-l border-border-primary ml-1 pl-2"
                            title="Ayuda"
                        >
                            <HelpCircle className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
