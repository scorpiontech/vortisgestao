# Permissões, Papéis e RLS

## Tipos de usuário

| Tipo | Onde está armazenado | O que pode fazer |
|---|---|---|
| **Master** | `auth.users` + `profiles` | Tudo do tenant: configurações, abertura de caixa, usuários, fiscal, relatórios. |
| **Vendedor** | `auth.users` + `company_members` (role=`vendedor`, owner_id=Master) | PDV, vendas, clientes, OS, fechamento de caixa. **Não** abre caixa nem edita configurações. |
| **Super Admin** | `auth.users` + `user_roles` (role=`admin`) | Painel `/admin/*` — gerencia clientes, planos, faturas da plataforma. |

> **Nunca** armazenar papéis em `profiles` ou em colunas no objeto do usuário. Sempre em tabela separada (`company_members` para tenant, `user_roles` para plataforma).

## Effective User ID

Vendedores compartilham os dados do Master. As RLS usam:

```sql
create function public.effective_user_id(uid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select owner_id from public.company_members
      where user_id = uid and active limit 1),
    uid
  );
$$;
```

Padrão das policies:

```sql
create policy "tenant scope"
on public.<tabela>
for all
to authenticated
using (user_id = public.effective_user_id(auth.uid()))
with check (user_id = public.effective_user_id(auth.uid()));
```

## Has-role (super admin)

```sql
create function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;
```

Rotas `/admin/*` validam via `AdminProtectedRoute` chamando `has_role(uid, 'admin')`.

## Restrições especiais

- **Abertura de caixa**: somente Master (`useUserRole().isMaster`).
- **Contas pagas / OS pagas**: bloqueadas para edição/remoção em UI e por trigger no banco.
- **Vendedor inativo**: `company_members.active = false` → bloqueia login (validação no `AuthContext`/`ProtectedRoute`).

## Frontend

Hook `src/hooks/useUserRole.ts` expõe:
```ts
const { role, isMaster, isVendedor, effectiveUserId, loading } = useUserRole();
```

Use `isMaster` para esconder/desabilitar ações restritas. Nunca confie só no frontend — toda restrição deve existir também em RLS/trigger.
