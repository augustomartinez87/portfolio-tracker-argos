import React, { useState } from 'react';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { usePrices } from '@/features/portfolio/services/priceService';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { PortfolioSelector } from '@/features/portfolio/components/PortfolioSelector';
import CarryTradeHeatmap from '@/features/portfolio/components/CarryTradeHeatmap';
import { CarryTradeSettings } from '@/features/carry/components/CarryTradeSettings';
import { PageHeader } from '@/components/common/PageHeader';
import { Repeat } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import MobileNav from '@/components/common/MobileNav';

import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';

export default function CarryTrade() {
    const { user, signOut } = useAuth();
    const { currentPortfolio } = usePortfolio();
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const [displayCurrency, setDisplayCurrency] = useState('USD');

    const {
        prices,
        mepRate,
        lastUpdate,
        isLoading: isPricesLoading,
        isFetching,
        error,
        refetch
    } = usePrices();

    const handleRefresh = async () => {
        try {
            await refetch();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-background-primary flex">
                <DashboardSidebar
                    user={user}
                    signOut={signOut}
                    isExpanded={sidebarExpanded}
                    setIsExpanded={setSidebarExpanded}
                />
                <main className={`flex-1 transition-all duration-300 overflow-hidden h-screen flex flex-col mt-16 lg:mt-0 mb-16 lg:mb-0 ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
                    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 flex flex-col h-full overflow-hidden">
                        <PageHeader
                            title="Carry Trade"
                            subtitle="Estrategia y Riesgo"
                            icon={Repeat}
                            loading={isPricesLoading || isFetching}
                            onRefresh={handleRefresh}
                            displayCurrency={displayCurrency}
                            onCurrencyChange={setDisplayCurrency}
                            showCurrencySelector={true}
                        />

                        {!currentPortfolio ? (
                            <PortfolioEmptyState title="Sin Portfolio" message="Selecciona o crea un portfolio para simular estrategias de Carry Trade." />
                        ) : (
                            <>
                                {isPricesLoading && (
                                    <div className="flex items-center justify-center p-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                                        <span className="text-text-tertiary">Cargando precios...</span>
                                    </div>
                                )}

                                {!isPricesLoading && (
                                    <div className="flex-1 min-h-[400px] bg-background-secondary border border-border-primary rounded-xl p-4 overflow-hidden shadow-2xl">
                                        <CarryTradeHeatmap positions={[]} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </main>
                <MobileNav />
            </div>
        </ErrorBoundary>
    );
}
