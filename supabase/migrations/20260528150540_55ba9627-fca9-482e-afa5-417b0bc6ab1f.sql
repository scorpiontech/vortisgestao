
-- 1) Hardening: recreate SECURITY DEFINER functions with explicit search_path including pg_temp
CREATE OR REPLACE FUNCTION public.get_effective_user_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.company_members WHERE user_id = _user_id AND role = 'vendedor' AND active = true),
    _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_client_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT blocked FROM public.client_accounts
      WHERE user_id = (SELECT public.get_effective_user_id(_user_id))
      LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_member_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.company_members WHERE user_id = _user_id AND active = true),
    'master'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Re-revoke from anon/public after CREATE OR REPLACE (which resets grants only on first create)
REVOKE EXECUTE ON FUNCTION public.get_effective_user_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_client_blocked(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_member_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_user_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_client_blocked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 2) Quota table
CREATE TABLE IF NOT EXISTS public.fiscal_quota_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  year_month text NOT NULL,
  authorized_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, year_month)
);

GRANT SELECT ON public.fiscal_quota_usage TO authenticated;
GRANT ALL ON public.fiscal_quota_usage TO service_role;

ALTER TABLE public.fiscal_quota_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own fiscal quota"
ON public.fiscal_quota_usage
FOR SELECT
USING (owner_id = auth.uid());

CREATE TRIGGER update_fiscal_quota_usage_updated_at
BEFORE UPDATE ON public.fiscal_quota_usage
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) check_nfce_quota function
CREATE OR REPLACE FUNCTION public.check_nfce_quota(_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _quota integer;
  _used integer;
  _ym text := to_char(now(), 'YYYY-MM');
BEGIN
  SELECT sp.nfe_quota
    INTO _quota
    FROM public.client_accounts ca
    LEFT JOIN public.subscription_plans sp ON sp.id = ca.plan_id
    WHERE ca.user_id = _owner_id
    LIMIT 1;

  SELECT COALESCE(authorized_count, 0)
    INTO _used
    FROM public.fiscal_quota_usage
    WHERE owner_id = _owner_id AND year_month = _ym;
  _used := COALESCE(_used, 0);

  IF _quota IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true, 'used', _used, 'quota', null, 'remaining', null, 'unlimited', true, 'year_month', _ym
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', _used < _quota,
    'used', _used,
    'quota', _quota,
    'remaining', GREATEST(_quota - _used, 0),
    'unlimited', false,
    'year_month', _ym
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_nfce_quota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_nfce_quota(uuid) TO authenticated;

-- 4) Metadata on invoices (for upgrade target_plan_id)
ALTER TABLE public.subscription_invoices
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
