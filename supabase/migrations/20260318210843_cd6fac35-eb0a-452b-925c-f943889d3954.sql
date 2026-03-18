
-- Add supplier_id to products
ALTER TABLE public.products ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- Create cash_registers table
CREATE TABLE public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opened_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone,
  opening_amount numeric NOT NULL DEFAULT 0,
  closing_amount numeric,
  expected_amount numeric,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cash registers" ON public.cash_registers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cash registers" ON public.cash_registers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cash registers" ON public.cash_registers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cash registers" ON public.cash_registers FOR DELETE USING (auth.uid() = user_id);
