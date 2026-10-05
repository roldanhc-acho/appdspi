-- ==============================================================================
-- ACTIVACIÓN CRON: Envío automático de Agenda a las 8:00 AM (Argentina, UTC-3)
-- Proyecto: ewlxcpgbavfvgnohtkuq
-- ==============================================================================
-- Instrucciones:
-- 1. Ve al Dashboard de Supabase (https://supabase.com/dashboard/project/ewlxcpgbavfvgnohtkuq)
-- 2. Abre el SQL Editor y pega este archivo completo.
-- 3. Haz clic en "Run" (ejecutar). ¡Listo!
--
-- Nota: Ya incluye la clave autorizada del proyecto para que se ejecute sin editar nada.
-- Si prefieres usar la clave secreta "service_role", puedes reemplazarla en la línea 32.
-- ==============================================================================

-- 1. Habilitar extensiones requeridas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Eliminar programación previa si existía
DO $$
BEGIN
    PERFORM cron.unschedule('daily-agenda-reminders-8am');
EXCEPTION WHEN OTHERS THEN
    -- Ignorar si no existía
END $$;

-- 3. Programar el cron job a las 8:00 AM (Argentina UTC-3 es 11:00 UTC)
-- '0 11 * * *' se ejecuta a las 11:00:00 UTC todos los días.
SELECT cron.schedule(
    'daily-agenda-reminders-8am',
    '0 11 * * *',
    $$
    SELECT net.http_post(
        url := 'https://ewlxcpgbavfvgnohtkuq.supabase.co/functions/v1/send-agenda-reminders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bHhjcGdiYXZmdmdub2h0a3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTcyNDMsImV4cCI6MjA4NDMzMzI0M30.d6zQpak_F9G12DG7_ZKdoYPyfPL8YQTbhnAQVltcHxs',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bHhjcGdiYXZmdmdub2h0a3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTcyNDMsImV4cCI6MjA4NDMzMzI0M30.d6zQpak_F9G12DG7_ZKdoYPyfPL8YQTbhnAQVltcHxs'
        ),
        body := jsonb_build_object(
            'scheduled_time', now()
        )
    );
    $$
);


-- ==============================================================================
-- CONSULTAS DE VERIFICACIÓN (Ejecutar para comprobar que quedó activo):
-- ==============================================================================
-- Ver el cron registrado:
-- SELECT * FROM cron.job WHERE jobname = 'daily-agenda-reminders-8am';

-- Ver el historial de ejecuciones y respuestas HTTP:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
