import { Briefcase, TrendingUp, Coins, Activity, PieChart, BarChart2, Settings } from 'lucide-react';

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
    path: '/dashboard',
    adminOnly: false
  },
  {
    id: 'fci',
    moduleId: 'fci',
    label: 'Fondos (FCI)',
    icon: PieChart,
    path: '/fci',
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
  return NAV_ITEMS.map(item => {
    // Si el item tiene subItems, filtrarlos primero
    const filteredSubItems = item.subItems
      ? item.subItems.filter(sub => isAdmin || (!sub.adminOnly && allowedModules.includes(sub.moduleId)))
      : null;

    return { ...item, subItems: filteredSubItems };
  }).filter(item => {
    // Si es admin, tiene acceso a la estructura base
    if (isAdmin) return true;

    // Si el item principal es adminOnly, solo mostrar si tiene sub-items permitidos (un poco contradictorio, mejor seguir el adminOnly del padre)
    // En este caso, si el padre es adminOnly, el usuario no entra.
    // SI queremos que el usuario vea el padre para llegar al hijo, el padre NO debe ser adminOnly.
    if (item.adminOnly) return false;

    // Verificar si el usuario tiene acceso al módulo principal
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
