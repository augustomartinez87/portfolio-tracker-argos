import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

class StructuredLogger {
  private logs: any[] = []
  log(stage: string, data: any, level: 'info' | 'warn' | 'error' = 'info') {
    const entry = { timestamp: new Date().toISOString(), stage, level, ...data }
    this.logs.push(entry)
    console.log(`[${stage}]`, JSON.stringify(data))
  }
  getLogs() { return this.logs }
}

// Limpieza de números (igual que tu Python: clean_number)
function cleanNumber(text: string): number {
  if (!text) return 0
  const cleaned = text.replace(/[^\d.,-]/g, '').trim()
  if (!cleaned) return 0

  // Formato argentino: 1.234.567,89
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const parts = cleaned.split(',')
    if (parts.length === 2) {
      const intPart = parts[0].replace(/\./g, '')
      return parseFloat(`${intPart}.${parts[1]}`)
    }
  }
  // Solo coma decimal
  if (cleaned.includes(',')) {
    return parseFloat(cleaned.replace(',', '.'))
  }
  return parseFloat(cleaned) || 0
}

function formatDate(dateStr: string): string {
  const [day, month, year] = dateStr.split('/')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

// Extractor robusto tipo pdfplumber (varias estrategias)
function extractTextFromPDF(bytes: Uint8Array): string {
  const strategies = [
    // Estrategia 1: Latin1 (la estándar de PDFs argentinos)
    () => {
      const decoder = new TextDecoder('latin1')
      return decoder.decode(bytes)
    },
    // Estrategia 2: Win-1252 (común en Windows)
    () => {
      const decoder = new TextDecoder('windows-1252')
      return decoder.decode(bytes)
    },
    // Estrategia 3: UTF-8
    () => {
      const decoder = new TextDecoder('utf-8', { fatal: false })
      return decoder.decode(bytes)
    },
    // Estrategia 4: Extraer solo strings entre paréntesis (streams de texto PDF)
    () => {
      const latin1 = new TextDecoder('latin1').decode(bytes)
      const matches = latin1.match(/\(([^)]+)\)/g)
      return matches ? matches.map(m => m.slice(1, -1)).join(' ') : ''
    }
  ]

  for (const strategy of strategies) {
    try {
      const result = strategy()
      // Validación: debe contener palabras clave de Alycbur
      if (result.includes('Alycbur') || result.includes('CAUCION') || result.includes('BOL ')) {
        return result
      }
    } catch (e) {
      continue
    }
  }

  throw new Error('PDF_NO_LEGIBLE')
}

