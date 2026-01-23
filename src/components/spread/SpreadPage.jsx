import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { caucionService } from '../../services/caucionService';
import SpreadUpload from './SpreadUpload';
import SpreadTable from './SpreadTable';
import SpreadCards from './SpreadCards';
import { CheckCircle } from 'lucide-react';

const SpreadPage = () => {
  const { user } = useAuth();
  const [cauciones, setCauciones] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedMessage, setSavedMessage] = useState('');

  const loadCauciones = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [data, resumen] = await Promise.all([
        caucionService.getCauciones(user.id),
        caucionService.getResumen(user.id)
      ]);
      setCauciones(data);
      setMetrics(resumen);
    } catch (err) {
      console.error('Error cargando cauciones:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCauciones();
  }, [loadCauciones]);

  const handleFilesParsed = useCallback((files) => {
    // Las operaciones ya están guardadas por la API
    // Solo mostramos mensaje de éxito
    const totalOps = files.reduce((sum, f) => sum + (f.operaciones?.length || 0), 0);
    setSavedMessage(`${totalOps} operaciones guardadas automáticamente`);
    setTimeout(() => setSavedMessage(''), 3000);
    
    // Recargar datos para mostrar las nuevas operaciones
    loadCauciones();
  }, [loadCauciones]);

  const handleDelete = async (id) => {
    if (!user || !confirm('Eliminar esta operación?')) return;

    try {
      await caucionService.deleteCaucion(user.id, id);
      await loadCauciones();
    } catch (err) {
      console.error('Error eliminando:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Funding Engine</h1>
          <p className="text-text-tertiary text-sm mt-1">
            Costo real de las cauciones tomadoras
          </p>
        </div>
      </div>

      <SpreadCards metrics={metrics} loading={loading} />

      {savedMessage && (
        <div className="flex items-center gap-2 text-success bg-success/10 px-4 py-3 rounded-lg">
          <CheckCircle className="w-5 h-5" />
          <span>{savedMessage}</span>
        </div>
      )}

      <div className="bg-background-secondary rounded-xl border border-border-primary p-6">
        <h2 className="text-text-primary font-medium mb-4">Subir comprobantes</h2>
        <SpreadUpload onFilesParsed={handleFilesParsed} />
      </div>

      <div>
        <h2 className="text-text-primary font-medium mb-4">Historial de operaciones</h2>
        <SpreadTable
          cauciones={cauciones}
          onDelete={handleDelete}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default SpreadPage;