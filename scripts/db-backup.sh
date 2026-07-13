#!/usr/bin/env bash
# ─────────────────────────────────────────────
# 에움길 DB 백업 (운영-준비-플랜 §5.5)
#
# pg_dump 1회 실행 + 보존 기간(기본 7일) 초과분 삭제.
# 사용자 데이터(saved/review/visit/user_profile)가 유일하게 복구 불가능한
# 데이터이므로 DB 전체를 custom 포맷으로 덤프한다.
#
# 사용:
#   DATABASE_URL="postgres://..." ./scripts/db-backup.sh
#   BACKUP_DIR=/data/backup RETENTION_DAYS=7 DATABASE_SCHEMA=eumgil ...  # 선택
#
# 크론 등록 예 (매일 04:15, 배포 호스트):
#   15 4 * * * DATABASE_URL="postgres://..." BACKUP_DIR=/data/backup \
#     /path/to/eumgil/scripts/db-backup.sh >> /var/log/eumgil-backup.log 2>&1
#
# 복원 (리허설 절차 — §5.5 DoD):
#   pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" <파일>.dump
# ─────────────────────────────────────────────
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL 이 필요합니다 (postgres://user:pass@host:port/db)}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/eumgil-$STAMP.dump"

# DATABASE_SCHEMA 지정 시 해당 스키마만 (앱 스키마 분리 운영 시).
SCHEMA_ARGS=()
if [[ -n "${DATABASE_SCHEMA:-}" && "${DATABASE_SCHEMA}" != "public" ]]; then
  SCHEMA_ARGS=(--schema="$DATABASE_SCHEMA")
fi

# ${arr[@]+...} 패턴: bash 3.2(macOS 기본)의 set -u 는 빈 배열 확장을 에러로 본다.
pg_dump --format=custom --no-owner ${SCHEMA_ARGS[@]+"${SCHEMA_ARGS[@]}"} --file="$FILE" "$DATABASE_URL"
echo "[db-backup] saved $FILE ($(du -h "$FILE" | cut -f1))"

# 보존 기간 초과분 정리 (파일명 패턴 한정 — 다른 파일은 건드리지 않음)
DELETED=$(find "$BACKUP_DIR" -name 'eumgil-*.dump' -mtime +"$RETENTION_DAYS" -print -delete | wc -l | tr -d ' ')
echo "[db-backup] retention ${RETENTION_DAYS}d, pruned $DELETED file(s)"
