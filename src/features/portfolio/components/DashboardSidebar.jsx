import React, { useState } from 'react';
import { Layers, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { getFilteredNavItems } from '@/config/navigation';

export const DashboardSidebar = ({ user, signOut, isExpanded, portfolioType = 'bursatil' }) => {
  const location = useLocation();
  const { isAdmin, allowedModules, userProfile } = useAuth();

  const [hoveredItem, setHoveredItem] = useState(null);

  // Filtrar items de navegacion segun permisos del usuario
  // No renderizar navegacion completa si el perfil aun no existe o esta cargando
  // Aunque ProtectedRoute maneja esto, el sidebar debe ser defensivo
  const navItems = userProfile
    ? getFilteredNavItems(isAdmin, allowedModules, portfolioType)
    : getFilteredNavItems(false, ['portfolio']); // Fallback mínimo absoluto

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <aside
      className={`hidden lg:flex bg-background-secondary border-r border-border-primary fixed h-screen left-0 top-0 z-40 flex-col transition-all duration-300 ${isExpanded ? 'w-56 overflow-hidden' : 'w-16 overflow-visible'} shadow-xl shadow-black/20`}
    >
      <div className={`h-20 flex items-center border-b border-border-primary ${isExpanded ? 'justify-between px-4' : 'justify-center'}`}>
        <Layers className={`w-5 h-5 transition-colors ${isExpanded ? 'text-primary' : 'text-text-tertiary'}`} />
      </div>

      <div className="flex-1 py-4 overflow-visible">
        <div className="space-y-1 h-full overflow-visible">
          {navItems.map((item) => (
            <div key={item.id} className="w-full">
              <Link
                to={item.path}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`w-full flex items-center py-2.5 h-10 transition-all duration-300 relative group/item ${isActive(item.path)
                  ? 'bg-text-primary text-background-primary'
                  : hoveredItem === item.id
                    ? 'bg-background-tertiary text-text-primary'
                    : 'text-text-tertiary hover:bg-background-tertiary/50 hover:text-text-primary'
                  }`}
                title={item.label}
              >
                <span className="w-16 flex justify-center flex-shrink-0">
                  <item.icon className={`w-5 h-5 transition-colors ${isActive(item.path) || hoveredItem === item.id ? 'text-current' : ''
                    }`} />
                </span>
                <span className={`whitespace-nowrap transition-opacity duration-200 flex-1 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                  <span className="max-w-28 overflow-hidden">{item.label}</span>
                </span>
                {!isExpanded && hoveredItem === item.id && (
                  <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-background-secondary border border-border-primary text-xs text-text-primary shadow-lg whitespace-nowrap z-40 pointer-events-none">
                    {item.label}
                  </span>
                )}
              </Link>

              {/* Sub-items (visible when sidebar is expanded) */}
              {isExpanded && item.subItems && (
                <div className="bg-background-tertiary/20 py-1">
                  {item.subItems.map(sub => (
                    <Link
                      key={sub.id}
                      to={sub.path}
                      className={`w-full flex items-center py-2 pl-12 h-9 transition-all text-xs ${isActive(sub.path)
                        ? 'text-primary font-bold'
                        : 'text-text-tertiary hover:text-text-primary'
                        }`}
                    >
                      <sub.icon className="w-3.5 h-3.5 mr-2 opacity-70" />
                      <span>{sub.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-border-primary overflow-hidden">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 ${isExpanded ? 'mx-0' : 'mx-auto'}`}
            title={user?.email || 'Usuario'}
          >
            <span className="text-white font-medium text-sm">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <span className={`whitespace-nowrap transition-opacity duration-200 truncate max-w-36 overflow-hidden ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
            <span className="text-sm font-medium text-text-primary truncate block">
              {userProfile?.display_name || user?.email || 'Usuario'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => signOut()}
                className="text-xs text-text-tertiary hover:text-text-primary flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                Salir
              </button>
            </div>
          </span>
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
