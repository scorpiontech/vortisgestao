-- ========= Configurações Asaas (por empresa) =========
CREATE TABLE public.asaas_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  api_key text NOT NULL DEFAULT '',
  ambiente text NOT NULL DEFAULT 'sandbox',
  webhook_token text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  boleto_days integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_settings TO authenticated;
GRANT ALL ON public.asaas_settings TO service_role;
ALTER TABLE public.asaas_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner tenant can view asaas settings"
  ON public.asaas_settings FOR SELECT TO authenticated
  USING (owner_id = public.get_effective_user_id(auth.uid()));
CREATE POLICY "Owner tenant can insert asaas settings"
  ON public.asaas_settings FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.get_effective_user_id(auth.uid()) AND public.get_member_role(auth.uid()) = 'master');
CREATE POLICY "Owner tenant can update asaas settings"
  ON public.asaas_settings FOR UPDATE TO authenticated
  USING (owner_id = public.get_effective_user_id(auth.uid()) AND public.get_member_role(auth.uid()) = 'master');
CREATE POLICY "Owner tenant can delete asaas settings"
  ON public.asaas_settings FOR DELETE TO authenticated
  USING (owner_id = public.get_effective_user_id(auth.uid()) AND public.get_member_role(auth.uid()) = 'master');

CREATE TRIGGER trg_asaas_settings_updated_at
  BEFORE UPDATE ON public.asaas_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========= Cobranças de clientes =========
CREATE TABLE public.customer_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  created_by uuid,
  provider text NOT NULL DEFAULT 'asaas',
  source text NOT NULL DEFAULT 'manual', -- manual | pdv | bill
  source_id text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  customer_document text NOT NULL DEFAULT '',
  customer_email text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  asaas_customer_id text,
  asaas_installment_id text,
  description text NOT NULL DEFAULT '',
  billing_type text NOT NULL DEFAULT 'BOLETO', -- BOLETO | PIX
  total_amount numeric NOT NULL DEFAULT 0,
  installment_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending', -- pending | partially_paid | paid | overdue | cancelled
  ambiente text NOT NULL DEFAULT 'sandbox',
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  discount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT '',
  finalized_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_charges TO authenticated;
GRANT ALL ON public.customer_charges TO service_role;
ALTER TABLE public.customer_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view charges"
  ON public.customer_charges FOR SELECT TO authenticated
  USING (owner_id = public.get_effective_user_id(auth.uid()));
CREATE POLICY "Tenant can insert charges"
  ON public.customer_charges FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.get_effective_user_id(auth.uid()));
CREATE POLICY "Tenant can update charges"
  ON public.customer_charges FOR UPDATE TO authenticated
  USING (owner_id = public.get_effective_user_id(auth.uid()));
CREATE POLICY "Master can delete charges"
  ON public.customer_charges FOR DELETE TO authenticated
  USING (owner_id = public.get_effective_user_id(auth.uid()) AND public.get_member_role(auth.uid()) = 'master');

CREATE TRIGGER trg_customer_charges_updated_at
  BEFORE UPDATE ON public.customer_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_customer_charges_owner ON public.customer_charges(owner_id, created_at DESC);

-- ========= Parcelas das cobranças =========
CREATE TABLE public.customer_charge_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid NOT NULL REFERENCES public.customer_charges(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  installment_number integer NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  asaas_payment_id text,
  invoice_url text,
  bank_slip_url text,
  barcode text,
  pix_payload text,
  pix_qrcode_image text,
  bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_charge_installments TO authenticated;
GRANT ALL ON public.customer_charge_installments TO service_role;
ALTER TABLE public.customer_charge_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view charge installments"
  ON public.customer_charge_installments FOR SELECT TO authenticated
  USING (owner_id = public.get_effective_user_id(auth.uid()));
CREATE POLICY "Tenant can insert charge installments"
  ON public.customer_charge_installments FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.get_effective_user_id(auth.uid()));
CREATE POLICY "Tenant can update charge installments"
  ON public.customer_charge_installments FOR UPDATE TO authenticated
  USING (owner_id = public.get_effective_user_id(auth.uid()));
CREATE POLICY "Master can delete charge installments"
  ON public.customer_charge_installments FOR DELETE TO authenticated
  USING (owner_id = public.get_effective_user_id(auth.uid()) AND public.get_member_role(auth.uid()) = 'master');

CREATE TRIGGER trg_charge_installments_updated_at
  BEFORE UPDATE ON public.customer_charge_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX idx_charge_inst_payment ON public.customer_charge_installments(asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;
CREATE INDEX idx_charge_inst_charge ON public.customer_charge_installments(charge_id, installment_number);

-- ========= Vincular cobrança em contas a receber =========
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS charge_id uuid REFERENCES public.customer_charges(id) ON DELETE SET NULL;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;