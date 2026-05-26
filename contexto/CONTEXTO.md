# OpenGravity — Documentação Completa de Arquitetura, Construção e Deploy

> **Versão:** 1.1.0 | **Data:** Março, 2026 | **Autor:** Diego (com assistência da IA)
> **Conta Google:** gentillidiego@gmail.com | **Bot Telegram:** @OpenGravityDP_bot

---

## 1. VISÃO GERAL DO PROJETO

O **OpenGravity** é um sistema de agentes de IA **generalista e multi-persona**, construído do zero para ser versátil e acessível. Roda em VPS via Docker, oferecendo comunicação via Telegram e WhatsApp.

### Capacidades Atuais
| Capacidade | Tecnologia | Status |
|---|---|---|
| Chat via Telegram | grammy (long polling) | ✅ Ativo |
| Chat via WhatsApp | @whiskeysockets/baileys | ✅ Ativo (Público) |
| Dashboard Web | Express.js (Porta 3333) | ✅ Ativo |
| Treinamento/Personalidade | .md dinâmico | ✅ Ativo |
| LLM (cérebro) | Groq API (Llama 3.3 70B) | ✅ Ativo |
| LLM Fallback | OpenRouter | ✅ Ativo |
| Memória persistente | SQLite (better-sqlite3) | ✅ Ativo |
| Limite de memória | Janela 50 msgs + 30 dias | ✅ Ativo |
| Perfil por usuário | Tabela user_profiles | ✅ Ativo |
| Transcrição de áudio | Groq Whisper Large v3 | ✅ Ativo |
| Resposta em áudio | ElevenLabs (voz v2) | ✅ Ativo |
| Google Workspace | gog CLI (OAuth 2.0) | ✅ Ativo |
| Deploy Docker | Docker + Portainer | ✅ Em produção |

---

## 2. STACK TECNOLÓGICA

```
Linguagem:      TypeScript (ES Modules)
Runtime:        Node.js 22
Bot Telegram:   grammy
WhatsApp:       @whiskeysockets/baileys
Dashboard:      Express + Vanilla JS + CSS
LLM primário:   Groq SDK (llama-3.3-70b-versatile)
LLM fallback:   OpenRouter (openrouter/free)
Transcrição:    Groq Audio API (whisper-large-v3)
TTS:            ElevenLabs API (eleven_multilingual_v2)
Memória:        better-sqlite3 (SQLite)
Google APIs:    gogcli (CLI compilado em Go)
Deploy:         Docker + docker compose + Portainer
```

---

## 3. ESTRUTURA DE PASTAS

```
/Agente
├── .env                          # Credenciais de produção (NUNCA commitar)
├── .env.example                  # Template com todas as variáveis
├── personality.md                # Personalidade ativa (ex: Dra. Eliza)
├── package.json
├── tsconfig.json
├── Dockerfile                    # Multi-stage: Go (gog) + Node.js 22-slim
├── docker-compose.yml            # Volumes, portas, env_file, healthcheck
├── .dockerignore
├── memory.db                     # SQLite (criado automaticamente)
├── docker-deploy/                # ← Arquivos prontos para enviar à VPS
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── .dockerignore
│   └── DEPLOY_VPS_PORTAINER.md  # Guia passo a passo completo
├── dashboard/                    # Frontend HTML/CSS/JS do Painel
├── contexto/
│   └── CONTEXTO.md               # Este arquivo
└── src/
    ├── index.ts                  # Entry point
    ├── config.ts                 # Lê e sanitiza .env
    ├── bot.ts                    # Bot Telegram (grammy)
    ├── agent/
    │   └── loop.ts               # Agent loop — contexto + perfil + tools
    ├── dashboard/
    │   └── server.ts             # API do Painel
    ├── whatsapp/
    │   ├── whatsapp.ts           # Baileys (conexão, mensagens, auth)
    │   └── state.ts              # Estado compartilhado (QR, status)
    ├── memory/
    │   └── db.ts                 # SQLite + janela 50 msgs + limpeza 30 dias + user_profiles
    ├── llm/
    │   └── provider.ts           # Groq + OpenRouter fallback
    ├── tts/
    │   └── elevenlabs.ts
    └── tools/
        ├── registry.ts           # Roteador de tools (passa userId)
        ├── time.ts
        ├── google.ts
        └── user_memory.ts        # Tool: remember_user_info (perfil permanente)
```

