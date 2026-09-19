CREATE TABLE public.sale_cancellations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  sale_id uuid NOT NULL,
  cancelled_by uuid,
  cancelled_by_name text NOT NULL DEFAULT '',
  cancelled_by_email text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  payment_method text NOT NULL DEFAULT '',
  sale_date timestamp with time zone,
  sale_total numeric NOT NULL DEFAULT 0,
  sale_discount numeric NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  stock_returned_qty numeric NOT NULL DEFAULT 0,
  cash_reverted numeric NOT NULL DEFAULT 0,
  transactions_removed integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sale_cancellations TO authenticated;
GRANT ALL ON public.sale_cancellations TO service_role;

ALTER TABLE public.sale_cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company can view sale cancellations"
ON public.sale_cancellations FOR SELECT TO authenticated
USING (owner_id = public.get_effective_user_id(auth.uid()));

CREATE POLICY "Company can insert sale cancellations"
ON public.sale_cancellations FOR INSERT TO authenticated
WITH CHECK (owner_id = public.get_effective_user_id(auth.uid()));

CREATE INDEX idx_sale_cancellations_owner_created ON public.sale_cancellations (owner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _reason text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_owner uuid;
  v_sale  public.sales;
  v_item  public.sale_items;
  v_items jsonb := '[]'::jsonb;
  v_qty numeric := 0;
  v_cash numeric := 0;
  v_tx_count integer := 0;
  v_name text := '';
  v_email text := '';
begin
  v_owner := public.get_effective_user_id(auth.uid());
  if v_owner is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_sale from public.sales where id = _sale_id and user_id = v_owner;
  if v_sale.id is null then
    raise exception 'Venda não encontrada';
  end if;

  select coalesce(cm.name, p.display_name, ''), coalesce(cm.email, '')
    into v_name, v_email
    from public.profiles p
    left join public.company_members cm on cm.user_id = auth.uid() and cm.active = true
   where p.user_id = auth.uid()
   limit 1;

  -- devolve o estoque dos itens e registra o que foi afetado
  for v_item in select * from public.sale_items where sale_id = _sale_id loop
    if v_item.product_id is not null then
      update public.products
         set stock = stock + v_item.quantity
       where id = v_item.product_id and user_id = v_owner;
      v_qty := v_qty + v_item.quantity;
    end if;
    v_items := v_items || jsonb_build_object(
      'product_id', v_item.product_id,
      'product_name', v_item.product_name,
      'quantity', v_item.quantity,
      'unit_price', v_item.unit_price,
      'total', v_item.total,
      'stock_returned', case when v_item.product_id is not null then v_item.quantity else 0 end
    );
  end loop;

  -- remove o lançamento de entrada no caixa/financeiro
  select coalesce(sum(amount), 0), count(*)
    into v_cash, v_tx_count
    from public.transactions
   where user_id = v_owner
     and type = 'entrada'
     and description like 'Venda%' || substr(_sale_id::text, 1, 8) || '%';

  delete from public.transactions
   where user_id = v_owner
     and type = 'entrada'
     and description like 'Venda%' || substr(_sale_id::text, 1, 8) || '%';

  -- desvincula cobranças e origens
  update public.customer_charges
     set sale_id = null, finalized_at = null
   where sale_id = _sale_id and owner_id = v_owner;

  update public.quotes
     set status = 'aprovado', converted_sale_id = null
   where converted_sale_id = _sale_id and user_id = v_owner;

  insert into public.sale_cancellations (
    owner_id, sale_id, cancelled_by, cancelled_by_name, cancelled_by_email, reason,
    customer_name, payment_method, sale_date, sale_total, sale_discount,
    items, stock_returned_qty, cash_reverted, transactions_removed
  ) values (
    v_owner, _sale_id, auth.uid(), coalesce(v_name, ''), coalesce(v_email, ''), coalesce(_reason, ''),
    coalesce(v_sale.customer_name, ''), coalesce(v_sale.payment_method, ''), v_sale.date,
    coalesce(v_sale.total, 0), coalesce(v_sale.discount, 0),
    v_items, v_qty, v_cash, v_tx_count
  );

  delete from public.sale_items where sale_id = _sale_id;
  delete from public.sales where id = _sale_id and user_id = v_owner;

  return jsonb_build_object(
    'ok', true,
    'sale_id', _sale_id,
    'total', v_sale.total,
    'items', v_items,
    'stock_returned_qty', v_qty,
    'cash_reverted', v_cash,
    'reason', coalesce(_reason, '')
  );
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.cancel_sale(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text) TO authenticated;