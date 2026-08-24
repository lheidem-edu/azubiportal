#!/bin/sh
# Vor dem Start die Datenbank auf den aktuellen Stand bringen. Dadurch braucht
# ein Deployment keinen zusätzlichen Handgriff.
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  node /app/dist/migrate.cjs
fi

exec "$@"
