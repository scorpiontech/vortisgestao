# Manual do Usuário — Vortis Gestão

> Versão Markdown. Para o PDF formatado, veja `docs/manual-usuario.pdf` (gere com `python docs/gerar-manual-pdf.py`).

## Sumário
1. Primeiros passos
2. Painel inicial (Dashboard)
3. Cadastros básicos
4. Estoque
5. PDV (Frente de caixa)
6. Caixa
7. Financeiro
8. Ordens de Serviço
9. Clientes e Fornecedores
10. Relatórios
11. Usuários e permissões
12. Configurações fiscais
13. Dúvidas frequentes

---

## 1. Primeiros passos

1. Acesse o sistema pelo endereço informado (ex.: `https://app.vortisgestao.com.br`).
2. Faça login com o e-mail e senha cadastrados.
3. Se for o primeiro acesso, conclua o cadastro da empresa em **Configurações** (CNPJ, endereço, logo).

**Tipos de usuário**
- **Master**: dono da conta, acesso total.
- **Vendedor**: cadastrado pelo Master, acesso ao PDV, vendas, clientes e OS.

## 2. Painel inicial (Dashboard)
Apresenta:
- Receita total e despesas do período.
- Quantidade de produtos cadastrados.
- Produtos com estoque baixo.
- Ordens de serviço em andamento e a receber.
- Últimas movimentações financeiras.

## 3. Cadastros básicos
Antes de vender, cadastre:
- **Categorias** (`/categorias`) — para agrupar produtos.
- **Unidades** (`/unidades`) — un, kg, m, cx, etc.
- **Fornecedores** (`/fornecedores`).

Em todos, valide CPF/CNPJ. Para CNPJ, clique na lupa para preencher automaticamente nome e endereço.

## 4. Estoque
- **Adicionar produto**: nome, SKU, código de barras, categoria, unidade, custo, preço, estoque atual e mínimo.
- **Importar NF-e**: botão "Importar XML" lê a nota e cria/atualiza produtos automaticamente.
- O sistema alerta produtos abaixo do estoque mínimo no Dashboard.

## 5. PDV (Frente de caixa)
1. Tenha um **caixa aberto** (somente Master abre — peça ao gestor).
2. Vá em **PDV**.
3. Adicione produtos:
   - Escaneie o código de barras, **ou**
   - Digite o código/nome no campo de busca.
4. Ajuste quantidade, desconto ou acréscimo.
5. Escolha o cliente (opcional).
6. Selecione forma de pagamento — cartão pode ser parcelado em até **12x**.
7. Finalize. O sistema imprime cupom 80 mm com o nome da empresa emitente.

## 6. Caixa
- **Abertura** (Master): informa valor inicial em dinheiro.
- **Suprimento**: entrada extra de dinheiro durante o expediente.
- **Sangria**: retirada de dinheiro.
- **Fechamento** (Master ou Vendedor): sistema mostra valor esperado; informe o contado e a diferença é registrada.

Sem caixa aberto, vendas em dinheiro ficam bloqueadas.

## 7. Financeiro

### Movimentações
Todas as entradas e saídas, com filtro por período, categoria e forma de pagamento.

### Contas a Pagar
- Cadastre fornecedor, valor, vencimento, categoria e parcelas.
- Ao pagar, a movimentação é registrada automaticamente.
- **Atenção**: contas já pagas **não podem** ser editadas ou excluídas.

### Contas a Receber
Geradas automaticamente em vendas parceladas, ou cadastradas avulsas. Mesma regra de bloqueio após quitação.

## 8. Ordens de Serviço
1. Crie a OS escolhendo cliente e descrevendo o problema.
2. Adicione **serviços** (mão de obra) e **materiais** (que descontam do estoque ao salvar).
3. Status: aberta → em andamento → finalizada.
4. Marque como **paga** ao receber. A OS paga fica travada para alterações.
5. Imprima em A4 (orçamento ou OS finalizada) — sai com o cabeçalho da empresa.

## 9. Clientes e Fornecedores
- Suporte a PF (CPF) e PJ (CNPJ), com **máscara automática** e validação de dígitos.
- Para CNPJ, clique no ícone de lupa para preencher nome e endereço pela Receita Federal.
- CEP preenche bairro, cidade e UF automaticamente.
- Em **Clientes**, o botão "Histórico" mostra todas as compras e KPIs do cliente.

## 10. Relatórios
- Vendas por período, ticket médio, top produtos, top clientes.
- Fluxo de caixa (entradas × saídas).
- Estoque (atual, baixo, sem giro).
- Todos os relatórios podem ser impressos em A4 com cabeçalho da empresa.

## 11. Usuários e permissões (Master)
- Em **Usuários**, convide vendedores informando e-mail e senha provisória.
- Marque como **inativo** para suspender o acesso sem apagar.

## 12. Configurações fiscais (Master)
- Faça upload do **certificado A1 (.pfx)** e informe a senha.
- Escolha ambiente: **Homologação** (testes) ou **Produção**.
- O sistema valida o certificado e mostra data de expiração.

## 13. Dúvidas frequentes

**Esqueci minha senha.** Use "Esqueci a senha" na tela de login — chega e-mail com link para redefinir.

**Por que não consigo abrir o caixa?** Apenas o usuário Master pode abrir. Vendedor só fecha.

**Por que não consigo editar uma conta?** Contas pagas são bloqueadas por segurança. Estorne o pagamento (se permitido) ou cadastre uma nova com o ajuste.

**O cupom imprimiu sem o nome da empresa.** Preencha **Razão Social** em Configurações da Empresa.

**O sistema avisa "fatura em aberto" e bloqueia tudo.** Sua mensalidade Vortis está vencida. Vá em **Cobranças** e pague para reativar.
