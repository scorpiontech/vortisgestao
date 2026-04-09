
-- Create company_members table
CREATE TABLE public.company_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  user_id UUID NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('master', 'vendedor')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Function to get the effective owner_id for data access
CREATE OR REPLACE FUNCTION public.get_effective_user_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.company_members WHERE user_id = _user_id AND role = 'vendedor' AND active = true),
    _user_id
  );
$$;

-- Function to check member role
CREATE OR REPLACE FUNCTION public.get_member_role(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.company_members WHERE user_id = _user_id AND active = true),
    'master'
  );
$$;

-- RLS for company_members
CREATE POLICY "Owners can view their members"
ON public.company_members FOR SELECT
USING (owner_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Owners can insert members"
ON public.company_members FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update members"
ON public.company_members FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete members"
ON public.company_members FOR DELETE
USING (owner_id = auth.uid());

-- Update trigger
CREATE TRIGGER update_company_members_updated_at
BEFORE UPDATE ON public.company_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Now update ALL existing RLS policies to use get_effective_user_id

-- PRODUCTS
DROP POLICY IF EXISTS "Users can view own products" ON public.products;
CREATE POLICY "Users can view own products" ON public.products FOR SELECT
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
CREATE POLICY "Users can insert own products" ON public.products FOR INSERT
WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own products" ON public.products;
CREATE POLICY "Users can update own products" ON public.products FOR UPDATE
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own products" ON public.products;
CREATE POLICY "Users can delete own products" ON public.products FOR DELETE
USING (user_id = public.get_effective_user_id(auth.uid()));

-- CUSTOMERS
DROP POLICY IF EXISTS "Users can view own customers" ON public.customers;
CREATE POLICY "Users can view own customers" ON public.customers FOR SELECT
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own customers" ON public.customers;
CREATE POLICY "Users can insert own customers" ON public.customers FOR INSERT
WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own customers" ON public.customers;
CREATE POLICY "Users can update own customers" ON public.customers FOR UPDATE
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own customers" ON public.customers;
CREATE POLICY "Users can delete own customers" ON public.customers FOR DELETE
USING (user_id = public.get_effective_user_id(auth.uid()));

-- SUPPLIERS
DROP POLICY IF EXISTS "Users can view own suppliers" ON public.suppliers;
CREATE POLICY "Users can view own suppliers" ON public.suppliers FOR SELECT
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own suppliers" ON public.suppliers;
CREATE POLICY "Users can insert own suppliers" ON public.suppliers FOR INSERT
WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own suppliers" ON public.suppliers;
CREATE POLICY "Users can update own suppliers" ON public.suppliers FOR UPDATE
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own suppliers" ON public.suppliers;
CREATE POLICY "Users can delete own suppliers" ON public.suppliers FOR DELETE
USING (user_id = public.get_effective_user_id(auth.uid()));

-- SALES
DROP POLICY IF EXISTS "Users can view own sales" ON public.sales;
CREATE POLICY "Users can view own sales" ON public.sales FOR SELECT
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own sales" ON public.sales;
CREATE POLICY "Users can insert own sales" ON public.sales FOR INSERT
WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));

-- SALE_ITEMS
DROP POLICY IF EXISTS "Users can view own sale items" ON public.sale_items;
CREATE POLICY "Users can view own sale items" ON public.sale_items FOR SELECT
USING (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.user_id = public.get_effective_user_id(auth.uid())));

DROP POLICY IF EXISTS "Users can insert own sale items" ON public.sale_items;
CREATE POLICY "Users can insert own sale items" ON public.sale_items FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.user_id = public.get_effective_user_id(auth.uid())));

-- CASH_REGISTERS
DROP POLICY IF EXISTS "Users can view own cash registers" ON public.cash_registers;
CREATE POLICY "Users can view own cash registers" ON public.cash_registers FOR SELECT
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own cash registers" ON public.cash_registers;
CREATE POLICY "Users can insert own cash registers" ON public.cash_registers FOR INSERT
WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own cash registers" ON public.cash_registers;
CREATE POLICY "Users can update own cash registers" ON public.cash_registers FOR UPDATE
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own cash registers" ON public.cash_registers;
CREATE POLICY "Users can delete own cash registers" ON public.cash_registers FOR DELETE
USING (user_id = public.get_effective_user_id(auth.uid()));

