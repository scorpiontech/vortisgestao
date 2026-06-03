## Consulta automática de CNPJ no cadastro de clientes

Adicionar busca automática dos dados do CNPJ na Receita Federal ao cadastrar/editar cliente Pessoa Jurídica, preenchendo nome, endereço, telefone e e-mail.

### Como funciona para o usuário

1. No diálogo "Novo Cliente" / "Editar Cliente", ao selecionar tipo **CNPJ**, aparece um botão de lupa ao lado do campo Documento (igual ao print enviado).
2. Usuário digita o CNPJ e clica na lupa (ou faz blur com 14 dígitos preenchidos).
3. Sistema consulta a base pública da Receita Federal e preenche automaticamente:
   - Razão Social → Nome
   - Logradouro, número, complemento, bairro, CEP, cidade, UF
   - Telefone e e-mail (quando disponíveis)
4. Caso o CNPJ esteja inválido, baixado ou não encontrado, mostra toast de erro e mantém os campos como estão.
5. Campos continuam editáveis depois do preenchimento.

### Detalhes técnicos

- **Fonte de dados**: API pública **BrasilAPI** (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`) — gratuita, sem chave, baseada nos dados da Receita Federal. Fallback para **ReceitaWS** (`https://receitaws.com.br/v1/cnpj/{cnpj}`) caso a BrasilAPI falhe.
- **Onde**: chamada direta do frontend (sem edge function), já que ambas APIs têm CORS aberto — segue o mesmo padrão do `viacep` já usado no projeto.
- **Arquivo novo**: `src/lib/cnpjLookup.ts` com função `fetchCnpjData(cnpj)` retornando objeto normalizado `{ name, zip_code, street, number, complement, neighborhood, city, state, phone, email }`.
- **Arquivo alterado**: `src/pages/Clientes.tsx`
  - Botão com ícone de lupa ao lado do input do documento, visível somente quando `document_type === "cnpj"`.
  - Estado `cnpjLoading` para mostrar spinner durante a consulta.
  - Função `handleCnpjLookup()` que valida o CNPJ, chama `fetchCnpjData` e faz merge no `form` (sem sobrescrever campos já preenchidos manualmente, exceto o nome quando vazio).
  - Toasts de sucesso/erro.

### Fora de escopo

- Não consulta automática em massa de clientes já cadastrados.
- Não armazena status de inscrição (ativa/baixada) no banco — apenas exibe no toast se relevante.