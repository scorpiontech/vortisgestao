CREATE OR REPLACE FUNCTION public.get_effective_user_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(
    (SELECT owner_id FROM public.company_members
       WHERE user_id = _user_id AND active = true
       LIMIT 1),
    _user_id
  );
$function$;

-- Prevent auto-creating a client_accounts row for anyone added as company_members (any role)
CREATE OR REPLACE FUNCTION public.handle_new_client_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'admin') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_members WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.client_accounts (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$function$;

-- Cleanup: remove any client_accounts belonging to users that are already sub-members
DELETE FROM public.client_accounts ca
USING public.company_members cm
WHERE cm.user_id = ca.user_id AND cm.active = true;