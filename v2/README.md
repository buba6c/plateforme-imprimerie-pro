# Evocom Print v2

Gestion des dossiers d'une imprimerie numérique : le préparateur crée le dossier et dépose les fichiers, l'imprimeur
Roland (grand format) ou Xerox (numérique) l'imprime, le livreur livre et encaisse, l'administrateur pilote.

Cette version remplace l'application des dossiers `backend/` et `frontend/` à la racine du dépôt, qui reste en service
jusqu'à la bascule (voir `deploy/GUIDE_MISE_EN_LIGNE.md`).

## Organisation

| Dossier | Contenu |
|---|---|
| `shared/` | Vocabulaire commun au serveur et à l'interface : rôles, statuts, **circuit des dossiers** (`workflow.ts`, la seule table de transitions), schémas de validation, **moteur de prix** (`pricing.ts`, en entiers FCFA), formats français, grille tarifaire de départ. |
| `api/` | Serveur Node.js (Express 5, PostgreSQL, Socket.IO, envoi de fichiers tus). Migrations dans `src/db/migrations`, modules dans `src/modules`, import de l'ancienne plateforme dans `src/import`. |
| `web/` | Interface React (Vite). Styles de la charte dans `src/styles/evocom.css` (identiques au Design System « Evocom Print »), conventions dans `web/CONVENTIONS.md`. |
| `deploy/` | Installation, mise à jour, sauvegarde, configuration Nginx et PM2, guide de mise en ligne. |
| `import/` | Documentation de l'import et base d'essai reproduisant l'ancienne production (`fixtures/`). |
| `API.md` | Contrat de l'API : routes, rôles, réponses. |

## Règles qui ne bougent pas

- Les droits sont appliqués par le serveur, dans les requêtes SQL (liste, fiche, fichiers, paiements) ; l'interface
  n'affiche que les actions que le serveur renvoie.
- Un seul circuit (`shared/src/workflow.ts`) sert à la fois à autoriser une action et à afficher les boutons.
- Les montants sont des entiers en FCFA. Un tarif inconnu ou sans prix bloque le calcul avec un message ; il n'est
  jamais compté pour 0.
- Les numéros CMD, DEV et FAC sont attribués sans trou ni doublon (table `compteurs`).
- Rien n'est supprimé définitivement : les dossiers et les fichiers vont à la corbeille. Seule exception : la purge des
  fichiers de la corbeille par l'administrateur (mot de passe, mot SUPPRIMER), dont la ligne reste en base comme trace.
- Les fichiers ne sont jamais servis en accès libre : chaque lecture vérifie les droits sur le dossier.

## Facturation

Une facture s'émet depuis la fiche d'un dossier (« Créer la facture », montant défini) ou directement, sans dossier,
dans Factures > Nouvelle facture (client de l'annuaire ou saisi, lignes libres, remise, échéance). Les deux suivent la
même numérotation FAC sans trou, le même PDF et la même règle : une facture émise ne se modifie plus, elle s'annule.
La liste Factures montre toutes les factures sans filtre de période. Liaison VosFactures.fr (Paramètres > Facturation) :
sous-domaine du compte, clé API chiffrée (jamais réaffichée), envoi manuel depuis chaque facture ou automatique à
l'émission, annulation propagée ; `VOSFACTURES_URL` remplace l'adresse réelle pour les essais. Contrat : `API.md`,
section « Facturation ».

## WhatsApp client

Administration > WhatsApp client (`/whatsapp`, administrateur) : un message automatique part au client depuis le numéro
WhatsApp **dédié** de l'imprimerie quand sa commande est imprimée (livraison ou retrait), quand la livraison est
programmée et quand elle est livrée ou remise. Installation : `npm install` dans `v2/` (bibliothèque
`@whiskeysockets/baileys`, chargée à la demande ; sans elle l'API tourne normalement et l'écran l'explique), puis
`npm run migrate` (migration `011_whatsapp`). Mise en service : prendre une carte SIM réservée à l'imprimerie, installer
WhatsApp dessus, activer les envois dans l'onglet Réglages, cliquer sur Connecter et scanner le code QR avec ce téléphone
(WhatsApp > Appareils connectés > Connecter un appareil). Les identifiants de session sont dans
`STORAGE_DIR/whatsapp/auth` (droits 700, à sauvegarder avec le stockage) ; la connexion reprend seule après un
redémarrage. Risques, à dire au propriétaire : cette liaison fonctionne comme WhatsApp Web, sans accord officiel ;
WhatsApp peut bloquer un numéro qui envoie trop ou en masse. D'où les garde-fous, tous côté serveur : un message par
commande et par événement, heures d'envoi (08:00–20:00), 20 messages par heure et 120 par jour au plus, pause aléatoire
entre deux envois, trois tentatives puis échec motivé, jamais de lien raccourci, et un numéro personnel ne doit jamais
être utilisé. STOP : un client qui répond « STOP » ou « ARRET » est exclu définitivement (liste STOP de l'écran, accusé
envoyé) ; l'administrateur ne le retire qu'à la demande du client. Le journal des messages, les réponses reçues et
l'envoi d'un message de test sont dans le même écran. Contrat : `API.md`, section « WhatsApp client ».

## Développer

Prérequis : Node 22, PostgreSQL 16.

```bash
cd v2
npm install
cp api/.env.example api/.env        # puis adapter DATABASE_URL, JWT_SECRET, STORAGE_DIR, NODE_ENV=development
npm run migrate
npm -w api run seed -- --demo       # comptes de démonstration, mot de passe Evocom2026!
npm run dev:api                     # API sur http://127.0.0.1:4000
npm run dev:web                     # interface sur http://localhost:5173
API_URL=http://127.0.0.1:4000 npx -w api tsx scripts/demo-data.ts   # 14 dossiers de démonstration
```

Comptes de démonstration : admin@evocom.test, prep@evocom.test, roland@evocom.test, xerox@evocom.test,
livreur@evocom.test.

## Vérifier

```bash
npm test            # module partagé + API (base de test evocom_test recréée à chaque passage)
npm run typecheck
npm run build
```

Les tests de l'API attendent un PostgreSQL local (`postgres://evocom:evocom_dev@localhost:5432/evocom_test`, modifiable
avec `TEST_DATABASE_URL`).

## Démonstration hors ligne

`npm -w web run build:demo` produit `web/dist-demo/` : la vraie interface avec une API simulée dans le navigateur
(données fictives, cinq rôles, aucun serveur). `node web/src/demo/outils/page-artifact.mjs` en tire `artifact.html`,
la page publiée comme Artifact claude.ai avec `assets/` et `fonts/`. Quand les écrans changent, réenregistrer les
données depuis une API de démonstration (`web/src/demo/outils/enregistrer.mjs`), puis vérifier le parcours complet
(`web/src/demo/outils/verifier.mjs`). Le code de démonstration est absent du build normal.

## Mettre en ligne

Voir `deploy/GUIDE_MISE_EN_LIGNE.md` : sécurité du VPS, installation à côté de l'ancienne application, import d'essai,
recette par l'équipe, bascule et retour arrière, sauvegardes.
