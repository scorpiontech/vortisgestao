# Importação de Produtos via Excel

## Objetivo
Permitir importar uma lista de produtos para o Estoque através de um arquivo Excel (.xlsx), com a mesma usabilidade e segurança da importação XML já existente (pré-visualização, checagem de duplicidade, soma de estoque para itens já cadastrados, geração automática de código de barras). Também gerar um arquivo modelo (.xlsx) para o usuário baixar e preencher.

## Modelo de planilha (colunas)
Colunas na planilha, nesta ordem. Apenas **Nome** é obrigatório; as demais têm padrões quando vazias.

| Coluna | Obrigatório | Observação |
|---|---|---|
| Nome | Sim | Nome do produto |
| SKU / Código de Barras | Não | Se vazio, gerado automaticamente |
| Categoria | Não | Texto livre |
| Preço Venda | Não | R$ (ex.: 12.90) — padrão 0 |
| Custo | Não | R$ (ex.: 8.50) — padrão 0 |
| Estoque Atual | Não | Número inteiro — padrão 0 |
| Estoque Mínimo | Não | Número inteiro — padrão 0 |
| Unidade | Não | ex.: un, kg, lt — padrão "un" |
| Fornecedor | Não | Nome do fornecedor já cadastrado (busca por nome) |
| NCM | Não | 8 dígitos numéricos |

## Entregas

### 1. Arquivo modelo (.xlsx) — gerado agora
Gerar `/mnt/documents/modelo-importacao-produtos.xlsx` com:
- Cabeçalho com as colunas acima
- Uma linha de exemplo preenchida
- Uma segunda linha em branco
- Comentários/notas nas colunas explicando formato
- Larguras ajustadas e cabeçalho em negrito

### 2. Componente `ExcelProductImport.tsx`
Novo componente ao lado de `XmlProductImport`, no cabeçalho do Estoque, com botão "Importar Excel".
- Input `accept=".xlsx,.xls"` lê o arquivo com a lib **SheetJS (xlsx)** via CDN/bundler.
- Faz parsing para um array de produtos aplicando os mesmos padrões do cadastro manual (SKU gerado se vazio, NCM só dígitos, valores numéricos com fallback 0, unidade minúscula).
- Tela de pré-visualização (tabela) com checkbox por linha, idêntica à do XML: Nome, Qtd, Custo, Preço.
- **Duplicidade**: consulta `products` por `name` e `sku` (igual ao fluxo XML). Duplicatas têm o **estoque somado** ao item existente e o custo atualizado; novos itens são inseridos.
- **Validação de Fornecedor**: se o nome informado não existir em `suppliers`, o campo fica nulo (não bloqueia a importação).
- Registra log em `xml_import_logs` (ou tabela equivalente) com totais de novos/atualizados/rejeitados, reaproveitando a estrutura existente.
- Usa `effectiveUserId` (do `useUserRole`) como `user_id`, igual ao `Estoque.tsx`, para respeitar multi-tenant.

### 3. Integração no `Estoque.tsx`
Adicionar o botão `ExcelProductImport` ao lado de `XmlProductImport`, na barra superior.

### 4. Dependência
Adicionar a lib `xlsx` (SheetJS) ao projeto via `bun add xlsx`.

## Escopo
- Apenas frontend + lib de parsing. Sem mudança de banco (a tabela `products` já tem todas as colunas).
- Mantém as regras de negócio existentes: duplicidade por nome/SKU, soma de estoque, geração de código de barras, NCM de 8 dígitos.
