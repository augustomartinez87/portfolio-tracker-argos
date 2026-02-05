// FCI Feature - Public API
// Fondos Comunes de Inversión module

// Components — lot model (active)
export { default as FciLotTable } from './components/FciLotTable';
export { default as FciLotsList } from './components/FciLotsList';
export { default as FciLotModal } from './components/FciLotModal';
export { default as FciPriceUploadModal } from './components/FciPriceUploadModal';
export { default as AnalisisRealContent } from './components/AnalisisRealContent';
export { FciTabs } from './components/FciTabs';

// Components — legacy (retained, not actively used)
export { default as FciTable } from './components/FciTable';
export { default as FciTransactionsList } from './components/FciTransactionsList';
export { default as FciTransactionModal } from './components/FciTransactionModal';

// Hooks
export { useFciLotEngine } from './hooks/useFciLotEngine';
export { useFciEngine } from './hooks/useFciEngine';

// Services
export { fciService } from './services/fciService';
