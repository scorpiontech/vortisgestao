-- Create logs table first if it doesn't exist
CREATE TABLE IF NOT EXISTS public.xml_import_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    filename text,
    total_items integer DEFAULT 0,
    imported_items integer DEFAULT 0,
    rejected_items integer DEFAULT 0,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT ON public.xml_import_logs TO authenticated;
GRANT ALL ON public.xml_import_logs TO service_role;

ALTER TABLE public.xml_import_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own import logs') THEN
        CREATE POLICY "Users can view their own import logs" 
        ON public.xml_import_logs FOR SELECT TO authenticated 
        USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own import logs') THEN
        CREATE POLICY "Users can insert their own import logs" 
        ON public.xml_import_logs FOR INSERT TO authenticated 
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Merge logic for products with same SKU
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT user_id, sku, array_agg(id ORDER BY created_at DESC) as ids
        FROM public.products
        WHERE sku IS NOT NULL AND sku <> ''
        GROUP BY user_id, sku
        HAVING count(*) > 1
    ) LOOP
        -- Transfer references
        UPDATE public.sale_items SET product_id = r.ids[1] WHERE product_id = ANY(r.ids[2:]);
        UPDATE public.stock_movements SET product_id = r.ids[1] WHERE product_id = ANY(r.ids[2:]);
        UPDATE public.quote_items SET product_id = r.ids[1] WHERE product_id = ANY(r.ids[2:]);
        
        -- Sum stock
        UPDATE public.products p
        SET stock = (SELECT SUM(stock) FROM public.products WHERE id = ANY(r.ids))
        WHERE id = r.ids[1];
        
        -- Delete duplicates
        DELETE FROM public.products WHERE id = ANY(r.ids[2:]);
    END LOOP;
END $$;

-- Merge logic for products with same NAME
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT user_id, name, array_agg(id ORDER BY created_at DESC) as ids
        FROM public.products
        GROUP BY user_id, name
        HAVING count(*) > 1
    ) LOOP
        UPDATE public.sale_items SET product_id = r.ids[1] WHERE product_id = ANY(r.ids[2:]);
        UPDATE public.stock_movements SET product_id = r.ids[1] WHERE product_id = ANY(r.ids[2:]);
        UPDATE public.quote_items SET product_id = r.ids[1] WHERE product_id = ANY(r.ids[2:]);
        
        UPDATE public.products p
        SET stock = (SELECT SUM(stock) FROM public.products WHERE id = ANY(r.ids))
        WHERE id = r.ids[1];
        
        DELETE FROM public.products WHERE id = ANY(r.ids[2:]);
    END LOOP;
END $$;

-- Apply constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_user_id_name_unique') THEN
        ALTER TABLE public.products ADD CONSTRAINT products_user_id_name_unique UNIQUE (user_id, name);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_user_id_sku_unique') THEN
        ALTER TABLE public.products ADD CONSTRAINT products_user_id_sku_unique UNIQUE (user_id, sku);
    END IF;
END $$;
