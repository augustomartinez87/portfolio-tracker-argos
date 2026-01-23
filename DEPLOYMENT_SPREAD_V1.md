# 📋 Guía de Deployment - Módulo Spread v1 (Server-Side)

## 🎯 Arquitectura Implementada

**Estado:** ✅ 100% Server-side PDF parsing
- ✅ Supabase Storage bucket para PDFs
- ✅ Edge Function con parsing server-side
- ✅ Schema DB actualizado con campos faltantes
- ✅ Frontend refactorizado sin pdf-parse
- ✅ Flujo completo: Upload → Storage → Edge Function → DB

## 🚀 Pasos para Deployment

### 1. Ejecutar Migraciones en Supabase

```sql
-- Ejecutar en Supabase SQL Editor
-- Archivo: supabase/migrations/002_storage_bucket_and_schema.sql
```

**Verificar creación:**
```sql
SELECT * FROM storage.buckets WHERE id = 'caucion-pdfs';
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'cauciones' AND column_name IN ('raw_text', 'pdf_storage_path', 'pdf_url');
```

### 2. Deploy Edge Functions

```bash
# Desde el directorio del proyecto
supabase functions deploy parse-caucion-pdf
```

**Verificar deployment:**
```bash
# Test Edge Function
curl -X POST https://[project-ref].supabase.co/functions/v1/parse-caucion-pdf \
  -H "Authorization: Bearer [service-role-key]" \
  -H "Content-Type: application/json" \
  -d '{"userId": "test", "filename": "test.pdf", "fileData": "base64-data"}'
```

### 3. Variables de Entorno

**Edge Function necesita:**
- `SUPABASE_URL` (automático)
- `SUPABASE_SERVICE_ROLE_KEY` (automático)

### 4. Testing del Flujo Completo

**Frontend Test:**
1. Iniciar app: `npm run dev`
2. Navegar a `/spread`
3. Subir PDF de caución
4. Verificar:
   - Upload a Storage ✅
   - Parsing server-side ✅
   - Resultados en tabla ✅
   - Cálculos TNA real ✅

## 🔍 Validaciones Técnicas

### **Schema DB**
```sql
-- Verificar tabla cauciones
\d cauciones

-- Verificar columnas nuevas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'cauciones' 
  AND column_name IN ('raw_text', 'pdf_storage_path', 'pdf_url');
```

### **Storage Bucket**
```sql
-- Verificar bucket y políticas
SELECT * FROM storage.buckets WHERE id = 'caucion-pdfs';
SELECT * FROM pg_policies WHERE tablename = 'objects';
```

### **Edge Function**
```typescript
// Test endpoint
GET https://[project-ref].supabase.co/functions/v1/parse-caucion-pdf
// Response: {"message": "Caución PDF parsing Edge Function", "version": "1.0.0", "status": "active"}
```

## 📊 Métricas y Validación

### **Cálculo TNA Real**
```sql
-- Verificar fórmula
SELECT 
  capital,
  monto_devolver,
  interes,
  dias,
  tna_real,
  ((monto_devolver - capital) / capital) * 365 / dias as expected_tna
FROM cauciones 
WHERE user_id = '[test-user-id]';
```

### **Resumen de Métricas**
```sql
-- Verificar vista de resumen
SELECT * FROM cauciones_resumen WHERE user_id = '[test-user-id]';
```

## 🛡️ Seguridad

### **RLS Policies**
- ✅ Storage: Solo usuarios pueden acceder a sus propios PDFs
- ✅ Database: Row Level Security por user_id
- ✅ Edge Function: Validación de userId en cada request

### **Validaciones**
- ✅ Solo archivos PDF (mime type validation)
- ✅ Límite de 10MB por archivo
- ✅ Detección de duplicados por filename
- ✅ Parsing exclusivo de operaciones de cierre

## 🚨 Troubleshooting

### **Error: "Missing required fields"**
- Verificar que userId, filename y fileData se envíen a Edge Function
- Validar conversión a base64 en frontend

### **Error: "Invalid user"**
- Verificar que userId exista en auth.users
- Validar service_role key permissions

### **Error: "No se encontraron operaciones de cierre válidas"**
- Verificar formato del PDF (debe ser de caución)
- Revisar regex patterns en Edge Function
- Validar que contenga operaciones de "cierre"

### **Error: Storage upload**
- Verificar políticas RLS del bucket
- Validar que user_id coincida con path structure

## 📈 Monitoreo

### **Logs de Edge Function**
```bash
supabase functions logs parse-caucion-pdf
```

### **Métricas de Storage**
```sql
-- Uso de Storage
SELECT bucket_id, SUM(file_size) as total_size, COUNT(*) as total_files
FROM storage.objects
GROUP BY bucket_id;
```

### **Performance de Parsing**
```sql
-- Tiempos de procesamiento
SELECT 
  DATE(created_at) as date,
  COUNT(*) as operations,
  AVG(capital) as avg_capital
FROM cauciones
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## ✅ Checklist de Deployment

- [ ] **Storage Bucket**: Creado con políticas RLS
- [ ] **Schema DB**: Actualizado con campos nuevos
- [ ] **Edge Function**: Deployada y testeada
- [ ] **Frontend**: Refactorizado sin pdf-parse
- [ ] **Variables de Entorno**: Configuradas
- [ ] **Testing**: Flujo completo validado
- [ ] **Seguridad**: RLS policies verificadas
- [ ] **Métricas**: Cálculos TNA real correctos
- [ ] **Logs**: Monitoreo configurado

## 🎉 Resultado Final

**Arquitectura 100% Server-Side:**
```
React Upload → Supabase Storage → Edge Function → Database
```

**Beneficios:**
- ✅ Seguro (no PDF parsing en cliente)
- ✅ Escalable (server-side processing)
- ✅ Robusto (manejo de errores)
- ✅ Auditable (PDFs almacenados)
- ✅ Rápido (caching en Storage)

**Estado:** Listo para producción 🚀