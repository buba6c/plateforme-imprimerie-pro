# Import des données de l’ancienne plateforme EvocomPrint

L’importeur reprend dans Evocom Print v2 toutes les données de production de l’ancienne plateforme
(base PostgreSQL « EvocomPrint » et dossiers d’uploads), puis produit un rapport détaillé.

Code : `v2/api/src/import/` · Test de bout en bout : `v2/api/test/import.test.ts` ·
Jeu de données de test : `v2/import/fixtures/`.

## Garanties

- **L’ancienne base n’est jamais modifiée.** Connexion ouverte avec `default_transaction_read_only=on`,
  lecture dans une seule transaction `REPEATABLE READ READ ONLY` (instantané cohérent de toutes les tables),
  vérification `SHOW transaction_read_only` avant la première lecture. Une empreinte (nombre de lignes + md5)
  de chaque table est calculée avant et après l’import et comparée dans le rapport.
- **Les fichiers sont copiés, jamais déplacés.** Copie en flux (pas de limite de taille), SHA-256 recalculé sur
  le contenu réellement copié, date de modification conservée. Les fichiers sources restent intacts.
  Seuls les fichiers situés sous les dossiers d’uploads indiqués sont lus.
- **Tout ou rien.** Tout l’import se fait dans **une seule transaction** sur la base v2. Au moindre problème,
  tout est annulé (y compris l’effacement fait par `--remplacer`) et les fichiers déjà copiés sont retirés.
- **Simulation.** `--dry-run` exécute tout, contrôle tout, écrit le rapport, puis annule. Aucun fichier n’est copié.
- **Rien n’est perdu en silence.** Chaque valeur corrigée, ignorée ou douteuse apparaît dans le rapport
  avec l’identifiant d’origine. Les colonnes de l’ancienne base sans équivalent v2 sont conservées dans
  l’événement « Importé de l’ancienne plateforme » de chaque dossier (visible par l’administrateur).

## Ce qui est repris

| Ancienne base | v2 | Règles principales |
|---|---|---|
| `users` | `users` | Hachages bcrypt conservés (`$2a`/`$2b`) : **les mots de passe restent les mêmes**. E-mail en minuscules ; doublons d’e-mail (à la casse près) fusionnés dans le compte actif le plus récemment connecté, leurs dossiers et paiements lui sont rattachés. Rôle inconnu : compte désactivé. |
| noms de clients des dossiers, devis, factures (+ table `clients` si elle existe) | `clients` | Regroupement sans tenir compte de la casse ni des espaces en trop (« pharmacie mermoz » = « Pharmacie Mermoz »). Téléphone et e-mail les plus récents. Les variantes regroupées sont listées dans le rapport et dans les notes du client. |
| `dossiers` | `dossiers` | Numéro conservé (en double : suffixe `-L<id d’origine>`). Machine depuis `type_formulaire`/`machine` (sinon déduite des spécifications, sinon xerox + **erreur** dans le rapport). Statuts des deux vocabulaires (voir plus bas). Montant : première valeur valide parmi `montant_cfa`, `amount`, `data_formulaire.prix/prix_total/total/montant` (« 42 000 », « 15000.00 », « 12 500,50 FCFA » sont lus), arrondi au franc. Spécifications d’origine conservées telles quelles dans `specs.legacy` (data_formulaire, sections, supports, formulaires). Dates de validation, d’impression, de livraison reconstituées depuis l’historique. |
| `historique_statuts`, `dossier_status_history`, `dossier_activity_log` | `dossier_events` | Changements de statut normalisés ; une même transition écrite dans deux tables est fusionnée ; le reste devient une note d’import avec les données brutes. Entrées de dossiers supprimés : listées dans le rapport. |
| `fichiers` (les deux familles de colonnes) | `fichiers` + copie dans `STORAGE_DIR/dossiers/<id>/<uuid>-<nom>` | Fichier retrouvé dans l’ordre : chemin en base (absolu, ou relatif à chaque dossier d’uploads et à son parent), partie après `uploads/`, `uploads/dossiers/<id>/<nom>`, `uploads/dossiers/<folder_id>/<nom>`, puis recherche par nom (seulement si elle est sans ambiguïté). Nom d’origine conservé (accents compris, « mojibake » réparé). **Fichier introuvable : la ligne n’est pas créée**, il est listé dans le rapport et ses métadonnées restent dans l’historique du dossier. Fichiers présents sur le disque sans ligne en base : listés (orphelins), non importés. |
| `paiements` | `paiements` | `approuve` → validé ; `encaisse_livreur`, `en_attente` → à valider ; `refuse` → refusé ; autre → à valider + signalé. Rattachement par id du dossier, par `folder_id` ou par la facture. Modes normalisés (Wave, Orange Money, Espèces, cb → carte, chèque, virement ; inconnu → espèces + signalé). Montant nul ou illisible : non importé, signalé. Trop-perçu (validé > montant du dossier) : importé, signalé. |
| `devis` (+ `devis_historique`) | `devis` | Numéro conservé, statut (`valide` → accepté, `en_attente` → envoyé…), lien vers le dossier converti, données d’origine dans `specs.legacy`. |
| `factures` | `factures` | Numéro légal conservé, montants en francs entiers (HT + TVA = TTC). Sans dossier retrouvable : **non importée, erreur** dans le rapport. Seconde facture émise pour un même dossier : importée comme annulée, signalée. |
| `tarifs_config` | `tarifs` | `prix_unitaire` (écran admin) prioritaire sur `valeur` (écart signalé). Unités `m²` → m2, `page`, `forfait`… (inconnue : tarif désactivé, signalé). Les codes de la grille v2 absents sont ajoutés (prix à renseigner). Reliures au forfait signalées « à vérifier ». |
| numéros `CMD-`, `DEV-`, `FAC-` | `compteurs` | Chaque compteur reprend au plus grand numéro importé de l’année : pas de collision. Les numéros « de repli » à 6 chiffres de l’ancienne application (CMD-2026-104233) sont ignorés pour le compteur et signalés. |
| — | `parametres` | Valeurs par défaut créées si absentes (les paramètres déjà saisis sont conservés). Aucun compte n’est créé. |

