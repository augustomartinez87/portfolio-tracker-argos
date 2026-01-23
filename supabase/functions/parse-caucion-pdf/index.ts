import { createClient } from '@supabase/supabase-js';
import * as pdfParse from 'pdf-parse';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Regex patterns para parsing de cauciones
const DATE_REGEX = /(\d{2})\/(\d{2})\/(\d{2,4})/;
const BOLETO_REGEX = /BOL\s+(\d{10})/;
const LIQUIDACION_REGEX = /Liquidaci[óo]n del d[íi]a\s+(\d{2}\/\d{2}\/\d{4})/;
const CAPITAL_FROM_CIERRE_REGEX = /Cantidad\s+([\d.]+,\d{2})\s*@/;
const MONTO_DEVOLVER_REGEX = /Importe\s+ARS\s+([\d.]+,\d{2})\s*D/;
const TNA_REGEX = /TNA:\s*([\d,]+)%/;
const TIPO_OPERACION_REGEX = /Operaci[óo]n de\s+(apertura|cierre)\s+de\s+cauci[óo]n/i;

function parseARSAmount(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const match = DATE_REGEX.exec(dateStr);
  if (!match) return null;
  let [, day, month, year] = match;
  if (year.length === 2) {
    year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
  }
  return `${year}-${month}-${day}`;
}

async function parsePDFText(text: string) {
  const operaciones = [];
  const lines = text.split('\n');
  let currentOperacion = null;
  let state = 'idle';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    const tipoMatch = TIPO_OPERACION_REGEX.exec(line);
    if (tipoMatch) {
      if (currentOperacion && currentOperacion.tipo === 'cierre') {
        operaciones.push(currentOperacion);
      }
      currentOperacion = {
        tipo: tipoMatch[1].toLowerCase(),
        fecha_liquidacion: null,
        capital: 0,
        monto_devolver: 0,
        tasa_tna: 0,
        boleto: null,
        raw_text: line
      };
      state = currentOperacion.tipo;
      continue;
    }

    if (state !== 'idle' && currentOperacion) {
      const liquidacionMatch = LIQUIDACION_REGEX.exec(line);
      if (liquidacionMatch && !currentOperacion.fecha_liquidacion) {
        currentOperacion.fecha_liquidacion = liquidacionMatch[1];
        continue;
      }

      const boletoMatch = BOLETO_REGEX.exec(line);
      if (boletoMatch && !currentOperacion.boleto) {
        currentOperacion.boleto = boletoMatch[1];
        continue;
      }

      if (state === 'cierre') {
        const capitalMatch = CAPITAL_FROM_CIERRE_REGEX.exec(line);
        if (capitalMatch && currentOperacion.capital === 0) {
          currentOperacion.capital = parseARSAmount(capitalMatch[1]);
          continue;
        }

        const montoMatch = MONTO_DEVOLVER_REGEX.exec(line);
        if (montoMatch && currentOperacion.monto_devolver === 0) {
          currentOperacion.monto_devolver = parseARSAmount(montoMatch[1]);
          continue;
        }

        const tnaMatch = TNA_REGEX.exec(line);
        if (tnaMatch && currentOperacion.tasa_tna === 0) {
          currentOperacion.tasa_tna = parseFloat(tnaMatch[1].replace(',', '.'));
          continue;
        }
      }
    }
  }

  if (currentOperacion && currentOperacion.tipo === 'cierre') {
    operaciones.push(currentOperacion);
  }

  return operaciones
    .filter(op => op.tipo === 'cierre' && op.capital > 0 && op.monto_devolver > 0)
    .map(op => ({
      tipo: 'cierre',
      boleto: op.boleto,
      fecha_liquidacion: parseDate(op.fecha_liquidacion),
      capital: op.capital,
      monto_devolver: op.monto_devolver,
      tasa_tna: op.tasa_tna,
      raw_text: text.substring(0, 500)
    }));
}

export async function POST(request: Request) {
  try {
    const { userId, filename, fileData } = await request.json();
    
    if (!userId || !filename || !fileData) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar que el usuario exista
    const { data: user, error: userError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parsear PDF
    const buffer = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;
    
    // Extraer operaciones
    const cierres = await parsePDFText(text);
    
    if (cierres.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No se encontraron operaciones de cierre válidas',
        filename,
        raw_text: text.substring(0, 500)
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      filename,
      cierres,
      raw_text: text,
      total_operaciones: cierres.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('PDF parsing error:', error);
    return new Response(JSON.stringify({ 
      error: 'Error procesando PDF',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({
    message: 'Caución PDF parsing Edge Function',
    version: '1.0.0',
    status: 'active'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}