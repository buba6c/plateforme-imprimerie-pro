#!/usr/bin/env bash
# Mise à jour d'Evocom Print v2 : récupère le code, sauvegarde, compile, migre, redémarre, vérifie.
#   bash v2/deploy/deploy.sh [branche]
set -euo pipefail

RACINE="$(cd "$(dirname "$0")/../.." && pwd)"
V2="$RACINE/v2"

# Node dédié à v2 si présent (/opt/node22) : l'ancienne application garde le Node du système.
NODE_V2="${EVOCOM_NODE:-/opt/node22/bin/node}"
if [ -x "$NODE_V2" ]; then export PATH="$(dirname "$NODE_V2"):$PATH"; fi
BRANCHE="${1:-$(git -C "$RACINE" rev-parse --abbrev-ref HEAD)}"

echo "Récupération de la branche $BRANCHE"
git -C "$RACINE" fetch origin "$BRANCHE"
AVANT="$(git -C "$RACINE" rev-parse HEAD)"
git -C "$RACINE" merge --ff-only "origin/$BRANCHE"
APRES="$(git -C "$RACINE" rev-parse HEAD)"
if [ "$AVANT" = "$APRES" ]; then echo "Déjà à jour ($APRES)."; fi

echo "Sauvegarde avant mise à jour"
"$V2/deploy/backup.sh"

echo "Installation et compilation"
cd "$V2"
npm ci --no-audit --no-fund
npm -w api run build
npm -w web run build

echo "Migrations de la base"
(cd "$V2/api" && node --env-file=.env dist/migrate.js)

echo "Redémarrage"
pm2 reload evocom-v2 --update-env
sleep 3
PORT_API="$(grep -E '^PORT=' "$V2/api/.env" | cut -d= -f2)"
if curl -fsS "http://127.0.0.1:${PORT_API:-4000}/api/health" >/dev/null; then
  echo "Mise à jour terminée : $(git -C "$RACINE" log --oneline -1)"
else
  echo "L'API ne répond pas après la mise à jour."
  echo "Pour revenir à la version précédente : git -C $RACINE checkout $AVANT && bash $V2/deploy/deploy.sh"
  echo "Journaux : pm2 logs evocom-v2 --lines 100"
  exit 1
fi
