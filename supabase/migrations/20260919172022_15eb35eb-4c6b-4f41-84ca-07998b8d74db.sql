create or replace function public.cancel_sale(_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_sale  public.sales;
  v_item  public.sale_items;
begin
  v_owner := public.get_effective_user_id(auth.uid());
  if v_owner is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_sale from public.sales where id = _sale_id and user_id = v_owner;
  if v_sale.id is null then
    raise exception 'Venda não encontrada';
  end if;

  -- devolve o estoque dos itens
  for v_item in select * from public.sale_items where sale_id = _sale_id loop
    if v_item.product_id is not null then
      update public.products
         set stock = stock + v_item.quantity
       where id = v_item.product_id and user_id = v_owner;
    end if;
  end loop;

  -- remove o lançamento de entrada no caixa/financeiro
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

  delete from public.sale_items where sale_id = _sale_id;
  delete from public.sales where id = _sale_id and user_id = v_owner;

  return jsonb_build_object('ok', true, 'sale_id', _sale_id, 'total', v_sale.total);
end;
$$;

grant execute on function public.cancel_sale(uuid) to authenticated;