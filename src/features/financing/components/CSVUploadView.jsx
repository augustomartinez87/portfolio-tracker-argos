import React, { useState, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, ChevronDown, ChevronUp, Table, Calendar, Settings2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import LocalCsvUploader from './LocalCsvUploader';
import { financingService } from '../services/financingService';

const CSVUploadView = ({ onProcessed, userId, portfolioId, queryClient }) => {
  const [processedFiles, setProcessedFiles] = useState([]);
  const [expandedFile, setExpandedFile] = useState(null);

  // React Query mutation para persistir CSV
  const uploadCsvMutation = useMutation({
    mutationFn: ({ csvText }) =>
      financingService.ingestFromCsv(userId, csvText, portfolioId),
    onSuccess: (data) => {
      console.log('✅ CSV persistido exitosamente:', data);

      // Invalidar queries para refrescar datos automáticamente
      queryClient.invalidateQueries({ queryKey: ['financing-operations'] });
      queryClient.invalidateQueries({ queryKey: ['financing-metrics'] });

      // Agregar al historial local para feedback visual
      const resultData = data.data || {};
      const fileEntry = {
        id: Date.now(),
        timestamp: new Date(),
        summary: resultData.summary || {},
        operations: resultData.records || [],
        details: resultData
      };

      setProcessedFiles(prev => [...prev, fileEntry]);

      if (onProcessed) {
        onProcessed(data);
      }
    },
    onError: (error) => {
      console.error('❌ Error persistiendo CSV:', error);
      const errorEntry = {
        id: Date.now(),
        timestamp: new Date(),
        error: error.message,
        isError: true
      };
      setProcessedFiles(prev => [...prev, errorEntry]);
    }
  });

  const handleFilesProcessed = useCallback(async (result) => {
    console.log('🔄 CSVUploadView - procesando archivo para persistencia...');

    if (result.csvText) {
      uploadCsvMutation.mutate({ csvText: result.csvText });
    } else {
      console.error('❌ No se encontró csvText en el resultado');
      uploadCsvMutation.mutate({ csvText: result.rawCsv || '' });
    }
  }, [uploadCsvMutation]);

  const isProcessing = uploadCsvMutation.isPending;

  const toggleExpanded = (fileId) => {
    setExpandedFile(expandedFile === fileId ? null : fileId);
  };

  const formatTimestamp = (timestamp) => {
    return timestamp.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-background-secondary border border-border-primary rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Cargar Archivo CSV</h2>
            <p className="text-text-tertiary text-sm">
              Sube tu archivo CSV para actualizar las métricas y análisis
            </p>
          </div>
        </div>

        <LocalCsvUploader onFilesParsed={handleFilesProcessed} />

        {/* Database Persistence Status */}
        {isProcessing && (
          <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/30">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              <span className="text-text-primary text-sm">
                Guardando en base de datos...
              </span>
            </div>
          </div>
        )}

        {uploadCsvMutation.isError && (
          <div className="mt-4 p-4 bg-red-500/10 rounded-lg border border-red-500/30">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-red-400 font-medium">Error al guardar</p>
                <p className="text-red-400/80 text-sm">
                  {uploadCsvMutation.error?.message || 'Error procesando archivo'}
                </p>
              </div>
            </div>
          </div>
        )}

        {uploadCsvMutation.isSuccess && (
          <div className="mt-4 p-4 bg-green-500/10 rounded-lg border border-green-500/30">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-green-400 font-medium">¡Archivo guardado exitosamente!</p>
                <p className="text-green-400/80 text-sm">
                  {uploadCsvMutation.data?.data?.totalInserted || 0} operaciones insertadas
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Format Requirements - Card Grid */}
      <div className="bg-background-secondary border border-border-primary rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Table className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Formato del CSV</h2>
            <p className="text-text-tertiary text-sm">
              Especificaciones requeridas para el archivo
            </p>
          </div>
        </div>

        {/* Required Columns */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-text-tertiary" />
            Columnas Requeridas
          </h3>
          <div className="flex flex-wrap gap-2">
            {['fecha_apertura', 'fecha_cierre', 'capital', 'monto_devolver', 'interes', 'dias', 'tna_real', 'archivo'].map((col) => (
              <span 
                key={col} 
                className="px-3 py-1.5 bg-background-tertiary text-text-secondary text-xs rounded-lg border border-border-primary"
              >
                {col}
              </span>
            ))}
          </div>
        </div>

        {/* Format Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3 p-4 bg-background-tertiary rounded-lg border border-border-primary">
            <Calendar className="w-5 h-5 text-text-tertiary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary">Formato de Fechas</p>
              <p className="text-xs text-text-tertiary mt-1">YYYY-MM-DD</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-background-tertiary rounded-lg border border-border-primary">
            <Table className="w-5 h-5 text-text-tertiary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary">Separador</p>
              <p className="text-xs text-text-tertiary mt-1">Coma (,)</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-background-tertiary rounded-lg border border-border-primary">
            <FileText className="w-5 h-5 text-text-tertiary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary">Encoding</p>
              <p className="text-xs text-text-tertiary mt-1">UTF-8</p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <p className="text-sm text-amber-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            El CSV es fuente de verdad: no se recalculan valores, se usan los datos exactos del archivo
          </p>
        </div>
      </div>

      {/* Processed Files History */}
      {processedFiles.length > 0 && (
        <div className="bg-background-secondary border border-border-primary rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-background-tertiary flex items-center justify-center">
              <FileText className="w-6 h-6 text-text-tertiary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Historial de Cargas</h2>
              <p className="text-text-tertiary text-sm">
                Archivos procesados recientemente
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {processedFiles.map((file) => (
              <div
                key={file.id}
                className={`bg-background-tertiary rounded-xl border overflow-hidden transition-colors ${file.isError
                  ? 'border-red-500/30'
                  : 'border-border-primary hover:border-text-tertiary'
                  }`}
              >
                <div className="p-4">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleExpanded(file.id)}
                  >
                    <div className="flex items-center gap-3">
                      {file.isError ? (
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {file.isError ? 'Error al procesar' : 'Procesado'}: {formatTimestamp(file.timestamp)}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {file.isError ? (
                            file.error || 'Error desconocido'
                          ) : (
                            `${file.summary?.totalRecords || file.operations?.length || 0} operaciones • ` +
                            `Capital: $${(file.summary?.totalCapital || 0).toLocaleString('es-AR')} • ` +
                            `Intereses: $${(file.summary?.totalInteres || 0).toLocaleString('es-AR')}`
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="p-2 hover:bg-background-secondary rounded-lg transition-colors">
                      {expandedFile === file.id ?
                        <ChevronUp className="w-4 h-4 text-text-tertiary" /> :
                        <ChevronDown className="w-4 h-4 text-text-tertiary" />
                      }
                    </div>
                  </div>

                  {expandedFile === file.id && (
                    <div className="mt-4 pt-4 border-t border-border-primary">
                      {!file.isError && file.summary && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <div className="bg-background-secondary rounded-lg p-3">
                            <p className="text-xs text-text-tertiary mb-1">Capital Total</p>
                            <p className="text-sm font-semibold text-text-primary">
                              ${(file.summary.totalCapital || 0).toLocaleString('es-AR')}
                            </p>
                          </div>
                          <div className="bg-background-secondary rounded-lg p-3">
                            <p className="text-xs text-text-tertiary mb-1">Interés Total</p>
                            <p className="text-sm font-semibold text-text-primary">
                              ${(file.summary.totalInteres || 0).toLocaleString('es-AR')}
                            </p>
                          </div>
                          <div className="bg-background-secondary rounded-lg p-3">
                            <p className="text-xs text-text-tertiary mb-1">TNA Promedio</p>
                            <p className="text-sm font-semibold text-text-primary">
                              {((file.summary.tnaPromedioPonderado || 0)).toFixed(2)}%
                            </p>
                          </div>
                          <div className="bg-background-secondary rounded-lg p-3">
                            <p className="text-xs text-text-tertiary mb-1">Registros</p>
                            <p className="text-sm font-semibold text-text-primary">
                              {file.summary.totalRecords || 0}
                            </p>
                          </div>
                        </div>
                      )}

                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-text-tertiary hover:text-text-primary transition-colors">
                          Ver detalles técnicos (JSON)
                        </summary>
                        <pre className="mt-3 text-xs bg-background-secondary rounded-lg p-3 overflow-x-auto">
                          {JSON.stringify(file.details || file, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CSVUploadView;
