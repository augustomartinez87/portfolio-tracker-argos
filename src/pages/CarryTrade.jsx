import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { usePrices } from '../services/priceService';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import { PortfolioSelector } from '../components/PortfolioSelector';
import CarryTradeHeatmap from '../components/dashboard/CarryTradeHeatmap.jsx';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { Loader2 } from 'lucide-react';

export default function CarryTrade() {
    const { user, signOut } = useAuth();
    const { currentPortfolio } = usePortfolio();
    const [sidebarExpanded, setSidebarExpanded] = useState(false);

    const {
        prices,
        mepRate,
        lastUpdate: priceLastUpdate,
        isLoading: isPricesLoading,
        isFetching,
        error
    } = usePrices();

    // Debug: Count prices
    const priceCount = prices ? Object.keys(prices).length : 0;

    // Debug: Check if any of the target tickers exist
    const targetTickers = ['T30E6', 'T13F6', 'S27F6', 'S17A6', 'S30A6', 'S29Y6', 'T30J6', 'S31G6', 'S30O6', 'S30N6'];
    const foundTickers = targetTickers.filter(t => prices && prices[t]);

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-background-primary flex">
                {/* Sidebar */}
                <DashboardSidebar
                    user={user}
                    signOut={signOut}
                    isExpanded={sidebarExpanded}
                    setIsExpanded={setSidebarExpanded}
                />

                <main className={`flex-1 transition-all duration-300 overflow-auto h-screen flex flex-col ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
                    <div className="p-4 lg:p-6 space-y-4 flex flex-col h-full">

                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-xl lg:text-2xl font-bold text-text-primary">Carry Trade</h1>
                                <p className="text-text-tertiary text-xs uppercase font-semibold tracking-wider">Macro Strategy</p>
                            </div>
                            <div className="hidden lg:block">
                                <PortfolioSelector />
                            </div>
                        </div>

                        {/* Debug Info Panel */}
                        <div className="bg-background-secondary border border-border-primary rounded-lg p-4 text-sm">
                            <h3 className="font-bold text-text-primary mb-2">Debug Info</h3>
                            <div className="space-y-1 text-text-secondary">
                                <p>Loading: {isPricesLoading ? 'Yes' : 'No'}</p>
                                <p>Fetching: {isFetching ? 'Yes' : 'No'}</p>
                                <p>Error: {error ? error.message : 'None'}</p>
                                <p>MEP Rate: {mepRate}</p>
                                <p>Total Prices: {priceCount}</p>
                                <p>Target Tickers Found: {foundTickers.length} / {targetTickers.length}</p>
                                <p className="text-xs font-mono">
                                    Found: {foundTickers.length > 0 ? foundTickers.join(', ') : 'None'}
                                </p>
                            </div>
                        </div>

                        {/* Loading State */}
                        {isPricesLoading && (
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                                <span className="text-text-tertiary">Cargando precios...</span>
                            </div>
                        )}

                        {/* Main Content: Heatmap */}
                        {!isPricesLoading && (
                            <div className="flex-1 min-h-[400px] bg-background-secondary border border-border-primary rounded-xl p-4">
                                <CarryTradeHeatmap positions={[]} />
                            </div>
                        )}

                    </div>
                </main>
            </div>
        </ErrorBoundary>
    );
}
