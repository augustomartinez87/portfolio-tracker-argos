// src/components/common/LoadingSpinner.jsx

/**
 * Spinner de carga básico
 */
export const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
  };

  return (
    <div className={`animate-spin rounded-full border-b-2 border-primary ${sizeClasses[size]} ${className}`} />
  );
};

/**
 * Fullscreen loading overlay para lazy components
 */
export const LoadingFallback = ({ message = 'Cargando...' }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="text-center">
      <LoadingSpinner size="md" className="mx-auto mb-4" />
      <p className="text-text-tertiary">{message}</p>
    </div>
  </div>
);

/**
 * Inline loading para secciones
 */
export const LoadingSection = ({ message = 'Cargando datos...' }) => (
  <div className="flex items-center justify-center py-16">
    <div className="text-center">
      <LoadingSpinner size="md" className="mx-auto mb-4" />
      <p className="text-text-tertiary">{message}</p>
    </div>
  </div>
);

/**
 * Fullscreen loading para páginas
 */
export const LoadingPage = ({ message = 'Cargando...' }) => (
  <div className="min-h-screen bg-background-primary flex items-center justify-center">
    <div className="text-center">
      <LoadingSpinner size="md" className="mx-auto mb-4" />
      <p className="text-text-tertiary">{message}</p>
    </div>
  </div>
);

export default LoadingSpinner;
