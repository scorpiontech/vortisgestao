## Diagnóstico

A rejeição "IBS/CBS não informado" vem da SEFAZ porque, a partir de 2026, toda NF-e/NFC-e precisa trafegar o grupo da Reforma Tributária (IBS estadual, IBS municipal e CBS) em cada item — mesmo em operações com alíquota zero de transição.

Nós já temos os padrões salvos em `fiscal_settings` (`ibs_cst`, `ibs_aliquota`, `cbs_aliquota`) e o diálogo NfeSettingsDialog já edita esses campos. O problema é que a Edge Function `supabase/functions/fiscal-emit-document/index.ts` **não inclui** esses campos no payload enviado à Focus NFe. Por isso o provedor recebe o item sem IBS/CBS e a SEFAZ rejeita com status 1115.

## O que fazer

Ajustar apenas o payload da Edge Function para preencher os campos IBS/CBS por item, usando as configurações já existentes (com fallback item-a-item quando o produto tiver override no futuro).

### 1. `supabase/functions/fiscal-emit-document/index.ts`

Dentro de `buildItemTaxes(...)`, após o bloco de PIS/COFINS, adicionar o grupo IBS/CBS conforme a documentação Focus NFe (nomes usados pelo provedor):

- `ibs_cbs_codigo_situacao_tributaria`: `it.ibs_cst ?? settings.ibs_cst ?? "000"`
- `ibs_cbs_codigo_classificacao_tributaria`: `it.ibs_classificacao ?? settings.ibs_classificacao ?? "000001"` (código genérico da tabela cClassTrib)
- Base de cálculo IBS/CBS = `valorBruto`
- IBS estadual: `ibs_uf_aliquota` = `settings.ibs_aliquota` (padrão 0.1), `ibs_uf_valor` = base * aliq / 100
- IBS municipal: `ibs_mun_aliquota` = 0, `ibs_mun_valor` = 0 (na transição só a UF opera, mas o campo tem que existir)
- CBS: `cbs_aliquota` = `settings.cbs_aliquota` (padrão 0.9), `cbs_valor` = base * aliq / 100
- Totalizar somando `ibs_valor_total` e `cbs_valor_total` no bloco principal do payload (opcional — Focus recalcula, mas envio explícito evita rejeição em algumas UFs).

Todos os valores passam por `round2` para manter 2 casas decimais.

### 2. Alíquotas padrão

Manter as defaults atuais salvas no banco (IBS 0.1% / CBS 0.9%), que são as alíquotas de teste da fase piloto de 2026. O usuário pode ajustar via **Configurações NF-e/NFC-e → IBS/CBS** (já existente).

### 3. Reemitir a nota pendente

A nota atual está em status `pending` porque a SEFAZ rejeitou. Após o deploy da função, o usuário deve:
1. Abrir **Notas Fiscais**
2. Cancelar/descartar a nota pendente
3. Emitir uma nova a partir do wizard — o payload já sairá com IBS/CBS.

Se quiser, num passo seguinte adiciono um botão "Reenviar" para notas rejeitadas que remonta o payload e chama o provedor sem duplicar numeração.

## Fora do escopo (por ora)

- Overrides IBS/CBS por produto: hoje o valor vem da configuração global. Se surgirem itens com tributação diferenciada, adicionamos colunas em `products` e campos no wizard num segundo passo.
- Ajuste da NFC-e modelo 65: o mesmo grupo se aplica; a mudança na Edge Function cobre os dois modelos porque `buildItemTaxes` é compartilhado.

Quer que eu implemente exatamente assim?