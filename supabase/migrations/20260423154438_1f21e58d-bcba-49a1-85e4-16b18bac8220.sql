CREATE TABLE public.barcode_scan_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  user_email text NOT NULL DEFAULT '',
  code text NOT NULL,
  format text NOT NULL DEFAULT '',
  product_id uuid,
  product_name text NOT NULL DEFAULT '',
  matched boolean NOT NULL DEFAULT false,
  context text NOT NULL DEFAULT 'pdv',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.barcode_scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view barcode scan logs"
ON public.barcode_scan_logs
FOR SELECT
USING ((owner_id = auth.uid()) OR (owner_id = public.get_effective_user_id(auth.uid())));

CREATE POLICY "Users can insert barcode scan logs"
ON public.barcode_scan_logs
FOR INSERT
WITH CHECK (owner_id = public.get_effective_user_id(auth.uid()) AND user_id = auth.uid());

CREATE INDEX idx_barcode_scan_logs_owner_created
ON public.barcode_scan_logs (owner_id, created_at DESC);