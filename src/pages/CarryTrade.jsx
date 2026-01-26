
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { usePrices } from '../services/priceService';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import { PortfolioSelector } from '../components/PortfolioSelector';
import CarryTradeHeatmap from '../components/dashboard/CarryTradeHeatmap.jsx';
import logo from '../assets/logo.png';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

export default function CarryTrade() {
    const { user, signOut } = useAuth();
    const { currentPortfolio } = usePortfolio();

    const {
        prices,
        mepRate,
        lastUpdate: priceLastUpdate,
        isLoading: isPricesLoading,
        refetch: refetchPrices
    } = usePrices();

    const [sidebarExpanded, setSidebarExpanded] = React.useState(false);

    const lastUpdate = priceLastUpdate ? priceLastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' hs' : null;

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-background-primary flex">
                {/* Header mobile top */}
                <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background-secondary/95 backdrop-blur-xl border-b border-border-primary px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <PortfolioSelector />
                            <img src={logo} alt="Argos Capital" className="w-8 h-8" />
                            <h1 className="text-lg font-bold text-text-primary">Argos Capital</h1>
                        </div>
                    </div>
                </div>

                {/* Sidebar desktop */}
                <DashboardSidebar
                    user={user}
                    signOut={signOut}
                    isExpanded={sidebarExpanded}
                    setIsExpanded={setSidebarExpanded}
                />

                <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 overflow-hidden h-screen flex flex-col ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
                    <div className="p-2 lg:p-3 space-y-2 lg:space-y-3 flex flex-col h-full overflow-hidden">

                        {/* Page Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative min-h-[48px] z-20">
                            <div className="flex items-center gap-3">
                                <div>
                                    <h1 className="text-lg lg:text-xl font-bold text-text-primary leading-tight">Carry Trade</h1>
                                    <p className="text-text-tertiary text-[10px] uppercase font-semibold tracking-wider">Macro Strategy</p>
                                </div>
                                <div className="hidden lg:block border-l border-border-primary h-8 mx-1"></div>
                                <div className="hidden lg:block scale-90 origin-left">
                                    <PortfolioSelector />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <DashboardHeader
                                    mepRate={mepRate}
                                    lastUpdate={lastUpdate}
                                    isPricesLoading={isPricesLoading}
                                    refetchPrices={refetchPrices}
                                    compact={true}
                                    showLogo={false}
                                />
                            </div>
                        </div>

                        {/* Mobile Selector */}
                        <div className="lg:hidden relative z-30">
                            <PortfolioSelector />
                        </div>

                        {/* Main Content */}
                        <div className="min-h-0 flex-1 flex flex-col overflow-hidden bg-background-secondary border border-border-primary rounded-xl p-4">
                            <div className="h-full w-full">
                                {/* We pass an empty list for 'positions' if we want just the watchlist, 
                      or currentPortfolio positions if we want to highlight owned assets.
                      For now, passing [] invokes the engine's default watchlist logic. */}
                                <CarryTradeHeatmap positions={[]} />
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </ErrorBoundary>
    );
}
