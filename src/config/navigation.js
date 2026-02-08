import { Briefcase, TrendingUp, Coins, PieChart, Settings, Wallet, Landmark, Bitcoin } from 'lucide-react';

/**
 * Configuración centralizada de navegación
 * Cada item define el módulo, permisos y metadata de navegación
 */
export const NAV_ITEMS = [
  {
    id: 'portfolio',
    moduleId: 'portfolio',
    label: 'Portfolio',
    icon: Briefcase,
    path: '/portfolio/dashboard',
    adminOnly: false
  },
  {
    id: 'portfolio-crypto',
    moduleId: 'portfolio_cripto',
    label: 'Portfolio Cripto',
    icon: Wallet,
    path: '/crypto/portfolio',
    adminOnly: true
  },
  {
    id: 'nexo-loans',
    moduleId: 'nexo_loans',
    label: 'Préstamos Nexo',
    icon: Landmark,
    path: '/crypto/nexo-loans',
    adminOnly: true
  },
  {
    id: 'funding-crypto',
    moduleId: 'funding_crypto',
    label: 'Funding Crypto',
    icon: Bitcoin,
    path: '/crypto/funding',
    adminOnly: true
  },
  {
    id: 'fci',
    moduleId: 'fci',
    label: 'Fondos (FCI)',
    icon: PieChart,
    path: '/portfolio/fci',
    adminOnly: true
  },
  {
    id: 'financiacion',
    moduleId: 'financiacion',
    label: 'Financiación',
    icon: TrendingUp,
    path: '/portfolio/financing',
    adminOnly: true
  },
  {
    id: 'funding',
    moduleId: 'funding',
    label: 'Funding & Carry',
    icon: Coins,
    path: '/portfolio/funding',
    adminOnly: true
  },
  {
    id: 'admin',
    moduleId: 'admin',
    label: 'Administración',
    icon: Settings,
    path: '/admin',
    adminOnly: true
  }
];

export const MODULES_BY_PORTFOLIO_TYPE = {
  bursatil: ['portfolio', 'fci', 'financiacion', 'funding', 'admin'],
  cripto: ['portfolio_cripto', 'nexo_loans', 'fci', 'funding_crypto', 'admin']
};

export const getModulesByPortfolioType = (portfolioType) => {
  if (!portfolioType) return MODULES_BY_PORTFOLIO_TYPE.bursatil;
  return MODULES_BY_PORTFOLIO_TYPE[portfolioType] || MODULES_BY_PORTFOLIO_TYPE.bursatil;
};

/**
 * Filtra los items de navegación según el rol y módulos del usuario
 * @param {boolean} isAdmin - Si el usuario es administrador
 * @param {string[]} allowedModules - Array de módulos permitidos para el usuario
 * @param {string} portfolioType - Tipo de portfolio activo
 * @returns {Array} Items de navegación filtrados
 */
export const getFilteredNavItems = (isAdmin, allowedModules = [], portfolioType = 'bursatil') => {
  const modulesByType = getModulesByPortfolioType(portfolioType);
  const effectiveModules = isAdmin
    ? modulesByType
    : (allowedModules || []).filter(m => modulesByType.includes(m));

  return NAV_ITEMS.map(item => {
    // Si el item tiene subItems, filtrarlos primero
    const filteredSubItems = item.subItems
      ? item.subItems.filter(sub => {
        if (sub.adminOnly && !isAdmin) return false;
        return effectiveModules.includes(sub.moduleId);
      })
      : null;

    return { ...item, subItems: filteredSubItems };
  }).filter(item => {
    // Si el item principal es adminOnly, el usuario no-admin no entra.
    if (!isAdmin && item.adminOnly) return false;

    // Verificar si el usuario tiene acceso al módulo principal de forma explícita
    return effectiveModules.includes(item.moduleId);
  });
};

/**
 * Obtiene un item de navegación por su path
 */
export const getNavItemByPath = (path) => {
  return NAV_ITEMS.find(item => item.path === path);
};

/**
 * Obtiene un item de navegación por su moduleId
 */
export const getNavItemByModule = (moduleId) => {
  return NAV_ITEMS.find(item => item.moduleId === moduleId);
};

/**
 * Módulos por defecto según el rol
 */
export const DEFAULT_MODULES = {
  user: ['portfolio'],
  admin: ['portfolio', 'fci', 'financiacion', 'funding', 'admin']
};
