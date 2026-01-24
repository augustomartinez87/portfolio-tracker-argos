import React, { useState, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import SpreadLocalUploader from '../spread/SpreadLocalUploader';
import { caucionService } from '../../services/caucionService';

const CSVUploadView = ({ onProcessed }) => {
  const [processedFiles, setProcessedFiles] = useState([]);
  const [expandedFile, setExpandedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFilesProcessed = useCallback(async (result) => {
    console.log('CSVUploadView - handleFilesProcessed llamado con:', result);
    setIsProcessing(true);
    try {
      const fileEntry = {
        id: Date.now(),
        timestamp: new Date(),
        summary: result.summary || {},
        operations: result.operaciones || [],
        details: result
      };
      console.log('CSVUploadView - Agregando archivo a historial:', fileEntry);
      
      setProcessedFiles(prev => {
        console.log('CSVUploadView - Estado anterior processedFiles:', prev);
        const nuevo = [...prev, fileEntry];
        console.log('CSVUploadView - Estado nuevo processedFiles:', nuevo);
        return nuevo;
      });
      
      // Llamar al callback del padre con los datos procesados
      console.log('CSVUploadView - Llamando a onProcessed callback...');
      if (onProcessed) {
        onProcessed(result);
      }
      
      // Opcional: Guardar en Supabase si está configurado
      // await caucionService.saveOperaciones(result.operaciones);
      
    } catch (error) {
      console.error('Error procesando archivos:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [onProcessed]);

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
              Sube tu archivo de cauciones para actualizar las métricas y análisis
            </p>
          </div>
        </div>

        <SpreadLocalUploader onFilesParsed={handleFilesProcessed} />
        
        {isProcessing && (
          <div className="mt-4 p-3 bg-background-tertiary rounded-lg border border-border-primary">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span className="text-text-tertiary text-sm">Procesando datos...</span>
            </div>
          </div>
        )}

        <div className="mt-4 p-3 bg-background-tertiary rounded-lg border border-border-primary">
          <h3 className="text-sm font-medium text-text-primary mb-2">📋 Formato del CSV</h3>
          <div className="text-xs text-text-tertiary space-y-1">
            <p>• El archivo debe incluir: fecha, capital, tasa, días, intereses</p>
            <p>• Formato de fechas: DD/MM/YYYY</p>
            <p>• Separador: coma (,) o punto y coma (;)</p>
            <p>• Encoding preferido: UTF-8</p>
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
                className="bg-background-tertiary rounded-lg border border-border-primary overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between cursor-pointer" 
                       onClick={() => toggleExpanded(file.id)}>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-success" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          Procesado: {formatTimestamp(file.timestamp)}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {file.summary.totalRecords || 0} operaciones • 
                          Capital: ${(file.summary.totalCapital || 0).toLocaleString('es-AR')} •
                          Intereses: ${(file.summary.totalInteres || 0).toLocaleString('es-AR')}
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
                      
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-text-tertiary hover:text-text-primary">
                          Ver detalles técnicos (JSON)
                        </summary>
                        <pre className="mt-2 text-xs bg-background-secondary rounded p-3 overflow-x-auto">
                          {JSON.stringify(file.details, null, 2)}
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