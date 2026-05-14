CREATE TABLE public.invoice_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid,
  client_name text NOT NULL DEFAULT '',
  reference_month text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'error',
  error_message text NOT NULL DEFAULT '',
  error_details jsonb DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'auto',
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invoice generation logs"
  ON public.invoice_generation_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update invoice generation logs"
  ON public.invoice_generation_logs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete invoice generation logs"
  ON public.invoice_generation_logs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_invoice_gen_logs_created ON public.invoice_generation_logs(created_at DESC);
CREATE INDEX idx_invoice_gen_logs_ack ON public.invoice_generation_logs(acknowledged, created_at DESC);