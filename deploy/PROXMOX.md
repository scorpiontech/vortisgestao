# Hospedagem em Servidor Local — Proxmox + Ubuntu 22.04

Guia passo a passo para rodar o **Vortis Gestão** em uma VM ou container LXC no Proxmox VE,
usando Ubuntu Server 22.04 LTS.

> Lembrete: o **backend** (banco, autenticação, edge functions) continua rodando na
> Lovable Cloud. Esta hospedagem local serve apenas o **frontend** (SPA estática).
> Por isso a VM precisa apenas de saída para a internet — sem portas de banco abertas.

---

## 1. Criar a VM / Container no Proxmox

### Opção A — Container LXC (recomendado, mais leve)
- Template: `ubuntu-22.04-standard`
- CPU: 2 vCPU
- RAM: 2 GB (mínimo 1 GB)
- Disco: 10 GB
- Rede: `vmbr0`, DHCP ou IP fixo
- **Marcar "Nesting"** (necessário para o build do Vite/esbuild rodar em LXC):
  - Datacenter → o container → Options → Features → `nesting=1`

### Opção B — VM completa
- ISO: `ubuntu-22.04.x-live-server-amd64.iso`
- CPU: 2 vCPU (tipo `host`)
- RAM: 2 GB
- Disco: 20 GB (SCSI, VirtIO SCSI single)
- Rede: VirtIO, `vmbr0`

Após instalar o Ubuntu, atualize a base:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw
```

---

## 2. Provisionar o servidor

Faça login como root (ou um usuário com `sudo`) e clone o projeto:

```bash
cd /opt
sudo git clone <URL_DO_REPOSITORIO> vortis
cd vortis
```

Execute o script de provisionamento (firewall, swap, timezone, Node 20, Nginx):

```bash
sudo bash deploy/provision-ubuntu22.sh
```

Em seguida, faça o build e publique o frontend:

```bash
sudo bash deploy/deploy.sh
```

Acesse `http://<IP_DA_VM>` — a aplicação deve carregar.

---

## 3. IP fixo (recomendado para servidor local)

Edite `/etc/netplan/00-installer-config.yaml` (o nome pode variar):

```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: false
      addresses: [192.168.1.50/24]
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [1.1.1.1, 8.8.8.8]
```

Aplique:

```bash
sudo netplan apply
```

> Em containers LXC, configure o IP direto pelo Proxmox (aba Network do CT).

---

## 4. HTTPS com domínio próprio (opcional)

Se você tem um domínio apontando para o IP público (com port-forward 80/443 no roteador
para a VM), habilite HTTPS gratuito:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com.br
```

O Certbot edita o `nginx.conf` automaticamente e renova o certificado via systemd timer.

Para uso **somente na rede local** (sem domínio público), use HTTP mesmo, ou gere um
certificado autoassinado e instale-o nas máquinas dos usuários.

---

## 5. Atualização do sistema

```bash
cd /opt/vortis
sudo git pull
sudo bash deploy/deploy.sh
```

---

## 6. Backup

Como o frontend é estático e o backend está na nuvem, o backup da VM é simples:

- **Proxmox → Backup**: agende snapshot semanal do CT/VM em um storage NFS/PBS.
- O conteúdo crítico no servidor é apenas `/opt/vortis` (código) e `/etc/nginx/sites-available/vortis`.

---

## 7. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| `npm run build` trava em LXC | `nesting=0` no container | Habilitar `nesting=1` nas Features do CT |
| Página em branco no IP da VM | Build não copiado | Re-rodar `sudo bash deploy/deploy.sh` |
| Login não funciona | Sem saída de internet | Verificar `curl https://lovable.app` na VM |
| `Unexpected token '.'` no Vite | Node < 20 | `node -v`; o `deploy.sh` reinstala Node 20 |
| 502 / Nginx erro | Permissão em `/var/www/vortis` | `sudo chown -R www-data:www-data /var/www/vortis` |

---

## 8. Resumo das portas

| Porta | Uso | Onde abrir |
|---|---|---|
| 22  | SSH      | UFW na VM (limitar à rede local) |
| 80  | HTTP     | UFW + firewall do Proxmox |
| 443 | HTTPS    | UFW + firewall do Proxmox (se usar Certbot) |

Nenhuma outra porta precisa estar exposta.
