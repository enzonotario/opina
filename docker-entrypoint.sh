#!/bin/sh
set -e

DATA_DIR="${OPINA_DATA_DIR:-/data}"
mkdir -p "$DATA_DIR" "$DATA_DIR/tmp" 2>/dev/null || true

# Prefer dropping to the `opina` user when started as root (image default).
# docker-compose may override with host UID/GID for shared ./data permissions.
if [ "$(id -u)" = "0" ] && id opina >/dev/null 2>&1; then
  chown -R opina:opina "$DATA_DIR" 2>/dev/null || true
  exec setpriv --reuid="$(id -u opina)" --regid="$(id -g opina)" --clear-groups -- \
    bun .output/server/index.mjs
fi

exec bun .output/server/index.mjs
