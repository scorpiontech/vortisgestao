DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('master', 'gerente', 'vendedor', 'caixa');
    END IF;
END $$;

-- Atualiza a coluna role na tabela company_members para usar o novo enum
ALTER TABLE public.company_members ALTER COLUMN role TYPE text;
DROP TYPE IF EXISTS public.company_role_old CASCADE;

GRANT SELECT, UPDATE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;
