#!/usr/bin/env bash
# Première installation d'Evocom Print v2 sur le VPS (à lancer en root, depuis le dépôt cloné).
# Ne touche pas à l'ancienne application (/var/www/imprimerie, processus PM2 « imprimerie-backend »).
#
#   DOMAINE=test.evocomprint.site ADMIN_EMAIL=moi@exemple.com bash v2/deploy/install.sh
#
# Sans nom de domaine (essai par l'adresse IP du serveur, sans HTTPS) :
#   PORT_WEB=8080 ADMIN_EMAIL=moi@exemple.com bash v2/deploy/install.sh
#   puis ouvrir http://IP-DU-SERVEUR:8080
#
# Variables facultatives : PORT_API (4000 par défaut, port interne de l'API), STOCKAGE, DB_NOM, DB_USER.
#
# Ce que fait le script, dans l'ordre :
#  1. vérifie Node 22+, PostgreSQL, Nginx, PM2, rsync ;
#  2. crée l'utilisateur et la base PostgreSQL « evocom » (mot de passe aléatoire) ;
#  3. crée le dossier de stockage des fichiers et le fichier v2/api/.env (secrets générés, droits 600) ;
#  4. installe les dépendances, compile, applique les migrations, crée le premier administrateur ;
#  5. démarre l'API avec PM2 et installe la configuration Nginx pour DOMAINE ;
#  6. planifie la sauvegarde quotidienne.
set -euo pipefail

RACINE="$(cd "$(dirname "$0")/../.." && pwd)"
V2="$RACINE/v2"
DOMAINE="${DOMAINE:-}"
PORT_WEB="${PORT_WEB:-}"
PORT_API="${PORT_API:-4000}"
if [ -z "$DOMAINE" ] && [ -z "$PORT_WEB" ]; then
  printf 'ERREUR : indiquez DOMAINE=test.evocomprint.site, ou PORT_WEB=8080 pour un essai par adresse IP.\n' >&2
  exit 1
fi
ADMIN_EMAIL="${ADMIN_EMAIL:?Indiquez l’adresse e-mail du premier administrateur, ex. ADMIN_EMAIL=vous@exemple.com}"
DB_NOM="${DB_NOM:-evocom}"
DB_USER="${DB_USER:-evocom}"
STOCKAGE="${STOCKAGE:-/var/lib/evocom/storage}"

info() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\nERREUR : %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "lancez ce script en root (sudo)."

if [ -n "$DOMAINE" ]; then
  PORT_WEB="${PORT_WEB:-80}"
  ADRESSE="https://$DOMAINE"
  COOKIE_SECURE=true
  NOM_SERVEUR="$DOMAINE"
else
  IP_PUBLIQUE="${IP_PUBLIQUE:-$(curl -fsS -4 --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')}"
  ADRESSE="http://$IP_PUBLIQUE:$PORT_WEB"
  # Sans HTTPS, le cookie de session ne peut pas être marqué « Secure » : mode réservé aux essais.
  COOKIE_SECURE=false
  NOM_SERVEUR="_"
fi
port_occupe() { ss -ltnH "( sport = :$1 )" 2>/dev/null | grep -q .; }
if port_occupe "$PORT_API" && ! pm2 describe evocom-v2 >/dev/null 2>&1; then
  fail "le port $PORT_API est déjà utilisé par une autre application. Relancez avec PORT_API=4100 (par exemple)."
fi
if [ "$PORT_WEB" != "80" ] && port_occupe "$PORT_WEB" && [ ! -f "/etc/nginx/sites-enabled/evocom-v2-port-$PORT_WEB.conf" ]; then
  fail "le port $PORT_WEB est déjà utilisé. Choisissez-en un autre, par exemple PORT_WEB=8081."
fi

info "1/6 Vérification des prérequis"
command -v node >/dev/null || fail "Node.js est absent. Installez Node 22 : curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs"
NODE_MAJ="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJ" -ge 22 ] || fail "Node $NODE_MAJ détecté ; il faut Node 22 ou plus (voir la commande ci-dessus). L'ancienne application fonctionne aussi avec Node 22."
command -v psql >/dev/null || fail "PostgreSQL est absent (apt-get install -y postgresql)."
command -v nginx >/dev/null || fail "Nginx est absent (apt-get install -y nginx)."
command -v pm2 >/dev/null || npm install -g pm2
command -v rsync >/dev/null || apt-get install -y rsync

info "2/6 Base de données"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  echo "L'utilisateur PostgreSQL $DB_USER existe déjà : son mot de passe n'est pas modifié."
  [ -f "$V2/api/.env" ] || fail "l'utilisateur $DB_USER existe mais v2/api/.env est absent. Créez .env à la main (voir .env.example)."
else
  DB_PASS="$(openssl rand -hex 24)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS'"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NOM'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NOM"
