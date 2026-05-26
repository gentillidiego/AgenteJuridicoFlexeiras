# 🚀 OpenGravity — Deploy na VPS com Portainer
> Guia completo com todos os comandos prontos para copiar e colar.

---

## 📁 PARTE 1 — O QUE ENVIAR PARA A VPS

A pasta `docker-deploy/` no seu projeto contém os arquivos Docker necessários.
Além desses, você precisará enviar mais alguns arquivos manualmente.

### Arquivos obrigatórios a enviar:

| Arquivo | Caminho local | Para onde vai na VPS |
|---|---|---|
| `Dockerfile` | `docker-deploy/Dockerfile` | `/home/SEU_USER/opengravity/` |
| `docker-compose.yml` | `docker-deploy/docker-compose.yml` | `/home/SEU_USER/opengravity/` |
| `.env.example` | `docker-deploy/.env.example` | `/home/SEU_USER/opengravity/` |
| `.env` | `.env` (raiz do projeto) | `/home/SEU_USER/opengravity/.env` |
| `personality.md` | `personality.md` | `/home/SEU_USER/opengravity/` |
| `src/` | pasta `src/` completa | `/home/SEU_USER/opengravity/src/` |
| `dashboard/` | pasta `dashboard/` completa | `/home/SEU_USER/opengravity/dashboard/` |
| `package.json` | `package.json` | `/home/SEU_USER/opengravity/` |
| `package-lock.json` | `package-lock.json` | `/home/SEU_USER/opengravity/` |
| `tsconfig.json` | `tsconfig.json` | `/home/SEU_USER/opengravity/` |

> **NÃO envie:** `node_modules/`, `memory.db`, `whatsapp-session/`, `.git/`, `client_secret_*.json`

---

## 📤 PARTE 2 — ENVIO DOS ARQUIVOS (na sua máquina local)

Abra o terminal e execute o comando abaixo. Substitua:
- `diego` pelo usuário da VPS
- `72.60.248.85` pelo IP da VPS

```bash
# Cria a pasta de destino na VPS
ssh diego@72.60.248.85 "mkdir -p /home/diego/opengravity"

# Envia todos os arquivos necessários de uma vez
scp /home/motoflow/Downloads/Diego/Agente/docker-deploy/Dockerfile \
    /home/motoflow/Downloads/Diego/Agente/docker-deploy/docker-compose.yml \
    /home/motoflow/Downloads/Diego/Agente/.env \
    /home/motoflow/Downloads/Diego/Agente/personality.md \
    /home/motoflow/Downloads/Diego/Agente/package.json \
    /home/motoflow/Downloads/Diego/Agente/package-lock.json \
    /home/motoflow/Downloads/Diego/Agente/tsconfig.json \
    diego@72.60.248.85:/home/diego/opengravity/

# Envia as pastas src/ e dashboard/
scp -r /home/motoflow/Downloads/Diego/Agente/src \
       /home/motoflow/Downloads/Diego/Agente/dashboard \
       diego@72.60.248.85:/home/diego/opengravity/
```

---

## 🖥️ PARTE 3 — CONFIGURAÇÃO NA VPS (via SSH)

Conecte-se à VPS:

```bash
ssh diego@72.60.248.85
```

### 3.1 — Ir para a pasta do projeto

```bash
cd /home/diego/opengravity
```

### 3.2 — Verificar se os arquivos chegaram

```bash
ls -la
```
Você deve ver: `Dockerfile`, `docker-compose.yml`, `.env`, `personality.md`, `src/`, `dashboard/`, `package.json`, `tsconfig.json`

### 3.3 — Criar pastas de volumes persistentes

```bash
mkdir -p whatsapp-session
mkdir -p gogcli-config
touch memory.db
```

### 3.4 — Verificar e editar o `.env` na VPS

```bash
nano .env
```
Confirme que todas as chaves estão preenchidas. As variáveis mais importantes:
- `TELEGRAM_BOT_TOKEN` → token do @BotFather
- `GROQ_API_KEY` → chave da Groq
- `WHATSAPP_ENABLED=true`
- `ELEVENLABS_API_KEY` → chave ElevenLabs

Salvar no nano: `CTRL+O` → `Enter` → `CTRL+X`

### 3.5 — Instalar Docker (se ainda não tiver)

```bash
curl -fsSL https://get.docker.com | sh
```

### 3.6 — Instalar Portainer (se ainda não tiver)

```bash
docker volume create portainer_data

docker run -d \
  -p 8000:8000 \
  -p 9443:9443 \
  --name portainer \
  --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest
```

