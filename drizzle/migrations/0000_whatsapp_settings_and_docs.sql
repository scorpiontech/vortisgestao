CREATE TABLE public.company_settings (
  owner_id uuid PRIMARY KEY,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company read settings" ON public.company_settings FOR SELECT TO authenticated
  USING (owner_id = public.get_effective_user_id(auth.uid()));
CREATE POLICY "company insert settings" ON public.company_settings FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.get_effective_user_id(auth.uid()));
CREATE POLICY "company update settings" ON public.company_settings FOR UPDATE TO authenticated
  USING (owner_id = public.get_effective_user_id(auth.uid()));

CREATE POLICY "company upload shared docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shared-docs' AND (storage.foldername(name))[1] = public.get_effective_user_id(auth.uid())::text);
CREATE POLICY "company read shared docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shared-docs' AND (storage.foldername(name))[1] = public.get_effective_user_id(auth.uid())::text);
CREATE POLICY "company update shared docs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shared-docs' AND (storage.foldername(name))[1] = public.get_effective_user_id(auth.uid())::text);