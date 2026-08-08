ALTER TABLE public.subscription_invoices ADD COLUMN IF NOT EXISTS asaas_id text;
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_asaas_id ON public.subscription_invoices(asaas_id);
GRANT ALL ON public.subscription_invoices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_invoices TO authenticated;
