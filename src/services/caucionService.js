import { supabase } from '../lib/supabase';

export const caucionService = {
  // CSV ingestion currently disabled
  async ingestCsv(csvText) {
    throw new Error('CSV ingestion is disabled in this deployment');
  },
  async uploadPDFAndTriggerParsing(userId, file) {
    try {
      // 1. Subir PDF a Supabase Storage
      const filePath = `${userId}/${Date.now()}-${file.name}`;
      const { data, error: uploadError } = await supabase.storage
        .from('caucion-pdfs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Obtener URL pública robusta
      let pdfUrl = null;
      try {
        const { data: urlData } = supabase.storage
          .from('caucion-pdfs')
          .getPublicUrl(filePath);
        pdfUrl = urlData?.publicURL ?? urlData?.publicUrl ?? null;
      } catch (e) {
        pdfUrl = null;
      }

      // 3. Llamar API Vercel para parsing
      const response = await fetch('/api/parse-caucion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pdfPath: data.path, 
          userId 
        })
      });

      if (!response.ok) {
        // Clonar la respuesta antes de leer el body para evitar "body stream already read"
        const clonedResponse = response.clone();
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          // Si response.json() falló, usar el texto de la respuesta clonada
          const text = await clonedResponse.text();
          throw new Error(`Error en parsing: ${text || response.statusText}`);
        }
        // Incluir detalles del error si están disponibles
        const errorMsg = errorData.error || 'Error en parsing';
        const errorDetails = errorData.details ? ` - ${errorData.details}` : '';
        const errorType = errorData.type ? ` [${errorData.type}]` : '';
        throw new Error(`${errorMsg}${errorDetails}${errorType}`);
      }

      const result = await response.json();

      // 4. Retornar resultado completo
      return {
        success: true,
        filename: file.name,
        pdf_storage_path: data.path,
        pdf_url: pdfUrl,
        operaciones: result.operaciones,
        total_cierres: result.total_operaciones,
        message: result.message
      };

    } catch (error) {
      console.error('Upload and parse error:', error);
      throw error;
    }
  },

  async insertCauciones(userId, cauciones) {
    const rows = cauciones.map(c => ({
      user_id: userId,
      pdf_filename: c.filename,
      pdf_storage_path: c.pdf_storage_path,
      pdf_url: c.pdf_url,
      boleto: c.boleto,
      fecha_inicio: c.fecha_liquidacion,
      fecha_fin: c.fecha_liquidacion,
      capital: c.capital,
      monto_devolver: c.monto_devolver,
      raw_text: c.raw_text
    }));

    const { data, error } = await supabase
      .from('cauciones')
      .insert(rows)
      .select();

    if (error) throw error;
    return data;
  },

  async getCauciones(userId) {
    const { data, error } = await supabase
      .from('cauciones')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async deleteCaucion(userId, caucionId) {
    // 1. Obtener info del PDF para borrar de Storage
    const { data: caucion } = await supabase
      .from('cauciones')
      .select('pdf_storage_path')
      .eq('id', caucionId)
      .eq('user_id', userId)
      .single();

    // 2. Borrar de Storage
    if (caucion?.pdf_storage_path) {
      await supabase.storage
        .from('caucion-pdfs')
        .remove([caucion.pdf_storage_path]);
    }

    // 3. Borrar de DB
    const { error } = await supabase
      .from('cauciones')
      .delete()
      .eq('id', caucionId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async getResumen(userId) {
    const { data, error } = await supabase
      .from('cauciones')
      .select('capital, monto_devolver, tna_real, fecha_inicio, fecha_fin')
      .eq('user_id', userId);

    if (error) throw error;

    if (!data || data.length === 0) {
      return {
        capitalTotal: 0,
        interesTotal: 0,
        tnaPromedioPonderada: 0,
        totalOperaciones: 0,
        totalDias: 0
      };
    }

    const capitalTotal = data.reduce((sum, c) => sum + Number(c.capital), 0);
    const interesTotal = data.reduce((sum, c) => sum + (Number(c.monto_devolver) - Number(c.capital)), 0);
    const tnaPonderada = capitalTotal > 0
      ? data.reduce((sum, c) => sum + (Number(c.capital) * Number(c.tna_real || 0)), 0) / capitalTotal
      : 0;

    const totalDias = data.reduce((sum, c) => {
      const d = Math.ceil((new Date(c.fecha_fin) - new Date(c.fecha_inicio)) / (1000 * 60 * 60 * 24));
      return sum + (d > 0 ? d : 0);
    }, 0);

    return {
      capitalTotal,
      interesTotal,
      tnaPromedioPonderada: tnaPonderada,
      totalOperaciones: data.length,
      totalDias
    };
  },

  async existePDF(userId, filename) {
    const { data, error } = await supabase
      .from('cauciones')
      .select('id')
      .eq('user_id', userId)
      .eq('pdf_filename', filename)
      .limit(1);

    if (error) throw error;
    return data && data.length > 0;
  }
};
