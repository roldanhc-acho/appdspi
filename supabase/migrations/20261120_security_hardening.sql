-- ==============================================================================
-- MIGRACIÓN DE SEGURIDAD (Auditoría): Endurecimiento de RLS y RPCs SECURITY DEFINER
-- ==============================================================================

-- 1. Restringir ejecución de RPCs de notificaciones push únicamente a service_role
REVOKE ALL ON FUNCTION public.get_agenda_reminders_for_date(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_agenda_reminders_for_date(DATE) TO service_role;

REVOKE ALL ON FUNCTION public.log_push_notification_attempt(UUID, UUID, DATE, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_push_notification_attempt(UUID, UUID, DATE, TEXT, TEXT) TO service_role;

-- 2. Endurecer políticas RLS en public.holidays (solo admins pueden escribir; lectura autenticada/pública)
REVOKE INSERT, UPDATE, DELETE ON TABLE public.holidays FROM anon;

DROP POLICY IF EXISTS "Permitir insertar feriados" ON public.holidays;
DROP POLICY IF EXISTS "Permitir actualizar feriados" ON public.holidays;
DROP POLICY IF EXISTS "Permitir eliminar feriados" ON public.holidays;
DROP POLICY IF EXISTS "Permitir insertar feriados a usuarios autenticados" ON public.holidays;
DROP POLICY IF EXISTS "Permitir actualizar feriados a usuarios autenticados" ON public.holidays;
DROP POLICY IF EXISTS "Permitir eliminar feriados a usuarios autenticados" ON public.holidays;
DROP POLICY IF EXISTS "Solo admins gestionan feriados" ON public.holidays;

CREATE POLICY "Solo admins gestionan feriados"
    ON public.holidays
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin' AND is_active IS NOT FALSE
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin' AND is_active IS NOT FALSE
        )
    );
