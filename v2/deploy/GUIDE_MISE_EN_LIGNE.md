# Mise en ligne d'Evocom Print v2

Ce guide s'adresse à la personne qui a accès au VPS (`ssh root@72.61.145.37`), ou à une session Claude Code
ouverte sur ce serveur ou sur un ordinateur qui y a accès. Chaque étape se termine par une vérification.
L'ancienne application reste en service jusqu'à la bascule (étape 6) et peut être remise en route à tout moment
(étape 7).

Ordre conseillé : 0 → 1 tout de suite ; 2 → 5 quand vous êtes prêt à tester la nouvelle version ; 6 un soir ou un
dimanche, avec l'équipe prévenue.

---

## 0. Sécurité, avant toute chose

1. Passer le dépôt GitHub en **privé** : Settings → General → Change visibility → Private.
2. Changer le mot de passe root du VPS (`passwd`) : l'ancien a circulé dans une conversation.
3. Se connecter au VPS par clé SSH, puis interdire la connexion root par mot de passe :
   ```bash
   # sur votre ordinateur
   ssh-keygen -t ed25519 && ssh-copy-id root@72.61.145.37
   # sur le VPS, une fois la connexion par clé vérifiée
   sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl reload ssh
   ```
4. Pare-feu et protection contre les essais de mots de passe :
   ```bash
   apt-get update && apt-get install -y ufw fail2ban
   ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
   systemctl enable --now fail2ban
   ```
   Vérification : `ufw status` n'autorise que 22, 80 et 443. Les ports 5001 (ancienne API) et 4000 (nouvelle API)
   ne doivent plus être joignables depuis Internet. (Pendant un essai par adresse IP, l'installation ouvre aussi le port choisi,
   par exemple 8080 ; le refermer après la bascule : `ufw delete allow 8080/tcp`.)
5. Changer les secrets de l'ancienne application, publiés sur GitHub : mot de passe PostgreSQL de
   `imprimerie_prod_user`, `JWT_SECRET`, clé OpenAI, et les mots de passe des comptes de démonstration.
   ```bash
   sudo -u postgres psql -c "ALTER ROLE imprimerie_prod_user PASSWORD 'NOUVEAU_MOT_DE_PASSE'"
   # puis reporter le nouveau mot de passe dans /var/www/imprimerie/backend/.env (DB_PASSWORD)
   ```

## 1. Appliquer les correctifs d'urgence à l'application actuelle

Ces correctifs ferment les failles graves de la version en service, sans rien changer à son fonctionnement.

```bash
cd /var/www/imprimerie

# 1. Sauvegarde (base + fichiers) avant toute modification
mkdir -p /root/sauvegardes
sudo -u postgres pg_dump -Fc imprimerie_prod > /root/sauvegardes/avant-correctifs-$(date +%F).dump
tar czf /root/sauvegardes/uploads-$(date +%F).tgz uploads backend/uploads 2>/dev/null || true

# 2. Récupérer les correctifs (dossiers backend et frontend uniquement)
git init -q 2>/dev/null; git fetch https://github.com/buba6c/plateforme-imprimerie-pro.git claude/peaceful-tesla-5wq2iy
git checkout FETCH_HEAD -- backend frontend

# 3. Variables obligatoires dans backend/.env
grep -q '^JWT_SECRET=.\{32,\}' backend/.env || echo "JWT_SECRET=$(openssl rand -hex 48)" >> backend/.env
grep -q '^DB_PORT=' backend/.env || echo "DB_PORT=5432" >> backend/.env

# 4. Redémarrer l'API et recompiler l'interface
cd backend && npm install --omit=dev && pm2 restart imprimerie-backend --update-env && cd ..
bash deploy-frontend.sh
```

Si le dépôt GitHub est privé, la commande `git fetch` demande un identifiant : utilisez un jeton GitHub
(Settings → Developer settings → Personal access tokens) comme mot de passe.

Vérifications :
- `pm2 logs imprimerie-backend --lines 30` ne montre pas « ERREUR DE CONFIGURATION ».
- Tout le monde doit se reconnecter une fois (nouvelle clé de session) : c'est normal.
- Nginx doit transmettre `/socket.io/` avec les en-têtes WebSocket (`Upgrade`, `Connection`). Sinon les mises à jour
  en direct ne passent plus ; la configuration de la nouvelle version (`v2/deploy/nginx-evocom-v2.conf`) montre le bloc
  à reprendre.
