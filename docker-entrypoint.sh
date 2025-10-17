#!/bin/sh
set -e

echo "=== MB4 Service Startup ==="
echo "Environment: ${MB_ENV:-development}"

# Only run migrations in production (dev uses sync())
if [ "${MB_ENV}" = "production" ]; then
  echo "Running database migrations..."
  npx sequelize-cli db:migrate --env production
  
  echo "Checking migration status..."
  npx sequelize-cli db:migrate:status --env production
fi

echo "Starting application..."
exec node src/server.js

