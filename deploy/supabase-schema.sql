-- Vortis Gestão — schema consolidado para Supabase self-hosted
-- Gerado a partir de supabase/migrations/* em 2026-06-17
-- Rode dentro do container do Postgres:
--   docker exec -i supabase-db psql -U postgres -d postgres < deploy/supabase-schema.sql


-- ============================================================
-- 20260314141502_16413f79-8094-45bd-94fe-c03cdba425bd.sql
-- ============================================================

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'un',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own products" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own products" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON public.products FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- Sales table
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name TEXT,
  payment_method TEXT NOT NULL DEFAULT '',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sales" ON public.sales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sales" ON public.sales FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sale items table
CREATE TABLE public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sale items" ON public.sale_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid()));
CREATE POLICY "Users can insert own sale items" ON public.sale_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid()));

-- ============================================================
-- 20260317141934_f8db8177-0ed9-4cf3-949f-704794a8ed6f.sql
-- ============================================================

-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'cpf', -- 'cpf' or 'cnpj'
  document TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  zip_code TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  number TEXT NOT NULL DEFAULT '',
  complement TEXT NOT NULL DEFAULT '',
  neighborhood TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  observation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own customers" ON public.customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customers" ON public.customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own customers" ON public.customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own customers" ON public.customers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  zip_code TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  number TEXT NOT NULL DEFAULT '',
  complement TEXT NOT NULL DEFAULT '',
  neighborhood TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  observation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own suppliers" ON public.suppliers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own suppliers" ON public.suppliers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own suppliers" ON public.suppliers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own suppliers" ON public.suppliers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 20260318210843_cd6fac35-eb0a-452b-925c-f943889d3954.sql
-- ============================================================

-- Add supplier_id to products
ALTER TABLE public.products ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- Create cash_registers table
CREATE TABLE public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opened_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone,
  opening_amount numeric NOT NULL DEFAULT 0,
  closing_amount numeric,
  expected_amount numeric,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cash registers" ON public.cash_registers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cash registers" ON public.cash_registers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cash registers" ON public.cash_registers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cash registers" ON public.cash_registers FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 20260319021607_7bb79b45-fc33-4973-9cf7-64f88ea525bc.sql
-- ============================================================
ALTER TABLE public.sales ADD COLUMN discount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN installments integer NOT NULL DEFAULT 1;
-- ============================================================
-- 20260320181829_e10dae4d-7171-4668-bf59-2be36ffda28d.sql
-- ============================================================

-- Create categories table
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- Create units table
CREATE TABLE public.units (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  abbreviation text NOT NULL DEFAULT '',
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own units" ON public.units FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own units" ON public.units FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own units" ON public.units FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own units" ON public.units FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 20260321181140_aa9049aa-4f8b-463f-8eda-1f7cf254a706.sql
-- ============================================================

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

-- ============================================================
-- 20260323114922_7654b5e0-7de1-411f-81d2-6c49221db3d4.sql
-- ============================================================
CREATE TABLE public.company_registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  person_type text NOT NULL DEFAULT 'pf',
  name text NOT NULL,
  document text NOT NULL DEFAULT '',
  state_registration text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  number text NOT NULL DEFAULT '',
  complement text NOT NULL DEFAULT '',
  neighborhood text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  zip_code text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.company_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own registrations" ON public.company_registrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own registrations" ON public.company_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own registrations" ON public.company_registrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own registrations" ON public.company_registrations FOR DELETE USING (auth.uid() = user_id);
-- ============================================================
-- 20260323121549_5bda3bbe-369d-4533-b857-1d9f17972f01.sql
-- ============================================================

-- 1. Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Tabela de roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Função security definer para checar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS policies para user_roles
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 5. Tabela de contas de clientes
CREATE TABLE public.client_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  plan text NOT NULL DEFAULT 'Plano Mensal',
  status text NOT NULL DEFAULT 'ativo',
  monthly_value numeric NOT NULL DEFAULT 99.90,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;

-- 6. RLS: somente admins podem gerenciar client_accounts
CREATE POLICY "Admins can view all accounts" ON public.client_accounts
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert accounts" ON public.client_accounts
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update accounts" ON public.client_accounts
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete accounts" ON public.client_accounts
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own account
CREATE POLICY "Users can view own account" ON public.client_accounts
  FOR SELECT USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_client_accounts_updated_at
  BEFORE UPDATE ON public.client_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 20260323121713_45df2c69-72c1-4e21-b835-ad99aaf3f8c7.sql
-- ============================================================

-- Trigger to auto-create client_account on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_client_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create account if user is not an admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'admin') THEN
    INSERT INTO public.client_accounts (user_id, name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_client_account
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_client_account();

-- ============================================================
-- 20260326115619_8995a384-6a03-4e56-83b5-1557b59f75b3.sql
-- ============================================================

CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pagar', 'receber')),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bills" ON public.bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bills" ON public.bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bills" ON public.bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bills" ON public.bills FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 20260326134828_e2c3ecac-17d9-4793-83ed-7ca3e9edfbb4.sql
-- ============================================================
ALTER TABLE public.bills ADD COLUMN payment_method text NOT NULL DEFAULT '';
-- ============================================================
-- 20260409131818_e0388333-08f4-4a17-97bb-0463ee34b58b.sql
-- ============================================================

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

-- ============================================================
-- 20260409132906_3bca0aae-3bff-4bbf-b685-b339c6e43635.sql
-- ============================================================

CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  user_email TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity TEXT NOT NULL DEFAULT '',
  entity_id TEXT DEFAULT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_logs_owner_id ON public.audit_logs(owner_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Owner can view all logs for their company
CREATE POLICY "Owners can view audit logs"
ON public.audit_logs FOR SELECT
USING (owner_id = auth.uid() OR (owner_id = public.get_effective_user_id(auth.uid())));

-- Any authenticated user can insert logs
CREATE POLICY "Users can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (owner_id = public.get_effective_user_id(auth.uid()));

-- ============================================================
-- 20260409185019_1f272b0c-7f32-4a3e-b8e2-6657f406f6bd.sql
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own cash registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Users can view own cash registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Users can update own cash registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Users can delete own cash registers" ON public.cash_registers;

-- INSERT: allow if user_id is self OR user_id is a vendedor owned by current user
CREATE POLICY "Users can insert own cash registers" ON public.cash_registers
FOR INSERT WITH CHECK (
  user_id = get_effective_user_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.user_id = cash_registers.user_id
      AND company_members.owner_id = auth.uid()
      AND company_members.active = true
  )
);

-- SELECT: allow if user_id matches effective id OR user is the owner of that vendedor
CREATE POLICY "Users can view own cash registers" ON public.cash_registers
FOR SELECT USING (
  user_id = get_effective_user_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.user_id = cash_registers.user_id
      AND company_members.owner_id = auth.uid()
      AND company_members.active = true
  )
);

-- UPDATE: same logic
CREATE POLICY "Users can update own cash registers" ON public.cash_registers
FOR UPDATE USING (
  user_id = get_effective_user_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.user_id = cash_registers.user_id
      AND company_members.owner_id = auth.uid()
      AND company_members.active = true
  )
);

-- DELETE: same logic
CREATE POLICY "Users can delete own cash registers" ON public.cash_registers
FOR DELETE USING (
  user_id = get_effective_user_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.user_id = cash_registers.user_id
      AND company_members.owner_id = auth.uid()
      AND company_members.active = true
  )
);

-- ============================================================
-- 20260409191425_d6a04d32-a5ae-484b-9a5a-a97379fedc6f.sql
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own cash registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Users can view own cash registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Users can update own cash registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Users can delete own cash registers" ON public.cash_registers;

-- SELECT: user can see their own registers (by actual user_id), master's registers (via effective id), or master can see vendor registers
CREATE POLICY "Users can view own cash registers" ON public.cash_registers
FOR SELECT USING (
  user_id = auth.uid()
  OR user_id = get_effective_user_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.user_id = cash_registers.user_id
      AND company_members.owner_id = auth.uid()
      AND company_members.active = true
  )
);

-- INSERT: user can insert for themselves, or master can insert for their vendors
CREATE POLICY "Users can insert own cash registers" ON public.cash_registers
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR user_id = get_effective_user_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.user_id = cash_registers.user_id
      AND company_members.owner_id = auth.uid()
      AND company_members.active = true
  )
);

-- UPDATE: same logic
CREATE POLICY "Users can update own cash registers" ON public.cash_registers
FOR UPDATE USING (
  user_id = auth.uid()
  OR user_id = get_effective_user_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.user_id = cash_registers.user_id
      AND company_members.owner_id = auth.uid()
      AND company_members.active = true
  )
);

-- DELETE: same logic
CREATE POLICY "Users can delete own cash registers" ON public.cash_registers
FOR DELETE USING (
  user_id = auth.uid()
  OR user_id = get_effective_user_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.user_id = cash_registers.user_id
      AND company_members.owner_id = auth.uid()
      AND company_members.active = true
  )
);

-- ============================================================
-- 20260417145348_9a341531-14d3-478b-bf4e-aaf972fd8deb.sql
-- ============================================================
-- Tabela de planos de assinatura
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  monthly_value NUMERIC NOT NULL DEFAULT 0,
  mp_plan_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage plans" ON public.subscription_plans FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated can view active plans" ON public.subscription_plans FOR SELECT
  USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar colunas em client_accounts
ALTER TABLE public.client_accounts
  ADD COLUMN plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN billing_type TEXT NOT NULL DEFAULT 'avulsa',
  ADD COLUMN due_day INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN mp_subscription_id TEXT,
  ADD COLUMN blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN blocked_at TIMESTAMPTZ,
  ADD COLUMN tolerance_days INTEGER NOT NULL DEFAULT 15;

-- Tabela de faturas
CREATE TABLE public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  mp_payment_id TEXT,
  mp_preference_id TEXT,
  payment_link TEXT,
  paid_at TIMESTAMPTZ,
  reference_month TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invoices" ON public.subscription_invoices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients view own invoices" ON public.subscription_invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.client_accounts ca
    WHERE ca.id = subscription_invoices.client_account_id
      AND ca.user_id = auth.uid()
  ));

CREATE TRIGGER subscription_invoices_updated_at
  BEFORE UPDATE ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_subscription_invoices_client ON public.subscription_invoices(client_account_id);
CREATE INDEX idx_subscription_invoices_status ON public.subscription_invoices(status);
CREATE INDEX idx_subscription_invoices_mp_payment ON public.subscription_invoices(mp_payment_id);
CREATE INDEX idx_subscription_invoices_due ON public.subscription_invoices(due_date);

-- Função helper: verifica se conta do cliente está bloqueada
CREATE OR REPLACE FUNCTION public.is_client_blocked(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT blocked FROM public.client_accounts
      WHERE user_id = (SELECT get_effective_user_id(_user_id))
      LIMIT 1),
    false
  );
$$;
-- ============================================================
-- 20260423153627_7945d24b-5192-4d65-8f81-ed4c9f4853b0.sql
-- ============================================================
-- Prevent multiple open cash registers for the same user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_cash_register_per_user
ON public.cash_registers (user_id)
WHERE status = 'open';
-- ============================================================
-- 20260423154438_1f21e58d-bcba-49a1-85e4-16b18bac8220.sql
-- ============================================================
CREATE TABLE public.barcode_scan_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  user_email text NOT NULL DEFAULT '',
  code text NOT NULL,
  format text NOT NULL DEFAULT '',
  product_id uuid,
  product_name text NOT NULL DEFAULT '',
  matched boolean NOT NULL DEFAULT false,
  context text NOT NULL DEFAULT 'pdv',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.barcode_scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view barcode scan logs"
ON public.barcode_scan_logs
FOR SELECT
USING ((owner_id = auth.uid()) OR (owner_id = public.get_effective_user_id(auth.uid())));

CREATE POLICY "Users can insert barcode scan logs"
ON public.barcode_scan_logs
FOR INSERT
WITH CHECK (owner_id = public.get_effective_user_id(auth.uid()) AND user_id = auth.uid());

CREATE INDEX idx_barcode_scan_logs_owner_created
ON public.barcode_scan_logs (owner_id, created_at DESC);
-- ============================================================
-- 20260425170510_b3438def-8034-4cf9-b64e-59d99e3b500a.sql
-- ============================================================
-- Tabela de configurações de retenção
CREATE TABLE public.barcode_scan_log_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT retention_days_positive CHECK (retention_days >= 1 AND retention_days <= 3650)
);

ALTER TABLE public.barcode_scan_log_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own scan log settings"
ON public.barcode_scan_log_settings
FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY "Owners can insert own scan log settings"
ON public.barcode_scan_log_settings
FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update own scan log settings"
ON public.barcode_scan_log_settings
FOR UPDATE
USING (owner_id = auth.uid());

CREATE TRIGGER update_barcode_scan_log_settings_updated_at
BEFORE UPDATE ON public.barcode_scan_log_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para performance da limpeza
CREATE INDEX IF NOT EXISTS idx_barcode_scan_logs_owner_created
ON public.barcode_scan_logs(owner_id, created_at);

-- Função de limpeza
CREATE OR REPLACE FUNCTION public.cleanup_old_barcode_scan_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER := 0;
  rec RECORD;
  total INTEGER := 0;
BEGIN
  -- Apaga logs por owner respeitando sua configuração
  FOR rec IN
    SELECT DISTINCT l.owner_id,
      COALESCE((SELECT s.retention_days FROM public.barcode_scan_log_settings s WHERE s.owner_id = l.owner_id), 30) AS days
    FROM public.barcode_scan_logs l
  LOOP
    DELETE FROM public.barcode_scan_logs
    WHERE owner_id = rec.owner_id
      AND created_at < (now() - (rec.days || ' days')::interval);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    total := total + deleted_count;
  END LOOP;

  RETURN total;
END;
$$;
-- ============================================================
-- 20260514143655_02686ebd-2c81-4821-a0be-999ff0f43947.sql
-- ============================================================
CREATE TABLE public.invoice_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid,
  client_name text NOT NULL DEFAULT '',
  reference_month text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'error',
  error_message text NOT NULL DEFAULT '',
  error_details jsonb DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'auto',
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invoice generation logs"
  ON public.invoice_generation_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update invoice generation logs"
  ON public.invoice_generation_logs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete invoice generation logs"
  ON public.invoice_generation_logs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_invoice_gen_logs_created ON public.invoice_generation_logs(created_at DESC);
CREATE INDEX idx_invoice_gen_logs_ack ON public.invoice_generation_logs(acknowledged, created_at DESC);
-- ============================================================
-- 20260514150006_9a023bd1-a811-41ed-8298-49a4a19a574f.sql
-- ============================================================

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'basico',
  ADD COLUMN IF NOT EXISTS nfe_quota integer,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_tier ON public.subscription_plans(tier);

-- ============================================================
-- 20260528144841_1dead703-0d48-41e3-9703-47a9e425d6d4.sql
-- ============================================================

-- Tabela de configurações fiscais (1 por owner)
CREATE TABLE public.fiscal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  cnpj text NOT NULL DEFAULT '',
  ie text NOT NULL DEFAULT '',
  regime_tributario text NOT NULL DEFAULT 'simples_nacional',
  csc_id text NOT NULL DEFAULT '',
  csc_token text NOT NULL DEFAULT '',
  certificate_path text NOT NULL DEFAULT '',
  certificate_filename text NOT NULL DEFAULT '',
  certificate_password_encrypted text NOT NULL DEFAULT '',
  certificate_subject text NOT NULL DEFAULT '',
  certificate_expires_at timestamptz,
  certificate_valid boolean NOT NULL DEFAULT false,
  cfop_default text NOT NULL DEFAULT '5102',
  csosn_default text NOT NULL DEFAULT '102',
  ambiente text NOT NULL DEFAULT 'homologacao',
  provider text NOT NULL DEFAULT 'focusnfe',
  provider_token text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_settings TO authenticated;
GRANT ALL ON public.fiscal_settings TO service_role;

ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own fiscal settings" ON public.fiscal_settings
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Owners insert own fiscal settings" ON public.fiscal_settings
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update own fiscal settings" ON public.fiscal_settings
  FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owners delete own fiscal settings" ON public.fiscal_settings
  FOR DELETE USING (owner_id = auth.uid());

CREATE TRIGGER trg_fiscal_settings_updated_at
  BEFORE UPDATE ON public.fiscal_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para certificados A1
INSERT INTO storage.buckets (id, name, public)
VALUES ('fiscal-certificates', 'fiscal-certificates', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Owners read own fiscal certs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fiscal-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners upload own fiscal certs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fiscal-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners update own fiscal certs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fiscal-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners delete own fiscal certs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fiscal-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Desconto em ordens de serviço (aplicado no momento do pagamento)
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;

-- ============================================================
-- 20260528150117_56dcf5a2-6bd0-4ae3-945e-4174ebdbed3f.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.get_effective_user_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_client_blocked(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_member_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_barcode_scan_logs() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_effective_user_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_client_blocked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- ============================================================
-- 20260528150540_55ba9627-fca9-482e-afa5-417b0bc6ab1f.sql
-- ============================================================

-- 1) Hardening: recreate SECURITY DEFINER functions with explicit search_path including pg_temp
CREATE OR REPLACE FUNCTION public.get_effective_user_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.company_members WHERE user_id = _user_id AND role = 'vendedor' AND active = true),
    _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_client_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT blocked FROM public.client_accounts
      WHERE user_id = (SELECT public.get_effective_user_id(_user_id))
      LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_member_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.company_members WHERE user_id = _user_id AND active = true),
    'master'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Re-revoke from anon/public after CREATE OR REPLACE (which resets grants only on first create)
REVOKE EXECUTE ON FUNCTION public.get_effective_user_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_client_blocked(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_member_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_user_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_client_blocked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 2) Quota table
CREATE TABLE IF NOT EXISTS public.fiscal_quota_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  year_month text NOT NULL,
  authorized_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, year_month)
);

GRANT SELECT ON public.fiscal_quota_usage TO authenticated;
GRANT ALL ON public.fiscal_quota_usage TO service_role;

ALTER TABLE public.fiscal_quota_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own fiscal quota"
ON public.fiscal_quota_usage
FOR SELECT
USING (owner_id = auth.uid());

CREATE TRIGGER update_fiscal_quota_usage_updated_at
BEFORE UPDATE ON public.fiscal_quota_usage
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) check_nfce_quota function
CREATE OR REPLACE FUNCTION public.check_nfce_quota(_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _quota integer;
  _used integer;
  _ym text := to_char(now(), 'YYYY-MM');
BEGIN
  SELECT sp.nfe_quota
    INTO _quota
    FROM public.client_accounts ca
    LEFT JOIN public.subscription_plans sp ON sp.id = ca.plan_id
    WHERE ca.user_id = _owner_id
    LIMIT 1;

  SELECT COALESCE(authorized_count, 0)
    INTO _used
    FROM public.fiscal_quota_usage
    WHERE owner_id = _owner_id AND year_month = _ym;
  _used := COALESCE(_used, 0);

  IF _quota IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true, 'used', _used, 'quota', null, 'remaining', null, 'unlimited', true, 'year_month', _ym
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', _used < _quota,
    'used', _used,
    'quota', _quota,
    'remaining', GREATEST(_quota - _used, 0),
    'unlimited', false,
    'year_month', _ym
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_nfce_quota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_nfce_quota(uuid) TO authenticated;

-- 4) Metadata on invoices (for upgrade target_plan_id)
ALTER TABLE public.subscription_invoices
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================
-- 20260528151140_67c1d230-270a-42d6-a8ac-9a16e5dd1cef.sql
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_client_account() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
-- ============================================================
-- 20260528151203_9b637bba-047f-4abf-8fad-9d91d2268104.sql
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_client_account() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
-- ============================================================
-- 20260612134309_c2b85f8e-8af0-4042-a3af-de1679466c5a.sql
-- ============================================================

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
