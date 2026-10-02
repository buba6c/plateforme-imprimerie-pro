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
- Rien n'est supprimé définitivement : les dossiers et les fichiers vont à la corbeille.
- Les fichiers ne sont jamais servis en accès libre : chaque lecture vérifie les droits sur le dossier.

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

## Mettre en ligne

Voir `deploy/GUIDE_MISE_EN_LIGNE.md` : sécurité du VPS, installation à côté de l'ancienne application, import d'essai,
recette par l'équipe, bascule et retour arrière, sauvegardes.
