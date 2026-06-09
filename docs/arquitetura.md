# Arquitetura — Vortis Gestão

## Visão geral

```
┌───────────────────────────┐        ┌────────────────────────────┐
│  Navegador (SPA React)    │ HTTPS  │  Lovable Cloud (Supabase)  │
│  Vite build → estático    │ ─────► │  Postgres + Auth + Edge fn │
│  Hospedagem: Lovable      │        │  Storage + Realtime        │
│  ou Nginx (Proxmox/Linux) │        └────────────────────────────┘
└───────────────────────────┘                  ▲
                                               │
                                  ┌────────────┴────────────┐
                                  │  Mercado Pago (webhooks)│
                                  │  BrasilAPI / ViaCEP     │
                                  └─────────────────────────┘
```

- **Frontend**: SPA React 18 + Vite 5 + TypeScript. Sem SSR.
- **Estado/dados**: chamadas diretas ao Postgres via `@supabase/supabase-js` com RLS.
- **Autenticação**: e-mail/senha + sessão JWT armazenada no `localStorage` (Supabase Auth).
- **Edge Functions** (Deno): cobrança recorrente, webhooks de pagamento, criação de usuários, validações fiscais.

---

## Stack

| Camada | Tecnologia |
|---|---|
| UI | React 18, Tailwind v3, shadcn/ui, Framer Motion, lucide-react |
| Build | Vite 5, TypeScript 5, ESLint |
| Roteamento | React Router v6 |
| Forms/validação | React Hook Form + zod (parcial) + validadores customizados |
| Backend | Supabase (Postgres + Auth + Edge Functions Deno) |
| Pagamentos | Mercado Pago Checkout Pro |
| Hospedagem | Lovable / Nginx (Ubuntu 22.04) |

---

## Estrutura de pastas

```
src/
├── components/           # Componentes reutilizáveis
│   ├── auth/             # ProtectedRoute, AdminProtectedRoute
│   ├── dashboard/        # StatCard
│   ├── financeiro/       # ContasPagarReceber
│   ├── layout/           # AppLayout, AppSidebar
│   └── ui/               # shadcn primitives
├── contexts/             # AuthContext
├── hooks/                # useUserRole, useFiscalQuota, useSellerName, ...
├── integrations/
│   └── supabase/         # client + types (AUTO-GERADO — não editar)
├── lib/                  # auditLog, cnpjLookup, printA4, validators
├── pages/                # Uma página por rota (Dashboard, PDV, Estoque, ...)
└── App.tsx               # Roteamento

supabase/
├── config.toml
└── functions/            # Edge functions (Deno)

deploy/                   # Scripts de hospedagem em servidor próprio
docs/                     # Esta documentação
```

---

## Roteamento

Definido em `src/App.tsx`. Todas as rotas privadas estão envolvidas por `<ProtectedRoute>`, que valida sessão e papel.

| Rota | Página | Permissão |
|---|---|---|
| `/` | Dashboard | autenticado |
| `/pdv` | PDV / Vendas | autenticado |
| `/caixa` | Caixa | abrir: master; fechar/consultar: ambos |
| `/estoque` | Produtos | autenticado |
| `/financeiro` | Movimentações + Contas | master (parcial vendedor) |
| `/ordens-servico` | OS | autenticado |
| `/clientes`, `/fornecedores`, `/categorias`, `/unidades` | Cadastros | autenticado |
| `/relatorios` | Relatórios | autenticado |
| `/usuarios` | Sub-usuários | master |
| `/configuracoes-fiscais` | Certificado A1 + ambiente | master |
| `/auditoria` | Logs | master |
| `/admin/*` | Painel super admin | role `admin` em `user_roles` |

---

## Modelo de dados (principais tabelas)

Todas em `public` com RLS habilitada e GRANTs para `authenticated` + `service_role`.

| Tabela | Conteúdo |
|---|---|
| `profiles` | Dados do usuário Master (empresa, CNPJ, endereço) |
| `company_members` | Sub-usuários vinculados ao Master (role: master/vendedor, active) |
| `user_roles` | Papéis globais (`admin` para super admin) |
| `products` | Produtos do estoque |
| `categories`, `units` | Cadastros auxiliares |
| `clients`, `suppliers` | Cadastros de pessoas |
| `transactions` | Movimentações financeiras (entrada/saída) |
| `accounts_payable`, `accounts_receivable` | Contas a pagar/receber + parcelas |
| `sales`, `sale_items` | Vendas e itens |
| `service_orders`, `service_order_items` | OS, materiais e serviços |
| `cash_registers`, `cash_movements` | Caixa aberto/fechado e movimentos |
| `audit_logs` | Trilha de auditoria (Master) |
| `client_accounts`, `subscription_invoices`, `plans` | Faturamento da plataforma (super admin) |

> Tabelas e tipos são auto-gerados em `src/integrations/supabase/types.ts`. **Não editar.**

---

## Effective User ID (isolamento multi-tenant)

Vendedores **não** têm dados próprios — operam sobre os dados do Master a que pertencem. Em vez de duplicar `owner_id` em toda query, as RLS usam uma função `effective_user_id(auth.uid())`:

```sql
-- Pseudocódigo
create function effective_user_id(uid uuid) returns uuid as $$
  select coalesce(
    (select owner_id from company_members where user_id = uid and active),
    uid
  );
$$ language sql stable security definer;
```

Toda policy padrão é `using (user_id = public.effective_user_id(auth.uid()))`.

Detalhes em [`permissoes.md`](permissoes.md).

---

## Triggers e automações

- **Geração de parcelas**: ao inserir venda parcelada, trigger gera linhas em `accounts_receivable`.
- **Baixa automática**: pagamento de conta a receber gera `transaction` de entrada e movimento de caixa quando há caixa aberto.
- **Updated_at**: trigger genérico em todas as tabelas com `updated_at`.
- **Bloqueio de edição**: contas pagas e OS finalizadas pagas não podem ser alteradas (validado por trigger + UI).

---

## Variáveis de ambiente

| Variável | Onde | Uso |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` | URL do projeto Cloud |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` | Anon key (pode estar no bundle) |
| `MP_ACCESS_TOKEN` | Secrets do Supabase | Mercado Pago (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secrets do Supabase | Edge functions admin |

Nunca colocar `service_role` ou `MP_ACCESS_TOKEN` no frontend.
