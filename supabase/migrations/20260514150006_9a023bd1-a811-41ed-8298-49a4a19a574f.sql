
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'basico',
  ADD COLUMN IF NOT EXISTS nfe_quota integer,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_tier ON public.subscription_plans(tier);
