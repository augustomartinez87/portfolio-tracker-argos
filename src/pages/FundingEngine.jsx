import React, { useState } from 'react';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { DashboardHeader } from '@/features/portfolio/components/DashboardHeader';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePrices, invokeFetchPrices } from '@/features/portfolio/services/priceService';
import { RefreshCw, Coins } from 'lucide-react';
import MobileNav from '@/components/common/MobileNav';
import logo from '@/assets/logo.png';

export default function FundingEngine() {
    const { user, signOut } = useAuth();
    const { currentPortfolio } = usePortfolio();
    const { theme } = useTheme();
    const { mepRate, lastUpdate: priceLastUpdate, isLoading: isPricesLoading, isFetching: isPricesFetching, refetch: refetchPrices } = usePrices();
    const [sidebarExpanded, setSidebarExpanded] = useState(false);

    const lastUpdate = priceLastUpdate ? priceLastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' hs' : '--:-- hs';

    const handleManualRefresh = async () => {
        try {
            await invokeFetchPrices();
            refetchPrices();
        } catch (error) {
            console.error("Manual refresh failed", error);
        }
    };

    // Reemplaza con TU URL final de Streamlit Cloud
    const APP_URL = "https://portfolio-tracker-argos.streamlit.app";

    const token = "argos-access";
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const iframeSrc = currentPortfolio && user
        ? `${APP_URL}/?embedded=true&token=${token}&portfolio_id=${currentPortfolio.id}&user_id=${user.id}&date_from=${startDate}&date_to=${endDate}&theme=${theme}`
        : null;

    if (!currentPortfolio || !user) {
        return (
            <div className="min-h-screen bg-background-primary flex items-center justify-center text-text-primary">
                <p>Cargando...</p>
            </div>
        );
    }

    return (
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
                        <h1 className="text-lg font-bold text-text-primary">Funding Engine</h1>
                    </div>
                </div>
            </div>

            <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 flex flex-col mb-16 lg:mb-0 ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
                {/* Header (Desktop) */}
                <div className="hidden lg:block p-3 border-b border-border-primary">
                    <DashboardHeader
                        mepRate={mepRate}
                        lastUpdate={lastUpdate}
                        isPricesLoading={isPricesLoading || isPricesFetching}
                        refetchPrices={handleManualRefresh}
                        compact={true}
                        showLogo={true}
                    />
                </div>

                <div className="h-[calc(100vh-4rem)] w-full relative">
                    {iframeSrc && (
                        <iframe
                            src={iframeSrc}
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            title="Funding Engine"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            style={{ display: 'block', height: '100%', width: '100%' }}
                        />
                    )}
                </div>
            </main>
            <MobileNav />
        </div>
    );
};
