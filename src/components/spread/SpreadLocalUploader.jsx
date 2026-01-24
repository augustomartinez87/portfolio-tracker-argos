import React, { useState } from 'react';
import { processCsvClient } from '../../ingest/csvSpreadClient';

const SpreadLocalUploader = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
        const res = await processCsvClient(text);
        setResult(res);
      } catch (err) {
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
      {result ? (
        <div className="p-3 bg-background-secondary rounded-md border border-border-primary">
          <div className="text-sm font-medium text-text-primary mb-2">Resultados</div>
          <ul className="text-sm text-text-tertiary space-y-1">
            <li>Capital caucionado: {result.summary?.totalCapital?.toLocaleString?.() ?? '—'}</li>
            <li>Interés total pagado: {result.summary?.totalInteres?.toLocaleString?.() ?? '—'}</li>
            <li>TNA promedio ponderado: {result.summary?.tnaPromedioPonderado ?? '—'}</li>
            <li>Total registros: {result.summary?.totalRecords ?? '—'}</li>
          </ul>
          <details className="mt-2">
            <summary className="cursor-pointer text-text-tertiary">Ver detalle completo (JSON)</summary>
            <pre className="mt-2 text-xs" style={{ maxHeight: '320px', overflow: 'auto' }}>
{JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      ) : (
        <div className="text-text-tertiary">Carga de CSV no realizada aún o no válida.</div>
      )}
    </div>
  );
};

export default SpreadLocalUploader;
