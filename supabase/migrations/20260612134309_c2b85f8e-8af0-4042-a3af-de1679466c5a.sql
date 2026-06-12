
-- Quotes (orçamentos / pré-venda)
CREATE TYPE public.quote_status AS ENUM ('rascunho','enviado','aprovado','recusado','expirado','convertido');

CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  status public.quote_status NOT NULL DEFAULT 'rascunho',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  installments INTEGER NOT NULL DEFAULT 1,
  valid_until DATE,
  notes TEXT,
  negotiation_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  converted_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quotes" ON public.quotes
  FOR SELECT USING (user_id = public.get_effective_user_id(auth.uid()));
CREATE POLICY "Users can insert own quotes" ON public.quotes
  FOR INSERT WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));
CREATE POLICY "Users can update own quotes" ON public.quotes
  FOR UPDATE USING (user_id = public.get_effective_user_id(auth.uid()))
  WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));
CREATE POLICY "Users can delete own quotes" ON public.quotes
  FOR DELETE USING (user_id = public.get_effective_user_id(auth.uid()));

CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quote items" ON public.quote_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND q.user_id = public.get_effective_user_id(auth.uid())
  ));
CREATE POLICY "Users can insert own quote items" ON public.quote_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND q.user_id = public.get_effective_user_id(auth.uid())
  ));
CREATE POLICY "Users can update own quote items" ON public.quote_items
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND q.user_id = public.get_effective_user_id(auth.uid())
  ));
CREATE POLICY "Users can delete own quote items" ON public.quote_items
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND q.user_id = public.get_effective_user_id(auth.uid())
  ));

CREATE INDEX idx_quotes_user_status ON public.quotes(user_id, status);
CREATE INDEX idx_quote_items_quote ON public.quote_items(quote_id);
