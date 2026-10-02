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
| GET | /dossiers/:id | tous (filtré) | fiche : champs + `actions[]`, `peut_modifier`, `peut_supprimer`, `peut_deposer_fichiers`, `fichiers[]`, `historique[]`, `paiements[]`, `facture` |
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