---

## 4. VARIÁVEIS DE AMBIENTE (`.env`)

```env
# Telegram
TELEGRAM_BOT_TOKEN=          # Token do @BotFather
TELEGRAM_ALLOWED_USER_IDS=   # IDs separados por vírgula

# LLM
GROQ_API_KEY=                # groq.com
OPENROUTER_API_KEY=          # openrouter.ai/keys (formato: sk-or-v1-...)
OPENROUTER_MODEL=openrouter/free

# Banco de dados
DB_PATH=./memory.db

# Google
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GOG_ACCOUNT=                 # Gmail autenticado

# WhatsApp
WHATSAPP_ENABLED=true
WHATSAPP_ALLOWED_NUMBERS=    # Vazio = Modo Público

# ElevenLabs TTS
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=         # Ex: cgSgspJ2msm6clMCkdW9 (Jessica)

# Ambiente
NODE_ENV=production
```

---

## 5. SISTEMA DE MEMÓRIA

### 5.1 Janela deslizante (últimas 50 mensagens)
O banco guarda toda a história, mas o LLM recebe apenas as **50 mensagens mais recentes** por usuário. Implementado em `src/memory/db.ts`:
```sql
SELECT * FROM (SELECT * FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT 50) ORDER BY id ASC
```

### 5.2 Limpeza automática (30 dias)
Ao iniciar o container e a cada 24h, mensagens com mais de 30 dias são apagadas do banco automaticamente.

### 5.3 Perfil permanente por usuário
Tabela `user_profiles` no SQLite armazena `name` e `notes` por `user_id`.
- A IA recebe instrução de **chamar a tool `remember_user_info`** sempre que o usuário revelar dados pessoais
- O perfil é injetado no system prompt em toda conversa: `[MEMÓRIA PERMANENTE DO USUÁRIO]`
- **Não é apagado pela limpeza de 30 dias** — é permanente

### 5.4 Lógica de fallback LLM
```
Groq (llama-3.3-70b-versatile) ──► erro/rate limit ──► OpenRouter (openrouter/free)
                                                          └── erro ──► "Desculpe, erro interno"
```
Limite gratuito Groq: **100.000 tokens/dia** (reseta à meia-noite UTC).

---

## 6. VPS DE PRODUÇÃO

### Dados de acesso
```
IP:           72.60.248.85
Usuário:      diego
Console Web:  https://srv1403247.hstgr.cloud:9090
Portainer:    https://72.60.248.85:9443
Dashboard:    http://72.60.248.85:3333
OS:           Debian GNU/Linux 6.12 (srv1403247)
```

### Pasta do projeto na VPS
```
/home/diego/opengravity/
├── Dockerfile
├── docker-compose.yml
├── .env                   # Preenchido com chaves reais
├── personality.md
├── src/                   # Código-fonte TypeScript
├── dashboard/
├── package.json
├── tsconfig.json
├── memory.db              # Banco de dados SQLite persistente
├── whatsapp-session/      # Sessão WhatsApp (não apagar!)
└── gogcli-config/         # Tokens Google OAuth
```

### Comandos essenciais na VPS
```bash
# Conectar via SSH
ssh diego@72.60.248.85

# Navegar para o projeto
cd /home/diego/opengravity

# Ver logs em tempo real
docker logs opengravity -f

# Reiniciar (sem rebuild — para mudanças em .env ou personality.md)
docker compose restart

# Atualizar código TypeScript (após enviar novos .ts via SCP)
docker compose down && docker compose up -d --build

# Status dos containers
docker ps
```

