# Pasos para Completar la Implementación

## ⚠️ Requisito Previo
Node.js no está detectado en tu sistema. Primero instala Node.js desde https://nodejs.org/

## Paso 1: Instalar Dependencias
```bash
npm install
```

## Paso 2: Verificar Configuración
El archivo `.env.local` ya fue creado con las credenciales de Supabase.

## Paso 3: Reestructurar App.jsx

Necesitas mover el contenido actual de `App.jsx` (que tiene ~1400 líneas) a un nuevo `Dashboard.jsx`.

### Opción A: Manual (Recomendado para control total)

1. **Crear backup de App.jsx:**
   ```bash
   mv src/App.jsx src/App.jsx.backup
   ```

2. **Renombrar App_new.jsx a App.jsx:**
   ```bash
   mv src/App_new.jsx src/App.jsx
   ```

3. **Crear archivo Dashboard.jsx:**
   - Copia TODO el contenido de `src/App.jsx.backup`
   - Crea un nuevo archivo `src/pages/Dashboard.jsx`
   - Pega el contenido
   - Cambia la línea 385: `export default function ArgosCapital()` por `export default function Dashboard()`

4. **Adaptar Dashboard.jsx para usar Supabase:**

   Agrega estos imports al inicio del archivo (después de los imports existentes):
   ```javascript
   import { useAuth } from '../contexts/AuthContext'
   import { usePortfolio } from '../contexts/PortfolioContext'
   import { PortfolioSelector } from '../components/PortfolioSelector'
   import { tradeService } from '../services/tradeService'
   ```

   En la función Dashboard (línea 385), agrega después de las declaraciones useState:
   ```javascript
   const { user, signOut } = useAuth()
   const { currentPortfolio } = usePortfolio()
   const [trades, setTrades] = useState([])
   ```

   Reemplaza `const [trades, setTrades] = useLocalStorage('portfolio-trades-v3', []);` con:
   ```javascript
   const [trades, setTrades] = useState([])
   ```

   Reemplaza `const [prices, setPrices] = useLocalStorage('portfolio-prices-v3', {});` con:
   ```javascript
   const [prices, setPrices] = useState({})
   ```

   Agrega un useEffect para cargar trades cuando cambia el portfolio:
   ```javascript
   // Load trades from Supabase when portfolio changes
   useEffect(() => {
     if (!currentPortfolio || !user) return

     const loadTrades = async () => {
       try {
         const data = await tradeService.getTrades(currentPortfolio.id)
         setTrades(data || [])
       } catch (error) {
         console.error('Error loading trades:', error)
         setTrades([])
       }
     }

     loadTrades()
   }, [currentPortfolio, user])
   ```

   En el botón de "Cerrar sesión" (línea ~1050), cambia:
   ```javascript
   onClick={() => {}}
   ```
   por:
   ```javascript
   onClick={() => signOut()}
   ```

   En el header (línea ~980-985), agrega el PortfolioSelector:
   ```javascript
   <div className="flex items-center gap-2">
     <PortfolioSelector />
     <img src={logo} alt="Argos Capital" className="w-8 h-8" />
     <h1 className="text-lg font-bold text-white">Argos Capital</h1>
   </div>
   ```

5. **Probar la aplicación:**
   ```bash
   npm run dev
   ```

### Opción B: Usar script de migración (si prefieres automatizar)

El script `migrate-dashboard.sh` puede ayudar con algunos pasos, pero requerirá edición manual final.

## Paso 4: Testing

Una vez completado, prueba:

1. **Registro:**
   - Ve a http://localhost:5173/signup
   - Crea una cuenta
   - Verifica que te redirige al dashboard
   - Verifica que se crea el portfolio por defecto

2. **Login:**
   - Cerrar sesión y volver a /login
   - Inicia sesión con tus credenciales

3. **Gestión de Portfolios:**
   - Crea un nuevo portfolio
   - Cambia entre portfolios
   - Establece un portfolio como por defecto

4. **Crear Trades:**
   - Agrega un trade en un portfolio
   - Verifica que aparece en la tabla
   - Cambia de portfolio y verifica que los datos son diferentes

5. **Persistencia:**
   - Cierra sesión
   - Vuelve a iniciar sesión
   - Verifica que todos los datos persisten

## Solución de Problemas Comunes

### "useAuth must be used within AuthProvider"
- Asegúrate que `App.jsx` usa el `AuthProvider`
- Verifica que las rutas están envueltas en `AuthProvider`

### "usePortfolio must be used within PortfolioProvider"
- Asegúrate que `App.jsx` envuelve la ruta de dashboard con `PortfolioProvider`

### Error de conexión a Supabase
- Verifica que `.env.local` tiene las credenciales correctas
- Verifica que tu proyecto de Supabase está activo
- Revisa la URL y el anon key

### Los trades no se cargan
- Verifica que `currentPortfolio` no es null
- Revisa la consola del navegador para errores
- Verifica que el usuario está autenticado

### Los portfolios no aparecen en el selector
- Verifica que las políticas de RLS en Supabase están configuradas
- Revisa en la consola de Supabase si hay datos en la tabla `portfolios`

## Archivos Modificados

### Nuevos Archivos
- ✅ `.env.local`
- ✅ `src/lib/supabase.js`
- ✅ `src/contexts/AuthContext.jsx`
- ✅ `src/contexts/PortfolioContext.jsx`
- ✅ `src/pages/Login.jsx`
- ✅ `src/pages/SignUp.jsx`
- ✅ `src/pages/ForgotPassword.jsx`
- ✅ `src/pages/ResetPassword.jsx`
- ✅ `src/components/ProtectedRoute.jsx`
- ✅ `src/components/PortfolioSelector.jsx`
- ✅ `src/services/positionService.js`
- ✅ `src/services/tradeService.js`
- ✅ `src/services/snapshotService.js`
- ✅ `src/App_new.jsx` (para reemplazar App.jsx)
- ✅ `package.json` (actualizado con nuevas dependencias)
- ✅ `.gitignore` (actualizado)

### Archivos por Renombrar/Crear
- 🔄 `src/App.jsx` → `src/App.jsx.backup`
- 🔄 `src/App_new.jsx` → `src/App.jsx`
- ➕ `src/pages/Dashboard.jsx` (nuevo, con contenido de App.jsx.backup)

## Siguientes Mejoras

Una vez que la implementación base funcione:

1. **Migración de datos:** Script para migrar datos existentes de localStorage a Supabase
2. **React Query:** Para optimizar las llamadas a la API
3. **Validación de formularios:** Usar react-hook-form o similar
4. **Notificaciones:** Sistema de toast para feedback al usuario
5. **Skeletons:** Mejorar los estados de carga
6. **Realtime updates:** Usar Supabase Realtime para actualizaciones instantáneas
7. **Export/Import:** Funcionalidad completa para exportar/importar portfolios
