import React from 'react';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { PortfolioProvider } from '../contexts/PortfolioContext';
import SpreadPage from '../components/spread/SpreadPage';

const Spread = () => {
  return (
    <ProtectedRoute>
      <PortfolioProvider>
        <SpreadPage />
      </PortfolioProvider>
    </ProtectedRoute>
  );
};

export default Spread;
