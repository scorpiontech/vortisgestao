CREATE TABLE public.user_presence (
  user_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  user_email text NOT NULL DEFAULT '',
  ip_address text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  device text NOT NULL DEFAULT '',
  online boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view presence" ON public.user_presence FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_session_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  user_email text NOT NULL DEFAULT '',
  session_key text NOT NULL,
  ip_address text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  device text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE (user_id, session_key)
);
CREATE INDEX idx_user_session_logs_owner ON public.user_session_logs(owner_id, started_at DESC);
GRANT SELECT ON public.user_session_logs TO authenticated;
GRANT ALL ON public.user_session_logs TO service_role;
ALTER TABLE public.user_session_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view sessions" ON public.user_session_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));