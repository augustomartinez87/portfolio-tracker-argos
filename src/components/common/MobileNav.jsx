import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { getFilteredNavItems } from '@/config/navigation';

export const MobileNav = () => {
    const location = useLocation();
    const { isAdmin, allowedModules } = useAuth();

    // Filtrar items de navegación según permisos del usuario
    // Limitar a los primeros 5 items para móvil
    const navItems = getFilteredNavItems(isAdmin, allowedModules).slice(0, 5);

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background-secondary/95 backdrop-blur-xl border-t border-border-primary px-2 pb-safe">
            <div className="flex items-center justify-around h-16">
                {navItems.map((item) => (
                    <Link
                        key={item.id}
                        to={item.path}
                        className={`flex flex-col items-center justify-center flex-1 gap-1 transition-colors ${isActive(item.path)
                            ? 'text-primary'
                            : 'text-text-tertiary hover:text-text-primary'
                            }`}
                    >
                        <item.icon className={`w-5 h-5 ${isActive(item.path) ? 'text-primary' : ''}`} />
                        <span className="text-[10px] font-medium uppercase tracking-tight">{item.label}</span>
                    </Link>
                ))}
            </div>
        </nav>
    );
};

export default MobileNav;
