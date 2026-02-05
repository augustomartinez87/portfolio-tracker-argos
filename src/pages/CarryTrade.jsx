import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { usePrices } from '@/features/portfolio/services/priceService';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { SidebarToggleButton } from '@/components/common/SidebarToggleButton';
import { PortfolioSelector } from '@/features/portfolio/components/PortfolioSelector';
import CarryTradeHeatmap from '@/features/portfolio/components/CarryTradeHeatmap';
import { PageHeader } from '@/components/common/PageHeader';
import { Repeat, Loader2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import MobileNav from '@/components/common/MobileNav';

import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';
import { CarryTradeTabs } from '@/features/portfolio/components/CarryTradeTabs';

export default function CarryTrade() {
    const { tab } = useParams();
    const activeTab = tab || 'analisis';

    const { user, signOut } = useAuth();
    const { currentPortfolio } = usePortfolio();
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebarExpanded') === 'true';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarExpanded', sidebarExpanded ? 'true' : 'false');
    }
  }, [sidebarExpanded]);



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
            sidebarToggle={<SidebarToggleButton isExpanded={sidebarExpanded} setIsExpanded={setSidebarExpanded} />}
                        />

                        {!currentPortfolio ? (
                            <PortfolioEmptyState title="Sin Portfolio" message="Selecciona o crea un portfolio para simular estrategias de Carry Trade." />
                        ) : (
                            <>
                                {/* Sub-navigation (Tabs) */}
                                <div className="bg-background-secondary/50 border border-border-primary rounded-lg p-1">
                                    <CarryTradeTabs activeTab={activeTab} />
                                </div>

                                {activeTab === 'analisis' ? (
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
                                ) : (
                                    <div className="flex-1 bg-background-secondary border border-border-primary rounded-xl p-8 flex flex-col items-center justify-center text-center">
                                        <div className="p-4 bg-background-tertiary rounded-full mb-4">
                                            <Repeat className="w-12 h-12 text-primary animate-pulse" />
                                        </div>
                                        <h3 className="text-xl font-bold text-text-primary mb-2">Simulador de Carry Trade</h3>
                                        <p className="text-text-secondary max-w-md">
                                            Esta sección permitirá simular escenarios dinámicos de tipo de cambio e inflación para optimizar tu estrategia de Carry.
                                        </p>
                                        <div className="mt-6 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm font-medium">
                                            Fase 2: Próximamente disponible
                                        </div>
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
