-- ==============================================================================
-- MIGRACIÓN: Sistema de Notificaciones Push Web para Agenda (DSPI)
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

-- 1. Tabla de Suscripciones Push por Usuario / Dispositivo
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en suscripciones
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view only their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view only their own push subscriptions"
    ON public.push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert their own push subscriptions"
    ON public.push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update their own push subscriptions"
    ON public.push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete their own push subscriptions"
    ON public.push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

-- Índices para optimizar búsquedas por usuario y endpoint
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);


-- 2. Tabla de Auditoría y Control de Duplicados (para el cron de las 8:00 AM)
CREATE TABLE IF NOT EXISTS public.push_notification_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sent_for_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_event_user_sent_date UNIQUE (event_id, user_id, sent_for_date)
);

ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and owners can view notification logs" ON public.push_notification_logs;
CREATE POLICY "Admins and owners can view notification logs"
    ON public.push_notification_logs FOR SELECT
    USING (
        auth.uid() = user_id 
        OR EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE INDEX IF NOT EXISTS idx_push_logs_event_user_date ON public.push_notification_logs(event_id, user_id, sent_for_date);


-- 3. Función Segura para Obtener Recordatorios a Enviar a las 8:00 AM
-- Garantiza privacidad:
--   - Eventos públicos: Reciben todos los usuarios activos suscritos.
--   - Eventos privados: Reciben SOLAMENTE el creador y convocados cuyo estado != 'declined'.
--   - No repite notificaciones ya enviadas para ese evento en el mismo día.
CREATE OR REPLACE FUNCTION public.get_agenda_reminders_for_date(target_date DATE)
RETURNS TABLE (
    event_id UUID,
    event_title TEXT,
    event_description TEXT,
    event_time TEXT,
    is_public BOOLEAN,
    target_user_id UUID,
    subscription_id UUID,
    endpoint TEXT,
    p256dh TEXT,
    auth TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH current_events AS (
        SELECT 
            e.id AS ev_id,
            e.title,
            e.description,
            e.event_time,
            e.is_public,
            e.created_by
        FROM public.events e
        WHERE (
            -- 1. Evento para la fecha específica
            e.event_date = target_date
            -- 2. Recurrencia semanal
            OR (e.recurrence = 'weekly' AND EXTRACT(DOW FROM e.event_date) = EXTRACT(DOW FROM target_date))
            -- 3. Recurrencia mensual
            OR (e.recurrence = 'monthly' AND EXTRACT(DAY FROM e.event_date) = EXTRACT(DAY FROM target_date))
            -- 4. Recurrencia anual
            OR (e.recurrence = 'yearly' AND EXTRACT(MONTH FROM e.event_date) = EXTRACT(MONTH FROM target_date) AND EXTRACT(DAY FROM e.event_date) = EXTRACT(DAY FROM target_date))
        )
    ),
    authorized_recipients AS (
        -- CASO A: Eventos públicos -> Todos los usuarios de profiles
        SELECT 
            ce.ev_id,
            p.id AS user_id
        FROM current_events ce
        CROSS JOIN public.profiles p
        WHERE ce.is_public = TRUE

        UNION

        -- CASO B: Eventos privados -> El creador del evento
        SELECT 
            ce.ev_id,
            ce.created_by AS user_id
        FROM current_events ce
        WHERE ce.is_public = FALSE

        UNION

        -- CASO C: Eventos privados -> Participantes convocados (que no hayan rechazado)
        SELECT 
            ce.ev_id,
            ep.user_id
        FROM current_events ce
        JOIN public.event_participants ep ON ep.event_id = ce.ev_id
        WHERE ce.is_public = FALSE
          AND (ep.status IS NULL OR ep.status != 'declined')
    )
    SELECT 
        ce.ev_id AS event_id,
        ce.title AS event_title,
        ce.description AS event_description,
        ce.event_time,
        ce.is_public,
        ar.user_id AS target_user_id,
        ps.id AS subscription_id,
        ps.endpoint,
        ps.p256dh,
        ps.auth
    FROM authorized_recipients ar
    JOIN current_events ce ON ce.ev_id = ar.ev_id
    JOIN public.push_subscriptions ps ON ps.user_id = ar.user_id
    -- Excluir si ya fue enviado exitosamente hoy para este evento a este usuario
    LEFT JOIN public.push_notification_logs l 
        ON l.event_id = ce.ev_id 
       AND l.user_id = ar.user_id 
       AND l.sent_for_date = target_date
       AND l.status = 'sent'
    WHERE l.id IS NULL;
END;
$$;


-- 4. Función Auxiliar para Registrar el Resultado del Envío
CREATE OR REPLACE FUNCTION public.log_push_notification_attempt(
    p_event_id UUID,
    p_user_id UUID,
    p_sent_for_date DATE,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.push_notification_logs (
        event_id,
        user_id,
        sent_for_date,
        status,
        error_message,
        sent_at
    ) VALUES (
        p_event_id,
        p_user_id,
        p_sent_for_date,
        p_status,
        p_error_message,
        timezone('utc'::text, now())
    )
    ON CONFLICT (event_id, user_id, sent_for_date)
    DO UPDATE SET 
        status = EXCLUDED.status,
        error_message = EXCLUDED.error_message,
        sent_at = EXCLUDED.sent_at;
END;
$$;
