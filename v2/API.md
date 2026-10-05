# API Evocom Print v2

Toutes les routes sont sous `/api`, en JSON, authentifiées par le cookie HttpOnly `evocom_session`
(sauf `POST /auth/login` et `GET /health`). Erreurs : `{ error: "message lisible en français", code?, champs?, details? }`.
Montants : entiers en FCFA. Dates : ISO 8601 (`date` = `AAAA-MM-JJ`).

## Déjà en place

| Méthode | Route | Rôles | Rôle |
|---|---|---|---|
| POST | /auth/login `{email,password}` | public | `{user}` + cookie ; 401, 429 (blocage 15 min après 5 échecs) |
| POST | /auth/logout | tous | |
| GET | /auth/me | tous | `{user:{id,nom,email,role,telephone,doit_changer_mdp}}` |
| POST | /auth/mot-de-passe `{actuel,nouveau}` | tous | 204 |
| GET | /users | admin | liste avec `nb_dossiers` |
| GET | /users/annuaire | admin, preparateur | `[{id,nom,role}]` actifs |
| POST | /users `{nom,email,role,telephone?,password}` | admin | |
| PATCH | /users/:id | admin | `{nom?,email?,role?,telephone?,is_active?}` |
| POST | /users/:id/reinitialiser-mot-de-passe | admin | `{mot_de_passe_provisoire}` (affiché une fois) |
| GET | /dossiers?statut=a,b&machine&q&urgent=1&mine=1&file=travail&client_id&page&limit&tri=priorite\|recent\|ancien | tous (filtré par rôle) | `{items,total,page,limit,compteurs:{statut:n}}` |
| POST | /dossiers | admin, preparateur | fiche complète (201) |
| GET | /dossiers/:id | tous (filtré) | fiche : champs (dont `resume_specs`, résumé lisible) + `actions[]`, `peut_modifier`, `peut_supprimer`, `peut_deposer_fichiers`, `fichiers[]`, `historique[]`, `paiements[]`, `facture` |
| PATCH | /dossiers/:id | admin, preparateur propriétaire (en_cours/a_revoir) | fiche |
| DELETE | /dossiers/:id `{motif?}` | admin ; préparateur propriétaire si en_cours sans paiement | 204 (corbeille) |
| POST | /dossiers/:id/restaurer | admin | |
| POST | /dossiers/:id/actions/:action `{commentaire?, livraison?:{date_prevue,adresse?,notes?}, encaissement?:{montant,mode,reference?}}` | selon `ACTIONS` (shared/workflow.ts) | fiche |
| POST | /dossiers/:id/forcer-statut `{statut,commentaire}` | admin | |
| POST | /dossiers/:id/reporter `{date_prevue,motif?}` | admin, livreur | |
| POST | /dossiers/:id/urgence `{urgent}` | admin, préparateur propriétaire | |
| POST | /dossiers/:id/affecter `{imprimeur_id?,livreur_id?}` | admin | |
| POST | /dossiers/:id/commentaires `{texte}` | tous ceux qui voient le dossier | |
| tus | /uploads (POST/HEAD/PATCH) métadonnées `dossierId`, `filename`, `filetype` | préparateur propriétaire / admin tant que modifiable | en-tête `X-Fichier-Id` à la fin |
| GET | /fichiers/:id/contenu[?telecharger=1] | tous sauf livreur, si le dossier est visible | flux, Range accepté |
| PATCH | /fichiers/:id `{a_reimprimer}` | admin, imprimeur de la machine, préparateur propriétaire | 204 |
| DELETE | /fichiers/:id | comme l'envoi | 204 |
| GET | /tarifs | admin, preparateur | toutes les lignes |
| GET | /tarifs/libelles | tous | `[{machine,categorie,code,libelle,unite}]` sans les prix |
| POST / PATCH | /tarifs[/:id] | admin | |
| POST | /tarifs/estimer `{machine,specs}` | admin, preparateur | `ResultatPrix` ou `{ok:false,erreurs}` |

Socket.IO (`/socket.io`, cookie) : événements `dossier {type,id,numero,statut,machine}`, `paiement {dossier_id}`,
`notification {id,type,titre,message,dossier_id,created_at}`.

## Modules complémentaires

