import pandas as pd
import sys

# Configuración
INPUT_CSV = r"C:\Users\Augusto\Downloads\FCI\bala.csv"
OUTPUT_SQL = r"C:\Users\Augusto\Downloads\FCI\seed_prices.sql"

# ID DEL FONDO (Se pedirá al ejecutar o se puede hardcodear si el usuario nos lo da)
# Por defecto pondremos un placeholder que el usuario debe reemplazar
FCI_UUID_PLACEHOLDER = "96706c15-2038-4614-8a09-17d1ec6384e3"

def generate_sql():
    print(f"🚀 Generando SQL de precios...")
    
    try:
        # Leer CSV
        df = pd.read_csv(INPUT_CSV)
        print(f"📖 Leídos {len(df)} registros.")
        
        with open(OUTPUT_SQL, 'w', encoding='utf-8') as f:
            f.write("-- Bulk insert historical prices\n")
            f.write(f"-- IMPORTANTE: Reemplaza '{FCI_UUID_PLACEHOLDER}' con el UUID real de fci_master\n")
            f.write("\n")
            
            # Generar inserts en bloques para no saturar
            f.write("INSERT INTO fci_prices (fci_id, fecha, vcp) VALUES\n")
            
            values = []
            for index, row in df.iterrows():
                # Formato: ('uuid', 'YYYY-MM-DD', 12.345678)
                val = f"('{FCI_UUID_PLACEHOLDER}', '{row['fecha']}', {row['vcp']})"
                values.append(val)
            
            # Unir todo con comas y cerrar con punto y coma
            f.write(",\n".join(values))
            f.write(";\n")

        print(f"✅ Archivo SQL generado en: {OUTPUT_SQL}")
        print("⚠️  ABRE EL ARCHIVO Y REEMPLAZA 'TU_UUID_AQUI' POR EL ID REAL DEL FONDO.")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    generate_sql()
