/**
 * SCRIPT DE IMPORTACIÓN ÚNICA DE MEP
 * 
 * Este script está diseñado para leer el mep.csv y poblar la tabla mep_history en Supabase.
 * Nota: Debe usarse en un entorno que soporte importaciones de TS/Supabase.
 */

import { supabase } from '../lib/supabase';

// Esta función se puede llamar desde un componente temporal o una herramienta de admin
export const importMepCsvData = async (csvContent: string) => {
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');

    const fechaIdx = headers.indexOf('fecha');
    const cierreIdx = headers.indexOf('cierre');

    if (fechaIdx === -1 || cierreIdx === -1) {
        throw new Error('Formato de CSV inválido: faltan columnas fecha o cierre');
    }

    const dataToInsert = lines.slice(1)
        .map(line => {
            const cols = line.split(',');
            if (cols.length < headers.length) return null;

            const date = cols[fechaIdx].trim();
            const price = parseFloat(cols[cierreIdx]);

            if (!date || isNaN(price)) return null;

            return { date, price };
        })
        .filter(Boolean) as { date: string, price: number }[];

    console.log(`Preparando inserción de ${dataToInsert.length} registros...`);

    // Insertar en batches de 1000 para no saturar Supabase
    const batchSize = 1000;
    for (let i = 0; i < dataToInsert.length; i += batchSize) {
        const batch = dataToInsert.slice(i, i + batchSize);
        const { error } = await supabase
            .from('mep_history')
            .upsert(batch, { onConflict: 'date' });

        if (error) {
            console.error(`Error en batch ${i}:`, error);
        } else {
            console.log(`Batch ${i} completado.`);
        }
    }

    return dataToInsert.length;
};
