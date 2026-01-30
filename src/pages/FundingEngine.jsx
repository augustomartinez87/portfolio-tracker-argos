import React, { useState } from 'react';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePrices, invokeFetchPrices } from '@/features/portfolio/services/priceService';
import { Database } from 'lucide-react';
import MobileNav from '@/components/common/MobileNav';
import { PageHeader } from '@/components/common/PageHeader';
import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';

export default function FundingEngine() {
    const { user, signOut } = useAuth();
    const { currentPortfolio } = usePortfolio();
    const { theme } = useTheme();
    const { lastUpdate: priceLastUpdate, isLoading: isPricesLoading, isFetching: isPricesFetching, refetch: refetchPrices } = usePrices();
    const [sidebarExpanded, setSidebarExpanded] = useState(false);

    const handleManualRefresh = async () => {
        try {
            await invokeFetchPrices();
            refetchPrices();
        } catch (error) {
            console.error("Manual refresh failed", error);
        }
    };

    const APP_URL = "https://portfolio-tracker-argos.streamlit.app";
    const token = "argos-access";
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const iframeSrc = currentPortfolio && user
        ? `${APP_URL}/?embedded=true&token=${token}&portfolio_id=${currentPortfolio.id}&user_id=${user.id}&date_from=${startDate}&date_to=${endDate}&theme=${theme}`
        : null;

    return (
        <div className="min-h-screen bg-background-primary flex">
            <DashboardSidebar
                user={user}
                signOut={signOut}
                isExpanded={sidebarExpanded}
                setIsExpanded={setSidebarExpanded}
            />

            <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 flex flex-col mb-16 lg:mb-0 h-screen ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
                <div className="p-4 lg:p-6 flex flex-col flex-1 h-full overflow-hidden">
                    <PageHeader
                        title="Funding"
                        subtitle="Caja y Liquidez"
                        icon={Database}
                        loading={isPricesLoading || isPricesFetching}
                        onRefresh={handleManualRefresh}
                        showCurrencySelector={false}
                    />

                    {!currentPortfolio ? (
                        <PortfolioEmptyState title="Sin Portfolio" message="Selecciona o crea un portfolio para ver tus flujos de caja y liquidez." />
                    ) : (
                        <div className="flex-1 w-full mt-4 bg-background-secondary border border-border-primary rounded-xl overflow-hidden shadow-2xl">
                            {iframeSrc && (
                                <iframe
                                    src={iframeSrc}
                                    title="Funding Engine"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    className="w-full h-full border-0"
                                />
                            )}
                        </div>
                    )}
                </div>
            </main>

            <MobileNav />
        </div>
    );
}
