import { Briefcase, TrendingUp, Coins, Activity, BarChart2, PiggyBank, Settings } from 'lucide-react';

/**
 * Configuración centralizada de navegación
 * Cada item define el módulo, permisos y metadata de navegación
 */
export const NAV_ITEMS = [
  {
    id: 'portfolio',
    moduleId: 'portfolio',
    label: 'Portafolio',
    icon: Briefcase,
    path: '/dashboard',
    adminOnly: false
  },
  {
    id: 'fci',
    moduleId: 'fci',
    label: 'Fondos (FCI)',
    icon: PiggyBank,
    path: '/fci',
    adminOnly: true
  },
  {
    id: 'financiacion',
    moduleId: 'financiacion',
    label: 'Financiación',
    icon: TrendingUp,
    path: '/financiacion',
    adminOnly: true
  },
  {
    id: 'funding',
    moduleId: 'funding',
    label: 'Funding & Carry',
    icon: Coins,
    path: '/funding-engine',
    adminOnly: true
  },
  {
    id: 'carry',
    moduleId: 'carryTrade',
    label: 'Carry Trade',
    icon: Activity,
    path: '/carry-trade',
    adminOnly: false
  },
  {
    id: 'analisis',
    moduleId: 'analisis',
    label: 'Análisis Real',
    icon: BarChart2,
    path: '/analisis-real',
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

/**
 * Filtra los items de navegación según el rol y módulos del usuario
 * @param {boolean} isAdmin - Si el usuario es administrador
 * @param {string[]} allowedModules - Array de módulos permitidos para el usuario
 * @returns {Array} Items de navegación filtrados
 */
export const getFilteredNavItems = (isAdmin, allowedModules = []) => {
  return NAV_ITEMS.filter(item => {
    // Si es admin, acceso a todo
    if (isAdmin) return true;

    // Si el item es solo para admin y el usuario no es admin, ocultar
    if (item.adminOnly) return false;

    // Verificar si el usuario tiene acceso al módulo
    return allowedModules.includes(item.moduleId);
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
  user: ['portfolio', 'carryTrade'],
  admin: ['portfolio', 'fci', 'carryTrade', 'financiacion', 'funding', 'analisis', 'admin']
};
