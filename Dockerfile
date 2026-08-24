# Contexto de build é a RAIZ do monorepo (..), porque a plataforma depende de
# packages/checkout. Veja docker-compose.yml.
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY packages/checkout ./packages/checkout
COPY lojas.avilaops.com/package.json lojas.avilaops.com/package-lock.json* ./lojas.avilaops.com/
WORKDIR /repo/lojas.avilaops.com
RUN npm install --no-audit --no-fund

FROM deps AS build
COPY lojas.avilaops.com ./
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production PORT=3070 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/lojas.avilaops.com/.next/standalone ./
COPY --from=build /repo/lojas.avilaops.com/.next/static ./lojas.avilaops.com/.next/static
COPY --from=build /repo/lojas.avilaops.com/public ./lojas.avilaops.com/public
COPY --from=build /repo/lojas.avilaops.com/prisma ./lojas.avilaops.com/prisma
EXPOSE 3070
# `standalone` reproduz a árvore do monorepo; o server.js fica dentro da pasta do app.
CMD ["node", "lojas.avilaops.com/server.js"]
