import pandas as pd
import os
import sys

# Configuración
INPUT_FILE = r"C:\Users\Augusto\Downloads\FCI\bala.xlsx"
OUTPUT_FILE = r"C:\Users\Augusto\Downloads\FCI\bala.csv"
FCI_NAME = "Adcap Balanceado III - Clase A"

def ingest_fci_data():
    print(f"🚀 Iniciando procesamiento de FCI...")
    print(f"📂 Archivo de entrada: {INPUT_FILE}")

    if not os.path.exists(INPUT_FILE):
        print(f"❌ Error: No se encuentra el archivo {INPUT_FILE}")
        return

    try:
        # 1. Leer Excel
        print("📖 Leyendo archivo Excel...")
        df = pd.read_excel(INPUT_FILE)
        
        # Normalizar nombres de columnas (minusculas y sin espacios)
        df.columns = [str(c).lower().strip() for c in df.columns]
        
        print(f"   Columnas encontradas: {list(df.columns)}")

        # Buscar columnas clave heurísticamente
        col_fecha = next((c for c in df.columns if 'fecha' in c), None)
        col_vcp = next((c for c in df.columns if 'vcp' in c or 'valor' in c or 'precio' in c), None)

        if not col_fecha or not col_vcp:
            print("❌ Error: No se encontraron las columnas 'fecha' y 'vcp' (o similar).")
            return

        # 2. Limpieza y Normalización
        print("🧹 Limpiando datos...")
        
        # Fecha -> datetime
        df['fecha_norm'] = pd.to_datetime(df[col_fecha], errors='coerce')
        df = df.dropna(subset=['fecha_norm']) # Eliminar filas sin fecha válida
        
        # VCP -> numeric
        df['vcp_norm'] = pd.to_numeric(df[col_vcp], errors='coerce')
        df = df.dropna(subset=['vcp_norm']) # Eliminar filas sin VCP válido

        # Lógica 'Por mil'
        # Heurística: Si la mediana del VCP es > 100, asumimos que está expresado cad 1000 cp
        median_vcp = df['vcp_norm'].median()
        if median_vcp > 100:
            print(f"⚠️ Detectado valor por mil (Mediana: {median_vcp}). Dividiendo por 1000.")
            df['vcp_norm'] = df['vcp_norm'] / 1000.0
        else:
            print(f"✅ Valores detectados como unitarios (Mediana: {median_vcp}).")

        # 3. Preparar DataFrame final
        output_df = pd.DataFrame({
            'fci': FCI_NAME,
            'fecha': df['fecha_norm'].dt.strftime('%Y-%m-%d'),
            'vcp': df['vcp_norm'].round(8) # 8 decimales de precisión
        })

        # Ordenar
        output_df = output_df.sort_values('fecha', ascending=True)

        # 4. Validaciones finales
        if output_df.isnull().values.any():
            print("❌ Error: El CSV resultante contiene valores nulos.")
            return

        # 5. Exportar
        print(f"💾 Guardando en {OUTPUT_FILE}...")
        output_df.to_csv(OUTPUT_FILE, index=False, encoding='utf-8')
        
        print("✅ Proceso completado exitosamente.")
        print(f"📊 Registros procesados: {len(output_df)}")
        print("Ejemplo de salida:")
        print(output_df.tail(3))

    except Exception as e:
        print(f"❌ Error inesperado: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    ingest_fci_data()
