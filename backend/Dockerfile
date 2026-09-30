# ---- deps: production node_modules. mediasoup downloads a prebuilt media worker here, or
# compiles one with the build tools below when no prebuilt binary matches the platform.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- runtime
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=4000 \
    SFU_PORT=44444
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# data/ holds generated VAPID keys, uploads/ holds locally stored files: mount volumes here
RUN mkdir -p data uploads/chat && chown -R node:node data uploads
USER node

EXPOSE 4000 44444/udp 44444/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["node", "src/server.js"]
