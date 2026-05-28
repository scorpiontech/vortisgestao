
-- Tabela de configurações fiscais (1 por owner)
CREATE TABLE public.fiscal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  cnpj text NOT NULL DEFAULT '',
  ie text NOT NULL DEFAULT '',
  regime_tributario text NOT NULL DEFAULT 'simples_nacional',
  csc_id text NOT NULL DEFAULT '',
  csc_token text NOT NULL DEFAULT '',
  certificate_path text NOT NULL DEFAULT '',
  certificate_filename text NOT NULL DEFAULT '',
  certificate_password_encrypted text NOT NULL DEFAULT '',
  certificate_subject text NOT NULL DEFAULT '',
  certificate_expires_at timestamptz,
  certificate_valid boolean NOT NULL DEFAULT false,
  cfop_default text NOT NULL DEFAULT '5102',
  csosn_default text NOT NULL DEFAULT '102',
  ambiente text NOT NULL DEFAULT 'homologacao',
  provider text NOT NULL DEFAULT 'focusnfe',
  provider_token text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_settings TO authenticated;
GRANT ALL ON public.fiscal_settings TO service_role;

ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own fiscal settings" ON public.fiscal_settings
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Owners insert own fiscal settings" ON public.fiscal_settings
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update own fiscal settings" ON public.fiscal_settings
  FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owners delete own fiscal settings" ON public.fiscal_settings
  FOR DELETE USING (owner_id = auth.uid());

CREATE TRIGGER trg_fiscal_settings_updated_at
  BEFORE UPDATE ON public.fiscal_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para certificados A1
INSERT INTO storage.buckets (id, name, public)
VALUES ('fiscal-certificates', 'fiscal-certificates', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Owners read own fiscal certs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fiscal-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners upload own fiscal certs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fiscal-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners update own fiscal certs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fiscal-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners delete own fiscal certs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fiscal-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Desconto em ordens de serviço (aplicado no momento do pagamento)
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;
