# Consignes pour Claude Code lancé sur le VPS

À lire en entier avant toute commande. Tu travailles **sur le serveur de production** d'une imprimerie : l'ancienne
application sert l'équipe en ce moment même. Ton travail : installer Evocom Print v2 **à côté**, y copier les
données, et ne **rien** changer à ce qui tourne.

## Règles absolues

1. **Ne jamais modifier l'ancienne application** : ni `/var/www/imprimerie` (code, `.env`, `uploads`), ni la base
   `imprimerie_prod`, ni le processus PM2 `imprimerie-backend`, ni ses sites Nginx, ni ses certificats.
   Lecture seule uniquement. Seule exception : la section « Correctifs de l'ancienne application » ci-dessous,
   et seulement si la personne la demande explicitement.
2. **Sauvegarde avant toute écriture**, vérifiée (taille non nulle, `pg_restore --list` lisible).
3. **Demander l'accord** avant chaque étape qui écrit quelque chose (installation, import, Nginx, pare-feu),
   en disant en une phrase ce qui va changer et ce qui ne change pas.
4. **Aucun secret à l'écran** : ne jamais afficher le contenu d'un `.env`, un mot de passe, une clé ou un jeton.
   Pour une valeur nécessaire, la lire dans une variable (`$(grep … | cut …)`) sans l'imprimer.
5. Ne jamais lancer `pm2 delete`, `pm2 kill`, `pm2 restart all`, `systemctl restart postgresql`,
   `DROP DATABASE`, `rm -rf` hors des dossiers de v2 que tu as toi-même créés.
6. En cas de doute ou d'écart avec ces consignes : s'arrêter et demander.

## Étape 0 : état des lieux (lecture seule)

Rapporter à la personne, sans rien changer :

```bash
pm2 list
ls /etc/nginx/sites-enabled/ && nginx -T 2>/dev/null | grep -E "server_name|listen" | sort -u
ss -ltnp | grep -E ":(80|443|4000|5001|8080) "
node -v; psql --version; df -h / /var; free -h
sudo -u postgres psql -Atc "SELECT datname FROM pg_database"
du -sh /var/www/imprimerie/uploads /var/www/imprimerie/backend/uploads 2>/dev/null
sudo -u postgres psql -d imprimerie_prod -Atc "SELECT statut, count(*) FROM dossiers GROUP BY 1 ORDER BY 2 DESC"
```

Noter le nombre de dossiers par statut et la taille des uploads : ce sont les chiffres à retrouver après l'import.

## Étape 1 : sauvegarde de l'ancienne application

```bash
mkdir -p /var/backups/evocom-ancien && cd /var/backups/evocom-ancien
D=$(date +%Y%m%d-%H%M)
sudo -u postgres pg_dump -Fc imprimerie_prod > imprimerie_prod-$D.dump
pg_restore --list imprimerie_prod-$D.dump | head -3 && ls -lh imprimerie_prod-$D.dump
tar -czf uploads-$D.tar.gz -C /var/www/imprimerie uploads backend/uploads
ls -lh uploads-$D.tar.gz
```

Vérifier que l'espace disque le permet (étape 0) avant de lancer `tar`.

## Étape 2 : installer v2 à côté (accord requis)

Code : ce dépôt, cloné dans `/var/www/evocom` (branche `claude/peaceful-tesla-5wq2iy`). Node 22 est requis ; si
`node -v` est plus ancien, prévenir la personne : la mise à jour de Node touche aussi l'ancienne application
(la recommandation du guide est de l'accepter puis de vérifier `pm2 restart imprimerie-backend` et le site).

Sans nom de domaine de test (le plus simple) :

```bash
cd /var/www/evocom
PORT_WEB=8080 ADMIN_EMAIL=<adresse de la personne> bash v2/deploy/install.sh
```

Avec `test.evocomprint.site` (enregistrement DNS A `test` → IP du VPS déjà créé) :
`DOMAINE=test.evocomprint.site ADMIN_EMAIL=… bash v2/deploy/install.sh` puis `certbot --nginx -d test.evocomprint.site`.

Le script crée sa propre base `evocom`, son dossier `/var/lib/evocom/storage`, son processus PM2 `evocom-v2`
et son propre site Nginx ; il refuse de continuer si un port est pris. Le mot de passe administrateur
provisoire s'affiche une seule fois à la fin : le laisser à la personne, ne pas le recopier ailleurs.

## Étape 3 : copier les données (accord requis)

L'importeur lit l'ancienne base en **lecture seule** (transaction `READ ONLY`, empreinte des tables avant et après)
et **copie** les fichiers sans les déplacer. Détails : `v2/import/README.md`.

```bash
cd /var/www/evocom/v2/api
export LEGACY_UPLOADS_DIRS="/var/www/imprimerie/uploads,/var/www/imprimerie/backend/uploads"
# Adresse de l'ancienne base construite à partir de son .env (DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME),
# sans jamais l'afficher :
lire() { grep -E "^$1=" /var/www/imprimerie/backend/.env | tail -1 | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//'; }
MDP="$(lire DB_PASSWORD)"; HOTE="$(lire DB_HOST)"; PORT_DB="$(lire DB_PORT)"
export LEGACY_DATABASE_URL="postgres://$(lire DB_USER):$(MDP="$MDP" node -e 'process.stdout.write(encodeURIComponent(process.env.MDP))')@${HOTE:-127.0.0.1}:${PORT_DB:-5432}/$(lire DB_NAME)"
unset MDP HOTE PORT_DB
node --env-file=.env dist/import-legacy.js --dry-run --rapport /root/import-simulation.json
```

Le nom de la base (`DB_NAME`, en principe `imprimerie_prod`) est aussi celui à utiliser aux étapes 0 et 1.

Montrer à la personne le résumé de la simulation : dossiers par statut (comparer avec l'étape 0), fichiers copiés,
fichiers introuvables, anomalies. Puis, avec son accord :

```bash
node --env-file=.env dist/import-legacy.js --remplacer --rapport /root/import-test.json
```

Vérifier : mêmes nombres de dossiers par statut qu'à l'étape 0 ; l'empreinte de l'ancienne base est inchangée
(indiquée dans le rapport) ; un compte existant se connecte sur la v2 avec son mot de passe habituel.

## Étape 4 : s'arrêter et rendre compte

Ne pas basculer le domaine principal. Donner à la personne : l'adresse de test, les chiffres comparés, la liste
des anomalies du rapport à regarder. L'équipe continue de travailler sur l'ancienne application ; les dossiers
créés d'ici la bascule seront repris par un nouvel import (`--remplacer`) pendant la bascule
(`v2/deploy/GUIDE_MISE_EN_LIGNE.md`, étape 6), qui ne se fait qu'à la demande explicite de la personne.

## Correctifs de l'ancienne application (seulement sur demande)

Les correctifs de sécurité de l'ancienne application (dossiers `backend/` et `frontend/` de ce dépôt) sont décrits
à l'étape 1 du guide. Ils ne changent que du code, pas les données ; ils exigent un `JWT_SECRET` d'au moins
32 caractères dans `/var/www/imprimerie/backend/.env`, ce qui déconnecte tout le monde une fois (chacun se
reconnecte avec son mot de passe). Sauvegarde de l'étape 1 obligatoire avant, et accord explicite.
