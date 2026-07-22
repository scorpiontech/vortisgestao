
-- Extend fiscal_settings with per-model numbering and emission defaults
ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS proximo_numero_nfe integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS proximo_numero_nfce integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS serie_nfe text NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS serie_nfce text NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS informacoes_fisco text NOT NULL DEFAULT 'Documento emitido por ME ou EPP optante pelo SIMPLES NACIONAL. Não gera Direito a Crédito Fiscal de ICMS e de ISS. Conforme Lei Complementar 123 de 14/12/2006.',
  ADD COLUMN IF NOT EXISTS ibs_cst text NOT NULL DEFAULT '000',
  ADD COLUMN IF NOT EXISTS ibs_aliquota numeric NOT NULL DEFAULT 0.1,
  ADD COLUMN IF NOT EXISTS cbs_aliquota numeric NOT NULL DEFAULT 0.9,
  ADD COLUMN IF NOT EXISTS enviar_email_destinatario_default boolean NOT NULL DEFAULT true;

-- Extend nfce_documents to also support NF-e (55) with wizard fields
ALTER TABLE public.nfce_documents
  ADD COLUMN IF NOT EXISTS modelo text NOT NULL DEFAULT '65',
  ADD COLUMN IF NOT EXISTS natureza_operacao text NOT NULL DEFAULT 'Venda',
  ADD COLUMN IF NOT EXISTS finalidade text NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS tipo_documento text NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS consumidor_final text NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS indicador_presenca text NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS data_emissao timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS data_saida timestamptz,
  ADD COLUMN IF NOT EXISTS movimenta_estoque boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enviar_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chave_referencia text,
  ADD COLUMN IF NOT EXISTS frete_modalidade text NOT NULL DEFAULT '9',
  ADD COLUMN IF NOT EXISTS informacoes_complementares text,
  ADD COLUMN IF NOT EXISTS informacoes_fisco text,
  ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS payments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS destinatario jsonb,
  ADD COLUMN IF NOT EXISTS total_produtos numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_frete numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outras_despesas numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_pago numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS troco numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS separar_iguais boolean NOT NULL DEFAULT false;
