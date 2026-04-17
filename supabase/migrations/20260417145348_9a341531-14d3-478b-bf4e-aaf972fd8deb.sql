-- Tabela de planos de assinatura
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  monthly_value NUMERIC NOT NULL DEFAULT 0,
  mp_plan_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage plans" ON public.subscription_plans FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated can view active plans" ON public.subscription_plans FOR SELECT
  USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar colunas em client_accounts
ALTER TABLE public.client_accounts
  ADD COLUMN plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN billing_type TEXT NOT NULL DEFAULT 'avulsa',
  ADD COLUMN due_day INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN mp_subscription_id TEXT,
  ADD COLUMN blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN blocked_at TIMESTAMPTZ,
  ADD COLUMN tolerance_days INTEGER NOT NULL DEFAULT 15;

-- Tabela de faturas
CREATE TABLE public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  mp_payment_id TEXT,
  mp_preference_id TEXT,
  payment_link TEXT,
  paid_at TIMESTAMPTZ,
  reference_month TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invoices" ON public.subscription_invoices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients view own invoices" ON public.subscription_invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.client_accounts ca
    WHERE ca.id = subscription_invoices.client_account_id
      AND ca.user_id = auth.uid()
  ));

CREATE TRIGGER subscription_invoices_updated_at
  BEFORE UPDATE ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_subscription_invoices_client ON public.subscription_invoices(client_account_id);
CREATE INDEX idx_subscription_invoices_status ON public.subscription_invoices(status);
CREATE INDEX idx_subscription_invoices_mp_payment ON public.subscription_invoices(mp_payment_id);
CREATE INDEX idx_subscription_invoices_due ON public.subscription_invoices(due_date);

-- Função helper: verifica se conta do cliente está bloqueada
CREATE OR REPLACE FUNCTION public.is_client_blocked(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT blocked FROM public.client_accounts
      WHERE user_id = (SELECT get_effective_user_id(_user_id))
      LIMIT 1),
    false
  );
$$;