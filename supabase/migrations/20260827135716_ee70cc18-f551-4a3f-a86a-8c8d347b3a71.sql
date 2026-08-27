ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_user_id_name_unique;

ALTER TABLE public.products
  ADD CONSTRAINT products_user_id_name_manufacturer_unique UNIQUE (user_id, name, manufacturer);