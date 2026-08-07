ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS document text NOT NULL DEFAULT '';

-- Vincula o CPF/CNPJ da empresa cadastrada (relativo ao master) em cada conta
UPDATE public.client_accounts ca
SET document = COALESCE(NULLIF(cr.document, ''), NULLIF(fs.cnpj, ''), '')
FROM (SELECT id, public.get_effective_user_id(user_id) AS master_id FROM public.client_accounts) m
LEFT JOIN public.company_registrations cr ON cr.user_id = m.master_id
LEFT JOIN public.fiscal_settings fs ON fs.owner_id = m.master_id
WHERE ca.id = m.id
  AND COALESCE(NULLIF(ca.document, ''), '') = ''
  AND COALESCE(NULLIF(cr.document, ''), NULLIF(fs.cnpj, '')) IS NOT NULL;