Non repris (listés dans le rapport) : `themes`, `user_theme_preferences`, `system_config`, `openai_config`
(la clé API y était en clair : à révoquer chez OpenAI). Une table inconnue est signalée.

Statuts : `En cours`/`en_cours`/`nouveau`/`brouillon`/`en_preparation` → en_cours ; `À revoir` → a_revoir ;
`Prêt impression` → pret_impression ; `En impression` → en_impression ; `Imprimé`/`imprime`/`Prêt livraison` →
pret_livraison ; `En livraison` → en_livraison ; `Livré` → livre ; `Terminé` → termine (accents, casse et
espaces indifférents). Valeur inconnue → en_cours, signalée.

## Prérequis

1. Evocom Print v2 installé (`v2/deploy/install.sh`) avec `v2/api/.env` contenant `DATABASE_URL` et `STORAGE_DIR`.
2. L’adresse de l’ancienne base (lecture suffit). Pour un compte dédié en lecture seule (conseillé) :
   ```sql
   -- en tant que postgres, PostgreSQL 14 ou plus :
   CREATE ROLE import_lecture LOGIN PASSWORD 'choisir-un-mot-de-passe';
   GRANT pg_read_all_data TO import_lecture;
   -- (versions plus anciennes : GRANT CONNECT ON DATABASE imprimerie_prod TO import_lecture;
   --  puis dans la base : GRANT USAGE ON SCHEMA public TO import_lecture;
   --  GRANT SELECT ON ALL TABLES IN SCHEMA public TO import_lecture;)
   ```
3. Les deux dossiers d’uploads de l’ancienne application, lisibles par l’utilisateur qui lance l’import :
   `/var/www/imprimerie/uploads` et `/var/www/imprimerie/backend/uploads`.
4. De l’espace disque sous `STORAGE_DIR` : au moins la taille des uploads (`du -sh /var/www/imprimerie/uploads
   /var/www/imprimerie/backend/uploads`). L’importeur vérifie l’espace libre avant de copier et refuse s’il manque.

## Commandes sur le VPS

Toutes les commandes se lancent depuis `v2/api` (où se trouve `.env`) ; l’API doit avoir été compilée
(`npm -w api run build` produit `dist/import-legacy.js`).

```bash
cd /var/www/evocom/v2/api
export LEGACY_DATABASE_URL="postgres://import_lecture:MOT_DE_PASSE@127.0.0.1:5432/imprimerie_prod"
export LEGACY_UPLOADS_DIRS="/var/www/imprimerie/uploads,/var/www/imprimerie/backend/uploads"
```

