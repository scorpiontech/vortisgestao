CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL, -- 'pdv', 'financeiro', 'info', etc.
    read boolean DEFAULT false,
    link text,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (owner_id = (SELECT owner_id FROM public.company_members WHERE user_id = auth.uid() LIMIT 1) OR owner_id = auth.uid());

CREATE POLICY "Service role can manage notifications"
ON public.notifications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
