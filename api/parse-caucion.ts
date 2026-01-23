import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';

// Robust lazy loading de pdf-parse (solo en Node) para evitar errores en ejecución
let pdfParse: any = null;
async function getPdfParse() {
  if (!pdfParse) {
    try {
      // Evitar ejecución en navegador
      if (typeof window !== 'undefined') {
        throw new Error('pdf-parse cannot run in the browser');
      }
      const mod: any = await import('pdf-parse');
      pdfParse = (mod && mod.default) ? mod.default : mod;
    } catch (error) {
      console.error('Error loading pdf-parse:', error);
      throw new Error('Failed to load pdf-parse module');
    }
  }
  return pdfParse;
}

// Utilidad para convertir Blob/Blob-like a Buffer (funciona en Node y navegador cuando se aplica correctamente)
async function blobToBuffer(blob: any): Promise<Buffer> {
  if (!blob) throw new Error('No blob provided for PDF');
  if (Buffer.isBuffer(blob)) return blob;
  // Blob en navegador
  if (typeof blob.arrayBuffer === 'function') {
    const ab = await blob.arrayBuffer();
    return Buffer.from(ab);
  }
  // Uint8Array o ArrayBuffer directo
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (blob instanceof ArrayBuffer) return Buffer.from(blob);
  throw new Error('Unsupported blob type for PDF data');
}

// Lazy initialization de Supabase para validar variables de entorno en runtime
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel settings.');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

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

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const match = DATE_REGEX.exec(dateStr);
  if (!match) return null;
  let [, day, month, year] = match;
  if (year.length === 2) {
    year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
  }
  return new Date(`${year}-${month}-${day}`);
}

interface Operacion {
  tipo: string;
  fecha_liquidacion: string | null;
  capital: number;
  monto_devolver: number;
  tasa_tna: number;
  boleto: string | null;
  raw_text: string;
}

async function parsePDFText(text: string): Promise<Operacion[]> {
  const operaciones: Operacion[] = [];
  const lines = text.split('\n');
  let currentOperacion: Operacion | null = null;
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
      fecha_liquidacion: op.fecha_liquidacion,
      capital: op.capital,
      monto_devolver: op.monto_devolver,
      tasa_tna: op.tasa_tna,
      raw_text: text.substring(0, 500)
    }));
}

export default async function handler(req: any, res: any) {
  console.log('parse-caucion invoked', {
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Inicializar Supabase con validación de variables de entorno
    let supabase;
    try {
      supabase = getSupabaseClient();
      console.log('Supabase client initialized successfully');
    } catch (supabaseError) {
      console.error('Failed to initialize Supabase:', supabaseError);
      return res.status(500).json({ 
        error: 'Error de configuración',
        details: supabaseError instanceof Error ? supabaseError.message : 'Failed to initialize Supabase',
        type: 'CONFIG_ERROR'
      });
    }
    
    const { pdfPath, userId } = req.body;

    if (!pdfPath || !userId) {
      console.error('Missing required fields', { pdfPath: !!pdfPath, userId: !!userId });
      return res.status(400).json({ error: 'Missing required fields: pdfPath and userId' });
    }

    console.log(`Processing PDF: ${pdfPath} for user: ${userId}`);

    // Descargar PDF desde Supabase Storage
    const { data: pdfBlob, error: downloadError } = await supabase.storage
      .from('caucion-pdfs')
      .download(pdfPath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      return res.status(404).json({ 
        error: 'PDF not found in storage',
        details: downloadError.message 
      });
    }

    if (!pdfBlob) {
      console.error('PDF blob is null or undefined');
      return res.status(404).json({ 
        error: 'PDF blob is empty'
      });
    }

    // Obtener URL pública robusta del PDF (si disponible)
    let pdfUrl: string | null = null;
    try {
      const { data: urlData } = supabase.storage.from('caucion-pdfs').getPublicUrl(pdfPath);
      pdfUrl = urlData?.publicURL ?? urlData?.publicUrl ?? null;
    } catch (e) {
      pdfUrl = null;
    }

    // Convertir Blob a Buffer para pdf-parse (robusto)
    console.log('Converting PDF blob to Buffer...');
    const buffer = await blobToBuffer(pdfBlob);
    console.log(`Buffer created, size: ${buffer.length} bytes`);

    // Parsear PDF (lazy load pdf-parse)
    console.log('Loading pdf-parse module...');
    let pdfParseFn: any;
    try {
      pdfParseFn = await getPdfParse();
      console.log('pdf-parse loaded successfully');
    } catch (pdfParseError) {
      console.error('Failed to load pdf-parse:', pdfParseError);
      return res.status(500).json({ 
        error: 'Error cargando módulo de parsing',
        details: pdfParseError instanceof Error ? pdfParseError.message : 'Failed to load pdf-parse',
        type: 'PDF_PARSE_ERROR'
      });
    }
    
    console.log('Parsing PDF...');
    const pdfData = await pdfParseFn(buffer);
    const text = pdfData.text;
    console.log(`PDF parsed successfully, text length: ${text.length} characters`);
    
    // Extraer operaciones del texto
    const operaciones = await parsePDFText(text);
    
    if (operaciones.length === 0) {
      return res.status(400).json({ 
        error: 'No se encontraron operaciones de cierre válidas',
        filename: pdfPath.split('/').pop(),
        raw_text: text.substring(0, 500)
      });
    }

    // Preparar datos para inserción
    const cierresParaGuardar = operaciones.map(op => {
      const fecha_inicio = parseDate(op.fecha_liquidacion!);
      const fecha_fin = parseDate(op.fecha_liquidacion!);

      return {
        user_id: userId,
        pdf_filename: pdfPath.split('/').pop(),
        pdf_storage_path: pdfPath,
        pdf_url: pdfUrl,
        boleto: op.boleto,
        fecha_inicio: fecha_inicio?.toISOString().split('T')[0],
        fecha_fin: fecha_fin?.toISOString().split('T')[0],
        capital: op.capital,
        monto_devolver: op.monto_devolver,
        raw_text: op.raw_text
      };
    });

    // Insertar en database
    const { data, error: insertError } = await supabase
      .from('cauciones')
      .insert(cierresParaGuardar)
      .select();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return res.status(500).json({ 
        error: 'Failed to insert operations in database',
        details: insertError.message 
      });
    }

    console.log(`Successfully processed ${cierresParaGuardar.length} operations for user ${userId}`);

    return res.status(200).json({
      success: true,
      operaciones: data,
      total_operaciones: cierresParaGuardar.length,
      message: `${cierresParaGuardar.length} cierres procesados correctamente`
    });

  } catch (error) {
    console.error('Parse caucion error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log detallado para debugging en Vercel
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      name: error instanceof Error ? error.name : 'Unknown',
      env: {
        hasSupabaseUrl: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    });
    
    // Devolver error más descriptivo
    const isEnvError = errorMessage.includes('Missing Supabase environment variables');
    const isPdfParseError = errorMessage.includes('Failed to load pdf-parse');
    
    return res.status(500).json({ 
      error: 'Error procesando caución',
      details: errorMessage,
      type: isEnvError ? 'ENV_ERROR' : isPdfParseError ? 'PDF_PARSE_ERROR' : 'UNKNOWN_ERROR'
    });
  }
}
