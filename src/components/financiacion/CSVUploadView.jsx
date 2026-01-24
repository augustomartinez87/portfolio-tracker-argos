import React, { useState, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import SpreadLocalUploader from '../spread/SpreadLocalUploader';
import { financingService } from '../../services/financingService';

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
      queryClient.invalidateQueries(['financing-operations']);
      queryClient.invalidateQueries(['financing-metrics']);
      
      // Agregar al historial local para feedback visual
      const fileEntry = {
        id: Date.now(),
        timestamp: new Date(),
        summary: data.summary || {},
        operations: data.records || [],
        details: data
      };
      
      setProcessedFiles(prev => [...prev, fileEntry]);
      
      // Llamar al callback del padre
      if (onProcessed) {
        onProcessed(data);
      }
    },
    onError: (error) => {
      console.error('❌ Error persistiendo CSV:', error);
      // Manejar error visualmente
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
    
    // Obtener texto CSV del resultado (necesitamos pasarlo desde el uploader)
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
          <div className="w-12 h-12 rounded-lg bg-background-tertiary flex items-center justify-center">
            <Upload className="w-6 h-6 text-text-tertiary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Cargar Archivo CSV</h2>
            <p className="text-text-tertiary text-sm">
              Sube tu archivo CSV para actualizar las métricas y análisis
            </p>
          </div>
        </div>

        <SpreadLocalUploader onFilesParsed={handleFilesProcessed} />
        
        {isProcessing && (
          <div className="mt-4 p-3 bg-background-tertiary rounded-lg border border-border-primary">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span className="text-text-tertiary text-sm">
                {uploadCsvMutation.isPending ? 'Guardando en base de datos...' : 'Procesando datos...'}
              </span>
            </div>
          </div>
        )}

        {uploadCsvMutation.isError && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 rounded-lg border border-red-300 dark:border-red-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-red-700 dark:text-red-300 text-sm">
                Error: {uploadCsvMutation.error?.message || 'Error procesando archivo'}
              </span>
            </div>
          </div>
        )}

        {uploadCsvMutation.isSuccess && (
          <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/20 rounded-lg border border-green-300 dark:border-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-green-700 dark:text-green-300 text-sm">
                ¡Archivo guardado exitosamente! ({uploadCsvMutation.data?.totalInserted || 0} operaciones)
              </span>
            </div>
          </div>
        )}

        <div className="mt-4 p-3 bg-background-tertiary rounded-lg border border-border-primary">
          <h3 className="text-sm font-medium text-text-primary mb-2">📋 Formato del CSV</h3>
          <div className="text-xs text-text-tertiary space-y-1">
            <p>• Columnas requeridas: fecha_apertura, fecha_cierre, capital, monto_devolver, interes, dias, tna_real, archivo</p>
            <p>• Formato de fechas: YYYY-MM-DD</p>
            <p>• Separador: coma (,)</p>
            <p>• Encoding: UTF-8</p>
            <p>• El CSV es fuente de verdad, no se recalculan valores</p>
          </div>
        </div>
      </div>

      {/* Processed Files History */}
      {processedFiles.length > 0 && (
        <div className="bg-background-secondary border border-border-primary rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-background-tertiary flex items-center justify-center">
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
                className={`bg-background-tertiary rounded-lg border overflow-hidden ${
                  file.isError 
                    ? 'border-red-300 dark:border-red-800' 
                    : 'border-border-primary'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between cursor-pointer" 
                       onClick={() => toggleExpanded(file.id)}>
                    <div className="flex items-center gap-3">
                      {file.isError ? (
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-success" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {file.isError ? 'Error' : 'Procesado'}: {formatTimestamp(file.timestamp)}
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
                    {expandedFile === file.id ? 
                      <ChevronUp className="w-4 h-4 text-text-tertiary" /> : 
                      <ChevronDown className="w-4 h-4 text-text-tertiary" />
                    }
                  </div>

                  {expandedFile === file.id && (
                    <div className="mt-4 pt-4 border-t border-border-primary">
                      {!file.isError && file.summary && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-text-tertiary">Capital Total</p>
                            <p className="text-sm font-medium text-text-primary">
                              ${(file.summary.totalCapital || 0).toLocaleString('es-AR')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-text-tertiary">Interés Total</p>
                            <p className="text-sm font-medium text-text-primary">
                              ${(file.summary.totalInteres || 0).toLocaleString('es-AR')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-text-tertiary">TNA Promedio</p>
                            <p className="text-sm font-medium text-text-primary">
                              {((file.summary.tnaPromedioPonderado || 0)).toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-text-tertiary">Registros</p>
                            <p className="text-sm font-medium text-text-primary">
                              {file.summary.totalRecords || 0}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-text-tertiary hover:text-text-primary">
                          Ver detalles técnicos (JSON)
                        </summary>
                        <pre className="mt-2 text-xs bg-background-secondary rounded p-3 overflow-x-auto">
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