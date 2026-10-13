# TL-Organizer — образ для hostit.mifcom.dev (MIDAS).
# Сборка идёт на стороне платформы из загруженного tar.gz.
# Контейнер слушает $PORT (по умолчанию 3000) на 0.0.0.0 — требование hostit.

# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* вшиваются в клиентский бандл на этапе сборки.
# Значения берутся из .env.production, который кладётся в архив скриптом
# scripts/pack-hostit.sh и намеренно не хранится в git.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
USER nextjs
EXPOSE 3000
# Миграции применяются до старта сервера. Если схема не легла, контейнер не
# поднимается: приложение, которое молча не работает, хуже упавшего.
CMD ["sh", "-c", "node db/migrate.js && node server.js"]
