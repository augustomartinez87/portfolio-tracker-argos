import React, { useState } from 'react';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { usePrices } from '@/features/portfolio/services/priceService';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { PortfolioSelector } from '@/features/portfolio/components/PortfolioSelector';
import CarryTradeHeatmap from '@/features/portfolio/components/CarryTradeHeatmap';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import MobileNav from '@/components/common/MobileNav';
import logo from '@/assets/logo.png';

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
                <DashboardSidebar
                    user={user}
                    signOut={signOut}
                    isExpanded={sidebarExpanded}
                    setIsExpanded={setSidebarExpanded}
                />
                {/* Mobile Header */}
                <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background-secondary/95 backdrop-blur-xl border-b border-border-primary px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <img src={logo} alt="Argos Capital" className="w-8 h-8" />
                            <h1 className="text-lg font-bold text-text-primary">Carry Trade</h1>
                        </div>
                    </div>
                </div>

                <main className={`flex-1 transition-all duration-300 overflow-auto h-screen flex flex-col mt-16 lg:mt-0 mb-16 lg:mb-0 ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
                    <div className="p-4 lg:p-6 space-y-4 flex flex-col h-full">

                        {/* Header (Desktop) */}
                        <div className="hidden lg:flex items-center justify-between">
                            <div>
                                <h1 className="text-xl lg:text-2xl font-bold text-text-primary">Carry Trade</h1>
                                <p className="text-text-tertiary text-xs uppercase font-semibold tracking-wider">Macro Strategy</p>
                            </div>
                            <div className="hidden lg:block">
                                <PortfolioSelector />
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
                <MobileNav />
            </div>
        </ErrorBoundary>
    );
}