Acesse o Portainer em: `https://72.60.248.85:9443`
Pode haver um aviso de certificado (pode ignorar e prosseguir).

---

## 🐳 PARTE 4 — FAZER O BUILD E SUBIR VIA PORTAINER

### Opção A — Via terminal SSH (mais simples)

```bash
cd /home/diego/opengravity

# Buildar a imagem e subir o container
docker compose up -d --build
```

Acompanhe os logs:
```bash
docker compose logs -f
```

### Opção B — Via Portainer (interface web)

1. Acesse `https://72.60.248.85:9443`
2. Vá em **Stacks** → **Add Stack**
3. Nome: `opengravity`
4. Em **Build method**, selecione **Upload**
5. Faça upload do arquivo `docker-compose.yml`
6. Clique em **Deploy the stack**

> ⚠️ **Importante:** Para o Portainer conseguir fazer o build, os arquivos do projeto devem estar na VPS e o `docker-compose.yml` deve apontar `build: .` — já está correto no arquivo enviado.

---

## 🔐 PARTE 5 — AUTENTICAR O GOOGLE NA VPS (gog CLI)

O `gog` é o CLI que gerencia o acesso ao Gmail, Calendar e Drive.

### 5.1 — Abrir um túnel SSH da sua máquina local (em um terminal separado)

```bash
# Execute ISSO na sua máquina LOCAL (não na VPS)
ssh -L 33133:localhost:33133 diego@72.60.248.85
```

### 5.2 — Copiar o arquivo de credenciais do Google para a VPS

```bash
# Execute na sua máquina LOCAL
scp /home/motoflow/Downloads/Diego/Agente/client_secret_*.json \
    diego@72.60.248.85:/home/diego/opengravity/gogcli-config/
```

### 5.3 — Dentro do container, fazer o login

```bash
# Entre no container em execução:
docker exec -it opengravity bash

# Dentro do container, registrar o arquivo de credenciais:
gog auth credentials /root/.config/gogcli/client_secret_*.json

# Adicionar a conta Google (troque pelo email da conta):
gog auth add gentillidiego@gmail.com --services gmail,calendar,drive,contacts,docs,sheets
```

Vai aparecer uma URL. Copie e abra no **navegador da sua máquina local** (o túnel SSH redireciona o callback para funcionar).

Depois de autorizar, tecle `Enter` no terminal e confira:
```bash
gog accounts
```
Deve aparecer a conta `gentillidiego@gmail.com` como ativa.

```bash
# Sair do container
exit
```

---

## ✅ PARTE 6 — VERIFICAR SE ESTÁ FUNCIONANDO

### Ver status do container

```bash
docker ps
```
O container `opengravity` deve aparecer com status `Up` e `(healthy)`.

### Ver logs em tempo real

```bash
docker compose logs -f
```

Você deve ver:
```
--- Initializing OpenGravity ---
[Dashboard] Servidor rodando em http://0.0.0.0:3333
[Telegram] Bot iniciado com sucesso
[WhatsApp] Canal WhatsApp habilitado. Iniciando...
```

### Acessar o Dashboard

Abra no navegador: `http://IP_DA_VPS:3333`

### Testar o bot Telegram

Envie uma mensagem para o `@OpenGravityDP_bot` no Telegram.

---

## 🔄 PARTE 7 — COMANDOS DE MANUTENÇÃO

### Reiniciar o container

```bash
docker compose restart
```

### Parar o container

```bash
docker compose down
```

### Atualizar o código (após enviar novos arquivos)

```bash
cd /home/SEU_USER/opengravity
docker compose down
docker compose up -d --build
```

### Ver logs dos últimos 100 registros

```bash
docker compose logs --tail=100
```

### Rebuildar sem cache (se der problema)

```bash
docker compose build --no-cache
docker compose up -d
```

---

## 🌐 PARTE 8 — EXPONDO PORTA 3333 (Firewall/Rede)

Para acessar o Dashboard de fora da VPS, a porta `3333` deve estar aberta no firewall:

```bash
# Se usar UFW (Ubuntu):
ufw allow 3333/tcp
ufw reload

# Se usar firewall-cmd (CentOS/RHEL):
firewall-cmd --permanent --add-port=3333/tcp
firewall-cmd --reload
```

> 💡 **Dica de segurança:** Em produção, considere expor o Dashboard apenas internamente e usar o Nginx como proxy reverso com autenticação básica, para não deixar o painel acessível publicamente sem senha.

---

*Guia gerado por Antigravity AI — Março 2026*
