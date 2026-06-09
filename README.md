# Vortis Gestão

Sistema ERP + PDV web para gestão de **estoque**, **financeiro**, **vendas**, **ordens de serviço**, **clientes** e **fornecedores**, com controle de papéis (Master / Vendedor), caixa, contas a pagar/receber, relatórios e impressão em A4 e térmica 80 mm.

> **Backend** roda na **Lovable Cloud** (banco, autenticação e edge functions). O frontend é uma SPA estática que pode ser hospedada em qualquer servidor web — incluindo um servidor local Proxmox + Ubuntu.

---

## Documentação

| Documento | Para quem |
|---|---|
| [`docs/manual-usuario.md`](docs/manual-usuario.md) | Usuários finais — passo a passo de cada módulo |
| [`docs/arquitetura.md`](docs/arquitetura.md) | Devs — stack, estrutura de pastas, modelo de dados |
| [`docs/modulos.md`](docs/modulos.md) | Devs — descrição funcional de cada módulo/página |
| [`docs/permissoes.md`](docs/permissoes.md) | Devs/Admins — papéis, RLS e effective user ID |
| [`docs/edge-functions.md`](docs/edge-functions.md) | Devs — funções serverless e webhooks |
| [`deploy/README.md`](deploy/README.md) | DevOps — deploy em servidor Linux |
| [`deploy/PROXMOX.md`](deploy/PROXMOX.md) | DevOps — hospedagem local Proxmox + Ubuntu 22.04 |

Manual em PDF pronto para distribuir: gere com `docs/gerar-manual-pdf.py` ou baixe em [`Manual do Usuário (PDF)`](docs/manual-usuario.pdf) quando publicado.

---

## Stack

- **Frontend**: React 18 + Vite 5 + TypeScript 5
- **UI**: Tailwind CSS v3 + shadcn/ui + Framer Motion
- **Backend**: Lovable Cloud (Supabase) — Postgres + Auth + Edge Functions (Deno)
- **Pagamentos**: Mercado Pago (assinaturas)
- **Validações**: CNPJ/CPF + lookup BrasilAPI/ReceitaWS + CEP via ViaCEP

---

## Desenvolvimento local

```bash
npm install
npm run dev
```

A aplicação fica em `http://localhost:5173`. As variáveis de ambiente do backend (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) já estão em `.env`.

---

## Deploy

### Lovable (oficial)
Botão **Publish** no editor — gera URL `*.lovable.app`.

### Servidor próprio (Linux / Proxmox)
```bash
sudo git clone <repo> /opt/vortis && cd /opt/vortis
sudo bash deploy/provision-ubuntu22.sh     # primeira vez
sudo bash deploy/deploy.sh                 # build + publica
```

Veja [`deploy/PROXMOX.md`](deploy/PROXMOX.md) para detalhes (IP fixo, HTTPS, firewall, backup).

---

## Papéis

- **Master**: acesso total — abre caixa, configura empresa, cria vendedores, libera bloqueios.
- **Vendedor**: PDV, vendas, clientes, OS, consultas — não abre caixa, não edita configurações.
- **Super Admin** (painel `/admin/*`): gerencia clientes, planos, faturas — separado dos usuários da plataforma.

Sub-usuários (vendedores) **compartilham os dados do Master** através do *effective user ID* nas políticas RLS.

---

## Licença

Software proprietário © Vortis. Todos os direitos reservados.
