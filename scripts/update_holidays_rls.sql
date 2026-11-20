-- Ajustar políticas de RLS para permitir operaciones de feriados únicamente a administradores activos
DROP POLICY IF EXISTS "Permitir insertar feriados a usuarios autenticados" ON public.holidays;
DROP POLICY IF EXISTS "Permitir actualizar feriados a usuarios autenticados" ON public.holidays;
DROP POLICY IF EXISTS "Permitir eliminar feriados a usuarios autenticados" ON public.holidays;
DROP POLICY IF EXISTS "Permitir insertar feriados" ON public.holidays;
DROP POLICY IF EXISTS "Permitir actualizar feriados" ON public.holidays;
DROP POLICY IF EXISTS "Permitir eliminar feriados" ON public.holidays;
DROP POLICY IF EXISTS "Solo admins gestionan feriados" ON public.holidays;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.holidays FROM anon;
GRANT SELECT ON TABLE public.holidays TO anon, authenticated;
GRANT ALL ON TABLE public.holidays TO service_role, postgres;

CREATE POLICY "Solo admins gestionan feriados"
    ON public.holidays FOR ALL
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
