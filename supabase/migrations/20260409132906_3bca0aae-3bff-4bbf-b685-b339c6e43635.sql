
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  user_email TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity TEXT NOT NULL DEFAULT '',
  entity_id TEXT DEFAULT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_logs_owner_id ON public.audit_logs(owner_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Owner can view all logs for their company
CREATE POLICY "Owners can view audit logs"
ON public.audit_logs FOR SELECT
USING (owner_id = auth.uid() OR (owner_id = public.get_effective_user_id(auth.uid())));

-- Any authenticated user can insert logs
CREATE POLICY "Users can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (owner_id = public.get_effective_user_id(auth.uid()));
