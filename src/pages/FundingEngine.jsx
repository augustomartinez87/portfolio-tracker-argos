import React, { useState } from 'react';
import { usePortfolio } from '../contexts/PortfolioContext';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import { useAuth } from '../contexts/AuthContext';
import { RefreshCw, Coins } from 'lucide-react';

export default function FundingEngine() {
    const { user, signOut } = useAuth();
    const { currentPortfolio } = usePortfolio();
    const [sidebarExpanded, setSidebarExpanded] = useState(false);

    // Reemplaza con TU URL final de Streamlit Cloud
    const APP_URL = "https://portfolio-tracker-argos.streamlit.app";

    const token = "argos-access";
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const iframeSrc = currentPortfolio && user
        ? `${APP_URL}/?embedded=true&token=${token}&portfolio_id=${currentPortfolio.id}&user_id=${user.id}&date_from=${startDate}&date_to=${endDate}`
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
            {/* Sidebar reuse */}
            <DashboardSidebar
                user={user}
                signOut={signOut}
                isExpanded={sidebarExpanded}
                setIsExpanded={setSidebarExpanded}
            />

            <main className={`flex-1 transition-all duration-300 ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
                <div className="h-screen w-full relative">
                    {iframeSrc && (
                        <iframe
                            src={iframeSrc}
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            title="Funding Engine"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            style={{ display: 'block', height: '100vh', width: '100%' }}
                        />
                    )}
                </div>
            </main>
        </div>
    );
};
