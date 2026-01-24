import React, { useState } from 'react';
import { processCsvClient } from '../../ingest/csvSpreadClient';

const SpreadLocalUploader = ({ onFilesParsed }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  console.log('SpreadLocalUploader render - result:', result, 'loading:', loading, 'error:', error);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || '');
      setError(null);
      setResult(null);
      setLoading(true);
      try {
        console.log('Procesando CSV... Text length:', text.length);
        console.log('Primeras 200 chars:', text.substring(0, 200));
        const res = await processCsvClient(text);
        console.log('Resultado del procesamiento:', res);
        console.log('Estableciendo resultado en estado...');
        setResult(res);
        console.log('Llamando a onFilesParsed callback...');
        if (onFilesParsed) {
          // Pasar también el texto CSV original para persistencia
          const enrichedResult = {
            ...res,
            csvText: text // Agregar texto CSV para persistencia
          };
          onFilesParsed(enrichedResult);
        }
      } catch (err) {
        console.error('Error procesando CSV:', err);
        setError(err?.message || 'Error procesando CSV');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="spread-local-uploader bg-background-secondary rounded-xl border border-border-primary p-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <input className="block w-full" type="file" accept=".csv" onChange={onFile} />
      {loading && <div className="text-text-tertiary">Procesando CSV local…</div>}
      {error && <div className="text-red-500">{error}</div>}
      {result && (
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#0a0a0a', 
          borderRadius: '8px', 
          border: '1px solid #1a1a1a',
          marginTop: '12px'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#ffffff', marginBottom: '8px' }}>
            ✅ CSV Procesado Exitosamente
          </div>
          <ul style={{ fontSize: '14px', color: '#6b6b6b', listStyle: 'none', padding: 0 }}>
            <li>📊 Capital caucionado: ${result.summary?.totalCapital?.toLocaleString?.() ?? '—'}</li>
            <li>💰 Interés total pagado: ${result.summary?.totalInteres?.toLocaleString?.() ?? '—'}</li>
            <li>📈 TNA promedio ponderado: {result.summary?.tnaPromedioPonderado?.toFixed(2) ?? '—'}%</li>
            <li>📋 Total registros: {result.summary?.totalRecords ?? '—'}</li>
          </ul>
          <details style={{ marginTop: '16px' }}>
            <summary style={{ cursor: 'pointer', color: '#6b6b6b', fontSize: '12px' }}>
              🔍 Ver detalle completo (JSON)
            </summary>
            <pre style={{ 
              marginTop: '8px', 
              fontSize: '11px', 
              maxHeight: '320px', 
              overflow: 'auto',
              backgroundColor: '#141414',
              padding: '8px',
              borderRadius: '4px'
            }}>
{JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
      {!result && !loading && (
        <div style={{ color: '#6b6b6b' }}>
          📁 Carga de CSV no realizada aún o no válida.
        </div>
      )}
    </div>
  );
};

export default SpreadLocalUploader;
