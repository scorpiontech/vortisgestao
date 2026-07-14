## Objetivo

Garantir que todos os campos monetários do módulo de Orçamentos usem a MESMA formatação BRL e o MESMO arredondamento (2 casas) já aplicado ao valor unitário — inclusive nos inputs editáveis, subtotais, descontos e no PDF.

## Situação atual

- Já existe um helper `fmt()` em `src/pages/Orcamentos.tsx` e em `src/lib/quotePdf.ts` que aplica `pt-BR / BRL` (R$ 0,00). Subtotal, desconto e total já são arredondados a 2 casas.
- Pontos que ainda escapam do padrão:
  1. Input de **Desconto (R$)** (linha 654) é `type="number"` livre — aceita qualquer número de casas decimais e não mostra máscara BRL.
  2. Preço do produto exibido na busca (linha 574) usa `fmt(p.price)` sem arredondar antes (ok visualmente, mas não normaliza o valor).
  3. Persistência: ao salvar (`saveQuote`), os campos são gravados como estão em memória; se um valor vier com resíduo de ponto-flutuante (ex.: `12.345000001`), ele vai para o banco assim.
  4. PDF (`quotePdf.ts`) apenas formata; se receber um número não arredondado, ele exibe "R$ 12,35" mas o total somado pode diferir de 1 centavo.

## Mudanças

### 1. Helper único de arredondamento
Em `src/pages/Orcamentos.tsx`, expor o `round2` já criado e usá-lo em todos os pontos onde há multiplicação/soma monetária (add/update de itens, subtotal, desconto, total). Nenhum valor sai para tela, banco ou PDF sem passar por `round2`.

### 2. Input de Desconto com máscara BRL
Trocar o `<Input type="number">` do desconto por um input de moeda igual ao do valor unitário:
- `type="text"` + `inputMode="numeric"`
- Usuário digita apenas dígitos; o componente divide por 100 e formata via `fmt()`.
- Limite superior = subtotal atual (mantendo a regra `Math.min(..., subtotal)`).
- Valor mostrado sempre em `R$ 0,00`.

### 3. Normalização antes do save
Em `saveQuote()`, aplicar `round2` explicitamente em `subtotal`, `discount`, `total` e em cada `item.unit_price` / `item.total` antes de mandar para o banco. Também normalizar ao carregar (`loadQuote`) para blindar registros antigos.

### 4. PDF consistente
Em `src/lib/quotePdf.ts`, arredondar os valores recebidos (`unit_price`, `total`, `subtotal`, `discount`, `taxAmount`) com o mesmo `round2` antes do `fmt()`, garantindo que a soma linha-a-linha bata com o total.

### 5. Preço na busca de produtos
Aplicar `round2(p.price)` na exibição (linha 574) — puramente cosmético, mas mantém o padrão.

## Detalhes técnicos

- `round2(n) = Math.round((Number(n) || 0) * 100) / 100`
- `fmt(n) = round2(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })` — embutir o `round2` dentro do `fmt` elimina a chance de esquecer em algum ponto.
- Mesma abordagem replicada em `quotePdf.ts` (helper local já existe lá).
- Máscara de moeda do desconto reaproveita o padrão de `handlePriceInput` (dígitos → ÷100 → `round2`).

## Fora do escopo

- Alterar formatação em outros módulos (PDV, OS, Vendas). Este plano cobre somente Orçamentos e o PDF do orçamento.
- Mudar moeda / locale (permanece BRL / pt-BR).
