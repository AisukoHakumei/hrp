FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
RUN pnpm prune --prod

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 hrp \
 && adduser --system --uid 1001 --ingroup hrp hrp

RUN mkdir -p /data/uploads /data/backups \
 && chown -R hrp:hrp /data

COPY --from=builder --chown=hrp:hrp /app/build ./build
COPY --from=builder --chown=hrp:hrp /app/node_modules ./node_modules
COPY --from=builder --chown=hrp:hrp /app/drizzle ./drizzle
COPY --chown=hrp:hrp package.json .

USER hrp

EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/hrp.db
ENV UPLOAD_DIR=/data/uploads
ENV BACKUP_DIR=/data/backups

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "build/index.js"]
