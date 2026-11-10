#!/bin/sh
# Runs at container start (nginx image runs /docker-entrypoint.d/*.sh).
# Lets the backend URL be changed with the API_URL env var without rebuilding the image.
set -eu

api_url="${API_URL:-http://localhost:8080}"
escaped=$(printf '%s' "$api_url" | sed 's/\\/\\\\/g; s/"/\\"/g')

printf 'window.__APP_CONFIG__ = { API_URL: "%s" };\n' "$escaped" > /usr/share/nginx/html/config.js
echo "runtime-config: API_URL=$api_url"
