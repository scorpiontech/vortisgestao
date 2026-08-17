CREATE TABLE IF NOT EXISTS public.asaas_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text,
  payment_id text,
  payload jsonb,
  status text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_webhook_logs TO authenticated;
GRANT ALL ON public.asaas_webhook_logs TO service_role;
GRANT SELECT ON public.asaas_webhook_logs TO anon;

ALTER TABLE public.asaas_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on asaas_webhook_logs"
ON public.asaas_webhook_logs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));