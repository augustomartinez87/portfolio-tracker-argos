import { supabase } from '../lib/supabase';

export const caucionService = {
  async getCauciones(userId) {
    const { data, error } = await supabase
      .from('cauciones')
      .select('*')
      .eq('user_id', userId)
      .order('fecha_fin', { ascending: false });

    if (error) throw error;
    return data;
  },

  async insertCauciones(userId, cauciones) {
    const rows = cauciones.map(c => ({
      user_id: userId,
      pdf_filename: c.pdf_filename,
      boleto: c.boleto,
      fecha_inicio: c.fecha_inicio,
      fecha_fin: c.fecha_fin,
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

  async deleteCaucion(userId, caucionId) {
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
      .select('capital, monto_devolver, tasa_tna, fecha_inicio, fecha_fin')
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
      ? data.reduce((sum, c) => sum + (Number(c.capital) * Number(c.tasa_tna || 0)), 0) / capitalTotal
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
