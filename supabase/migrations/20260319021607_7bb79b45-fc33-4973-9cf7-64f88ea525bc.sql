ALTER TABLE public.sales ADD COLUMN discount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN installments integer NOT NULL DEFAULT 1;