#!/usr/bin/env bash
# Spin up an ephemeral postgres, apply the schema, run the integration
# test suite, tear postgres down on exit. Idempotent.
set -euo pipefail

CONTAINER=blogflock-test-pg
PORT="${BLOGFLOCK_TEST_PG_PORT:-54322}"

# Resolve repo root from this script's location so the script works
# regardless of cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/.." && pwd)"

cleanup() {
  docker stop "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Wipe any leftover container from a prior crashed run.
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

echo "==> Starting postgres on :$PORT"
docker run -d --rm \
  --name "$CONTAINER" \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=blogflock_test \
  -p "$PORT:5432" \
  postgres:17-alpine >/dev/null

echo "==> Waiting for postgres + target database to be ready"
# pg_isready returns success as soon as the server accepts connections,
# which happens before POSTGRES_DB is created. Run an actual query against
# the target db so we don't race the schema apply.
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" \
    psql -U test -d blogflock_test -c 'SELECT 1' >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo "==> Applying schema"
docker exec -i "$CONTAINER" \
  psql -U test -d blogflock_test \
  < "$REPO_ROOT/db/schema.sql" >/dev/null

echo "==> Running deno test"
cd "$APP_DIR"
# Match the production environment: postgres is UTC inside Docker, and the
# `published_at` column is `timestamp without time zone`. Running the deno
# process under TZ=UTC ensures roundtrip equality on date comparisons.
export TZ=UTC
export POSTGRES_USER=test
export POSTGRES_PASSWORD=test
export POSTGRES_DB=blogflock_test
export POSTGRES_HOST=localhost
export POSTGRES_PORT="$PORT"
# Stripe / SMTP / etc. are not required by the poller tests but set
# dummy values defensively in case future tests transitively load them.
export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_dummy}"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-dummy}"
export STRIPE_PRICE_ID="${STRIPE_PRICE_ID:-price_dummy}"
export EMAIL_FROM="${EMAIL_FROM:-test@test.com}"
export SMTP_HOST="${SMTP_HOST:-localhost}"
export SMTP_PORT="${SMTP_PORT:-587}"
export SMTP_USER="${SMTP_USER:-test}"
export SMTP_PASSWORD="${SMTP_PASSWORD:-test}"
export APP_URL="${APP_URL:-http://localhost:8021}"
export JWT_SECRET="${JWT_SECRET:-dummy_jwt_secret}"
export SIGNED_COOKIE_SECRET="${SIGNED_COOKIE_SECRET:-dummy_cookie_secret}"

# --no-check skips type-checking during test runs (faster, and we have
# `deno task check` for that). Tests run sequentially within a file by
# default; --parallel would race on the shared DB.
deno test -A --no-check "$@" test/
