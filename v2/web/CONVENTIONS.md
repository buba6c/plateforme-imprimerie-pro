# Interface Evocom Print v2 : conventions

## Charte
- Les composants visuels viennent de `src/styles/evocom.css` (classes `ev-*`), copie exacte du Design System
  « Evocom Print » (Claude Design). Lire ce fichier avant d'écrire un écran : boutons `ev-btn`, champs `ev-field`,
  badges `ev-status[data-statut]`, `ev-machine`, `ev-urgent`, `ev-pay[data-pay]`, cartes `ev-card`, indicateurs `ev-kpi`,
  tableaux `ev-table-wrap > ev-table`, onglets `ev-tabs`, filtres `ev-filterbar`/`ev-search`/`ev-chip`, fichiers `ev-file`,
  `ev-dropzone`, `ev-progress`, historique `ev-timeline`, dialogues, notifications, états vides `ev-empty`, cartes de
  dossier `ev-job` dans `ev-board`/`ev-column`.
- Mise en page : `src/styles/app.css` (`stack`, `row`, `row-between`, `grid-2`, `grid-main`, `kv`, `section-title`…).
- Couleurs : uniquement les variables (`var(--ink)`, `var(--text-muted)`…). Jamais de couleur en dur, jamais de dégradé,
  jamais de violet. `coral` est réservé au marqueur URGENT.
- Polices : Geist (texte) et Geist Mono via les classes `ev-num` (montants, quantités), `ev-ref` (numéros, dates).
- Icônes : `lucide-react` uniquement, 16 px dans les boutons. Aucun emoji, nulle part.
- Mode sombre : automatique via les variables ; vérifier les écrans dans les deux thèmes.
- Mobile : tout écran doit fonctionner à 390 px de large (une colonne, pas de défilement horizontal de la page ;
  les tableaux défilent dans `ev-table-wrap`). Le livreur et les imprimeurs utilisent surtout un téléphone.

## Composants React existants (ne pas modifier, les réutiliser)
- `src/ui` : `Button`, `IconButton`, `TextField`, `SelectField`, `TextareaField`, `Checkbox`, `Segmented`, `FieldShell`,
  `StatusBadge`, `MachineChip`, `UrgentTag`, `PaymentBadge`, `PaiementStatutBadge`, `Count`, `Ref`, `Card`, `PageHeader`,
  `EmptyState`, `Skeleton`, `LoadingRows`, `Alert`, `Kpi`, `Money`, `Tabs`, `Pagination`, `Dialog`, `ConfirmDialog`,
  `useToast`.
- `src/features/dossiers` : `useDossiers`, `useDossier`, `useAction`, `useDossierMutation`, `DossierActions`
  (boutons + dialogues de révision, programmation, livraison avec encaissement), `JobCard`, `specResume`.
- `src/lib/api.ts` : `api.get/post/put/patch/del`, `ApiError`, `messageErreur`, `fichierUrl`.
- `src/lib/types.ts` : types des réponses. `@evocom/shared` : libellés, formats (`formatFCFA`, `formatDate`,
  `formatDateHeure`, `formatRelatif`, `formatTaille`, `parseMontant`), circuit (`ACTIONS_BY_ID`), schémas, moteur de prix
  (`calculerPrix`, `UNITE_TARIF_LABELS`, `CATEGORIE_TARIF_LABELS`, `resumeLigne`).
- `src/auth/AuthContext.tsx` : `useUser()`, `useAuth()`.

## Règles d'écriture
- Toute nouvelle page remplace le fichier « Placeholder » prévu dans `src/pages/...` (les routes sont déjà dans
  `src/App.tsx`). Ne pas modifier `App.tsx`, `src/ui`, `src/layout`, `src/lib`, `src/auth`, `src/styles/evocom.css`,
  `src/styles/tokens.css`, `src/styles/app.css`. Les composants propres à une partie vont dans `src/features/<partie>/` ;
  le CSS spécifique, s'il en faut, dans `src/features/<partie>/<partie>.css` importé par ses pages.
- Données : TanStack Query avec des clés qui commencent par le nom de la ressource (`['dossiers', …]`, `['dossier', id]`,
  `['paiements', …]`, `['devis', …]`, `['factures', …]`, `['clients', …]`, `['stats', …]`, `['tarifs']`, `['users']`,
  `['parametres']`) : le temps réel les invalide automatiquement.
- Aucune donnée inventée : un chiffre inconnu s'affiche « — ». Pas de valeurs de démonstration dans le code.
- Textes en français, phrase simple ; boutons = verbe à l'infinitif qui dit ce qui se passe ; erreurs = ce qui a échoué
  et comment corriger (utiliser `messageErreur(e)` pour les erreurs de l'API). Pas d'`alert()` ni de `confirm()` :
  `ConfirmDialog` et `useToast`.
- Accessibilité : chaque champ a un libellé, chaque bouton-icône un `label`, les éléments cliquables sont des boutons
  ou des liens, focus visible conservé.
- Chargement : `LoadingRows`/`Skeleton` ; vide : `EmptyState` qui dit ce qui apparaîtra et comment commencer.
- Droits : l'API filtre déjà tout ; l'interface n'affiche que les actions renvoyées (`actions`, `peut_modifier`…).

## Environnement de développement
- API de développement (rechargement automatique) : http://127.0.0.1:4000, base `evocom_v2` avec 14 dossiers de
  démonstration. Comptes (mot de passe `Evocom2026!`) : admin@evocom.test, prep@evocom.test, roland@evocom.test,
  xerox@evocom.test, livreur@evocom.test. Contrat de l'API : `v2/API.md`.
- Lancer l'interface : `cd v2/web && npx vite --port <votre port> --strictPort` (le proxy envoie `/api` et
  `/socket.io` vers le port 4000).
- Vérifications obligatoires avant de rendre : `npx tsc -p tsconfig.json` sans erreur, `npx vite build` sans erreur,
  et des captures d'écran de chaque écran (bureau 1440 px et téléphone 390 px, clair et sombre) avec
  `BASE=http://127.0.0.1:<port> node <scratchpad>/shot.cjs <chemin> <sortie.png> <email> <largeur> <light|dark>`,
  regardées une par une pour corriger ce qui dépasse, se chevauche ou est illisible.
