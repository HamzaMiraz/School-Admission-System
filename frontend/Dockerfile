# --- build ----------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# --- test: `docker compose --profile test run --rm frontend-tests` -------------------
FROM build AS test
CMD ["npm", "test"]

# --- runtime: static files served by nginx -------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Writes config.js from the API_URL env var each time the container starts
COPY docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
ENV API_URL=http://localhost:8080
EXPOSE 80
