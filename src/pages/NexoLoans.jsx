import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { SidebarToggleButton } from '@/components/common/SidebarToggleButton';
import MobileNav from '@/components/common/MobileNav';
import { PageHeader } from '@/components/common/PageHeader';
import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';

export default function NexoLoans() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { currentPortfolio } = usePortfolio();
  const [sidebarExpanded, setSidebarExpanded] = useSidebarState();

  // Auto-redirect if portfolio type doesn't match this page (crypto only)
  useEffect(() => {
    if (currentPortfolio && currentPortfolio.portfolio_type !== 'cripto') {
      navigate('/portfolio/dashboard');
    }
  }, [currentPortfolio, navigate]);

  return (
    <div className="min-h-screen bg-background-primary flex">
      <DashboardSidebar
        user={user}
        signOut={signOut}
        isExpanded={sidebarExpanded}
        setIsExpanded={setSidebarExpanded}
        portfolioType={currentPortfolio?.portfolio_type}
      />

      <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 overflow-x-hidden ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
        <div className="p-3 lg:p-4 space-y-3">
          <PageHeader
            title="Prestamos Nexo"
            subtitle="Deuda, intereses y eventos"
            icon={Landmark}
            sidebarToggle={<SidebarToggleButton isExpanded={sidebarExpanded} setIsExpanded={setSidebarExpanded} />}
          />

          {!currentPortfolio ? (
            <PortfolioEmptyState title="Sin Portfolio" message="Selecciona o crea un portfolio cripto para comenzar." />
          ) : (
            <div className="bg-background-secondary border border-border-primary rounded-xl p-6">
              <p className="text-text-tertiary text-sm">Modulo en construccion. Aqui se veran prestamos, drawdowns e intereses diarios.</p>
            </div>
          )}
        </div>
      </main>

      <MobileNav portfolioType={currentPortfolio?.portfolio_type} />
    </div>
  );
}
