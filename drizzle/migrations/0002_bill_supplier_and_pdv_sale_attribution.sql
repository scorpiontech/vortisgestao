ALTER TABLE public.bills ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN attendant_id uuid, ADD COLUMN cash_register_id uuid REFERENCES public.cash_registers(id) ON DELETE SET NULL;
ALTER TABLE public.customer_charges ADD COLUMN cash_register_id uuid REFERENCES public.cash_registers(id) ON DELETE SET NULL;
CREATE INDEX sales_cash_register_idx ON public.sales(cash_register_id);
CREATE INDEX bills_supplier_idx ON public.bills(supplier_id);
CREATE OR REPLACE FUNCTION public.validate_bill_supplier() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id=NEW.supplier_id AND user_id=NEW.user_id) THEN
 RAISE EXCEPTION 'Fornecedor não pertence à empresa'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_bill_supplier BEFORE INSERT OR UPDATE OF supplier_id,user_id ON public.bills FOR EACH ROW EXECUTE FUNCTION public.validate_bill_supplier();
CREATE OR REPLACE FUNCTION public.capture_pdv_attribution() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid; tenant uuid;
BEGIN
 IF TG_TABLE_NAME='sales' THEN
  actor := coalesce(auth.uid(),NEW.attendant_id);
  tenant := NEW.user_id;
  NEW.attendant_id := actor;
 ELSE
  IF NEW.source <> 'pdv' THEN RETURN NEW; END IF;
  actor := coalesce(auth.uid(),NEW.created_by);
  tenant := NEW.owner_id;
  NEW.created_by := actor;
 END IF;
 IF actor IS NOT NULL AND public.get_effective_user_id(actor) IS DISTINCT FROM tenant THEN
  RAISE EXCEPTION 'Atendente não pertence à empresa';
 END IF;
 IF NEW.cash_register_id IS NULL AND actor IS NOT NULL THEN
  SELECT id INTO NEW.cash_register_id FROM public.cash_registers
  WHERE user_id=actor AND status='open' ORDER BY opened_at DESC LIMIT 1;
 END IF;
 IF NEW.cash_register_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.cash_registers WHERE id=NEW.cash_register_id AND user_id=actor
 ) THEN RAISE EXCEPTION 'Caixa não pertence ao atendente'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER capture_sale_attribution BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.capture_pdv_attribution();
CREATE TRIGGER capture_charge_attribution BEFORE INSERT ON public.customer_charges FOR EACH ROW EXECUTE FUNCTION public.capture_pdv_attribution();
UPDATE public.sales s SET attendant_id=c.created_by FROM public.customer_charges c WHERE c.sale_id=s.id AND c.source='pdv' AND c.owner_id=s.user_id AND c.created_by IS NOT NULL;