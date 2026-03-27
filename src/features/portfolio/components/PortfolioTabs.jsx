import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, PieChart, HelpCircle, Target } from 'lucide-react';

export const PortfolioTabs = ({ activeTab, currentPortfolio }) => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-10 border-b border-border-secondary" />;
  }

  const tabs = [
    { id: 'resumen', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trades', label: 'Transacciones', icon: FileText },
    { id: 'distribution', label: 'Gráficos', icon: PieChart },
    { id: 'estrategia', label: 'Estrategia', icon: Target },
    { id: 'help', label: 'Ayuda', icon: HelpCircle },
  ];

  return (
    <div className="border-b border-border-secondary">
      <div className="flex gap-0.5 sm:gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide w-full">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate(`/portfolio/${tab.id}`)}
            className={`px-2.5 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors border-b-2 flex-shrink-0 ${activeTab === tab.id
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
              }`}
          >
            <span className="flex items-center gap-1.5 sm:gap-2">
              <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