| Méthode | Route | Rôles | Réponse |
|---|---|---|---|
| GET | /notifications?non_lues=1 | tous | `{items:[{id,type,titre,message,dossier_id,lu_at,created_at}], non_lues:n}` (50 dernières) |
| POST | /notifications/lues `{ids?: number[]}` | tous | 204 (toutes si `ids` absent) |
| GET | /parametres | tous | `{entreprise, prix, livreur_jours_historique, fuseau}` (champs sensibles : aucun) |
| PUT | /parametres `{entreprise?, prix?, livreur_jours_historique?, fuseau?}` | admin | paramètres complets ; journalisé |
| GET | /clients?q&page&limit | admin, preparateur | `{items:[{id,nom,telephone,email,nb_dossiers,total_commandes,reste_du,dernier_dossier_at}], total}` |
| GET | /clients/recherche?q | admin, preparateur | `[{id,nom,telephone,email}]` (10 max, pour l'autocomplétion) |
| GET | /clients/:id | admin, preparateur | client + `dossiers[]` (20 derniers) + totaux `{nb_dossiers,total_commandes,total_paye,reste_du}` |
| POST | /clients `{nom,telephone?,email?,adresse?,notes?}` | admin, preparateur | 201 |
| PATCH | /clients/:id | admin, preparateur | |
| POST | /clients/:id/fusionner `{dans_id}` | admin | déplace dossiers/devis/factures vers `dans_id`, marque `fusionne_dans` |
| GET | /paiements?statut=a_valider\|valide\|refuse&livreur_id&from&to&page&limit | admin (tout) ; livreur (les siens) ; préparateur (les siens) | `{items:[{id,dossier_id,numero,client_nom,montant,mode,reference,statut,notes,encaisse_par_nom,encaisse_at,valide_par_nom,valide_at,motif_refus}], total, somme}` |
| POST | /dossiers/:id/paiements `{montant,mode,reference?,notes?}` | admin (validé d'office), préparateur, livreur (à valider) | paiement créé ; refuse un dépassement du reste à payer |
| POST | /paiements/:id/valider | admin | |
| POST | /paiements/:id/refuser `{motif}` | admin | motif obligatoire |
| GET | /caisse | admin | par encaisseur : `[{user_id,nom,role,a_valider:{n,somme},valide_aujourdhui:{n,somme}}]` + par mode |
| GET | /devis?statut&q&page&limit | admin (tous), préparateur (les siens) | `{items,total}` |
| POST | /devis `{machine,client_id?,client_nom,client_telephone?,client_email?,description?,specs,notes?,validite_jours?}` | admin, preparateur | prix calculé par le moteur ; 422 avec `details.erreurs` si incalculable |
| GET | /devis/:id | | devis + `detail_prix` |
| PATCH | /devis/:id | auteur ou admin, statut brouillon/envoye | recalcule |
| POST | /devis/:id/statut `{statut: envoye\|accepte\|refuse}` | auteur ou admin | |
| POST | /devis/:id/convertir | auteur ou admin, statut accepte (ou envoye) | crée le dossier (montant = total TTC du devis, `montant_source='devis'`), devis → `converti` ; renvoie `{dossier_id}` |
| GET | /devis/:id/pdf | auteur ou admin | PDF |
| DELETE | /devis/:id | auteur ou admin, brouillon uniquement | 204 |
| GET | /factures?q&from&to&statut&page&limit | admin, preparateur | `{items,total,somme_ttc}` |
| POST | /dossiers/:id/facture | admin, preparateur | crée la facture du dossier (numéro sans trou, lignes = detail_prix ou une ligne « Travaux d'impression »), 409 si déjà facturé ou sans montant |
| GET | /factures/:id | admin, preparateur | facture + situation de paiement du dossier |
| GET | /factures/:id/pdf | admin, preparateur | PDF |
| POST | /factures/:id/annuler `{motif}` | admin | statut `annulee` (le numéro n'est jamais réutilisé) |
| GET | /stats/apercu?periode=jour\|semaine\|mois\|annee | admin | KPI : `commandes {nb,montant}`, `encaisse {montant}`, `a_valider {nb,montant}`, `reste_a_encaisser {montant}` (dossiers livrés/terminés non soldés), `production {par_statut, par_machine}`, `retards {nb}` (date_promise dépassée non livrés), `urgents {nb}` |
| GET | /stats/evolution?from&to&pas=jour\|semaine\|mois | admin | `[{periode, commandes, montant_commandes, encaisse}]` |
| GET | /stats/production?from&to | admin | délais moyens (création→validation, validation→fin impression, fin impression→livraison), par machine, par utilisateur (nb actions) |
| GET | /stats/top-clients?from&to&limit | admin | `[{client_id,nom,nb,montant}]` |
| GET | /journal?user_id&action&from&to&page&limit | admin | `{items:[{id,user_nom,action,cible,cible_id,data,ip,created_at}], total}` |
| GET | /corbeille | admin | dossiers supprimés `[{id,numero,client_nom,statut,deleted_at,deleted_by_nom}]` |
| GET | /exports/dossiers.csv?from&to | admin | CSV `;` UTF-8 avec BOM |
| GET | /exports/paiements.csv?from&to | admin | |
| GET | /exports/factures.csv?from&to | admin | |
| GET | /sante | admin | `{version, base:{ok}, stockage:{chemin, libre_octets}, derniere_sauvegarde:{ok,created_at,taille,message}\|null, migrations}` |
| GET | /dossiers/:id/bon-de-travail.pdf | admin, preparateur, imprimeur de la machine | fiche atelier imprimable (sans montant), QR code vers la fiche |

## Apparence

| Méthode | Route | Rôles | Réponse |
|---|---|---|---|
| GET | /apparence | public (aussi avant connexion) | `{palette_defaut: evocom\|sobre\|perso, couleurs_perso: {debut,fin}\|null}` |
| PUT | /apparence `{palette_defaut, couleurs_perso}` | admin | idem ; couleurs `#rrvvbb` ; `perso` exige les deux couleurs ; journalisé `apparence_modifiee` |
| GET | /preferences | tous | `{theme: system\|light\|dark, palette: evocom\|sobre\|perso\|null, contraste: normal\|eleve}` (`palette: null` = celle de l'entreprise) |
| PUT | /preferences `{theme?, palette?, contraste?}` | tous | préférences complètes ; un champ absent ne change pas |

## Écarts

Précisions et ajouts par rapport au tableau ci-dessus (les champs listés dans le contrat sont tous présents ; rien n'a été retiré).

- **Listes paginées** (`/clients`, `/paiements`, `/devis`, `/factures`, `/journal`) : renvoient aussi `page` et `limit` (par défaut 50, maximum 200).
- **`/parametres` (PUT)** : fusion partielle (un champ absent garde sa valeur). Bornes : textes de `entreprise` ≤ 200 caractères (nom non vide, e-mail valide ou vide) ; `prix.arrondi_pas` entier 0..10 000 ; `prix.tva_taux` 0..100 ; `prix.surface_min_m2` 0..100 ; `livreur_jours_historique` entier 1..90 ; `fuseau` = nom IANA connu de PostgreSQL. Journalisé sous `parametres_modifies` avec `{cle:{avant,apres}}`.
- **`/clients`** : `items[]` contient aussi `adresse` et `total_paye`. `reste_du` = Σ par dossier de max(0, montant − paiements validés), dossiers supprimés exclus. Tri : dernier dossier le plus récent d'abord. `POST /clients` renvoie 409 (`details.client_id`) si un client actif a déjà le même nom et le même téléphone. `GET /clients/:id` renvoie la fiche même fusionnée (`fusionne_dans`, `fusionne_dans_nom`) ; `PATCH` d'une fiche fusionnée : 409. `POST /clients/:id/fusionner` renvoie la fiche de destination (format de `GET /clients/:id`) plus `fusion:{dossiers,devis,factures}` ; les coordonnées manquantes de la destination sont complétées par la source. Journalisé (`client_fusionne`, `client_modifie`).
- **`/paiements`** : filtres supplémentaires `mode` et `dossier_id` ; `statut` accepte une liste (`a_valider,valide`). `livreur_id` filtre sur l'encaisseur (quel que soit son rôle) et n'est pris en compte que pour l'administrateur. Chaque élément porte aussi `encaisse_par`, `valide_par` et `dossier_supprime`. `valide_par_nom`/`valide_at` désignent aussi la personne et la date d'un **refus**. `somme` = Σ des montants filtrés, tous statuts confondus.
- **`POST /dossiers/:id/paiements`** : 201 avec le paiement (même format que la liste). Le livreur ne peut encaisser que sur un dossier qu'il voit (404 sinon). Valider ou refuser un paiement déjà traité : 409. À la validation, si le total validé dépassait le montant du dossier : 409 avec `details:{deja_paye, montant_dossier}`. Valider et refuser sont journalisés et notifient l'encaisseur (`paiement_valide`, `paiement_refuse`).
- **`GET /caisse`** : objet `{ par_encaisseur: [{user_id,nom,role,a_valider:{n,somme},valide_aujourdhui:{n,somme}}], par_mode: [{mode,libelle,a_valider,valide_aujourdhui}], totaux:{a_valider,valide_aujourdhui} }`. « Aujourd'hui » = jour civil dans le fuseau des paramètres.
- **`/devis`** : chaque devis porte `statut_label`, `date_validite` (AAAA-MM-JJ), `expire`, `created_by_nom`, `dossier_numero`, et dans la fiche `transitions[]`, `peut_modifier`, `peut_supprimer`, `peut_convertir`. Un préparateur ne voit que ses devis (404 sinon). Circuit : brouillon → envoye → accepte | refuse ; en plus, accepte → refuse (le client se rétracte) et refuse → envoye (nouvelle proposition). `PATCH` ne recalcule le prix que si `machine` ou `specs` sont fournis. `detail_prix` contient aussi `tva_applicable`, `tva_taux`, `prix_saisis_ht` (règle appliquée au chiffrage).
- **`POST /devis/:id/convertir`** : 201 `{dossier_id, numero}`. Corps facultatif `{urgent?, date_promise?, consignes?, adresse_livraison?, mode_paiement_prevu?}` repris sur le dossier. Le `detail_prix` du dossier est celui du devis (prix convenus). Deuxième conversion : 409 avec `details.dossier_id`.
- **`/factures`** : `somme_ttc` ne compte que les factures émises (pas les annulées) parmi les résultats filtrés ; filtres supplémentaires `client_id`, `dossier_id`, `statut` en liste. `from`/`to` portent sur `date_emission`. `GET /factures/:id` ajoute `dossier_numero`, `deja_paye`, `en_attente_validation`, `reste`, `situation_paiement`, `created_by_nom`, `annulee_par_nom`. Lignes : `{designation, detail, quantite, unite, prix_unitaire, total}` ; quand la TVA s'applique elles sont exprimées hors taxes et leur somme vaut `total_ht` (une ligne « Remise », « Arrondi » ou « Ajustement au prix convenu » rend l'écart explicite). Un dossier sans montant ou à 0 : 409. Émission et annulation sont journalisées.
- **PDF** (`/devis/:id/pdf`, `/factures/:id/pdf`, `/dossiers/:id/bon-de-travail.pdf`) : affichés dans le navigateur ; `?telecharger=1` force le téléchargement. Le QR code du bon de travail pointe vers `${APP_URL}/dossiers/:id` (chemin relatif imprimé en clair si `APP_URL` n'est pas défini).
- **`/stats/apercu`** : `periode` vaut `mois` par défaut ; réponse enrichie de `du`, `au` (jours civils), `fuseau`, `encaisse.nb`, `reste_a_encaisser.nb_dossiers`. `production.par_statut` = `{statut: n}` (tous les statuts, photographie actuelle) et `production.par_machine` = `{roland:{statut:n}, xerox:{statut:n}}`. Définitions détaillées en tête de `api/src/modules/stats/routes.ts` (dossiers supprimés et leurs paiements exclus partout).
- **`/stats/evolution`** : `periode` = premier jour de la période (AAAA-MM-JJ) ; par défaut 30 jours (`jour`), 12 semaines (`semaine`) ou 12 mois (`mois`) jusqu'à aujourd'hui ; 400 au-delà de 400/260/120 points.
- **`/stats/production`** : `{du, au, delais:{creation_validation, validation_fin_impression, fin_impression_livraison}, par_machine:[{machine,crees,montant,imprimes,livres,delais}], par_utilisateur:[{user_id,nom,role,nb_actions,actions:{action:n}}]}` ; chaque délai vaut `{heures_moyennes, nb}` et porte sur les dossiers dont l'étape se termine dans la période. Par défaut : du 1er du mois à aujourd'hui (idem `/stats/top-clients`, `limit` 10 par défaut, 100 maximum).
- **`/journal`** : filtres `action` et `cible` acceptent une liste ; chaque élément porte aussi `user_id`.
- **`/corbeille`** : ajoute `machine`, `montant`, `deleted_by`, `motif` (dernier motif de suppression) et `nb_paiements` ; 500 éléments au plus.
- **Exports CSV** : sans `from`/`to`, tout l'historique. Dossiers : par date de création (supprimés exclus) ; paiements : par date d'encaissement ; factures : par date d'émission. Booléens « Oui »/« Non », taux de TVA avec virgule décimale ; une cellule commençant par `=`, `@`, `+` ou `-` (hors numéro de téléphone) est préfixée d'une apostrophe pour neutraliser les formules.
- **`/sante`** : `base:{ok, latence_ms}` (ou `{ok:false, erreur}`), `stockage:{chemin, libre_octets, total_octets}`, `derniere_sauvegarde` ajoute `fichier`, `migrations:{a_jour, en_attente:[...]}`.