fi
sudo -u postgres psql -d "$DB_NOM" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS pg_trgm;"

info "3/6 Stockage et configuration"
mkdir -p "$STOCKAGE" /var/backups/evocom
chmod 750 "$STOCKAGE"
if [ ! -f "$V2/api/.env" ]; then
  cat > "$V2/api/.env" <<ENV
NODE_ENV=production
HOST=127.0.0.1
PORT=$PORT_API
DATABASE_URL=postgres://$DB_USER:${DB_PASS}@127.0.0.1:5432/$DB_NOM
JWT_SECRET=$(openssl rand -hex 48)
STORAGE_DIR=$STOCKAGE
APP_URL=$ADRESSE
COOKIE_SECURE=$COOKIE_SECURE
TRUST_PROXY=1
MAX_UPLOAD_MB=4096
BACKUP_DIR=/var/backups/evocom
BACKUP_JOURS=14
# RCLONE_DEST=b2:evocom-sauvegardes
ENV
  chmod 600 "$V2/api/.env"
  echo "Fichier $V2/api/.env créé (secrets générés)."
else
  echo "$V2/api/.env existe déjà : conservé."
fi

info "4/6 Installation et compilation"
cd "$V2"
npm ci --no-audit --no-fund
npm -w api run build
npm -w web run build
cd "$V2/api"
node --env-file=.env dist/migrate.js
ADMIN_PASSWORD="$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-14)"
ETAT_ADMIN="$(ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" ADMIN_NOM="${ADMIN_NOM:-Administrateur}" ADMIN_REINITIALISER=1 node --env-file=.env dist/seed.js | tee /dev/stderr | sed -n 's/^ADMIN://p')"
case "$ETAT_ADMIN" in
  cree|reinitialise) LIGNE_MDP="  Mot de passe provisoire : $ADMIN_PASSWORD   (à changer à la première connexion ; il n'est affiché qu'ici)" ;;
  *) LIGNE_MDP="  Un autre administrateur existe déjà : son mot de passe n'a pas été changé." ;;
esac

info "5/6 Démarrage et Nginx"
pm2 start "$V2/deploy/ecosystem.config.cjs"
pm2 save
sleep 3
curl -fsS "http://127.0.0.1:$PORT_API/api/health" >/dev/null || fail "l'API ne répond pas : consultez « pm2 logs evocom-v2 »."
if [ -n "$DOMAINE" ]; then CONF="/etc/nginx/sites-available/evocom-v2-$DOMAINE.conf"; else CONF="/etc/nginx/sites-available/evocom-v2-port-$PORT_WEB.conf"; fi
sed -e "s#server_name DOMAINE;#server_name $NOM_SERVEUR;#" -e "s#RACINE#$RACINE#g" \
    -e "s#listen 80;#listen $PORT_WEB;#" -e "s#listen \[::\]:80;#listen [::]:$PORT_WEB;#" \
    -e "s#127.0.0.1:4000#127.0.0.1:$PORT_API#g" "$V2/deploy/nginx-evocom-v2.conf" > "$CONF"
# Serveur sans IPv6 : la ligne « listen [::] » ferait échouer Nginx.
[ -f /proc/net/if_inet6 ] || sed -i '/listen \[::\]/d' "$CONF"
ln -sf "$CONF" "/etc/nginx/sites-enabled/"
nginx -t || { rm -f "/etc/nginx/sites-enabled/$(basename "$CONF")"; fail "configuration Nginx refusée : rien n'a été changé pour les autres sites."; }
systemctl reload nginx
if [ "$PORT_WEB" != "80" ] && command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow "$PORT_WEB/tcp" >/dev/null && echo "Pare-feu : port $PORT_WEB ouvert."
fi
chmod o+x "$RACINE" "$V2" "$V2/web" 2>/dev/null || true

info "6/6 Sauvegarde quotidienne"
CRON="/etc/cron.d/evocom-backup"
echo "15 2 * * * root $V2/deploy/backup.sh >> /var/log/evocom-backup.log 2>&1" > "$CRON"
chmod 644 "$CRON"
"$V2/deploy/backup.sh" || echo "La première sauvegarde a échoué : vérifiez /var/log/evocom-backup.log."

cat <<FIN

Installation terminée.
  Adresse : $ADRESSE
$( [ -n "$DOMAINE" ] && echo "  (activez HTTPS : certbot --nginx -d $DOMAINE ; d'ici là, ouvrez http://$DOMAINE)" || echo "  (essai sans HTTPS : si la page ne s'ouvre pas, ouvrez le port $PORT_WEB dans le pare-feu de l'hébergeur)" )
  Administrateur : $ADMIN_EMAIL
$LIGNE_MDP

Étape suivante : importer les données de l'ancienne plateforme (voir v2/deploy/GUIDE_MISE_EN_LIGNE.md).
FIN
