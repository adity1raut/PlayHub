# ---- build the static app
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Empty = same origin: nginx below proxies /api, /socket.io and /uploads to the backend.
# Set it only when the API lives on another domain.
ARG VITE_BACKEND_URL=""
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
RUN npm run build

# ---- serve it
FROM nginx:1.27-alpine
# Where nginx forwards API and socket traffic (the compose service name by default)
ENV API_UPSTREAM=http://backend:4000
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
