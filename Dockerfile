# Зафіксована версія базового образу (не latest)
FROM node:20.18.1-bookworm-slim AS deps

WORKDIR /app

# Залежності — окремий шар до копіювання коду (кеш збірки)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

FROM node:20.18.1-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Процес не від root
RUN groupadd --system --gid 10001 app \
  && useradd --system --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY openapi.yaml ./
COPY src ./src

USER app

EXPOSE 8080

CMD ["node", "src/server.js"]
