-- Garante que o trigger handle_new_client_account use o plano 'free' com valor 0.00 por padrão
CREATE OR REPLACE FUNCTION public.handle_new_client_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  free_plan_id UUID;
BEGIN
  -- Ignorar admins
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'admin') THEN
    
    -- Busca o plano 'free' ou 'gratuito'
    SELECT id INTO free_plan_id 
    FROM public.subscription_plans 
    WHERE tier = 'free' OR lower(name) LIKE '%free%' OR lower(name) LIKE '%gratuito%'
    LIMIT 1;

    INSERT INTO public.client_accounts (
      user_id, 
      name, 
      email, 
      plan_id, 
      plan, 
      monthly_value, 
      status, 
      billing_type
    )
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), 
      NEW.email,
      free_plan_id,
      'Plano Free',
      0.00,
      'ativo',
      'avulsa'
    );
  END IF;
  RETURN NEW;
END;
$$;