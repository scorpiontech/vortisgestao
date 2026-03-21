
-- Service orders table
CREATE TABLE public.service_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  service_type TEXT NOT NULL DEFAULT '',
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  problem_description TEXT NOT NULL DEFAULT '',
  resolution_description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'aberta',
  budget_total NUMERIC NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Materials used in a service order
CREATE TABLE public.service_order_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0
);

-- RLS for service_orders
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own service orders" ON public.service_orders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own service orders" ON public.service_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own service orders" ON public.service_orders
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own service orders" ON public.service_orders
  FOR DELETE USING (auth.uid() = user_id);

-- RLS for service_order_materials
ALTER TABLE public.service_order_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own service order materials" ON public.service_order_materials
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.service_orders WHERE id = service_order_materials.service_order_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert own service order materials" ON public.service_order_materials
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.service_orders WHERE id = service_order_materials.service_order_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own service order materials" ON public.service_order_materials
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.service_orders WHERE id = service_order_materials.service_order_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own service order materials" ON public.service_order_materials
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.service_orders WHERE id = service_order_materials.service_order_id AND user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
