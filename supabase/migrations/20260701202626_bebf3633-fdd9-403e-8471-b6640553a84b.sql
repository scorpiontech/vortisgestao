
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('entrada','saida','ajuste')),
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  reference text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stock_movements_user_idx ON public.stock_movements(user_id, created_at DESC);
CREATE INDEX stock_movements_product_idx ON public.stock_movements(product_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own stock movements"
  ON public.stock_movements FOR SELECT
  USING (user_id = public.get_effective_user_id(auth.uid()));

CREATE POLICY "Users insert own stock movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));

CREATE POLICY "Users update own stock movements"
  ON public.stock_movements FOR UPDATE
  USING (user_id = public.get_effective_user_id(auth.uid()));

CREATE POLICY "Users delete own stock movements"
  ON public.stock_movements FOR DELETE
  USING (user_id = public.get_effective_user_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta numeric := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := CASE NEW.type
      WHEN 'entrada' THEN NEW.quantity
      WHEN 'saida'   THEN -NEW.quantity
      WHEN 'ajuste'  THEN NEW.quantity
    END;
    UPDATE public.products SET stock = stock + delta, updated_at = now() WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    delta := CASE OLD.type
      WHEN 'entrada' THEN -OLD.quantity
      WHEN 'saida'   THEN OLD.quantity
      WHEN 'ajuste'  THEN -OLD.quantity
    END;
    UPDATE public.products SET stock = stock + delta, updated_at = now() WHERE id = OLD.product_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- reverter antigo
    delta := CASE OLD.type
      WHEN 'entrada' THEN -OLD.quantity
      WHEN 'saida'   THEN OLD.quantity
      WHEN 'ajuste'  THEN -OLD.quantity
    END;
    UPDATE public.products SET stock = stock + delta, updated_at = now() WHERE id = OLD.product_id;
    -- aplicar novo
    delta := CASE NEW.type
      WHEN 'entrada' THEN NEW.quantity
      WHEN 'saida'   THEN -NEW.quantity
      WHEN 'ajuste'  THEN NEW.quantity
    END;
    UPDATE public.products SET stock = stock + delta, updated_at = now() WHERE id = NEW.product_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_apply_stock_movement
AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();