- Ne pas définir `ALLOW_SYSTEM_RESET` : la remise à zéro de la plateforme reste bloquée.

## 2. Préparer l'installation de la nouvelle version

1. Créer l'adresse de test : chez votre gestionnaire de domaine, un enregistrement **A** `test` → `72.61.145.37`
   (donne `test.evocomprint.site`). Sans attendre le DNS, on peut aussi essayer par l'adresse IP (voir l'étape 3, option B).
2. Installer Node 22 (l'ancienne application fonctionne aussi avec Node 22) :
   ```bash
   node -v   # si < 22 :
   curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
   pm2 restart imprimerie-backend   # vérifier que l'ancienne application redémarre bien
   ```
3. Cloner le code :
   ```bash
   git clone -b claude/peaceful-tesla-5wq2iy https://github.com/buba6c/plateforme-imprimerie-pro.git /var/www/evocom
   ```

## 3. Installer la nouvelle version en test

Option A, avec l'adresse de test (recommandée) :

```bash
cd /var/www/evocom
DOMAINE=test.evocomprint.site ADMIN_EMAIL=votre@adresse.com bash v2/deploy/install.sh
certbot --nginx -d test.evocomprint.site      # HTTPS (apt-get install -y certbot python3-certbot-nginx si absent)
```

Option B, sans nom de domaine, par l'adresse IP du serveur (essai seulement : pas de HTTPS) :

```bash
cd /var/www/evocom
PORT_WEB=8080 ADMIN_EMAIL=votre@adresse.com bash v2/deploy/install.sh
# puis ouvrir http://72.61.145.37:8080 ; si la page ne s'ouvre pas, ouvrir le port 8080
# dans le pare-feu du panneau Hostinger (VPS → Pare-feu).
```

Le script ne touche ni à l'ancienne application ni à ses sites Nginx ; il refuse de continuer si un port est déjà
pris (choisir alors `PORT_API=4100` ou `PORT_WEB=8081`). Relancé, il reprend là où il s'était arrêté et redonne un
mot de passe provisoire valable pour l'administrateur indiqué.

Le script affiche à la fin le mot de passe provisoire de l'administrateur (une seule fois).

Vérifications :
- `curl -s http://127.0.0.1:4000/api/health` renvoie `{"ok":true,...}`.
- https://test.evocomprint.site (ou http://72.61.145.37:8080) affiche la page de connexion ; la connexion admin demande de changer le mot de passe.
- `ls /var/backups/evocom/base` contient une première sauvegarde.

## 4. Importer les données de l'ancienne plateforme (essai)

L'import lit l'ancienne base sans jamais l'écrire, copie les fichiers (sans les déplacer) et produit un rapport.
Détails : `v2/import/README.md`.

```bash
cd /var/www/evocom/v2/api
LEGACY_DATABASE_URL="postgres://imprimerie_prod_user:MOT_DE_PASSE@127.0.0.1:5432/imprimerie_prod" \
LEGACY_UPLOADS_DIRS="/var/www/imprimerie/uploads,/var/www/imprimerie/backend/uploads" \
node --env-file=.env dist/import-legacy.js --dry-run --rapport /root/import-essai.json
```

Lire le résumé affiché : nombre de dossiers, fichiers copiés, fichiers introuvables, anomalies de statut ou de
montant, et la comparaison des totaux. Puis lancer l'import réel dans la base de test :

```bash
node --env-file=.env dist/import-legacy.js --remplacer --rapport /root/import-test.json
```

Vérification : se connecter sur test.evocomprint.site avec un compte existant de l'ancienne plateforme
(les mots de passe sont conservés) et retrouver ses dossiers.

## 5. Faire tester par l'équipe

Pendant quelques jours, chacun refait ses gestes habituels sur test.evocomprint.site
(les données de test seront remplacées à la bascule) :

- **Préparateur** : créer un dossier Roland et un Xerox, vérifier le prix calculé, déposer de gros fichiers
  (couper la connexion pendant l'envoi : il doit reprendre), valider ; corriger un dossier renvoyé en révision.
- **Imprimeurs** : voir uniquement leur machine, ouvrir et télécharger les fichiers, démarrer, marquer imprimé,
  demander une révision.
- **Livreur** (sur téléphone) : programmer, appeler le client, ouvrir l'itinéraire, livrer avec encaissement Wave
  (référence obligatoire) ou espèces.
- **Admin** : valider et refuser des paiements, vérifier la caisse, les tarifs (renseigner les prix vides),
  les paramètres (TVA, arrondi, coordonnées de l'entreprise pour les PDF), un devis converti en dossier,
  une facture.

Noter ce qui manque ou gêne, et le corriger avant la bascule.

## 6. Bascule (fenêtre de maintenance, environ 30 minutes)

1. Prévenir l'équipe : plus personne ne travaille sur l'ancienne application pendant la bascule.
2. Arrêter l'ancienne API pour figer les données : `pm2 stop imprimerie-backend`.
3. Import final (remplace les données de test) :
   ```bash
   cd /var/www/evocom/v2/api
   LEGACY_DATABASE_URL=... LEGACY_UPLOADS_DIRS=... node --env-file=.env dist/import-legacy.js --remplacer --rapport /root/import-final.json
   ```
4. Servir la nouvelle version sur le domaine principal :
   ```bash
   cd /var/www/evocom
   sed -e "s#DOMAINE#evocomprint.site www.evocomprint.site#g" -e "s#RACINE#/var/www/evocom#g" \
     v2/deploy/nginx-evocom-v2.conf > /etc/nginx/sites-available/evocom-v2-prod.conf
   # désactiver l'ancien site (garder le fichier pour le retour arrière)
   ls /etc/nginx/sites-enabled/
   rm /etc/nginx/sites-enabled/<ancien-site>
   ln -s /etc/nginx/sites-available/evocom-v2-prod.conf /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   certbot --nginx -d evocomprint.site -d www.evocomprint.site
   sed -i -e 's#^APP_URL=.*#APP_URL=https://evocomprint.site#' -e 's#^COOKIE_SECURE=.*#COOKIE_SECURE=true#' v2/api/.env
   pm2 reload evocom-v2 --update-env
   rm -f /etc/nginx/sites-enabled/evocom-v2-port-*.conf && nginx -t && systemctl reload nginx   # si l'essai par IP avait été installé
   ```
5. Vérifier : connexion, un dossier importé avec ses fichiers, la file Roland, la file Xerox, le livreur.
6. Garder l'ancienne application arrêtée (ne pas supprimer `/var/www/imprimerie` ni sa base pendant au moins un mois).

## 7. Retour arrière

Si un problème bloquant apparaît après la bascule :

```bash
rm /etc/nginx/sites-enabled/evocom-v2-prod.conf
ln -s /etc/nginx/sites-available/<ancien-site> /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
pm2 start imprimerie-backend
```

L'ancienne base n'a jamais été modifiée par l'import. Attention : ce qui a été saisi dans la nouvelle version
depuis la bascule n'existe pas dans l'ancienne.

## 8. Sauvegardes

- Automatiques chaque nuit à 2 h 15 (`/etc/cron.d/evocom-backup`) : base (`/var/backups/evocom/base`) et fichiers
  (`/var/backups/evocom/fichiers`, instantanés quotidiens), conservées 14 jours. L'écran « Sauvegardes et état »
  de l'admin affiche la dernière et signale un échec.
- **Copie hors du serveur (fortement conseillée)** : une sauvegarde sur le même disque ne protège pas d'une panne du
  VPS. Configurer `rclone` vers un stockage externe (Backblaze B2, Cloudflare R2, Google Drive…) puis ajouter
  `RCLONE_DEST=nom-du-remote:dossier` dans `v2/api/.env`.
- **Tester une restauration chaque mois** :
  ```bash
  sudo -u postgres createdb evocom_essai
  sudo -u postgres pg_restore --no-owner -d evocom_essai "$(ls -1 /var/backups/evocom/base/*.dump | tail -1)"
  sudo -u postgres psql -d evocom_essai -c "select count(*) from dossiers"
  sudo -u postgres dropdb evocom_essai
  ```

## 9. Mises à jour suivantes

```bash
cd /var/www/evocom && bash v2/deploy/deploy.sh
```

Le script sauvegarde, récupère le code, compile, applique les migrations, redémarre et vérifie que l'API répond ;
en cas d'échec, il affiche la commande pour revenir à la version précédente.
