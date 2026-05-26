# ============================================================
# Stage 1: Build gog CLI (Go tool para Google APIs)
# ============================================================
FROM golang:1.24-alpine AS gog-builder
ENV GOTOOLCHAIN=auto
RUN apk add --no-cache git
RUN git clone https://github.com/steipete/gogcli.git /tmp/gogcli
WORKDIR /tmp/gogcli
RUN go build -o /usr/local/bin/gog ./cmd/gog

# ============================================================
# Stage 2: App principal (Node.js 22 - Debian Slim)
# ============================================================
FROM node:22-slim

# Dependências do sistema (Debian/apt-get)
# chromium-sandbox e libs são necessárias para o Baileys se usar puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia o gog compilado do stage 1
COPY --from=gog-builder /usr/local/bin/gog /usr/local/bin/gog

# Instala dependências Node primeiro (camada cacheável)
COPY package*.json ./
RUN npm install --omit=dev || npm install

# Copia o código-fonte
COPY src/ ./src/
COPY dashboard/ ./dashboard/
COPY tsconfig.json ./
COPY personality.md ./

# Expõe a porta do Dashboard (acesso externo via Portainer/Nginx)
EXPOSE 3333

# Healthcheck para o Portainer monitorar o container
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3333/api/status || exit 1

# Comando de produção
CMD ["npx", "tsx", "src/index.ts"]
