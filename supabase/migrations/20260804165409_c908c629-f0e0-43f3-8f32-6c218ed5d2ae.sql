
-- Trigger to auto-create client_account on new user signup
-- Updated to point to 'free' tier by default
CREATE OR REPLACE FUNCTION public.handle_new_client_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  free_plan_id UUID;
BEGIN
  -- Only create account if user is not an admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'admin') THEN
    
    -- Try to find the 'free' plan ID
    SELECT id INTO free_plan_id FROM public.subscription_plans WHERE tier = 'free' LIMIT 1;

    INSERT INTO public.client_accounts (user_id, name, email, plan_id, plan)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), 
      NEW.email,
      free_plan_id,
      'Gratuito'
    );
  END IF;
  RETURN NEW;
END;
$$;
