-- Actualización para Facundo Bepre (Jornada reducida de 6 horas)

-- 1. Actualizar la solicitud de estudio del 14/09/2026 a 6 horas
UPDATE absences
SET hours = 6
WHERE user_id IN (
    SELECT id FROM profiles WHERE full_name ILIKE '%FACUNDO%BEPRE%'
)
AND start_date = '2026-09-14';

-- 2. Configurar la jornada laboral habitual a 6 horas en su perfil para futuras solicitudes y cálculos
UPDATE profiles
SET daily_hours = 6
WHERE full_name ILIKE '%FACUNDO%BEPRE%';
