import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { caucionService } from '../../services/caucionService';
import SpreadUpload from './SpreadUpload';
import SpreadTable from './SpreadTable';
import SpreadCards from './SpreadCards';
import { CheckCircle, Loader2 } from 'lucide-react';

const SpreadPage = () => {
  const { user } = useAuth();
  const [cauciones, setCauciones] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const handleFilesParsed = (files) => {
    setParsedFiles(files);
  };

  const handleSave = async () => {
    if (!user || parsedFiles.length === 0) return;

    setSaving(true);
    try {
      const operaciones = parsedFiles.flatMap(file =>
        file.cierres.map(c => ({
          pdf_filename: file.filename,
          boleto: c.boleto,
          fecha_inicio: c.fecha_liquidacion,
          fecha_fin: c.fecha_liquidacion,
          capital: c.capital,
          monto_devolver: c.monto_devolver,
          tasa_tna: c.tasa_tna,
          raw_text: c.raw_text
        }))
      );

      await caucionService.insertCauciones(user.id, operaciones);
      setParsedFiles([]);
      await loadCauciones();

      setSavedMessage(`${operaciones.length} operaciones guardadas`);
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err) {
      console.error('Error guardando:', err);
      alert('Error al guardar las operaciones');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!user || !confirm('Eliminar esta operación?')) return;

    try {
      await caucionService.deleteCaucion(user.id, id);
      await loadCauciones();
    } catch (err) {
      console.error('Error eliminando:', err);
    }
  };

  const [parsedFiles, setParsedFiles] = useState([]);
  const totalNuevas = parsedFiles.reduce((sum, f) => sum + (f.cierres?.length || 0), 0);

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

        {totalNuevas > 0 && (
          <div className="mt-4 pt-4 border-t border-border-primary flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                `Guardar ${totalNuevas} operaciones`
              )}
            </button>
          </div>
        )}
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
