
-- Trigger to auto-create client_account on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_client_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create account if user is not an admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'admin') THEN
    INSERT INTO public.client_accounts (user_id, name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_client_account
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_client_account();
