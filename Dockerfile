FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev && mkdir -p public

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production APP_ENV=production HOST=0.0.0.0 PORT=8080 DATABASE_PATH=/data/quiz.sqlite NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends util-linux && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app /data && chown node:node /app /data
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist/next.config.mjs ./next.config.mjs
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src/features/content/samples ./src/features/content/samples
USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["flock", "--no-fork", "--nonblock", "/data/server.lock", "node", "dist/server.cjs"]
