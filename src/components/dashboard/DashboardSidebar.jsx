import React, { useState } from 'react';
import { LayoutDashboard, FileText, PieChart, HelpCircle, LogOut } from 'lucide-react';

export const DashboardSidebar = ({ user, signOut, activeTab, setActiveTab, isExpanded, setIsExpanded }) => {
  const handleMouseEnter = () => setIsExpanded(true);
  const handleMouseLeave = () => setIsExpanded(false);

  const [hoveredItem, setHoveredItem] = useState(null);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trades', label: 'Transacciones', icon: FileText },
    { id: 'distribution', label: 'Distribución', icon: PieChart },
    { id: 'help', label: 'Ayuda', icon: HelpCircle },
  ];

  const isActive = (id) => activeTab === id;

  return (
    <aside
      className="hidden lg:flex group bg-background-secondary border-r border-border-primary fixed h-screen left-0 top-0 z-40 flex-col transition-all duration-300 w-16 hover:w-56 overflow-hidden shadow-xl shadow-black/20"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="h-20 flex items-center justify-center border-b border-border-primary">
        <LayoutDashboard className="w-5 h-5 text-text-tertiary group-hover:text-text-primary transition-colors" />
      </div>

      <div className="flex-1 py-4 overflow-hidden">
        <div className="space-y-1 h-full">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`w-full flex items-center py-2.5 h-10 transition-all ${
                isActive(item.id) 
                  ? 'bg-primary text-white' 
                  : hoveredItem === item.id
                    ? 'bg-background-tertiary text-text-primary'
                    : 'text-text-tertiary hover:bg-background-tertiary/50 hover:text-text-primary'
              }`}
              title={item.label}
            >
              <span className="w-16 flex justify-center flex-shrink-0">
                <item.icon className={`w-5 h-5 transition-colors ${
                  isActive(item.id) || hoveredItem === item.id ? 'text-current' : ''
                }`} />
              </span>
              <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 max-w-36 overflow-hidden">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-border-primary overflow-hidden">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mx-auto group-hover:mx-0"
            title={user?.email || 'Usuario'}
          >
            <span className="text-white font-medium text-sm">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 truncate max-w-36 overflow-hidden">
            <span className="text-sm font-medium text-text-primary truncate block">
              {user?.email || 'Usuario'}
            </span>
            <button
              onClick={() => signOut()}
              className="text-xs text-text-tertiary hover:text-text-primary flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              Cerrar sesión
            </button>
          </span>
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
