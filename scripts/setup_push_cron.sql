-- ==============================================================================
-- PROGRAMACIÓN CRON: Envío automático a las 8:00 AM (Argentina, UTC-3)
-- Ejecutar en Supabase SQL Editor después de desplegar la Edge Function
-- ==============================================================================

-- 1. Habilitar extensiones necesarias en Supabase (si no están habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Eliminar cron previo si existía
DO $$
BEGIN
    PERFORM cron.unschedule('daily-agenda-reminders-8am');
EXCEPTION WHEN OTHERS THEN
    -- Ignorar si no existía
END $$;

-- 3. Programar el cron job a las 8:00 AM (Argentina UTC-3 es 11:00 UTC)
-- '0 11 * * *' se ejecuta a las 11:00:00 UTC todos los días.
--
-- NOTA: Reemplazar:
--   <TU_PROJECT_REF>: ID de proyecto Supabase (ej: 'abcdefghijklmnop')
--   <TU_SERVICE_ROLE_KEY>: Clave service_role de Supabase (Settings -> API)
SELECT cron.schedule(
    'daily-agenda-reminders-8am',
    '0 11 * * *',
    $$
    SELECT net.http_post(
        url := 'https://<TU_PROJECT_REF>.supabase.co/functions/v1/send-agenda-reminders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer <TU_SERVICE_ROLE_KEY>'
        ),
        body := jsonb_build_object(
            'scheduled_time', now()
        )
    );
    $$
);

-- Para verificar que quedó registrado:
-- SELECT * FROM cron.job;
