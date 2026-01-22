// src/components/common/ErrorBoundary.jsx
import React from 'react';
import { AlertCircle } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    console.error('Component stack:', errorInfo?.componentStack);

    // Aquí podrías enviar a un servicio de error tracking como Sentry
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { extra: errorInfo });
    // }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background-primary flex items-center justify-center p-6">
          <div className="bg-background-secondary border border-border-primary rounded-xl p-8 max-w-md text-center">
            <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text-primary mb-2">Error inesperado</h2>
            <p className="text-text-tertiary mb-4">
              {this.state.error?.message || 'Hubo un problema al cargar la página.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
