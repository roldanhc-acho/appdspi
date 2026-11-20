-- ==============================================================================
-- MIGRACIÓN: CREACIÓN Y CARGA DE TABLA DE FERIADOS (holidays)
-- Permite registrar y persistir feriados y días no laborables para toda la app.
-- ==============================================================================

-- 1. Crear la tabla 'holidays'
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'feriado', -- 'feriado' o 'no_laborable'
    is_custom BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Índices para acelerar búsquedas por fecha
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_type ON public.holidays(type);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad (RLS)
-- Permitir que todos los usuarios autenticados y anónimos puedan consultar los feriados
DROP POLICY IF EXISTS "Permitir lectura publica de feriados" ON public.holidays;
CREATE POLICY "Permitir lectura publica de feriados"
    ON public.holidays FOR SELECT
    USING (true);

-- Permitir a usuarios autenticados insertar feriados
DROP POLICY IF EXISTS "Permitir insertar feriados a usuarios autenticados" ON public.holidays;
CREATE POLICY "Permitir insertar feriados a usuarios autenticados"
    ON public.holidays FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Permitir a usuarios autenticados actualizar feriados
DROP POLICY IF EXISTS "Permitir actualizar feriados a usuarios autenticados" ON public.holidays;
CREATE POLICY "Permitir actualizar feriados a usuarios autenticados"
    ON public.holidays FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Permitir a usuarios autenticados eliminar feriados
DROP POLICY IF EXISTS "Permitir eliminar feriados a usuarios autenticados" ON public.holidays;
CREATE POLICY "Permitir eliminar feriados a usuarios autenticados"
    ON public.holidays FOR DELETE
    TO authenticated
    USING (true);

-- Otorgar permisos de tabla a los roles correspondientes
GRANT ALL ON TABLE public.holidays TO postgres;
GRANT ALL ON TABLE public.holidays TO service_role;
GRANT ALL ON TABLE public.holidays TO authenticated;
GRANT SELECT ON TABLE public.holidays TO anon;

-- 5. Carga inicial de feriados oficiales nacionales de Argentina 2026
INSERT INTO public.holidays (date, name, type, is_custom) VALUES
    ('2026-01-01', 'Año Nuevo', 'feriado', false),
    ('2026-02-16', 'Carnaval', 'feriado', false),
    ('2026-02-17', 'Carnaval', 'feriado', false),
    ('2026-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'feriado', false),
    ('2026-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'feriado', false),
    ('2026-04-03', 'Viernes Santo', 'feriado', false),
    ('2026-05-01', 'Día del Trabajador', 'feriado', false),
    ('2026-05-25', 'Día de la Revolución de Mayo', 'feriado', false),
    ('2026-06-15', 'Paso a la Inmortalidad del Gral. Martín Miguel de Güemes', 'feriado', false),
    ('2026-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano', 'feriado', false),
    ('2026-07-09', 'Día de la Independencia', 'feriado', false),
    ('2026-08-17', 'Paso a la Inmortalidad del Gral. José de San Martín', 'feriado', false),
    ('2026-10-12', 'Día del Respeto a la Diversidad Cultural', 'feriado', false),
    ('2026-11-23', 'Día de la Soberanía Nacional', 'feriado', false),
    ('2026-12-08', 'Día de la Inmaculada Concepción de María', 'feriado', false),
    ('2026-12-25', 'Navidad', 'feriado', false)
ON CONFLICT (date) DO UPDATE 
SET 
    name = EXCLUDED.name,
    type = EXCLUDED.type;
