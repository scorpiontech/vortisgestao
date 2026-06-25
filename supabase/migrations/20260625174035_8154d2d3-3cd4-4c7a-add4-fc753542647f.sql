
-- 1. Novos planos Free e Pro
INSERT INTO public.subscription_plans (name, description, monthly_value, tier, nfe_quota, features, active)
VALUES
  ('Free', 'Gestão completa sem emissão fiscal', 0, 'free', 0,
   '{"nfce": false, "modules": ["clientes","estoque","financeiro","ordens_servico","relatorios","pdv"]}'::jsonb, true),
  ('Pro', 'Tudo do Free + emissão de NFC-e ilimitada', 79.90, 'pro', NULL,
   '{"nfce": true, "modules": ["clientes","estoque","financeiro","ordens_servico","relatorios","pdv","nfce"]}'::jsonb, true);

-- 2. Desativa planos antigos (mantém para histórico)
UPDATE public.subscription_plans
SET active = false
WHERE tier IN ('basico','pro_6','pro_12','pro_20','pro_custom')
  AND name IN ('Plano Lite','Plano Top','Plano Premium','Pro 6','Pro 12','Pro 20');

-- 3. Marca features=nfce nos planos antigos pro_* para clientes que já pagam continuarem emitindo
UPDATE public.subscription_plans
SET features = features || '{"nfce": true}'::jsonb
WHERE tier IN ('pro_6','pro_12','pro_20','pro_custom');

UPDATE public.subscription_plans
SET features = features || '{"nfce": false}'::jsonb
WHERE tier = 'basico';

-- 4. Tabela nfce_documents
CREATE TABLE public.nfce_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  created_by uuid,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_ref text,
  status text NOT NULL DEFAULT 'pending',
  numero text,
  serie text,
  chave text,
  protocolo text,
  ambiente text NOT NULL DEFAULT 'homologacao',
  xml_url text,
  danfce_url text,
  qrcode_url text,
  qrcode_data text,
  motivo_rejeicao text,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  customer_doc text,
  customer_name text,
  payload_request jsonb,
  payload_response jsonb,
  emitted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nfce_status_chk CHECK (status IN ('pending','processing','authorized','rejected','cancelled','contingency','error'))
);

CREATE INDEX idx_nfce_documents_owner ON public.nfce_documents(owner_id, created_at DESC);
CREATE INDEX idx_nfce_documents_sale ON public.nfce_documents(sale_id);
CREATE INDEX idx_nfce_documents_status ON public.nfce_documents(owner_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfce_documents TO authenticated;
GRANT ALL ON public.nfce_documents TO service_role;

ALTER TABLE public.nfce_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner & members read nfce"
  ON public.nfce_documents FOR SELECT TO authenticated
  USING (owner_id = public.get_effective_user_id(auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Owner & members insert nfce"
  ON public.nfce_documents FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.get_effective_user_id(auth.uid()));

CREATE POLICY "Owner & members update nfce"
  ON public.nfce_documents FOR UPDATE TO authenticated
  USING (owner_id = public.get_effective_user_id(auth.uid()))
  WITH CHECK (owner_id = public.get_effective_user_id(auth.uid()));

CREATE POLICY "Admin manage nfce"
  ON public.nfce_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER nfce_documents_updated_at
  BEFORE UPDATE ON public.nfce_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Função helper: checa se o owner pode emitir NFC-e baseado no plano
CREATE OR REPLACE FUNCTION public.can_emit_nfce(_owner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT (sp.features->>'nfce')::boolean
       FROM public.client_accounts ca
       JOIN public.subscription_plans sp ON sp.id = ca.plan_id
      WHERE ca.user_id = _owner_id
      LIMIT 1),
    false
  );
$$;
