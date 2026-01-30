-- Migration script to add 23 users
-- Uses extensions.crypt for password hashing (requires pgcrypto extension)

DO $$
DECLARE
    u_id uuid;
    users_data JSONB[] := ARRAY[
        -- ADMINS
        '{"name": "HORACIO", "pass": "ACHO", "role_meta": "ADM", "email": "horacio.roldan@dspi.com.ar", "is_admin": true}'::jsonb,
        '{"name": "GUSTAVO", "pass": "OSO", "role_meta": "ADM", "email": "gustavo.pussetto@dspi.com.ar", "is_admin": true}'::jsonb,
        '{"name": "AGUSTIN", "pass": "LOBO", "role_meta": "ADM", "email": "agustin.alberione@dspi.com.ar", "is_admin": true}'::jsonb,
        -- EMPLOYEES
        '{"name": "TORLETTI, Andres", "pass": "DSPI1235", "role_meta": "TT", "email": "andres.torletti@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "BIANCHI, Nicolas", "pass": "Nico41680891", "role_meta": "IVECO", "email": "nicolas.bianchi@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "DIAZ, Guadalupe", "pass": "DSPI1234", "role_meta": "IVECO", "email": "guadalupe.diaz@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "ENCINAS, Gonzalo", "pass": "DSPI2022", "role_meta": "IVECO", "email": "gonzalo.encinas@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "MOTTURA, Gonzalo", "pass": "34792832", "role_meta": "IVECO", "email": "gonzalo.mottura@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "MARTINEZ, Javier", "pass": "428646ljm", "role_meta": "FPT", "email": "javier.martinez@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "ANDRADA, Santiago", "pass": "DSPI1234", "role_meta": "IVECO", "email": "santiago.andrada@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "LOPEZ, Lisandro", "pass": "Iveco2022", "role_meta": "IVECO", "email": "lisandro.lopez@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "FONTEÑEZ, Lucas", "pass": "DSPI1234", "role_meta": "IVECO", "email": "lucas.fonteneez@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "MARTELLOTTO, Lucas", "pass": "Dspi", "role_meta": "IVECO", "email": "lucas.martellotto@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "FAIVRE, Santiago", "pass": "Iveco2022", "role_meta": "IVECO", "email": "santiago.faivre@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "ESPINAL, Ittala", "pass": "Dspi2022", "role_meta": "IVECO", "email": "ittala.espinal@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "SANCHEZ, Sergio", "pass": "Dspi2022", "role_meta": "IFT", "email": "sergio.sanchez@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "DOMINGUEZ, Pablo", "pass": "dspi1234", "role_meta": "TT", "email": "pablo.dominguez@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "BURGESSER, Raul", "pass": "Burgui01", "role_meta": "IVECO", "email": "raul.burgesser@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "RIVAROLA, Fernanda", "pass": "dspi1234", "role_meta": "IVECO", "email": "fernanda.rivarola@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "ARANEGA, Ezequiel", "pass": "732063aa", "role_meta": "IVECO", "email": "ezequiel.aranega@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "BOASSO, Aylen", "pass": "dspi1234", "role_meta": "IVECO", "email": "aylen.boasso@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "PISCIOTTA, Fabricio", "pass": "dspi1234", "role_meta": "IFT", "email": "fabrizio.pisciotta@dspi.com.ar", "is_admin": false}'::jsonb,
        '{"name": "PICCOLI, Francisco", "pass": "Juan2024", "role_meta": "IVECO", "email": "juanfrancisco.piccoli@dspi.com.ar", "is_admin": false}'::jsonb
    ];
    u JSONB;
BEGIN
    FOREACH u IN ARRAY users_data
    LOOP
        -- Insert into auth.users
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
            u->>'email',
            extensions.crypt(u->>'pass', extensions.gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"]}',
            jsonb_build_object('full_name', u->>'name', 'email', u->>'email'),
            now(),
            now(),
            '',
            '',
            '',
            ''
        ) RETURNING id INTO u_id;

        -- Update the profile created by the trigger
        UPDATE public.profiles
        SET 
            role = CASE WHEN (u->>'is_admin')::boolean THEN 'admin'::user_role ELSE 'employee'::user_role END,
            department = u->>'role_meta'
        WHERE id = u_id;

    END LOOP;
END $$;
