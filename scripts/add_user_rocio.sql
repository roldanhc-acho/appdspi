-- Script SQL para dar de alta a Rocio Crego en Supabase con email autoconfirmado

DO $$
DECLARE
    u_id uuid;
BEGIN
    -- Buscar si el usuario ya existe en auth.users
    SELECT id INTO u_id FROM auth.users WHERE email = 'rocio.crego@dspi.com.ar';

    IF u_id IS NULL THEN
        -- Insertar nuevo usuario con email_confirmed_at activado (sin requerir confirmación)
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change_token_current,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'rocio.crego@dspi.com.ar',
            extensions.crypt('DSPI2026', extensions.gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"]}',
            '{"full_name": "ROCIO CREGO", "email": "rocio.crego@dspi.com.ar"}'::jsonb,
            now(),
            now(),
            '',
            '',
            '',
            ''
        ) RETURNING id INTO u_id;
    ELSE
        -- Si el usuario ya fue creado por signUp, confirmar email y asegurar password
        UPDATE auth.users
        SET 
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            encrypted_password = extensions.crypt('DSPI2026', extensions.gen_salt('bf')),
            raw_user_meta_data = jsonb_build_object('full_name', 'ROCIO CREGO', 'email', 'rocio.crego@dspi.com.ar')
        WHERE id = u_id;
    END IF;

    -- Crear o actualizar perfil en public.profiles
    INSERT INTO public.profiles (id, full_name, email, role, is_active)
    VALUES (u_id, 'ROCIO CREGO', 'rocio.crego@dspi.com.ar', 'employee', true)
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        is_active = true;

END $$;
