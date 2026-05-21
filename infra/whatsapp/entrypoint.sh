#!/bin/sh
# WPPConnect Server v2.10.0 loads config from dist/config.js (compiled).
# CLI --config + --secretKey are silently ignored. We patch dist/config.js
# at startup so the runtime secret never lives in a baked image layer.
set -e

if [ -z "$WPP_SECRET_KEY" ]; then
  echo "[entrypoint] WPP_SECRET_KEY is not set" >&2
  exit 1
fi

CONFIG_JS=/app/dist/config.js
if [ ! -f "$CONFIG_JS" ]; then
  echo "[entrypoint] $CONFIG_JS not found" >&2
  exit 1
fi

# Replace the baked default secret key with our runtime one. Only the FIRST
# occurrence (the actual config value) — leave doc strings alone.
sed -i "0,/secretKey: 'THISISMYSECURETOKEN'/ s||secretKey: '${WPP_SECRET_KEY}'|" "$CONFIG_JS"

# Disable autoClose (60s default kills QR generation on slower hosts).
sed -i "s|autoClose: 60000|autoClose: 0|g" "$CONFIG_JS"

# Disable startAllSession so we don't auto-launch antagna on boot before
# the webhook is ready.
sed -i "s|startAllSession: true|startAllSession: false|g" "$CONFIG_JS"

echo "[entrypoint] patched dist/config.js — secret installed + autoClose disabled"
exec node dist/server.js
