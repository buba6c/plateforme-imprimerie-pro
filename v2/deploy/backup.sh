#!/usr/bin/env bash
# Sauvegarde quotidienne d'Evocom Print v2 : base PostgreSQL + fichiers d'impression.
# - Base : pg_dump compressé, conservé BACKUP_JOURS jours.
# - Fichiers : instantané rsync avec liens physiques (seuls les fichiers nouveaux prennent de la place).
# - Copie hors du serveur si RCLONE_DEST est défini (ex. "b2:evocom-sauvegardes").
# - Le résultat est enregistré dans la table `sauvegardes`, affichée dans l'écran « Sauvegardes et état ».
# Planification (root) : 15 2 * * * /var/www/evocom/v2/deploy/backup.sh >> /var/log/evocom-backup.log 2>&1
set -euo pipefail

ENV_FILE="${ENV_FILE:-$(cd "$(dirname "$0")/../api" && pwd)/.env}"
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

DEST="${BACKUP_DIR:-/var/backups/evocom}"
JOURS="${BACKUP_JOURS:-14}"
DATE="$(date +%Y%m%d-%H%M)"
mkdir -p "$DEST/base" "$DEST/fichiers"
chmod 700 "$DEST"

enregistrer() {
  local ok="$1" fichier="$2" taille="$3" message="$4"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c \
    "INSERT INTO sauvegardes (ok, fichier, taille, message) VALUES ($ok, '$fichier', $taille, \$m\$$message\$m\$)" || true
}

trap 'enregistrer false "" 0 "Échec de la sauvegarde à la ligne $LINENO"' ERR

DUMP="$DEST/base/evocom-$DATE.dump"
pg_dump --format=custom --no-owner --file="$DUMP" "$DATABASE_URL"
pg_restore --list "$DUMP" > /dev/null   # vérifie que le fichier est lisible

DERNIER="$(ls -1d "$DEST"/fichiers/20* 2>/dev/null | tail -n 1 || true)"
# Liens physiques vers l'instantané précédent ET vers le stockage lui-même : même le premier instantané
# ne recopie pas les fichiers (sinon une copie complète des uploads importés peut remplir le disque).
# Un fichier supprimé dans l'application reste récupérable dans les instantanés pendant BACKUP_JOURS jours.
rsync -a --delete ${DERNIER:+--link-dest="$DERNIER"} --link-dest="$(cd "$STORAGE_DIR" && pwd)" "$STORAGE_DIR/" "$DEST/fichiers/$DATE/"

find "$DEST/base" -name 'evocom-*.dump' -mtime +"$JOURS" -delete
find "$DEST/fichiers" -mindepth 1 -maxdepth 1 -type d -mtime +"$JOURS" -exec rm -rf {} +

if [ -n "${RCLONE_DEST:-}" ]; then
  rclone copy "$DUMP" "$RCLONE_DEST/base/"
  rclone sync "$STORAGE_DIR" "$RCLONE_DEST/fichiers/"
  HORS_SITE=" et copiée hors du serveur"
else
  HORS_SITE=" (pas de copie hors du serveur : définir RCLONE_DEST)"
fi

TAILLE="$(stat -c %s "$DUMP")"
enregistrer true "$DUMP" "$TAILLE" "Sauvegarde terminée$HORS_SITE"
echo "$(date '+%F %T') sauvegarde OK : $DUMP ($TAILLE octets)$HORS_SITE"
