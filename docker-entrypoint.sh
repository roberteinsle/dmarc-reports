#!/bin/sh
set -e

echo "==================================="
echo "DMARC Reports - Starting Container"
echo "==================================="

# Print environment info
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Environment: ${NODE_ENV}"
echo "Port: ${PORT}"
echo "Database path: ${DATABASE_PATH}"

# Check if database exists
if [ ! -f "${DATABASE_PATH}" ]; then
  echo ""
  echo "Database not found. Initializing database..."
  echo "Running: npm run db:init"

  # Initialize database
  npm run db:init

  if [ $? -eq 0 ]; then
    echo "Database initialized successfully!"
  else
    echo "ERROR: Database initialization failed!"
    exit 1
  fi
else
  echo ""
  echo "Database found at ${DATABASE_PATH}"
  echo "Skipping initialization..."
fi

# Validate required environment variables
echo ""
echo "Validating environment variables..."

required_vars="IMAP_HOST IMAP_PORT IMAP_USER IMAP_PASSWORD ANTHROPIC_API_KEY POSTAL_API_KEY POSTAL_BASE_URL NOTIFICATION_TO_EMAIL NOTIFICATION_FROM_EMAIL"

missing_vars=""
for var in $required_vars; do
  eval value=\$$var
  if [ -z "$value" ]; then
    missing_vars="$missing_vars $var"
  fi
done

if [ -n "$missing_vars" ]; then
  echo "ERROR: Missing required environment variables:$missing_vars"
  echo "Please check your .env file or docker-compose.yml"
  exit 1
fi

echo "All required environment variables are set."

# Print configuration (without sensitive data)
echo ""
echo "==================================="
echo "Configuration:"
echo "==================================="
echo "IMAP Server: ${IMAP_HOST}:${IMAP_PORT}"
echo "IMAP User: ${IMAP_USER}"
echo "Postal Server: ${POSTAL_BASE_URL}"
echo "Notification To: ${NOTIFICATION_TO_EMAIL}"
echo "Notification From: ${NOTIFICATION_FROM_EMAIL}"
echo "Cron Schedule: ${CRON_SCHEDULE}"
echo "App URL: ${NEXT_PUBLIC_APP_URL}"
echo "==================================="

# Start the application
echo ""
echo "Starting DMARC Reports application..."
echo "Server will be available at: http://localhost:${PORT}"
echo ""

# Execute the main process (Next.js server with scheduler)
exec node server.js
