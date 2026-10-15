#!/bin/sh
# Nightly Postgres backups for Receipt-to-Report.
#
#   backup.sh loop                          run forever, one backup a day at BACKUP_HOUR (Manila time)
#   backup.sh once                          take one backup now and exit
#   backup.sh restore <file> [database]     restore a backup into a scratch database (default r2r_restore)
#
# Settings (environment): PGHOST, PGUSER, PGPASSWORD, PGDATABASE, BACKUP_DIR, BACKUP_HOUR (0-23, default 2),
# KEEP_DAYS (default 30).
set -eu

PGHOST="${PGHOST:-db}"
PGUSER="${PGUSER:-r2r}"
PGDATABASE="${PGDATABASE:-r2r}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_HOUR="${BACKUP_HOUR:-2}"
KEEP_DAYS="${KEEP_DAYS:-30}"
export PGHOST PGUSER PGDATABASE

log() { echo "[backup $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

take_backup() {
  mkdir -p "$BACKUP_DIR"
  stamp="$(date -u +%Y-%m-%d-%H%M)"
  tmp="$BACKUP_DIR/.r2r-$stamp.dump.partial"
  final="$BACKUP_DIR/r2r-$stamp.dump"
  if ! pg_dump --format=custom --no-owner --file="$tmp" "$PGDATABASE"; then
    rm -f "$tmp"
    echo "FAILED $stamp pg_dump error" > "$BACKUP_DIR/last-backup.txt"
    log "pg_dump failed"
    return 1
  fi
  # A backup that cannot be read back is not a backup.
  if ! pg_restore --list "$tmp" > /dev/null 2>&1 || [ ! -s "$tmp" ]; then
    rm -f "$tmp"
    echo "FAILED $stamp backup could not be read back" > "$BACKUP_DIR/last-backup.txt"
    log "backup could not be read back"
    return 1
  fi
  mv "$tmp" "$final"
  size="$(wc -c < "$final" | tr -d ' ')"
  echo "OK $stamp $(basename "$final") ${size} bytes" > "$BACKUP_DIR/last-backup.txt"
  log "wrote $(basename "$final") (${size} bytes)"
  find "$BACKUP_DIR" -maxdepth 1 -name 'r2r-*.dump' -mtime "+$KEEP_DAYS" -print -delete | while read -r old; do log "removed old backup $old"; done
}

restore_backup() {
  file="${1:?usage: backup.sh restore <file> [database]}"
  target="${2:-r2r_restore}"
  [ -f "$file" ] || { echo "No such file: $file" >&2; exit 1; }
  if [ "$target" = "$PGDATABASE" ]; then
    echo "Refusing to overwrite the live database '$PGDATABASE'. Restore to another name, check it, then swap." >&2
    exit 1
  fi
  psql -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$target\"" -c "CREATE DATABASE \"$target\""
  pg_restore --no-owner --dbname="$target" "$file"
  log "restored $(basename "$file") into database '$target'"
}

seconds_until_next_run() {
  # Manila is UTC+8 all year, so the run hour in UTC is fixed.
  utc_hour=$(( (BACKUP_HOUR + 16) % 24 ))
  now="$(date -u +%s)"
  midnight=$(( now - now % 86400 ))
  next=$(( midnight + utc_hour * 3600 ))
  [ "$next" -le "$now" ] && next=$(( next + 86400 ))
  echo $(( next - now ))
}

case "${1:-loop}" in
  once) take_backup ;;
  restore) shift; restore_backup "$@" ;;
  loop)
    log "starting; one backup a day at ${BACKUP_HOUR}:00 Manila time, keeping ${KEEP_DAYS} days"
    while true; do
      wait_for="$(seconds_until_next_run)"
      log "next backup in ${wait_for}s"
      sleep "$wait_for"
      take_backup || log "will try again tomorrow"
      sleep 60
    done
    ;;
  *) echo "usage: backup.sh loop | once | restore <file> [database]" >&2; exit 2 ;;
esac
