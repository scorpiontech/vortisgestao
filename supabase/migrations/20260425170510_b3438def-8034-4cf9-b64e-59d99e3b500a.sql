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