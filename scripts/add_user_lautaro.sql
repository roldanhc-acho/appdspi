-- Script SQL para dar de alta o reparar a Lautaro Nari en Supabase
-- Soluciona el error "Database error querying schema" (tokens en NULL y falta de registro en auth.identities)

DO $$
DECLARE
    u_id uuid;
BEGIN
    -- 1. Buscar si el usuario ya existe en auth.users
    SELECT id INTO u_id FROM auth.users WHERE email = 'lautaro.nari@dspi.com.ar';

    IF u_id IS NULL THEN
        -- Generar nuevo UUID
        u_id := gen_random_uuid();

        -- Insertar nuevo usuario con todos los campos de token en '' (evita Scan error / Database error querying schema)
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
            recovery_token,
            email_change_token_new,
            email_change_token_current,
            email_change,
            phone_change,
            phone_change_token,
            reauthentication_token,
            is_sso_user
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            u_id,
            'authenticated',
            'authenticated',
            'lautaro.nari@dspi.com.ar',
            extensions.crypt('DSPI2026', extensions.gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "NARI, Lautaro", "email": "lautaro.nari@dspi.com.ar"}'::jsonb,
            now(),
            now(),
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            false
        );
    ELSE
        -- Si el usuario ya existe, actualizar contraseña a DSPI2026 y limpiar campos NULL
        UPDATE auth.users
        SET 
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            encrypted_password = extensions.crypt('DSPI2026', extensions.gen_salt('bf')),
            raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
            raw_user_meta_data = jsonb_build_object('full_name', 'NARI, Lautaro', 'email', 'lautaro.nari@dspi.com.ar'),
            confirmation_token = COALESCE(confirmation_token, ''),
            recovery_token = COALESCE(recovery_token, ''),
            email_change_token_new = COALESCE(email_change_token_new, ''),
            email_change_token_current = COALESCE(email_change_token_current, ''),
            email_change = COALESCE(email_change, ''),
            phone_change = COALESCE(phone_change, ''),
            phone_change_token = COALESCE(phone_change_token, ''),
            reauthentication_token = COALESCE(reauthentication_token, ''),
            updated_at = now()
        WHERE id = u_id;
    END IF;

    -- 2. Asegurar que exista la identidad en auth.identities para el proveedor 'email'
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = u_id AND provider = 'email') THEN
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            u_id,
            u_id,
            jsonb_build_object('sub', u_id::text, 'email', 'lautaro.nari@dspi.com.ar'),
            'email',
            u_id::text,
            now(),
            now(),
            now()
        );
    ELSE
        UPDATE auth.identities
        SET identity_data = jsonb_build_object('sub', u_id::text, 'email', 'lautaro.nari@dspi.com.ar'),
            updated_at = now()
        WHERE user_id = u_id AND provider = 'email';
    END IF;

    -- 3. Crear o actualizar perfil en public.profiles
    INSERT INTO public.profiles (id, full_name, email, role, is_active)
    VALUES (u_id, 'NARI, Lautaro', 'lautaro.nari@dspi.com.ar', 'employee', true)
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        is_active = true;

    -- 4. Prevenir el error en cualquier otro usuario que tenga columnas NULL
    UPDATE auth.users
    SET 
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        email_change = COALESCE(email_change, ''),
        phone_change = COALESCE(phone_change, ''),
        phone_change_token = COALESCE(phone_change_token, ''),
        reauthentication_token = COALESCE(reauthentication_token, '')
    WHERE 
        confirmation_token IS NULL OR
        recovery_token IS NULL OR
        email_change_token_new IS NULL OR
        email_change_token_current IS NULL OR
        email_change IS NULL OR
        phone_change IS NULL OR
        phone_change_token IS NULL OR
        reauthentication_token IS NULL;

END $$;
