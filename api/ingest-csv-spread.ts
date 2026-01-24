// API route: keep lean typings compatible with existing API usage
// Import shared CSV ingestor (serverless-agnostic logic)
// Local CSV ingestion logic (serverless API should be self-contained)
type IngestResult = any;
type CsvRecord = any;
type DerivedRecord = any;
type TenorCurvePoint = any;
type IngestResultLocal = IngestResult;

function basicParseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '"') {
        if (inQuotes && trimmed[i + 1] === '"') { cur += '"'; i++; } else inQuotes = !inQuotes; continue;
      }
      if (ch === ',' && !inQuotes) { cells.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

function parseDateSafe(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function toNumber(n: any): number {
  const v = Number(n);
  return isNaN(v) ? 0 : v;
}

function validateHeaders(headers: string[]): boolean {
  const required = ['fecha_apertura','fecha_cierre','capital','monto_devolver','interes','dias','tna_real'];
  const lower = headers.map(h => h.trim());
  return required.every(r => lower.includes(r));
}

async function ingestFromCsvLocal(csvText: string) {
  const rows = basicParseCsv(csvText);
  if (rows.length < 2) throw new Error('CSV must have header and at least one data row');
  const headers = rows[0] as string[];
  if (!validateHeaders(headers)) throw new Error('CSV headers invalid. Expected: fecha_apertura, fecha_cierre, capital, monto_devolver, interes, dias, tna_real');
  const idx: Record<string, number> = {
    fecha_apertura: headers.indexOf('fecha_apertura'),
    fecha_cierre: headers.indexOf('fecha_cierre'),
    capital: headers.indexOf('capital'),
    monto_devolver: headers.indexOf('monto_devolver'),
    interes: headers.indexOf('interes'),
    dias: headers.indexOf('dias'),
    tna_real: headers.indexOf('tna_real'),
  } as any;

  const records: any[] = [];
  const tenorAgg: Map<number, any> = new Map();
  let totalCapital = 0; let totalMontoDevolver = 0; let totalInteres = 0; let totalTna = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const fecha_apertura = row[idx.fecha_apertura] ?? '';
    const fecha_cierre = row[idx.fecha_cierre] ?? '';
    const capital = toNumber(row[idx.capital]);
    const monto_devolver = toNumber(row[idx.monto_devolver]);
    const interes = toNumber(row[idx.interes]);
    const dias = Number(row[idx.dias]);
    const tna_real = toNumber(row[idx.tna_real]);
    if (!(capital > 0) || !(monto_devolver > 0) || !Number.isFinite(dias) || !Number.isFinite(tna_real)) {
      continue;
    }
    const monto_calc = capital * (1 + (tna_real * dias) / 365);
    const interes_calc = monto_calc - capital;
    const rec = { fecha_apertura, fecha_cierre, capital, monto_devolver, interes, dias, tna_real, monto_calc, interes_calc };
    records.push(rec);
    totalCapital += capital; totalMontoDevolver += monto_devolver; totalInteres += interes;
    totalTna += capital * tna_real;
    const tenor = dias;
    const agg = tenorAgg.get(tenor) || { totalCapital:0, totalMontoDevolver:0, totalInteres:0, totalTna:0, count:0 };
    agg.totalCapital += capital; agg.totalMontoDevolver += monto_devolver; agg.totalInteres += interes; agg.totalTna += capital * tna_real; agg.count += 1;
    tenorAgg.set(tenor, agg);
  }

  const curve: any[] = [];
  for (const [tenorStr, agg] of tenorAgg.entries()) {
    const curveTnaProm = agg.totalCapital > 0 ? agg.totalTna / agg.totalCapital : 0;
    curve.push({ tenor: tenorStr, totalCapital: agg.totalCapital, totalMontoDevolver: agg.totalMontoDevolver, totalInteres: agg.totalInteres, curveTnaProm});
  }
  curve.sort((a,b)=> a.tenor - b.tenor);

  const totalRecords = records.length;
  const tnaPromedioSimple = totalRecords > 0 ? records.reduce((s, r) => s + r.tna_real, 0) / totalRecords : 0;
  const tnaPromedioPonderado = totalCapital > 0 ? totalTna / totalCapital : 0;

  // Spreads by tenor
  const spreads: { tenor: number; avgSpread: number }[] = [];
  const tenorCurveByTenor = new Map<number, number>();
  for (const c of curve) tenorCurveByTenor.set(c.tenor, c.curveTnaProm);
  const spreadSums: Map<number, { sum: number; count: number }> = new Map();
  for (const r of records) {
    const tenor = r.dias;
    const tnaCurve = tenorCurveByTenor.get(tenor) ?? 0;
    const spread = r.tna_real - tnaCurve;
    const s = spreadSums.get(tenor) || { sum: 0, count: 0 };
    s.sum += spread; s.count += 1; spreadSums.set(tenor, s);
  }
  for (const [tenor, s] of spreadSums.entries()) {
    spreads.push({ tenor, avgSpread: s.count > 0 ? s.sum / s.count : 0 });
  }
  spreads.sort((a,b)=> a.tenor - b.tenor);

  const result: IngestResult = {
    records: records,
    summary: {
      totalCapital,
      totalMontoDevolver,
      totalInteres,
      tnaPromedioSimple,
      tnaPromedioPonderado,
      totalRecords
    },
    curve,
    spreads
  } as any;
  return result;
}

// Public wrapper
export async function ingestFromCsv(csvText: string) {
  return ingestFromCsvLocal(csvText);
}

// Vercel/Next.js style API route
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CSV ingestion is currently disabled by design
  res.status(501).json({ error: 'CSV ingestion is disabled', type: 'CSV_DISABLED' });
}
