import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, PieChart, HelpCircle } from 'lucide-react';

export const PortfolioTabs = ({ activeTab, currentPortfolio }) => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  // Evitar problemas de hidratación
  useEffect(() => {
    setMounted(true);
  }, []);

  // ELIMINADO: La persistencia ahora la maneja el sidebar redirigiendo a /resumen
  // o el usuario guardando el link directo si lo desea.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-12 bg-background-secondary border-b border-border-primary" />;
  }

  const tabs = [
    { id: 'resumen', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trades', label: 'Transacciones', icon: FileText },
    { id: 'distribution', label: 'Gráficos', icon: PieChart },
    { id: 'help', label: 'Ayuda', icon: HelpCircle },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => navigate(`/dashboard/${tab.id}`)}
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