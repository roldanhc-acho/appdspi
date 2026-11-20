# Versionado y Rollback Rápido — DSPI

## Versión Inicial (Baseline)
- **v1.0.0** — Estado operativo inicial tomado como línea base estable.
- La versión única se define en `package.json` (`version`) y se sincroniza con `public/version.json` para el aviso de actualización en la PWA (`AppUpdatePrompt.tsx`).

---

## Flujo para Publicar una Nueva Versión

1. **Trabajar en rama aislada** (ej. `feat/mi-cambio` o `fix/mi-correccion`) para validar la *Preview URL* de Vercel antes de tocar `main`.
2. **Incrementar la versión** (sincroniza `package.json` y `public/version.json`):
   ```bash
   npm run version:bump -- patch   # correcciones (1.0.0 -> 1.0.1)
   npm run version:bump -- minor   # nuevas funcionalidades (1.0.0 -> 1.1.0)
   npm run version:bump -- major   # cambios mayores (1.0.0 -> 2.0.0)
   ```
3. **Actualizar `highlights`** en `public/version.json` con las novedades reales de la versión (el modal `AppUpdatePrompt` las lee dinámicamente).
4. **Verificar antes de mergear/desplegar:**
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   ```
5. **Etiquetar el release en Git** una vez consolidado en `main`:
   ```bash
   git tag -a v1.0.1 -m "Release v1.0.1"
   git push origin main --tags
   ```

---

## Cómo Hacer Rollback Rápido si Falla un Despliegue

### 1. Frontend (Vercel) — < 1 minuto
1. Ingresar al **Dashboard de Vercel → Deployments**.
2. Ubicar el último deployment estable (etiquetado con su versión/commit anterior).
3. Abrir el menú `...` → **Instant Rollback** (o *Promote to Production*).
4. Los usuarios recibirán la versión restaurada automáticamente (el Service Worker usa estrategia *Network-First* y `AppUpdatePrompt` detectará el cambio de `version.json` y limpiará caché al confirmar).

### 2. Base de Datos y Edge Functions (Supabase)
> El rollback en Vercel **no revierte** cambios en Supabase.

- **Regla de oro para migraciones SQL (Expand & Contract):**
  - Nunca eliminar ni renombrar columnas/tablas en el mismo despliegue donde cambia el frontend.
  - Agregar primero las columnas/tablas nuevas (compatibles con la versión anterior) y eliminar lo obsoleto recién en un release posterior cuando la nueva versión esté validada.
- **Edge Functions:** Si se modificó una función (ej. `send-agenda-reminders`), hacer `git checkout v1.0.0` localmente y volver a desplegar solo esa función desde el tag estable.

---

## Historial de Versiones

- **v1.0.0** — Línea base inicial con sincronización de versión entre `package.json`, `public/version.json` y `AppUpdatePrompt`.
