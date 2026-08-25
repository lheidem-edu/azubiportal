# syntax=docker/dockerfile:1
#
# Produktionsabbild: Next.js im Standalone-Modus, dazu zwei eigenständig
# gebündelte Hilfsprogramme (Migration und Cron-Worker) ohne weitere
# Abhängigkeiten im Laufzeit-Abbild.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Die Migration zu einer Datei bündeln. `pg` bleibt extern, weil es native
# Bestandteile hat und ohnehin im Standalone-Build enthalten ist.
#
# Der Worker wird bewusst NICHT gebündelt: node-cron ermittelt den Pfad zu
# seinem Hintergrundprozess über `import.meta.url` und braucht dafür seine
# echten Dateien auf der Platte.
RUN npx esbuild src/db/migrate.ts \
      --bundle --platform=node --format=cjs --target=node24 \
      --external:pg --external:pg-native \
      --outfile=dist/migrate.cjs

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Europe/Berlin \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    MIGRATIONS_DIR=/app/drizzle

RUN apk add --no-cache tzdata curl \
 && addgroup -g 1001 nodejs \
 && adduser -u 1001 -G nodejs -S nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/worker.mjs ./worker.mjs
# node-cron hat keine eigenen Abhängigkeiten, der Ordner genügt.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/node-cron ./node_modules/node-cron
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