-- TRANSACTIONS
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT
WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE
USING (user_id = public.get_effective_user_id(auth.uid()));

-- CATEGORIES
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT
WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE
USING (user_id = public.get_effective_user_id(auth.uid()));

-- UNITS
DROP POLICY IF EXISTS "Users can view own units" ON public.units;
CREATE POLICY "Users can view own units" ON public.units FOR SELECT
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own units" ON public.units;
CREATE POLICY "Users can insert own units" ON public.units FOR INSERT
WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own units" ON public.units;
CREATE POLICY "Users can update own units" ON public.units FOR UPDATE
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own units" ON public.units;
CREATE POLICY "Users can delete own units" ON public.units FOR DELETE
USING (user_id = public.get_effective_user_id(auth.uid()));

-- BILLS
DROP POLICY IF EXISTS "Users can view own bills" ON public.bills;
CREATE POLICY "Users can view own bills" ON public.bills FOR SELECT
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own bills" ON public.bills;
CREATE POLICY "Users can insert own bills" ON public.bills FOR INSERT
WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own bills" ON public.bills;
CREATE POLICY "Users can update own bills" ON public.bills FOR UPDATE
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own bills" ON public.bills;
CREATE POLICY "Users can delete own bills" ON public.bills FOR DELETE
USING (user_id = public.get_effective_user_id(auth.uid()));

-- SERVICE_ORDERS
DROP POLICY IF EXISTS "Users can view own service orders" ON public.service_orders;
CREATE POLICY "Users can view own service orders" ON public.service_orders FOR SELECT
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own service orders" ON public.service_orders;
CREATE POLICY "Users can insert own service orders" ON public.service_orders FOR INSERT
WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own service orders" ON public.service_orders;
CREATE POLICY "Users can update own service orders" ON public.service_orders FOR UPDATE
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own service orders" ON public.service_orders;
CREATE POLICY "Users can delete own service orders" ON public.service_orders FOR DELETE
USING (user_id = public.get_effective_user_id(auth.uid()));

-- SERVICE_ORDER_MATERIALS
DROP POLICY IF EXISTS "Users can view own service order materials" ON public.service_order_materials;
CREATE POLICY "Users can view own service order materials" ON public.service_order_materials FOR SELECT
USING (EXISTS (SELECT 1 FROM service_orders WHERE service_orders.id = service_order_materials.service_order_id AND service_orders.user_id = public.get_effective_user_id(auth.uid())));

DROP POLICY IF EXISTS "Users can insert own service order materials" ON public.service_order_materials;
CREATE POLICY "Users can insert own service order materials" ON public.service_order_materials FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM service_orders WHERE service_orders.id = service_order_materials.service_order_id AND service_orders.user_id = public.get_effective_user_id(auth.uid())));

DROP POLICY IF EXISTS "Users can update own service order materials" ON public.service_order_materials;
CREATE POLICY "Users can update own service order materials" ON public.service_order_materials FOR UPDATE
USING (EXISTS (SELECT 1 FROM service_orders WHERE service_orders.id = service_order_materials.service_order_id AND service_orders.user_id = public.get_effective_user_id(auth.uid())));

DROP POLICY IF EXISTS "Users can delete own service order materials" ON public.service_order_materials;
CREATE POLICY "Users can delete own service order materials" ON public.service_order_materials FOR DELETE
USING (EXISTS (SELECT 1 FROM service_orders WHERE service_orders.id = service_order_materials.service_order_id AND service_orders.user_id = public.get_effective_user_id(auth.uid())));

-- COMPANY_REGISTRATIONS
DROP POLICY IF EXISTS "Users can view own registrations" ON public.company_registrations;
CREATE POLICY "Users can view own registrations" ON public.company_registrations FOR SELECT
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own registrations" ON public.company_registrations;
CREATE POLICY "Users can insert own registrations" ON public.company_registrations FOR INSERT
WITH CHECK (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own registrations" ON public.company_registrations;
CREATE POLICY "Users can update own registrations" ON public.company_registrations FOR UPDATE
USING (user_id = public.get_effective_user_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own registrations" ON public.company_registrations;
CREATE POLICY "Users can delete own registrations" ON public.company_registrations FOR DELETE
USING (user_id = public.get_effective_user_id(auth.uid()));

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT
USING (user_id = public.get_effective_user_id(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT
WITH CHECK (user_id = auth.uid());