### 1. Simulation (autant de fois que nécessaire, l’ancienne application peut tourner)

```bash
node --env-file=.env dist/import-legacy.js --dry-run --rapport /root/import-simulation.json
```

Rien n’est écrit dans la base v2 et aucun fichier n’est copié. Si la base v2 contient déjà des données
(administrateur créé par `install.sh`, import d’essai…), la simulation se fait comme avec `--remplacer` et le
signale ; elle bloque alors la base v2 le temps de son exécution (quelques dizaines de secondes).
Lire le résumé (voir « Lire le rapport ») et traiter les anomalies « ERREUR » et « À VÉRIFIER » avant d’aller plus loin.

### 2. Import d’essai sur l’instance de test

```bash
node --env-file=.env dist/import-legacy.js --remplacer --rapport /root/import-essai.json
```

Puis se connecter avec un compte de l’ancienne plateforme (mêmes mots de passe) et contrôler quelques dossiers,
leurs fichiers, les files Roland/Xerox et le livreur. Noter la durée affichée : l’import final prendra à peu près
autant (compter environ 1 minute pour 50 000 dossiers, plus le temps de copie des fichiers, de l’ordre de
10 à 20 minutes pour 100 Go selon le disque).

### 3. Import final pendant la fenêtre de maintenance

```bash
pm2 stop imprimerie-backend          # plus aucune écriture dans l’ancienne base ni dans les uploads
cd /var/www/evocom/v2/api
node --env-file=.env dist/import-legacy.js --remplacer --rapport /root/import-final.json
echo "code de sortie : $?"           # 0 = réussi
```

`--remplacer` efface d’abord, dans la même transaction, les données de la base v2 (comptes, clients, dossiers,
fichiers, devis, factures, paiements, tarifs, compteurs, notifications, journal ; les paramètres de l’entreprise
sont conservés). Les fichiers v2 qui ne sont plus référencés sont **déplacés** (jamais supprimés) dans
`STORAGE_DIR/remplaces-<date>/` : les supprimer une fois l’import vérifié pour récupérer la place.
Si l’espace disque manque pour l’import final alors qu’un import d’essai est déjà en place, supprimer d’abord
les fichiers de l’essai (ce ne sont que des copies) : `rm -rf "$STORAGE_DIR/dossiers"`.

En cas d’échec (code 1), rien n’a changé dans la base v2 : corriger la cause indiquée et relancer.
L’ancienne application peut être redémarrée à tout moment (`pm2 start imprimerie-backend`).

### Codes de sortie

| Code | Signification |
|---|---|
| 0 | Import (ou simulation) réussi |
| 1 | Erreur : rien n’a été modifié dans la base v2 ; la cause est affichée et notée dans le rapport |
| 2 | La base v2 contient déjà des données et `--remplacer` n’a pas été donné |

### Options

| Option | Variable d’environnement | Rôle |
|---|---|---|
| `--dry-run` | | Simulation (tout est annulé, aucun fichier copié) |
| `--legacy-url URL` | `LEGACY_DATABASE_URL` | Ancienne base (lecture seule) |
| `--uploads DIR [DIR…]` | `LEGACY_UPLOADS_DIRS` (séparés par des virgules) | Dossiers d’uploads de l’ancienne application |
| `--rapport FICHIER` | | Rapport JSON (défaut : `./import-report-<date>-<heure>.json`) |
| `--remplacer` | | Efface les données v2 existantes avant l’import |
| `--fuseau ZONE` | | Fuseau des dates de l’ancienne base (défaut : celui de son serveur, normalement `Africa/Dakar` ou UTC) |
| `--copies N` | | Copies de fichiers simultanées (défaut 4) |
| `--liens` | | Liens durs vers les fichiers d’origine au lieu de copies : sur le même disque, aucune place en plus (les originaux ne sont ni déplacés ni modifiés). Utile quand le disque ne peut pas contenir une seconde copie des uploads. |
| | `DATABASE_URL` | Base v2 (cible) |
| | `STORAGE_DIR` | Stockage des fichiers v2 |

Sans compilation (poste de développement) : `npm -w api run import-legacy -- --dry-run …` (mêmes options).

## Lire le rapport

Le résumé affiché à la fin contient :

