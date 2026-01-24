import React, { useState, useEffect } from 'react';
import { LayoutDashboard, FileText, PieChart, HelpCircle } from 'lucide-react';

export const PortfolioTabs = ({ activeTab, setActiveTab, currentPortfolio }) => {
  const [mounted, setMounted] = useState(false);

  // Evitar problemas de hidratación
  useEffect(() => {
    setMounted(true);
  }, []);

  // Recuperar tab guardada o usar dashboard por defecto
  useEffect(() => {
    if (mounted && currentPortfolio?.id) {
      const savedTab = localStorage.getItem(`portfolio-tab-${currentPortfolio.id}`);
      if (savedTab && ['dashboard', 'trades', 'distribution', 'help'].includes(savedTab)) {
        setActiveTab(savedTab);
      }
    }
  }, [mounted, currentPortfolio?.id, setActiveTab]);

  // Guardar tab cuando cambia
  useEffect(() => {
    if (mounted && currentPortfolio?.id && activeTab) {
      localStorage.setItem(`portfolio-tab-${currentPortfolio.id}`, activeTab);
    }
  }, [activeTab, currentPortfolio?.id, mounted]);

  if (!mounted) {
    return <div className="h-12 bg-background-secondary border-b border-border-primary" />;
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trades', label: 'Transacciones', icon: FileText },
    { id: 'distribution', label: 'Distribución', icon: PieChart },
    { id: 'help', label: 'Ayuda', icon: HelpCircle },
  ];

  return (
    <div className="bg-background-secondary border-b border-border-primary">
      <div className="flex space-x-1 px-4 lg:px-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === tab.id
                ? 'text-primary border-primary'
                : 'text-text-tertiary border-transparent hover:text-text-primary hover:border-border-primary'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};