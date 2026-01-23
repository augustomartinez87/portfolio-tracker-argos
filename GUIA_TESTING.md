# 🚀 **GUÍA RÁPIDA: Testing de Cambios del Módulo Spread v1**

## 📍 **Opción 1: Deploy en Vercel (Recomendado)**

### **1. Ejecutar SQLs en Supabase**
Primero ejecuta los 3 archivos SQL en orden:

1. `SQL_1_CREAR_TABLA.sql` - Crear tabla cauciones
2. `SQL_2_STORAGE_BUCKET.sql` - Crear Storage bucket  
3. `SQL_3_CAMPOS_FALTANTES.sql` - Agregar campos server-side

### **2. Deploy Edge Functions**
```bash
supabase functions deploy parse-caucion-pdf
```

### **3. Deploy a Vercel**
```bash
vercel --prod
# O vercel (para preview)
```

### **4. Testing**
- Navega a la URL de Vercel
- Login → `/spread`
- Sube PDF de caución
- ✅ Flujo completo server-side

---

## 📍 **Opción 2: Entorno Local Completo**

### **1. Iniciar Supabase Local**
```bash
# Instalar CLI si no lo tienes
npm install -g @supabase/cli

# Iniciar Supabase local
supabase start
```

### **2. Ejecutar Migraciones**
```bash
supabase db push
supabase functions deploy parse-caucion-pdf
```

### **3. Iniciar Frontend**
```bash
npm run dev
# Ahora sí encontrará la tabla local
```

---

## 📋 **Verificación del Módulo**

### **Antes (Client-side) ❌:**
- pdf-parse en frontend
- Error: "Pk is not a function"
- Error: "verbosity undefined"
- Pantalla blanca

### **Después (Server-side) ✅:**
- Upload a Supabase Storage
- Edge Function parsing
- PDFs guardados
- Cálculos TNA real correctos

### **Test Cases:**
1. **Upload PDF**: Debe mostrar "Subiendo y procesando PDFs..."
2. **Parse Results**: Operaciones extraídas correctamente
3. **Storage**: PDF guardado en bucket `caucion-pdfs`
4. **Database**: Operaciones guardadas con `tna_real` calculado
5. **UI**: Tabla muestra TNA real (no tasa_tna del PDF)

---

## 🎯 **Recomendación**

**Usa la Opción 1 (Vercel Deploy)** porque:
- ✅ Tu proyecto Supabase ya está configurado
- ✅ Edge Functions ya deployadas
- ✅ Testing real con producción
- ✅ No requiere configuración local

**Pasos inmediatos:**
1. Ejecuta los 3 SQLs en Supabase Dashboard
2. Deploy: `vercel --prod`
3. Testea en la URL generada

¿Quieres que te ayude con alguna de estas opciones?