#!/usr/bin/env bash
set -euo pipefail

backup="${1:?usage: verify-backup.sh /path/to/backup.dump}"
[ -f "$backup" ] || { echo "Backup not found" >&2; exit 1; }
[ -f "$backup.sha256" ] || { echo "Backup checksum not found" >&2; exit 1; }
(
  cd "$(dirname "$backup")"
  shasum -a 256 -c "$(basename "$backup").sha256"
)
if command -v pg_restore >/dev/null 2>&1; then
  pg_restore --list "$backup" >/dev/null
elif [ -n "${OPENFRONT_POSTGRES_CONTAINER:-}" ] && command -v docker >/dev/null 2>&1; then
  docker exec -i "$OPENFRONT_POSTGRES_CONTAINER" pg_restore --list < "$backup" >/dev/null
else
  echo "PostgreSQL pg_restore is required (or set OPENFRONT_POSTGRES_CONTAINER for a local Docker drill)" >&2
  exit 1
fi
printf 'verified=%s\n' "$backup"
