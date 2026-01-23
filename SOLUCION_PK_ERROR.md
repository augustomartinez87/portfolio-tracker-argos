# 🚨 **SOLUCIÓN MANUAL: Error "Pk is not a function"**

## 📋 **Diagnóstico Confirmado**

El error `Pk is not a function` ocurre porque **Vercel está sirviendo la versión antigua** de tu app con `pdf-parse` en el frontend.

## 🔧 **Pasos para Solucionar (Manual en Vercel Dashboard)**

### **1. Ir a Vercel Dashboard**
1. Entra a [vercel.com](https://vercel.com)
2. Busca tu proyecto `portfolio-tracker`
3. Ve a **Settings → Environment Variables**
4. Verifica que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` estén correctas

### **2. Forzar Redeploy**
1. En tu proyecto Vercel, ve a la pestaña **Deployments**
2. Encuentra el último deployment
3. Haz click en los 3 puntos → **Redeploy**
4. Marca **"Skip build cache"**
5. Click en **Redeploy**

### **3. Verificar Build Settings**
1. En **Settings → Build & Development Settings**
2. Asegúrate que:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### **4. Limpiar Cache Navegador**
1. En Chrome: `Ctrl + Shift + R` (Hard refresh)
2. O abre la app en **incógnito**
3. O limpia cache: `chrome://settings/clearBrowserData`

---

## ⚡ **Alternativa Rápida: Preview Deployment**

Si el redeploy falla, crea un preview:

1. **Commit los cambios** a GitHub:
   ```bash
   git add .
   git commit -m "Fix: Server-side PDF parsing implementation"
   git push origin main
   ```

2. **Vercel creará automatic preview** con los cambios

---

## 🧪 **Testing Post-Deployment**

Después del redeploy, prueba:

### **✅ Signos de que funcionó:**
- El mensaje de upload dice **"Subiendo y procesando PDFs..."** (no "Procesando PDFs...")
- **No aparece** error `Pk is not a function`
- El PDF aparece en **Supabase Storage** → **caucion-pdfs**
- Las operaciones se guardan en la tabla **cauciones** con `tna_real`

### **❌ Signos de que falló:**
- Sigue apareciendo `Pk is not a function`
- El upload se queda stuck en "Procesando PDFs..."
- No se crean archivos en Storage

---

## 🎯 **Si el error persiste**

Puede ser que haya un **import residual** oculto. Revisa en tu Vercel Dashboard:

1. **Build Logs** → Busca errores de `pdf-parse`
2. **Function Logs** → Verifica Edge Function logs
3. **Console del navegador** → F12 → Network tab → Mira si hay imports de `pdf-parse`

---

## 🚀 **Plan B: Deploy Manual**

Si nada funciona, podemos:
1. **Crear un nuevo proyecto** en Vercel
2. **Conectarlo al mismo repo** de GitHub
3. **Deploy desde cero** con cambios aplicados

---

## 📞 **Próximos Pasos**

1. **Intenta redeploy en Vercel Dashboard** con "Skip build cache"
2. **Testea en incógnito** después del deploy
3. **Verifica que diga "Subiendo y procesando PDFs..."**
4. **Confirma que el PDF aparezca en Supabase Storage**

**¿Puedes intentar el redeploy manual en Vercel Dashboard y me dices qué mensaje aparece en el upload?**