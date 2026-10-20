FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @meeting-intel/api...
COPY apps/api apps/api
RUN pnpm --filter @meeting-intel/api build \
  && pnpm deploy --filter @meeting-intel/api --prod --legacy /out

FROM node:22-slim AS runtime
ENV NODE_ENV=production MODELS_CACHE_DIR=/app/.models
WORKDIR /app
COPY --from=build /out/node_modules node_modules
COPY --from=build /out/package.json package.json
COPY --from=build /repo/apps/api/dist dist
COPY apps/api/migrations migrations
RUN mkdir -p .models && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
