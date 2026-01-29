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
    { id: 'distribution', label: 'Gráficos', icon: PieChart },
    { id: 'help', label: 'Ayuda', icon: HelpCircle },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm ${activeTab === tab.id
            ? 'bg-text-primary text-background-primary'
            : 'text-text-tertiary hover:text-text-primary hover:bg-background-tertiary'
            }`}
        >
          <tab.icon className="w-4 h-4" />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};