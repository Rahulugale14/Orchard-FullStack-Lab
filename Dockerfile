FROM node:22.13-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/app/data/orchard.sqlite QA_MODE=false
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir -p /app/data && chown -R node:node /app
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--experimental-strip-types", "src/server.ts"]
