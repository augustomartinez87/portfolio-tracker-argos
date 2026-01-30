import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as pdfParse from 'https://deno.land/x/pdfparse@v2.4.5/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Regex patterns based on provided example
const RE_FECHA_APERTURA = /Fecha de Apertura:\s*(\d{2}\/\d{2}\/\d{4})/i;
const RE_FECHA_CIERRE = /Fecha de Cierre:\s*(\d{2}\/\d{2}\/\d{4})/i;
const RE_CAPITAL = /Capital:\s*\$\s*([\d.]+,\d{2})/i;
const RE_MONTO_DEVOLVER = /Monto a Devolver:\s*\$\s*([\d.]+,\d{2})/i;
const RE_TASA = /Tasa:\s*([\d,]+)%\s*TNA/i;
const RE_DIAS = /Dí\s*as:\s*(\d+)/i;

/**
 * Parses Argentine currency format (1.234.567,89) to number
 */
function parseARS(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

/**
 * Converts DD/MM/YYYY to YYYY-MM-DD
 */
function formatDate(dateStr: string): string {
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates a unique operation_key
 */
async function generateOperationKey(data: { fecha_inicio: string; fecha_fin: string; capital: number }): Promise<string> {
  const msg = `${data.fecha_inicio}|${data.fecha_fin}|${data.capital}`;
  const msgUint8 = new TextEncoder().encode(msg);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pdf, filename, user_id, portfolio_id, email_date, email_subject } = await req.json();

    if (!pdf) throw new Error('No PDF content provided');

    console.log(`Processing PDF: ${filename} for user: ${user_id}`);

    // Decode base64
    const pdfBuffer = Uint8Array.from(atob(pdf), (c) => c.charCodeAt(0));

    // Parse PDF
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;
    console.log('PDF Text extracted successfully');

    // Extract data using regex
    const fechaInicioMatch = text.match(RE_FECHA_APERTURA);
    const fechaFinMatch = text.match(RE_FECHA_CIERRE);
    const capitalMatch = text.match(RE_CAPITAL);
    const montoDevolverMatch = text.match(RE_MONTO_DEVOLVER);
    const tasaMatch = text.match(RE_TASA);
    const diasMatch = text.match(RE_DIAS);

    if (!fechaInicioMatch || !fechaFinMatch || !capitalMatch || !montoDevolverMatch) {
      console.error('Failed to extract essential data. Text snippet:', text.substring(0, 500));
      throw new Error('Could not parse required fields from PDF');
    }

    const fecha_inicio = formatDate(fechaInicioMatch[1]);
    const fecha_fin = formatDate(fechaFinMatch[1]);
    const capital = parseARS(capitalMatch[1]);
    const monto_devolver = parseARS(montoDevolverMatch[1]);
    const interes = Number((monto_devolver - capital).toFixed(2));
    const tna_real = tasaMatch ? parseFloat(tasaMatch[1].replace(',', '.')) : 0;
    const dias = diasMatch ? parseInt(diasMatch[1]) : 0;

    // Generate unique key
    const operation_key = await generateOperationKey({ fecha_inicio, fecha_fin, capital });

    const caucionData = {
      user_id,
      portfolio_id,
      fecha_inicio,
      fecha_fin,
      capital,
      monto_devolver,
      interes,
      dias,
      tna_real,
      operation_key,
      archivo: filename,
      created_at: new Date().toISOString()
    };

    console.log('Caucion parsed:', caucionData);

    // Upsert to Supabase
    const { data, error } = await supabase
      .from('cauciones')
      .upsert(caucionData, { onConflict: 'operation_key' })
      .select()
      .single();

    if (error) {
      console.error('Database upsert error:', error);
      throw error;
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Execution error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});