import React from 'react';
import { Briefcase, TrendingUp, Coins, Activity } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export const MobileNav = () => {
    const location = useLocation();

    const navItems = [
        { id: 'portfolio', label: 'Portafolio', icon: Briefcase, path: '/dashboard' },
        { id: 'financiacion', label: 'Financiación', icon: TrendingUp, path: '/financiacion' },
        { id: 'funding', label: 'Funding', icon: Coins, path: '/funding-engine' },
        { id: 'carry', label: 'Carry', icon: Activity, path: '/carry-trade' },
    ];

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
