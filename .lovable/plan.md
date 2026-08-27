# Corrigir importação de produtos via Excel

## O que aconteceu

A planilha tem 32 linhas, mas nada foi inserido. O log da última importação mostra o motivo real:

```text
total_items: 32 | imported_items: 0 | updated: 1
rejected: "duplicate key value violates unique constraint products_user_id_name_unique"
```

Duas causas, confirmadas:

1. A planilha contém **nomes repetidos entre as próprias linhas** (ex.: "ACETILCISTEINA 20MG XPE FR 120ML INF" aparece duas vezes, com códigos diferentes). O banco tem restrição única por (empresa, nome) e por (empresa, SKU).
2. O importador envia **todas as linhas novas em um único insert**. Como o banco rejeita o lote inteiro quando uma única linha viola a restrição, os 32 produtos foram descartados de uma vez — e o erro só foi gravado no log, sem aparecer na tela (a mensagem mostrada foi "0 novos, 1 atualizados").

Também há um detalhe de robustez: a consulta de duplicidade monta um filtro de texto com os nomes; nomes com vírgula, parênteses ou aspas podem quebrar essa consulta em planilhas grandes.

## Correção proposta

Em `src/components/ExcelProductImport.tsx`:

1. **Consolidar linhas repetidas da própria planilha** antes de importar: agrupar por SKU (quando houver) ou por nome, somando o Estoque Atual e mantendo o último preço/custo informado. A pré-visualização passa a mostrar quantas linhas foram unificadas.
2. **Inserir em lotes pequenos com fallback por item**: se um lote falhar, cada item é tentado individualmente, de forma que uma linha problemática não derrube as outras 31.
3. **Consulta de duplicidade em blocos**, usando os filtros nativos do cliente (`in` sobre listas) em pedaços de ~100 itens, evitando quebra por caracteres especiais nos nomes.
4. **Relatório visível ao usuário**: o toast final passa a mostrar novos, atualizados e rejeitados; havendo rejeições, abre um resumo com nome do produto e motivo, em vez de esconder o erro no log.
5. Manter as regras atuais: SKU gerado automaticamente quando vazio, soma de estoque para produtos já cadastrados, NCM com 8 dígitos, fornecedor por nome, `effectiveUserId` como dono.

## Detalhes técnicos

- Dedupe local: `Map` com chave `sku || nome.toLowerCase()`; soma `stock`, mantém maior `min_stock`, último `price`/`cost` não zero.
- Insert: `chunk(payload, 50)`; em erro do chunk, loop item a item com `.insert(single)` e coleta de `error.message` por produto.
- Duplicidade: dois passos — `select ... in("sku", chunkSkus)` e `select ... in("name", chunkNames)` — em vez de `.or()` com string interpolada.
- Log em `xml_import_logs` continua sendo gravado, agora com `rejected_items` correto.
- Sem alteração de banco; as restrições únicas atuais são mantidas de propósito.