### Fluxo para atualizar código na VPS
```bash
# 1. Na máquina LOCAL — enviar arquivos modificados
scp /home/motoflow/Downloads/Diego/Agente/src/arquivo.ts \
    diego@72.60.248.85:/home/diego/opengravity/src/...

# 2. Na VPS — reconstruir e subir
cd /home/diego/opengravity
docker compose down && docker compose up -d --build

# 3. Confirmar
docker logs opengravity --tail=20
```

---

## 7. OUTROS CONTAINERS NA VPS
| Container | Imagem | Portas | Stack |
|---|---|---|---|
| portainer | portainer-ce:latest | 9443, 8000 | - |
| stirling-pdf | frooodle/s-pdf | 8080 | stirling-pdf |
| uptime-kuma | louislam/uptime-kuma | 3025 | uptime-kuma |
| opengravity | opengravity:latest | 3333 | opengravity |

---

## 8. IDs IMPORTANTES
```
Telegram Bot:      @OpenGravityDP_bot
Telegram User ID:  83013502 (Diego)
Gmail:             gentillidiego@gmail.com
WhatsApp do bot:   +55 82 8744-7403
ElevenLabs Voice:  cgSgspJ2msm6clMCkdW9 (Jessica — PT-BR)
Groq Model:        llama-3.3-70b-versatile
Whisper Model:     whisper-large-v3
ElevenLabs Model:  eleven_multilingual_v2
Max LLM iter:      5 (agent loop)
Janela memória:    50 mensagens
Retenção banco:    30 dias
```

---

## 9. ADICIONAR NOVAS FERRAMENTAS (TOOLS)

1. Crie `src/tools/minha_ferramenta.ts`
2. Exporte `minhaFerramentaConfig` (configuração da tool para o LLM) e `executarMinhaFerramenta(args)`
3. Em `src/tools/registry.ts`:
   - Importe e adicione ao `agentToolsConfig`
   - Adicione o `if (name === 'nome_da_ferramenta')` no `executeTool`

---

## 10. CHAVES DE API — ONDE OBTER

| Chave | Onde obter | Plano gratuito? |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather no Telegram | ✅ Grátis |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) | ✅ 100k tokens/dia |
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) | ✅ Modelos free |
| `ELEVENLABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io) | ✅ 10k chars/mês |
| `GOOGLE_OAUTH` | [console.cloud.google.com](https://console.cloud.google.com) | ✅ Grátis |

---

## 11. TROUBLESHOOTING

### Container crasha após iniciar (portas somem no Portainer)
→ Ver logs: `docker logs opengravity --tail=50`
→ Causa comum: `memory.db` montado como diretório. Solução:
```bash
docker compose down && rm -rf memory.db && touch memory.db && chmod 664 memory.db && docker compose up -d
```

### "Desculpe, encontrei um erro interno" no WhatsApp/Telegram
→ Rate limit do Groq atingido. Verificar: `docker logs opengravity | grep "rate_limit"`
→ Aguardar reset (meia-noite UTC) ou verificar chave OpenRouter:
```bash
docker exec opengravity printenv | grep OPENROUTER
```

### dotenv mostra "(0) from .env"
→ O arquivo `.env` não está montado dentro do container. Verificar o volume no `docker-compose.yml`.

### OpenRouter retorna 401
→ Chave inválida ou com erro de digitação. Formato correto: `sk-or-v1-...`
→ Corrigir no `.env` e fazer `docker compose down && docker compose up -d`

### Bot Telegram não responde
→ Token inválido. Verificar `TELEGRAM_BOT_TOKEN` no `.env`.
→ Ver logs: `docker logs opengravity | grep "\[Bot\]"`

### WhatsApp desconectado após reinicialização
→ A sessão é persistida em `./whatsapp-session/`. Se a pasta for apagada, escanear QR novamente pelo Dashboard: `http://72.60.248.85:3333`

---

*Documento atualizado por Antigravity AI — Março 2026.*
