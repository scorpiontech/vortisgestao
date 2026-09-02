# Melhorias na emissão de relatórios

Objetivo: deixar a tela de Relatórios mais completa, com exportação em Excel e PDF em todos os relatórios, filtros mais rápidos, novos relatórios de gestão e um layout de impressão mais profissional.

## 1. Exportação em Excel e PDF em todos os relatórios

Hoje só o relatório de Cobranças tem exportação (CSV). Cada relatório passa a ter três botões padronizados:

- **Imprimir / PDF** — abre a janela de impressão já formatada (o próprio navegador salva como PDF).
- **Excel (.xlsx)** — mesma lista e mesmas colunas do relatório impresso, com cabeçalho, larguras de coluna, valores numéricos formatados como moeda e linha de totais.
- **CSV** — mantido para quem importa em outros sistemas.

Aplicado a: Financeiro, Estoque, Vendas, Clientes, Margem de Lucro, Contas a Pagar, Contas a Receber, Cobranças e os novos relatórios.

## 2. Filtros e atalhos melhores

- Atalhos de período em um clique: Hoje, Ontem, Últimos 7 dias, Este mês, Mês passado, Este ano, Personalizado.
- Barra de filtros unificada, com contador de resultados e botão "Limpar filtros".
- Filtros adicionais por relatório:
  - Vendas: cliente, forma de pagamento, vendedor (usuário) e caixa.
  - Estoque / Margem: categoria, fornecedor, fabricante e "somente estoque baixo".
  - Financeiro: categoria e forma de pagamento.
  - Contas: status (pago / pendente / atrasado).
- O período e os filtros escolhidos aparecem no cabeçalho de todo arquivo gerado (impressão e Excel).

## 3. Novos relatórios

- **Produtos mais vendidos** — quantidade, faturamento e ticket médio por produto no período (top N configurável).
- **Vendas por vendedor** — total de vendas, faturamento, ticket médio e participação (%).
- **Curva ABC de produtos** — classificação A/B/C por faturamento acumulado.
- **Giro de estoque** — saídas no período versus estoque atual, com dias de cobertura e alerta de item parado.
- **DRE simplificado** — receitas, custo das mercadorias vendidas, despesas por categoria, resultado do período e margem (%).
- **Resumo de caixa** — abertura, movimentos, vendas por forma de pagamento, diferença de fechamento por caixa.

## 4. Layout de impressão melhor

- Cabeçalho com os dados reais da empresa (nome/razão social, CNPJ/CPF, endereço, telefone) além do logo Vortis e do nome de quem emitiu.
- Bloco de filtros aplicados logo abaixo do título.
- Rodapé com numeração "Página X de Y", data/hora de emissão e repetição do cabeçalho da tabela a cada página.
- Quebra de página controlada (linhas não são cortadas ao meio) e linha de totais fixa no fim.
- Modo de impressão térmica 80 mm (área útil 72 mm) para os relatórios resumidos: Resumo de caixa, Vendas do dia e Contas do dia.
- Gráficos incluídos no PDF nos relatórios que já têm gráfico na tela (financeiro, categorias, mais vendidos).

## Detalhes técnicos

- `src/pages/Relatorios.tsx` é reorganizado: cada relatório vira um card com a mesma barra de ações (Imprimir, Excel, CSV) e o mesmo componente de filtros; a lógica de cada relatório sai para hooks/helpers para o arquivo não crescer demais.
- Novos utilitários:
  - `src/lib/reportExport.ts` — geração de XLSX (biblioteca `xlsx`, já instalada) e CSV a partir de uma definição comum de colunas.
  - `src/lib/reportPeriod.ts` — atalhos de período e rótulos legíveis.
  - `src/lib/printThermal.ts` — layout 80 mm/72 mm para os resumos.
- `src/lib/printA4.ts` é estendido para receber dados da empresa, filtros aplicados, numeração de páginas via CSS e imagens de gráficos (data URL), mantendo compatibilidade com as chamadas atuais.
- Dados da empresa vêm de `company_registrations` (já existente), carregados junto dos demais dados do relatório.
- Novos relatórios consultam `sale_items` + `sales` (mais vendidos, curva ABC, vendedor), `stock_movements` (giro) e `cash_registers` + `transactions` (resumo de caixa), sempre filtrados pelo ID efetivo da empresa. Nenhuma mudança de banco é necessária.
- Sem envio por e-mail/WhatsApp e sem agendamento — apenas baixar e imprimir.
