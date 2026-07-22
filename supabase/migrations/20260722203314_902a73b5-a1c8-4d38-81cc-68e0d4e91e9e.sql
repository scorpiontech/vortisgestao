
ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS pis_cst_default text DEFAULT '49',
  ADD COLUMN IF NOT EXISTS cofins_cst_default text DEFAULT '49',
  ADD COLUMN IF NOT EXISTS pis_aliquota numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cofins_aliquota numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icms_aliquota numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icms_modalidade_base_calculo text DEFAULT '3';
