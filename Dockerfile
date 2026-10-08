FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
FROM base AS build
COPY package.json package-lock.json ./
COPY packages ./packages
COPY prisma ./prisma
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 FUNDO_MODELOS_DIR=/app/modelos
RUN node --input-type=module -e "import { baixarModelo } from './packages/removedor-de-fundo/src/modelo.ts'; await baixarModelo('u2netp')"
RUN npx prisma generate && npm run typecheck && npm run lint && npm test && npm run build
FROM base AS runtime
ENV NODE_ENV=production PORT=3080 HOSTNAME=0.0.0.0 FUNDO_MODELOS_DIR=/app/modelos
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/node_modules/onnxruntime-node ./node_modules/onnxruntime-node
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/modelos ./modelos
RUN node -e "require('onnxruntime-node').InferenceSession.create('/app/modelos/u2netp.onnx', {executionProviders:['cpu'],intraOpNumThreads:1,interOpNumThreads:1}).then(s=>s.release()).catch(e=>{console.error(e.message);process.exit(1)})"
EXPOSE 3080
CMD ["node", "server.js"]
