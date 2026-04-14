# Deploy - Vortis Gestão (Servidor Linux)

## Requisitos
- Ubuntu/Debian Linux
- Acesso root (sudo)

## Deploy rápido

```bash
# 1. Clone o repositório no servidor
git clone <URL_DO_REPOSITORIO> vortis
cd vortis

# 2. Execute o script de deploy
sudo bash deploy/deploy.sh
```

O sistema ficará acessível em `http://<IP_DO_SERVIDOR>`.

## Atualização

```bash
cd /caminho/do/projeto
git pull
sudo bash deploy/deploy.sh
```

## Diagnóstico de erro de build do Vite

Se aparecer erro parecido com `Unexpected token '.'` em `node_modules/vite/bin/vite.js`, o servidor ainda está usando um Node.js antigo.

Verifique com:

```bash
node -v
which node
```

O deploy exige **Node.js 20 ou superior**. O script `deploy.sh` já valida isso automaticamente, então faça `git pull` antes de rodá-lo novamente.

## HTTPS (opcional)

Para habilitar HTTPS com Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com.br
```

## Estrutura

- `deploy/nginx.conf` — Configuração do Nginx (SPA fallback, gzip, cache)
- `deploy/deploy.sh` — Script automatizado de build e deploy
- Os arquivos estáticos são servidos de `/var/www/vortis/`

## Observações

- O backend (banco de dados, autenticação) roda na nuvem via Lovable Cloud
- Apenas o frontend é hospedado localmente
- As variáveis de conexão com o backend já estão embutidas no build