function parseCaucion(fullText: string, filename: string, logger: StructuredLogger) {
  // Normalizar espacios (como en tu Python: replace(/\s+/g, ' '))
  const text = fullText.replace(/\s+/g, ' ')

  // Detectar tipo (igual que tu Python)
  const isCierre = /cierre de cauci/i.test(text)
  const isApertura = /apertura de cauci/i.test(text)

  if (!isCierre && !isApertura) {
    throw new Error('TIPO_NO_DETECTADO')
  }

  const tipo = isCierre ? 'cierre' : 'apertura'
  logger.log('tipo_detectado', { tipo })

  // Buscar fecha de liquidación (tu regex: "del día XX/XX/XXXX")
  let fechaStr = ''
  const dateMatch = text.match(/del\s+d[ií]a\s+(\d{2}\/\d{2}\/\d{4})/i)

  if (dateMatch) {
    fechaStr = dateMatch[1]
  } else {
    // Fallback: buscar cualquier fecha
    const fallback = text.match(/(\d{2}\/\d{2}\/\d{4})/)
    if (fallback) fechaStr = fallback[1]
    else throw new Error('FECHA_NO_ENCONTRADA')
  }

  const fechaParts = fechaStr.split('/')
  const fecha_liquidacion = `${fechaParts[2]}-${fechaParts[1]}-${fechaParts[0]}`

  // Extraer capital, tna, días (tu regex adaptada)
  // "Caución tomadora 28.615.422,00@22% (ARS 1 días)"
  const resultPattern = /Cauci[oó]n\s+tomadora\s+([\d.,]+)\s*@\s*([\d,]+)%\s*\(ARS\s+(\d+)\s*d[ií]as?\)/i
  const resultMatch = text.match(resultPattern)

  if (!resultMatch) {
    throw new Error('RESULTADO_NO_ENCONTRADO')
  }

  const capital = cleanNumber(resultMatch[1])
  const tna_real = parseFloat(resultMatch[2].replace(',', '.'))
  const dias = parseInt(resultMatch[3], 10)

  if (capital <= 0 || dias <= 0) {
    throw new Error('CAPITAL_O_DIAS_INVALIDO')
  }

  // Calcular fechas inicio/fin
  const fechaLiqDate = new Date(fecha_liquidacion)
  let fecha_inicio: string
  let fecha_fin: string

  if (tipo === 'apertura') {
    fecha_inicio = fecha_liquidacion
    const finDate = new Date(fechaLiqDate)
    finDate.setDate(finDate.getDate() + dias)
    fecha_fin = finDate.toISOString().split('T')[0]
  } else {
    fecha_fin = fecha_liquidacion
    const iniDate = new Date(fechaLiqDate)
    iniDate.setDate(iniDate.getDate() - dias)
    fecha_inicio = iniDate.toISOString().split('T')[0]
  }

  // Buscar monto a devolver (lógica de tu Python)
  let monto_devolver = 0

  if (tipo === 'cierre') {
    // Buscar "Se debitará... ARS X D"
    const debitMatch = text.match(/Se\s+debitar[aá].*?ARS\s+([\d.,]+)\s+D/i)
    if (debitMatch) {
      monto_devolver = cleanNumber(debitMatch[1])
    } else {
      // Fallback: buscar en tabla "Caución Tomadora... ARS X D"
      const tableMatch = text.match(/Cauci[oó]n\s+Tomadora.*?ARS\s+([\d.,]+)\s+D/i)
      if (tableMatch) {
        monto_devolver = cleanNumber(tableMatch[1])
      }
    }
  } else {
    // Apertura: calcular teórico
    monto_devolver = capital * (1 + (tna_real / 100) * (dias / 365))
  }

  if (monto_devolver <= 0) {
    throw new Error('MONTO_NO_ENCONTRADO')
  }

  // ANTI-SALDO (de tu Python): Si interés es negativo, rechazar
  const interes = monto_devolver - capital
  if (interes <= 0) {
    logger.log('anti_saldo_activado', { capital, monto_devolver, interes }, 'error')
    throw new Error('INTERES_NEGATIVO_POSIBLE_SALDO')
  }

  // Extraer garantías (opcional)
  const garantiasMatches = [...text.matchAll(/Garant[ií]a\s*\[?\(?(\d+)\)?\]?\s*([A-Z]+)/g)]
  const garantias_hash = garantiasMatches.map(m => `${m[1]}-${m[2]}`).join(',')

  return {
    tipo_operacion: tipo,
    fecha_inicio,
    fecha_fin,
    fecha_liquidacion,
    capital,
    monto_devolver,
    interes,
    dias,
    tna_real,
    garantias_hash: garantias_hash || null,
  }
}

async function generateOperationKey(data: any): Promise<string> {
  // Idempotencia fuerte (tu lógica Python adaptada)
  const raw_key = `${data.fecha_inicio}_${data.fecha_fin}_${data.capital}_${data.monto_devolver}_${data.interes}_${data.archivo}`
  const encoder = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(raw_key))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const logger = new StructuredLogger()
  let payload: any = {}
  let rawText = ''

  try {
    payload = await req.json()
    const { pdf, filename, user_id, portfolio_id } = payload

    if (!pdf || !user_id || !portfolio_id) {
      throw new Error('FALTAN_CAMPOS')
    }

    logger.log('inicio', { filename, user_id })

    // Decode base64
    const base64Data = pdf.includes(',') ? pdf.split(',')[1] : pdf
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Extraer texto (método robusto tipo Python)
    rawText = extractTextFromPDF(bytes)
    logger.log('texto_extraido', { length: rawText.length, hasAlycbur: rawText.includes('Alycbur') })

    // Parsear
    const data = parseCaucion(rawText, filename, logger)
    const operation_key = await generateOperationKey({ ...data, archivo: filename })

    // Guardar
    const record = {
      user_id,
      portfolio_id,
      operation_key,
      ...data,
      archivo: filename,
      raw_text: rawText.substring(0, 2000),
      parse_version: '3.1-python-like',
      processing_logs: logger.getLogs(),
      status: 'active'
    }

    const { data: upserted, error } = await supabase
      .from('cauciones')
      .upsert(record, { onConflict: 'operation_key' })
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify({
      success: true,
      id: upserted.id,
      operation_key: operation_key.substring(0, 16)
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    logger.log('error', { message: error.message }, 'error')

    // Guardar en rejected si es un error de datos (no conexión)
    if (payload.user_id && payload.filename) {
      await supabase.from('cauciones_rejected').insert({
        user_id: payload.user_id,
        portfolio_id: payload.portfolio_id,
        archivo: payload.filename,
        error_message: error.message,
        raw_text: rawText ? rawText.substring(0, 1000) : 'NO_TEXT',
        processing_logs: logger.getLogs()
      })

      // Devolver 200 para que Apps Script no reintente
      return new Response(JSON.stringify({
        success: false,
        status: 'REJECTED',
        error: error.message
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      error: error.message
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 })
  }
})