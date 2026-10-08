#!/usr/bin/env bash
# Sauvegarde quotidienne d'Evocom Print v2 : base PostgreSQL + fichiers d'impression.
# - Base : pg_dump compressé, conservé BACKUP_JOURS jours.
# - Fichiers : instantané rsync avec liens physiques (seuls les fichiers nouveaux prennent de la place).
# - Copie hors du serveur si RCLONE_DEST est défini (ex. "b2:evocom-sauvegardes") ; les fichiers effacés ou
#   remplacés côté serveur sont déplacés dans fichiers-supprimes/<date> (gardés RCLONE_JOURS jours), jamais perdus.
# - Le résultat est enregistré dans la table `sauvegardes`, affichée dans l'écran « Sauvegardes et état ».
# Planification (root) : 15 2 * * * /var/www/evocom/v2/deploy/backup.sh >> /var/log/evocom-backup.log 2>&1
# Aussi lancé par l'API (bouton « Sauvegarder maintenant ») : elle passe ENV_FILE vide et ses propres variables.
#
# Variables : DATABASE_URL, STORAGE_DIR (obligatoires), BACKUP_DIR, BACKUP_JOURS, RCLONE_DEST, RCLONE_JOURS.
# ENV_FILE : fichier .env à charger (par défaut v2/api/.env) ; s'il n'existe pas, ou si ENV_FILE est vide,
# les variables d'environnement déjà présentes sont utilisées.
set -euo pipefail

ENV_DEFAUT="$(cd "$(dirname "$0")/.." && pwd)/api/.env"
ENV_FILE="${ENV_FILE-$ENV_DEFAUT}"
if [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

: "${DATABASE_URL:?DATABASE_URL absent : définissez-le (ou ENV_FILE vers le .env de l'API).}"
: "${STORAGE_DIR:?STORAGE_DIR absent : définissez-le (ou ENV_FILE vers le .env de l'API).}"

DEST="${BACKUP_DIR:-/var/backups/evocom}"
JOURS="${BACKUP_JOURS:-14}"
JOURS_HORS_SITE="${RCLONE_JOURS:-30}"
DATE="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST/base" "$DEST/fichiers"
chmod 700 "$DEST"

# Une seule sauvegarde à la fois (tâche planifiée et bouton de l'écran). Verrou par répertoire : portable,
# et un verrou de plus de 6 heures (sauvegarde tuée) est considéré comme abandonné.
VERROU="$DEST/.sauvegarde-en-cours"
if [ -d "$VERROU" ] && [ -n "$(find "$VERROU" -maxdepth 0 -mmin +360 2>/dev/null)" ]; then
  rmdir "$VERROU" 2>/dev/null || true
fi
if ! mkdir "$VERROU" 2>/dev/null; then
  echo "Une sauvegarde est déjà en cours ($VERROU existe)." >&2
  exit 75
fi
trap 'rmdir "$VERROU" 2>/dev/null || true' EXIT

enregistrer() {
  # Valeurs passées en variables psql (:'nom') : un chemin ou un message contenant une apostrophe reste correct.
  printf '%s\n' "INSERT INTO sauvegardes (ok, fichier, taille, message) VALUES (:ok, NULLIF(:'fichier', ''), :taille, :'message');" |
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -X \
      -v ok="$1" -v fichier="$2" -v taille="$3" -v message="$4" >/dev/null || true
}

ETAPE="préparation"
trap 'enregistrer false "" 0 "Échec de la sauvegarde pendant l’étape : $ETAPE (ligne $LINENO). Voir /var/log/evocom-backup.log."' ERR

ETAPE="copie de la base (pg_dump)"
DUMP="$DEST/base/evocom-$DATE.dump"
pg_dump --format=custom --no-owner --file="$DUMP" "$DATABASE_URL"
ETAPE="vérification de la copie de la base (pg_restore --list)"
pg_restore --list "$DUMP" > /dev/null

ETAPE="instantané des fichiers (rsync)"
DERNIER="$(ls -1d "$DEST"/fichiers/20* 2>/dev/null | tail -n 1 || true)"
SNAP="$DEST/fichiers/$DATE"
# Liens physiques vers l'instantané précédent ET vers le stockage lui-même : même le premier instantané
# ne recopie pas les fichiers (sinon une copie complète des uploads importés peut remplir le disque).
# Un fichier supprimé dans l'application reste récupérable dans les instantanés pendant BACKUP_JOURS jours.
rsync -a --delete ${DERNIER:+--link-dest="$DERNIER"} --link-dest="$(cd "$STORAGE_DIR" && pwd)" "$STORAGE_DIR/" "$SNAP/"
# rsync -a recopie la date du dossier storage sur l'instantané : sans ce touch, un stockage de plus de
# BACKUP_JOURS jours rendait l'instantané « ancien » et le nettoyage ci-dessous l'effaçait le soir même.
touch "$SNAP"

ETAPE="nettoyage des anciennes sauvegardes"
find "$DEST/base" -name 'evocom-*.dump' -mtime +"$JOURS" -delete
find "$DEST/fichiers" -mindepth 1 -maxdepth 1 -type d -name '20*' ! -name "$DATE" -mtime +"$JOURS" -exec rm -rf {} +

if [ -n "${RCLONE_DEST:-}" ]; then
  ETAPE="copie hors du serveur (rclone)"
  rclone copy "$DUMP" "$RCLONE_DEST/base/"
  # --backup-dir : ce que sync effacerait ou remplacerait côté distant est déplacé dans un dossier daté.
  rclone sync "$STORAGE_DIR" "$RCLONE_DEST/fichiers/" --backup-dir "$RCLONE_DEST/fichiers-supprimes/$DATE"
  rclone delete --min-age "${JOURS_HORS_SITE}d" "$RCLONE_DEST/fichiers-supprimes/" || true
  rclone rmdirs --leave-root "$RCLONE_DEST/fichiers-supprimes/" || true
  HORS_SITE=" et copiée hors du serveur"
else
  HORS_SITE=" (pas de copie hors du serveur : définir RCLONE_DEST)"
fi

ETAPE="enregistrement du résultat"
TAILLE="$(wc -c < "$DUMP" | tr -d ' ')"
enregistrer true "$DUMP" "$TAILLE" "Sauvegarde terminée$HORS_SITE"
echo "$(date '+%F %T') sauvegarde OK : $DUMP ($TAILLE octets)$HORS_SITE"
