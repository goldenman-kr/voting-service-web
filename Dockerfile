# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
ARG NEXT_PUBLIC_NAV_BADGE=""
ENV NEXT_PUBLIC_NAV_BADGE=${NEXT_PUBLIC_NAV_BADGE}
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/buildtime
ENV APP_URL=https://localhost
ENV SESSION_SECRET=build_time_dummy_secret_32_bytes_minimum
ENV ENCRYPTION_KEY=build_time_dummy_secret_32_bytes_minimum
ENV HMAC_KEY=build_time_dummy_secret_32_bytes_minimum
COPY prisma ./prisma
COPY public ./public
COPY src ./src
COPY next.config.ts postcss.config.cjs tailwind.config.ts tsconfig.json prisma.config.ts ./
RUN npm run db:generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/guardrails ./src/guardrails
COPY --from=builder /app/src/lib/env.ts ./src/lib/env.ts
COPY --from=builder /app/src/server/auth/bootstrap-admin.ts ./src/server/auth/bootstrap-admin.ts
COPY --from=builder /app/src/server/auth/password.ts ./src/server/auth/password.ts
COPY scripts/bootstrap-admin.ts ./scripts/bootstrap-admin.ts
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN useradd --create-home --shell /usr/sbin/nologin nextjs
USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