- **Tables** : pour chaque table, lignes lues / importées / ignorées. « Ignorées » est détaillé dans les anomalies.
- **Statuts** : chaque valeur d’origine et le statut v2 retenu, puis la répartition finale.
- **Montants** : Σ `montant_cfa` d’origine, Σ des montants retenus (toutes sources), Σ v2. L’écart v2 − retenus doit
  être égal à la somme des arrondis signalés (mention « cohérent ») ; sinon l’import échoue. Totaux des paiements
  et factures lus / importés / ignorés.
- **Fichiers** : copiés (nombre et taille), règle qui a permis de retrouver chaque fichier, fichiers **manquants**
  (lignes non créées), **orphelins** (sur le disque sans ligne en base : PDF de factures générés, morceaux d’envoi
  interrompus, fichiers de dossiers supprimés…), espace libre.
- **Clients regroupés**, **compteurs** (prochain numéro de chaque série) et **anomalies** groupées par code et par
  gravité : `ERREUR` (à traiter), `À VÉRIFIER` (décision ou contrôle humain), `info` (correction automatique sûre).

Le fichier JSON contient tout, sans limite : listes complètes, identifiants d’origine (`legacy_id`), lignes brutes
des éléments non importés (sans les mots de passe). Il contient des données clients : le garder privé.

Anomalies à regarder en priorité :

| Code | Que faire |
|---|---|
| `facture_sans_dossier` | Facture non importée : retrouver le dossier, ou ressaisir la facture. Le numéro légal figure dans le rapport. |
| `machine_inconnue` | Le dossier a été mis sur Xerox par défaut : corriger la machine dans la v2. |
| `fichier_manquant`, `fichier_illisible` | Chercher le fichier (sauvegardes, autre dossier) ; s’il est retrouvé, ajouter son dossier avec `--uploads` et relancer, ou le redéposer dans la v2. |
| `statut_inconnu`, `machine_deduite`, `machine_conflit` | Contrôler le dossier. |
| `email_doublon`, `role_inconnu`, `hash_non_bcrypt`, `compte_demo` | Contrôler les comptes (fusion, rôle, réinitialisation du mot de passe, désactivation des comptes de démonstration). |
| `trop_percu`, `paiement_doublon_probable`, `paiement_sans_dossier`, `paiement_*_inconnu` | Contrôler les encaissements avec la caisse. |
| `statut_paiement_divergent` | Dossier « payé » dans l’ancienne plateforme sans paiement validé suffisant : en v2 il apparaît non payé ou en acompte. Valider le paiement en attente ou saisir le paiement manquant. |
| `facture_doublon_dossier`, `numero_doublon` | Régulariser avec le comptable. |
| `tarif_prix_divergent`, `tarif_a_verifier`, `tarif_unite_inconnue`, `tarif_ajoute` | Ouvrir l’écran Tarifs : confirmer les prix, renseigner les prix vides, corriger les unités. |
| `source_modifiee_pendant_import` | L’ancienne application écrivait encore : l’arrêter et relancer l’import avec `--remplacer`. |

## Relancer

L’import peut être relancé autant de fois que nécessaire : `--remplacer` repart d’une base v2 vide et donne
exactement le même résultat pour les mêmes données d’origine (mêmes dossiers, statuts, montants, fichiers et
empreintes, compteurs). Seuls changent les noms des copies de fichiers et la date des événements d’import.

## Essai en local avec le jeu de données de test

`fixtures/` contient un schéma reconstitué de la base de production (`legacy_schema.sql`), un jeu de données
volontairement « sale » (`legacy_seed.sql`, puis les cas limites de `legacy_seed_extra.sql`) et deux dossiers
d’uploads factices (`uploads/` et `backend/uploads/`). Mot de passe de tous les comptes : `Test1234!`.

```bash
cd v2/api
for f in legacy_schema.sql legacy_seed.sql legacy_seed_extra.sql; do
  psql postgres://evocom:evocom_dev@localhost:5432/evocom_legacy -v ON_ERROR_STOP=1 -q -f ../import/fixtures/$f
done
createdb -h localhost -U evocom evocom_import_essai
DATABASE_URL=postgres://evocom:evocom_dev@localhost:5432/evocom_import_essai STORAGE_DIR=/tmp/evocom-import \
LEGACY_DATABASE_URL=postgres://evocom:evocom_dev@localhost:5432/evocom_legacy \
  npm run import-legacy -- --uploads ../import/fixtures/uploads ../import/fixtures/backend/uploads

npx vitest run test/import.test.ts   # crée ses propres bases evocom_import_legacy_test et evocom_import_test
```
