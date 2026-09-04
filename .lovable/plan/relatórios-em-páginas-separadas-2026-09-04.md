# Relatórios em páginas separadas

Hoje tudo fica em uma única tela longa (`Relatorios.tsx`, ~1600 linhas), com diálogos e blocos empilhados. A proposta é transformar a tela em um **painel de escolha com botões** e dar a cada relatório a sua **própria página**, com números em destaque (KPIs) e gráficos.

## 1. Página inicial de Relatórios (hub)

Grade de botões/cartões, cada um com ícone, nome e uma frase curta do que mostra, agrupados por área:

- **Financeiro**: Financeiro (entradas/saídas), DRE simplificado, Resumo de caixa, Contas a Pagar, Contas a Receber, Cobranças.
- **Vendas**: Vendas, Produtos mais vendidos, Vendas por vendedor, Margem de lucro, Curva ABC.
- **Estoque**: Estoque, Giro de estoque.
- **Clientes**: Clientes.

Um campo de busca no topo filtra os botões pelo nome, para achar rápido.

## 2. Cada relatório com sua página

Cada botão abre um endereço próprio (ex. `/relatorios/vendas`, `/relatorios/dre`). A página tem sempre a mesma estrutura:

1. Título, descrição e botão **Voltar** para o painel.
2. Barra de filtros (atalhos de período: Hoje, Ontem, 7 dias, Este mês, Mês passado, Este ano, Todos + filtros próprios do relatório).
3. Faixa de **números-chave** (3 a 4 cartões: total, quantidade, ticket médio, margem etc., conforme o relatório).
4. **Gráfico** adequado: linha/barras para evolução no tempo, barras horizontais para rankings (mais vendidos, vendedores, ABC), rosca para composição (formas de pagamento, categorias, receita x despesa).
5. Tabela detalhada com totais.
6. Botões de saída já existentes: **Imprimir/PDF**, **Excel**, **CSV** (e 80 mm nos resumos).

Nada é perdido: todos os relatórios e exportações atuais continuam, só passam a ter espaço próprio.

## 3. Detalhes técnicos

- Novo `src/pages/relatorios/` com uma página por relatório e um `RelatoriosHub.tsx` para o painel de botões; rotas filhas registradas em `src/App.tsx` sob `/relatorios/*` dentro do `ProtectedRoute` atual.
- A lógica de dados sai de `Relatorios.tsx` para hooks reutilizáveis em `src/hooks/reports/` (ex. `useReportData`, cálculos de mais vendidos, ABC, giro, DRE, caixa), preservando o filtro por ID efetivo da empresa e as mesmas consultas de hoje. Cada página carrega só as tabelas de que precisa, deixando o carregamento mais rápido que a tela única atual.
- Componentes compartilhados: `ReportPageShell` (cabeçalho + voltar + filtros + ações), `ReportKpis`, e reaproveitamento de `PeriodFilter`/`SelectFilter`/`ReportActions` já existentes.
- Definições de coluna (`ReportDefinition`) e utilitários `reportExport.ts`, `reportPeriod.ts`, `printA4.ts`, `printThermal.ts`, `chartCapture.ts` continuam como estão — só passam a ser importados pelas novas páginas.
- Gráficos com `recharts` (já usado no projeto), cores por tokens do tema, funcionando em modo claro e escuro; os gráficos existentes seguem entrando no PDF via `chartCapture`.
- Cobranças mantém a restrição de plano/permissão atual: o botão aparece desabilitado com aviso quando indisponível.
- `Relatorios.tsx` fica apenas como o hub, e o item do menu lateral continua apontando para `/relatorios`.
