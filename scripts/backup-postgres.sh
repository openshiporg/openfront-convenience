#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/openfront-convenience-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
OFFSITE_REQUIRED="${BACKUP_OFFSITE_REQUIRED:-}"
if [ "${NODE_ENV:-}" = "production" ]; then
  [ "${BACKUP_PERSISTENT_STORAGE_MOUNTED:-}" = "true" ] || {
    echo "Production backup requires an explicitly mounted persistent volume (BACKUP_PERSISTENT_STORAGE_MOUNTED=true)" >&2
    exit 1
  }
  case "$BACKUP_DIR" in /tmp|/tmp/*|"") echo "Production BACKUP_DIR must be on the persistent backup volume" >&2; exit 1;; esac
  [ -n "$OFFSITE_REQUIRED" ] || OFFSITE_REQUIRED=true
else
  [ -n "$OFFSITE_REQUIRED" ] || OFFSITE_REQUIRED=false
fi
# Prisma accepts pool/schema query parameters that libpq tools reject. Preserve
# ordinary PostgreSQL connection options while removing only Prisma extensions.
PG_BACKUP_URL=$(node -e '
  const url = new URL(process.env.DATABASE_URL);
  for (const key of [
    "schema",
    "connection_limit",
    "pool_timeout",
    "pgbouncer",
    "statement_cache_size",
  ]) url.searchParams.delete(key);
  process.stdout.write(url.toString());
')
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
lock="$BACKUP_DIR/.backup.lock"
if ! mkdir "$lock" 2>/dev/null; then
  echo "A convenience backup is already running" >&2
  exit 1
fi
trap 'rm -rf "$lock"' EXIT

database_name=$(node -e 'const u=new URL(process.env.DATABASE_URL); const n=u.pathname.slice(1); if(!n) process.exit(1); process.stdout.write(n.replace(/[^A-Za-z0-9_-]/g,"_"))')
stamp=$(date -u +%Y%m%dT%H%M%SZ)
final="$BACKUP_DIR/${database_name}_${stamp}.dump"
temporary="$final.partial"

if command -v pg_dump >/dev/null 2>&1 && command -v pg_restore >/dev/null 2>&1; then
  pg_dump "$PG_BACKUP_URL" --format=custom --compress=9 --no-owner --no-acl --file="$temporary"
  pg_restore --list "$temporary" >/dev/null
elif [ -n "${OPENFRONT_POSTGRES_CONTAINER:-}" ] && command -v docker >/dev/null 2>&1; then
  docker exec "$OPENFRONT_POSTGRES_CONTAINER" \
    pg_dump "$PG_BACKUP_URL" --format=custom --compress=9 --no-owner --no-acl > "$temporary"
  docker exec -i "$OPENFRONT_POSTGRES_CONTAINER" pg_restore --list < "$temporary" >/dev/null
else
  echo "PostgreSQL pg_dump/pg_restore are required (or set OPENFRONT_POSTGRES_CONTAINER for a local Docker drill)" >&2
  exit 1
fi
chmod 600 "$temporary"
mv "$temporary" "$final"
(
  cd "$(dirname "$final")"
  shasum -a 256 "$(basename "$final")" > "$(basename "$final").sha256"
)
chmod 600 "$final.sha256"

offsite_replicated=false
if [ -n "${BACKUP_OFFSITE_BASE_URL:-}" ]; then
  command -v curl >/dev/null 2>&1 || { echo "curl is required for offsite backup replication" >&2; exit 1; }
  upload_base=$(node -e '
    const url = new URL(process.env.BACKUP_OFFSITE_BASE_URL);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) process.exit(1);
    process.stdout.write(url.toString().replace(/\/$/, ""));
  ') || { echo "BACKUP_OFFSITE_BASE_URL must be a credential-free HTTPS base URL without query or fragment" >&2; exit 1; }
  checksum=$(awk '{print $1}' "$final.sha256")
  if [ -n "${BACKUP_OFFSITE_BEARER_TOKEN:-}" ]; then
    case "$BACKUP_OFFSITE_BEARER_TOKEN" in *$'\n'*|*$'\r'*|*'"'*) echo "Offsite bearer token contains unsupported characters" >&2; exit 1;; esac
  fi
  upload_offsite_file() {
    local source_file="$1" content_type="$2" target_url="$upload_base/$(basename "$1")"
    local curl_args=(--fail --silent --show-error --retry 3 --connect-timeout 15 --max-time 1800 --request PUT --header "content-type: $content_type" --header "x-openfront-sha256: $checksum" --upload-file "$source_file" "$target_url")
    if [ -n "${BACKUP_OFFSITE_BEARER_TOKEN:-}" ]; then
      printf 'header = "Authorization: Bearer %s"\n' "$BACKUP_OFFSITE_BEARER_TOKEN" | curl --config - "${curl_args[@]}"
    else
      curl "${curl_args[@]}"
    fi
  }
  upload_offsite_file "$final" "application/octet-stream"
  upload_offsite_file "$final.sha256" "text/plain"
  offsite_replicated=true
elif [ "$OFFSITE_REQUIRED" = "true" ]; then
  echo "Offsite backup replication is required but BACKUP_OFFSITE_BASE_URL is not configured" >&2
  exit 1
fi
BACKUP_OFFSITE_REPLICATED="$offsite_replicated" npx tsx scripts/recordBackupHeartbeat.ts "$final"
find "$BACKUP_DIR" -type f \( -name '*.dump' -o -name '*.dump.sha256' \) -mtime "+$RETENTION_DAYS" -delete
printf 'backup=%s\noffsite_replicated=%s\n' "$final" "$offsite_replicated"
