# Módulos do Sistema

Descrição funcional de cada página/rota. Para guia de uso, veja [`manual-usuario.md`](manual-usuario.md).

## Dashboard (`/`)
Visão geral: receita total, despesas, número de produtos, alertas de estoque baixo, status de OS, últimas movimentações.

## PDV / Vendas (`/pdv`)
- Leitura de código de barras (campo + câmera via `BarcodeScanner`).
- Carrinho com desconto, acréscimo e múltiplas formas de pagamento.
- Parcelamento em até **12x** (cartão).
- Exige caixa aberto para vendas em dinheiro/recebíveis no caixa.
- Impressão de cupom 80 mm com nome do emitente.

## Caixa (`/caixa`)
- **Abertura**: somente Master. Define valor inicial.
- **Movimentos**: sangria, suprimento, registros automáticos de vendas/recebimentos.
- **Fechamento**: Master ou Vendedor. Mostra contagem esperada vs. informada.
- Histórico de caixas anteriores.

## Estoque (`/estoque`)
- CRUD de produtos (SKU, preço, custo, estoque mínimo, unidade, categoria, código de barras).
- Importação de XML de NF-e (`XmlProductImport`) — cria/atualiza produtos e vincula fornecedor.
- Alerta de estoque mínimo.

## Financeiro (`/financeiro`)
Movimentações de entrada/saída agregadas, com categoria, método de pagamento e data.

### Contas a Pagar (`/contas-pagar`)
- Lançamento avulso ou recorrente.
- Baixa parcial/total — gera transação automática.
- Bloqueia edição/remoção de contas já pagas.

### Contas a Receber (`/contas-receber`)
- Geradas a partir de vendas parceladas ou avulsas.
- Mesmo bloqueio de edição após quitação.

## Ordens de Serviço (`/ordens-servico`)
- Orçamento → aprovação → execução → fechamento → pagamento.
- Materiais aplicados deduzem do estoque.
- Bloqueia edição quando paga (igual contas).
- Impressão A4 com cabeçalho do emitente.

## Clientes (`/clientes`)
- PF/PJ com validação de CPF/CNPJ (dígitos + máscara em tempo real).
- Busca automática de dados via BrasilAPI/ReceitaWS para CNPJ.
- CEP via ViaCEP.
- Histórico de compras e KPIs em `/clientes/:id/historico`.

## Fornecedores (`/fornecedores`)
CRUD básico, mesmo padrão de validação de documento.

## Categorias (`/categorias`) e Unidades (`/unidades`)
Cadastros auxiliares para produtos.

## Relatórios (`/relatorios`)
- Vendas por período, ticket médio, top produtos, top clientes.
- Fluxo de caixa (entradas vs saídas).
- Exportação A4 com nome do emitente em todos os cabeçalhos.

## Usuários (`/usuarios`) — Master
- Convida sub-usuários vendedores (edge function `create-company-user`).
- Ativa/desativa acesso.

## Configurações Fiscais (`/configuracoes-fiscais`) — Master
- Upload de certificado A1 (.pfx) e senha.
- Ambiente homologação/produção.
- Validação via edge `fiscal-validate-certificate`.

## Auditoria (`/auditoria`) — Master
Lista eventos sensíveis (login, alterações em contas, exclusões), gravados via `src/lib/auditLog.ts`.

## Cobranças (`/cobrancas`)
Faturas da assinatura do próprio Vortis para o cliente Master. Integração Mercado Pago.

## Painel Super Admin (`/admin/*`)
Rotas separadas (`AdminLogin`, `AdminDashboard`, `AdminFaturas`, `AdminPlanos`, etc.) protegidas por `AdminProtectedRoute` — exige role `admin` em `user_roles`. Gerencia todos os clientes da plataforma.
