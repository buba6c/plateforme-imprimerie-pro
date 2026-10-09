# API Evocom Print v2

Toutes les routes sont sous `/api`, en JSON, authentifiées par le cookie HttpOnly `evocom_session`
(sauf `POST /auth/login` et `GET /health`). Erreurs : `{ error: "message lisible en français", code?, champs?, details? }`.
Montants : entiers en FCFA. Dates : ISO 8601 (`date` = `AAAA-MM-JJ`).

## Déjà en place

| Méthode | Route | Rôles | Rôle |
|---|---|---|---|
| POST | /auth/login `{email,password}` | public | `{user}` + cookie ; 401, 429 (blocage selon Paramètres > Sécurité : par défaut 15 min après 5 échecs) |
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
| POST | /paiements/:id/valider | admin | 409 si déjà traité, dossier à la corbeille ou dépassement du montant (`details:{deja_paye,montant_dossier}`) |
| POST | /paiements/:id/refuser `{motif}` | admin | motif obligatoire |
| POST | /paiements/valider-groupe `{ids}` | admin | 1 à 500 ids ; `{valides, somme, ids[], refuses:[{id,numero,code,message,details?}]}` (voir plus bas) |
| GET | /paiements/historique?avant | admin | aperçu sans écriture de la validation de l'historique importé : `{avant, borne, n, somme, ignores:{n,somme,depassement,exemples[]}, importes_a_valider:{n,somme}}` |
| POST | /paiements/valider-historique `{avant, mot_de_passe}` | admin | valide d'un coup les paiements importés à valider (voir plus bas) ; `{avant, borne, n, somme, ignores}` |
| GET | /caisse | admin | par encaisseur : `[{user_id,nom,role,a_valider:{n,somme},valide_aujourdhui:{n,somme},refuse_aujourdhui:{n,somme}}]` + par mode |
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

## Assistant IA (suggestion seulement)

L'assistant propose des spécifications ; la personne les applique au formulaire, relit et enregistre elle-même.
Le prix est toujours recalculé par le moteur (`calculerPrix`) et la grille, jamais repris de l'IA.

| Méthode | Route | Rôles | Réponse |
|---|---|---|---|
| GET | /ia/statut | admin, preparateur | `{actif}` : vrai seulement si l'assistant est activé et qu'une clé est enregistrée |
| GET | /ia/config | admin | `{actif, modele, modeles[], cle_configuree, cle_fin, cle_lisible, updated_at, updated_by_nom}` ; la clé n'est jamais renvoyée |
| PUT | /ia/config `{actif?, modele?: gpt-4o-mini\|gpt-4o\|gpt-4.1-mini, cle?: string\|null}` | admin | configuration ; `cle: null` efface la clé et désactive ; 409 si activation sans clé ; clé `sk-…` (20 à 300 caractères), chiffrée AES-256-GCM ; journalisé `ia_config_modifiee` sans la clé |
| POST | /ia/test `{cle?, modele?}` | admin | `{ok, modele, duree_ms}` ; teste la clé fournie ou l'enregistrée ; 409 si absente ou illisible |
| POST | /ia/suggestion `{description (1 à 2000), machine?: roland\|xerox}` | admin, preparateur | `{machine, specs, prix: {total, …ResultatPrix}\|null, erreur_prix?, avertissements[], remarques?}` ; codes de tarif inconnus ou sans prix retirés avec un avertissement |
| GET | /ia/usages?limit (50, 200 max) | admin | `{items:[{id,user_nom,type,statut,modele,duree_ms,jetons_entree,jetons_sortie,longueur_demande,extrait,created_at}], totaux_30_jours}` (extrait ≤ 120 caractères ; ni la demande complète ni la réponse ne sont gardées) |

Erreurs de `/ia/suggestion` : 409 `ia_inactif`, 409 `ia_cle_illisible` (secret de chiffrement changé : ressaisir la clé),
429 (plus de 30 propositions par utilisateur et par heure), 502 (clé refusée, modèle indisponible, service injoignable,
réponse illisible), 503 (crédit ou débit OpenAI épuisé), 504 (pas de réponse en 25 s). Une erreur 401 d'OpenAI n'est
jamais renvoyée telle quelle (elle déconnecterait l'utilisateur).

## Gestion des fichiers

Préfixe distinct de `/fichiers` pour qu'aucune route ne se marche dessus. Visibilité appliquée dans le SQL (mêmes règles
que les dossiers) ; les fichiers à la corbeille sont exclus de la liste ; le chemin disque n'est jamais renvoyé. Les
fichiers purgés (`purge_at` renseigné) n'apparaissent plus nulle part (liste, corbeille, contrôle d'intégrité) et ne
peuvent plus être restaurés ; leur ligne reste en base comme trace.
Aperçu et téléchargement : `GET /fichiers/:id/contenu`.

| Méthode | Route | Rôles | Réponse |
|---|---|---|---|
| GET | /gestion-fichiers?q&type=pdf,image,autre&machine&statut=a,b&uploaded_by&dossier_id&from&to&tri=date\|nom\|taille&ordre=asc\|desc&page&limit | admin, preparateur | `{items:[{id,nom_original,mime,taille,a_reimprimer,created_at,uploaded_by,uploaded_by_nom,categorie,importe,dossier_id,dossier_numero,dossier_statut,machine,client_id,client_nom,urgent}], total, taille_totale, page, limit}` ; valeur de filtre inconnue : 400 avec les valeurs possibles ; période sur la date d'envoi (fuseau des paramètres) |
| GET | /gestion-fichiers/auteurs | admin, preparateur | `[{id,nom,role,nb}]` |
| GET | /gestion-fichiers/corbeille?q&page&limit | admin | mêmes champs + `deleted_at, deleted_by, deleted_by_nom, dossier_supprime, dossier_deleted_at, present, partage, peut_restaurer` ; `total, taille_totale` ; fichiers purgés exclus ; `partage` = le contenu a d'autres noms sur le disque (nlink > 1 : ancienne application, instantanés de sauvegarde) |
| POST | /gestion-fichiers/:id/restaurer | admin | le fichier ; 404 ; 409 s'il n'est pas à la corbeille ou s'il a été purgé ; 409 avec `details.dossier_id` si son dossier est à la corbeille ; journal `fichier_restaure` et historique `fichier/restauration` |
| POST | /gestion-fichiers/corbeille-groupee `{ids: number[]}` (1 à 500) | admin | `{mis_a_la_corbeille, taille, deja_a_la_corbeille[], introuvables[], dossiers[]}` ; aussi pour un dossier validé ou livré ; historique `fichier/suppression` sur chaque dossier ; journal `fichiers_corbeille_groupee` |
| POST | /gestion-fichiers/restaurer-groupe `{ids}` (1 à 500) | admin | `{restaures, ignores:[{id,nom,raison: introuvable\|pas_a_la_corbeille\|purge\|dossier_a_la_corbeille,message}], dossiers[]}` ; historique `fichier/restauration` ; journal `fichiers_restaures_groupe` |
| POST | /gestion-fichiers/purger `{ids (1 à 500), mot_de_passe}` | admin | `{purges, supprimes_du_disque, octets_liberes_maintenant, octets_partages, fichiers_partages, absents, erreurs:[{id,nom,message}]}` (voir « Purge définitive ») |
| GET | /gestion-fichiers/integrite | admin | `{verifie_at, duree_ms, fichiers:{nb,taille}, repartition:{actifs,corbeille,dossiers_corbeille}, presents:{nb,taille}, manquants:{nb,taille_declaree,items}, taille_differente:{nb,items}, orphelins:{nb,taille}, espace:{libre_octets,total_octets}\|null}` (listes limitées à 500 ; relit le stockage à chaque appel ; fichiers purgés exclus) |

### Purge définitive

`POST /gestion-fichiers/purger` : 400 sans mot de passe ou s'il est faux (`champs.mot_de_passe`, journal `purge_refusee`) ;
429 après 5 mots de passe faux dans l'heure ; 409 si un des fichiers n'est pas à la corbeille, est déjà purgé ou n'existe
pas (`details:{hors_corbeille, deja_purges, introuvables}`, rien n'est purgé) ; 409 si une autre purge tourne.
Déroulé : 1. une transaction (`FOR UPDATE`) pose `purge_at`/`purge_par` et journalise `fichiers_purges` avec, pour chaque
fichier, `id, nom, chemin, sha256, taille, dossier_id, numero` ; 2. après le commit, pour chaque fichier : chemin sous
`STORAGE_DIR/dossiers`, `lstat` d'un fichier ordinaire (jamais un lien symbolique), aucune autre ligne non purgée avec le
même chemin, puis lecture de `nlink` et `unlink` ; 3. `purge_resultat` écrit sur chaque ligne (`supprime`,
`supprime (contenu partagé : n noms)`, `absent du disque`, `conserve : …`, `erreur : …`), journal `fichiers_purges_resultat`.
`octets_liberes_maintenant` = somme des tailles où `nlink` valait 1 ; `octets_partages` = fichiers dont le contenu avait
d'autres noms (ancienne application, instantanés `rsync --link-dest`) : la place ne revient qu'à la disparition du dernier
nom. Un fichier gardé (chemin partagé, hors du dossier des fichiers, lien symbolique, erreur) figure dans `erreurs`.

## Sauvegardes et espace disque

Routes `/systeme/*`, administrateur seulement.

| Méthode | Route | Réponse |
|---|---|---|
| GET | /systeme/sauvegardes | `{items:[{id, ok, fichier, nom, taille, message, created_at, present, taille_reelle}], en_cours, dossier}` : 30 dernières lignes de `sauvegardes` ; `present`/`taille_reelle` lus sur le disque, seulement pour un fichier situé sous `BACKUP_DIR` (liens symboliques résolus) |
| POST | /systeme/sauvegardes | lance `deploy/backup.sh` et attend sa fin : 200 `{ok:true, message, duree_ms}` ; 500 `{ok:false, error, message, duree_ms, code:'sauvegarde_echouee'}` avec la dernière ligne d'erreur du script ; 409 si une sauvegarde tourne déjà (dans l'API ou la tâche de la nuit : code 75 du script) ; arrêtée au bout de 30 minutes ; journal `sauvegarde_lancee` |
| GET | /systeme/sauvegardes/:id/telecharger | le fichier `.dump` (pièce jointe) seulement s'il est sous `BACKUP_DIR` ; 404 sinon ; journal `sauvegarde_telechargee` |
| GET | /systeme/stockage[?rafraichir=1] | `{disque:{total,libre,utilise}\|null, fichiers:{actifs:{nb,taille}, corbeille:{nb,taille}, purges:{nb,taille}}, liberable:{dossiers_livres_plus_3_mois:{nb,taille}}, partages:{nb,taille,calcule_at}}` ; `partages` = fichiers actifs (chemins distincts) dont `nlink > 1`, lu sur le disque et gardé 10 minutes (`rafraichir=1` force la relecture ; vidé après une purge, une action groupée ou une sauvegarde) |

Script : chemin `BACKUP_SCRIPT` s'il est défini, sinon `deploy/backup.sh` trouvé en remontant depuis le code de l'API.
L'API lui passe `ENV_FILE` vide et ses propres `DATABASE_URL`, `STORAGE_DIR`, `BACKUP_DIR` (le script ne charge un
fichier `.env` que s'il existe). Après chaque instantané rsync, le script fait `touch` sur le répertoire de l'instantané
(sinon il héritait de la date du stockage et `find -mtime` l'effaçait le soir même) ; `rclone sync` utilise
`--backup-dir <dest>/fichiers-supprimes/<date>` (gardés `RCLONE_JOURS`, 30 jours par défaut).

## Livraisons : planning et historique

| Méthode | Route | Rôles | Réponse |
|---|---|---|---|
| GET | /livraisons/planning?debut&fin[&livreur_id] | livreur (ses livraisons en cours, celles sans livreur désigné, celles qu'il a livrées dans la fenêtre `livreur_jours_historique`) ; admin (tout, filtre `livreur_id`) | `{debut, fin, aujourdhui, fuseau, livreur_id, jours_historique, items[], en_retard[], a_programmer[]}` ; élément : `{id, numero, statut, statut_label, urgent, client_nom, client_telephone, adresse_livraison, notes_livraison, date_promise, livraison_prevue_at, livre_at, livreur_id, livreur_nom, montant, mode_paiement_prevu, deja_paye, en_attente_validation, solde, reste_a_encaisser, nb_fichiers, nb_reports, jour, heure, actions[]}` (`jour`, `heure` dans le fuseau des paramètres) ; 400 si période absente, invalide, inversée ou de plus de 62 jours |
| GET | /livraisons/historique?page&taille&du&au&q&mode_paiement[&livreur_id] | livreur (les siennes, sans limite de durée) ; admin (tout, filtre `livreur_id`) | `{items:[{id, numero, client_nom, adresse_livraison, livre_at, livreur_id, livreur_nom, fiche_accessible, encaissements:[{id, montant, mode, statut, encaisse_at, motif_refus}], encaisse}], total, page, taille, du, au, totaux:{nb_livraisons, encaisse, valide, en_attente_validation, refuse, par_mode:[{mode, libelle, nb, montant, valide, en_attente_validation}]}}` ; ni téléphone, ni prix, ni fichiers ; `taille` 25 (100 max) ; 400 si mode inconnu ou `du` > `au` |

Préparateur et imprimeurs : 403. Droits appliqués dans le SQL (règle de visibilité commune).

## Paramètres étendus, numérotation, configuration, réinitialisation

Chaque réglage agit réellement ; les valeurs par défaut reprennent le comportement d'origine. Le cache des paramètres
(10 s par processus) est vidé à chaque enregistrement et à chaque import.

| Section | Réglage (défaut) | Effet |
|---|---|---|
| `securite` | `session_heures` (1..720, défaut `SESSION_HOURS`) | durée du jeton et du cookie à la connexion et au changement de mot de passe |
| `securite` | `echecs_avant_blocage` (3..20, 5), `blocage_minutes` (1..1440, 15) | blocage à la connexion ; le 429 de `/auth/login` indique les minutes restantes |
| `securite` | `mdp_longueur_min` (8..64, 8) | création d'utilisateur, changement de mot de passe, mot de passe provisoire |
| `fichiers` | `taille_max_mo` (≤ `MAX_UPLOAD_MB`), `extensions` (vide = toutes) | envoi tus : 413 et 415 avec un message en français |
| `documents` | `devis_validite_jours` (15), `mentions_devis`, `conditions_paiement` (≤ 1000) | devis créés sans validité ; textes imprimés sur les PDF de devis et de facture |
| `notifications` | un interrupteur par type émis | `notifier()` |

| Méthode | Route | Rôles | Réponse |
|---|---|---|---|
| GET | /parametres | tous | admin : toutes les sections (+ `securite`, `fichiers`, `documents`, `notifications`) ; autres rôles : `entreprise`, `prix`, `livreur_jours_historique`, `fuseau` |
| GET | /parametres/regles | tous | `{fichiers:{taille_max_mo,extensions,plafond_serveur_mo}, securite:{mdp_longueur_min}, documents:{devis_validite_jours}}` |
| PUT | /parametres | admin | fusion partielle, nouvelles sections comprises ; bornes validées ; journalisé |
| GET | /systeme/numerotation | admin | `{annee, series:[{serie,libelle,dernier,dernier_numero,prochain,prochain_numero}]}` |
| PUT | /systeme/numerotation `{CMD?,DEV?,FAC?}` | admin | état ; 400 si le prochain numéro n'est pas au-dessus du dernier attribué ; `numerotation_modifiee` |
| GET | /systeme/configuration | admin | fichier JSON `{format,version,exporte_le,exporte_par,parametres,apparence,tarifs}`, sans `ia_config` ni aucun secret ; `configuration_exportee` |
| POST | /systeme/configuration/apercu | admin | fichier exporté → `{parametres:[…], tarifs:{ajoutes,modifies,inchanges,absents_conserves}, nb_changements}` ; 400 avec `champs` |
| POST | /systeme/configuration/importer | admin | même corps ; appliqué en une transaction (tarifs absents conservés) ; `configuration_importee` |
| GET | /systeme/reinitialisation | admin | `{autorisee, variable, phrase_attendue, ce_qui_est_efface, ce_qui_est_conserve, tentatives_restantes}` |
| POST | /systeme/reinitialiser `{mot_de_passe, phrase}` | admin | `{sauvegarde, efface, fichiers:{deplaces,absents,dossier}, sessions_fermees}` |

Réinitialisation : 403 si `ALLOW_SYSTEM_RESET` n'est pas `true` ou si l'appelant n'est pas admin ; 400 mot de passe ou
phrase (`REINITIALISER EVOCOM`) incorrects ; 429 après 3 tentatives dans l'heure ; 500 `sauvegarde_echouee` (rien
n'est effacé). Déroulé : `pg_dump` complet vers `STORAGE_DIR/sauvegardes/avant-reinitialisation-<date>.sql.gz`, puis
une transaction efface dossiers, fichiers, paiements, devis, factures, notifications, historique, clients, `ia_usage` ;
compteurs remis à zéro ; autres sessions fermées ; fichiers physiques déplacés dans `STORAGE_DIR/reinitialisation-<date>/`
(remis en place si la transaction échoue). Conservés : utilisateurs, préférences, tarifs, paramètres (dont l'apparence),
configuration de l'assistant IA, journal, sauvegardes.

## Facturation : factures directes et liaison VosFactures

Migration `010_factures.sql` : `factures.dossier_id` devient facultatif (facture directe), colonnes `client_email`,
`remise`, `notes`, `conditions_paiement`, `date_echeance` ; table `factures_vosfactures` (journal d'envoi, une ligne par
facture) ; table `vosfactures_config` (une ligne, clé chiffrée). Toutes les requêtes joignent `dossiers` en LEFT JOIN :
une facture directe a `dossier_id`, `dossier_numero`, `deja_paye`, `reste` et `situation_paiement` à `null` et
`origine: "directe"` (sinon `"dossier"`).

| Méthode | Route | Rôles | Rôle |
|---|---|---|---|
| GET | /factures?q&from&to&statut&vosfactures&origine&client_id&dossier_id&page&limit | admin, preparateur | **toutes les factures par défaut** (aucun filtre de période implicite) ; `q` cherche numéro, client, dossier et numéro VosFactures ; `vosfactures` = `envoyee` \| `non_envoyee` \| `erreur` ; `origine` = `dossier` \| `directe` ; réponse `{items,total,somme_ttc,compteurs:{emise,annulee},page,limit,vosfactures_actif}` ; chaque élément porte `vosfactures` (journal ci-dessous ou `null`) |
| POST | /factures `{client_id?, client_nom, client_telephone?, client_email?, client_adresse?, date_emission?, date_echeance?, lignes:[{designation, detail?, quantite, unite, prix_unitaire}], remise?, notes?, conditions_paiement?}` | admin, preparateur | facture directe (201, format de `GET /factures/:id`) : client de l'annuaire (`client_id`, fusions suivies) ou retrouvé/créé par son nom ; 1 à 50 lignes, quantité > 0 (2 décimales), prix unitaire entier ≥ 0, unité libre (20 caractères) ; numéro FAC pris dans `compteurs` (même suite que les factures de dossier) ; 400 avec `champs` (`lignes.0.quantite`, `remise`, `date_echeance`…) ; total à 0 : 400 ; journal `facture_emise` (`directe: true`) |
| GET | /factures/vosfactures/config | admin | `{sous_domaine, cle_configuree, cle_fin, cle_lisible, envoi_auto, actif, vendeur, vendeur_effectif, updated_at, updated_by_nom}` ; la clé n'est jamais renvoyée |
| PUT | /factures/vosfactures/config `{sous_domaine?, cle?: string\|null, envoi_auto?, vendeur?:{nom,adresse,nif,email,telephone}}` | admin | `cle: null` efface la clé (et désactive l'envoi automatique) ; 409 si `envoi_auto` sans sous-domaine et clé ; clé chiffrée AES-256-GCM (même mécanisme que la clé OpenAI, `IA_CLE_CHIFFREMENT` sinon `JWT_SECRET`) ; journal `vosfactures_config_modifiee` sans la clé |
| POST | /factures/vosfactures/test `{sous_domaine?, cle?}` | admin | `GET https://<sous_domaine>.vosfactures.fr/invoices.json?page=1&per_page=1` avec les valeurs fournies, sinon celles enregistrées ; `{ok, sous_domaine, nb_factures_visibles, duree_ms}` ; erreurs ci-dessous |
| POST | /factures/:id/vosfactures | admin, preparateur | envoi (ou nouvel essai) vers VosFactures : `POST /invoices.json` ; fiche à jour ; 409 si annulée, déjà envoyée ou envoi en cours ; 502/504 (`code` ci-dessous) avec l'erreur notée dans le journal |
| POST | /factures/:id/vosfactures/annuler | admin | nouvel essai d'annulation côté VosFactures quand celle faite à l'annulation a échoué ; 409 si non annulée, jamais envoyée ou déjà annulée là-bas |
| GET | /factures/:id/vosfactures.pdf | admin, preparateur | PDF édité par VosFactures (`/invoices/:id.pdf`), relayé par le serveur : la clé API ne sort jamais vers le navigateur ; `?telecharger=1` |

Journal d'envoi `vosfactures` : `{id, numero, url, envoye_at, envoye_par_nom, erreur, erreur_at, tentatives, annulee_at, annulation_erreur}` (`id` = identifiant VosFactures, `null` tant qu'aucun envoi n'a abouti ; `url` = lien de consultation `view_url`).

Facture envoyée à VosFactures (`invoice`) : `kind: "vat"`, `issue_date` = `sell_date` = date d'émission, `payment_to` = échéance (sinon émission + 30 jours), `seller_*` depuis le vendeur de la configuration complété par Paramètres > Entreprise, `buyer_name/buyer_email/buyer_phone/buyer_street`, `currency: "XOF"`, `lang: "fr"`, `description` et `internal_note` = « Réf. Evocom FAC-… · Dossier CMD-… », `positions[{name, quantity, quantity_unit, total_price_gross, tax}]` : chaque ligne Evocom (hors taxes quand la TVA s'applique) est envoyée en TTC, `tax` = taux ou `"disabled"`, la dernière position absorbe l'écart d'arrondi pour que la somme soit exactement `total_ttc` ; remise et arrondi sont des positions négatives. Numéro VosFactures attribué par VosFactures (le numéro Evocom reste la référence interne).

Annulation : `POST /factures/:id/annuler` annule ensuite la facture côté VosFactures si elle y a été envoyée (`POST /invoices/cancel.json` avec `cancel_invoice_id` et `cancel_reason` = motif), ce qui la laisse visible et barrée là-bas. Un échec est noté (`annulation_erreur`) sans empêcher l'annulation locale ; journal `facture_annulee_vosfactures` / `facture_annulation_vosfactures_echouee`.

Envoi automatique (`envoi_auto`) : chaque facture émise (dossier ou directe) est envoyée juste après l'émission, dans la réponse 201 (`vosfactures` renseigné) ; un échec n'empêche pas l'émission et reste réessayable.

Erreurs VosFactures (`code`) : `vosfactures_cle_refusee` (401/403 distant), `vosfactures_compte_inconnu` (sous-domaine inconnu ou invalide), `vosfactures_injoignable` (réseau, 5xx), `vosfactures_delai` (504 après 20 s), `vosfactures_donnees_refusees` (422, détail du champ en clair), `vosfactures_reponse_invalide`, `vosfactures_cle_illisible` (409, secret de chiffrement changé). Variables : `VOSFACTURES_URL` remplace `https://<sous_domaine>.vosfactures.fr` (serveur simulé des tests) ; le jeton est envoyé dans le corps (POST) ou en paramètre `api_token` (GET), jamais écrit dans les journaux.

## WhatsApp client

Message automatique au client, envoyé depuis le numéro WhatsApp dédié de l'imprimerie (connexion « appareil lié », comme
WhatsApp Web, par `@whiskeysockets/baileys`). Module `api/src/modules/whatsapp`, migration `011_whatsapp.sql`
(`whatsapp_messages`, `whatsapp_optout`, `whatsapp_entrants`). Administrateur seulement ; toutes les actions sont
journalisées (`whatsapp_connexion`, `whatsapp_deconnexion`, `whatsapp_test`, `whatsapp_reessai`, `whatsapp_annulation`,
`whatsapp_optout_retire`, `whatsapp_parametres_modifies`). Aucune réponse ne contient les identifiants de la session
(dossier `STORAGE_DIR/whatsapp/auth`, droits 700).

| Méthode | Route | Rôles | Rôle |
|---|---|---|---|
| GET | /whatsapp/statut | admin | `{actif, etat: deconnecte\|qr\|connexion\|connecte, numero, qr (data URL PNG si en attente de scan), depuis, disponible, erreur, enregistre, file:{en_attente, envoyes_aujourdhui, echecs}}` |
| POST | /whatsapp/connecter | admin | ouvre la connexion (code QR si l'appareil n'est pas lié) ; renvoie le statut |
| POST | /whatsapp/deconnecter | admin | ferme la session, déconnecte l'appareil côté WhatsApp et efface les identifiants ; statut |
| POST | /whatsapp/test `{telephone}` | admin | met un message de test en file (mêmes règles) ; 201 message ; 422 si numéro invalide, module désactivé ou numéro en liste STOP |
| GET | /whatsapp/messages?statut&q&page&limit | admin | `{items:[{id,dossier_id,numero,client_nom,evenement,evenement_label,telephone,texte,statut,motif,tentatives,planifie_at,envoye_at,created_at}], total, page, limit, compteurs:{statut:n}}` ; `q` cherche dans le téléphone, le numéro et le nom du client |
| POST | /whatsapp/messages/:id/reessayer | admin | remet en attente un message `echec`, `annule` ou `ignore` (tentatives à 0) ; 409 si déjà envoyé/en attente, numéro en STOP ou module désactivé ; 422 numéro invalide |
| POST | /whatsapp/messages/:id/annuler | admin | annule un message `en_attente` (motif « Annulé par … ») ; 409 sinon |
| GET | /whatsapp/optout | admin | `[{telephone, motif, created_at}]` |
| DELETE | /whatsapp/optout/:telephone | admin | retire un numéro de la liste STOP (204 ; 404 s'il n'y est pas) |
| GET | /whatsapp/entrants?page | admin | `{items:[{id,telephone,texte,recu_at}], total, page, limit}` : réponses reçues (texte seul, 500 caractères) |
| GET | /parametres/whatsapp | admin | section `whatsapp` : `{actif, modeles:{pret_livraison,pret_retrait,en_livraison,livre}, heures:{debut,fin}, limites:{par_heure,par_jour}, delai:{min_s,max_s}, signature}` + `defauts`, `variables`, `evenements` (libellés), `apercu` (modèles rendus avec un exemple) |
| PUT | /parametres/whatsapp | admin | fusion partielle ; 400 `champs` si heure mal formée, fin ≤ début, délai max < min, lien raccourci dans un modèle, modèle < 10 ou > 700 caractères, limites hors bornes (1..60/h, 1..500/j, délais 5..600/5..900 s) |

Cette section n'apparaît pas dans `GET /parametres` ni dans l'export de configuration : elle est servie uniquement par
`/parametres/whatsapp`.

Événements (un seul message par dossier et par événement, contrainte `UNIQUE (dossier_id, evenement)`), déclenchés
après le COMMIT des transitions du circuit (`notifications/regles.ts`) : `marquer_imprime` → `pret_livraison` ou
`pret_retrait` selon `mode_remise` ; `programmer_livraison` → `en_livraison` ; `confirmer_livraison` et `remettre_client`
→ `livre`. Variables des modèles : `{client}`, `{numero}`, `{travail}` (première ligne des spécifications), `{montant}`,
`{adresse}` (adresse de l'entreprise), `{entreprise}`, `{date}` (livraison prévue, fuseau des paramètres) ; la signature
est ajoutée sur une dernière ligne.

Règles d'envoi, toutes appliquées par le serveur : numéros normalisés (Sénégal `+221 7X XXX XX XX`, accepte espaces,
tirets, `00221` ; sinon international avec `+`), numéro invalide ou absent → `ignore` avec motif ; module désactivé →
`ignore` ; numéro en liste STOP → `ignore` ; heures d'envoi (défaut 08:00–20:00, le message attend) ; limites par heure
(défaut 20) et par jour (défaut 120) ; délai aléatoire entre deux envois (défaut 25–90 s) ; au plus 3 tentatives puis
`echec` avec le motif (nouvelle tentative 2 min × n plus tard). La file est traitée dans le processus toutes les 15 s,
un message par passage, seulement quand la connexion est ouverte. Un message entrant « STOP », « ARRET » ou « ARRÊT »
inscrit le numéro en liste STOP, annule ses messages en attente et envoie l'accusé « Vous ne recevrez plus de messages
de {entreprise}. ». Reconnexion automatique avec attente progressive (30 s puis doublée, 10 min au plus) ; un code QR
jamais scanné ne provoque aucune reconnexion ; un appareil déconnecté depuis le téléphone efface les identifiants. Si la
bibliothèque manque ou refuse de démarrer, `disponible` est faux et l'API fonctionne sans WhatsApp.

## Écarts

Précisions et ajouts par rapport au tableau ci-dessus (les champs listés dans le contrat sont tous présents ; rien n'a été retiré).

- **Listes paginées** (`/clients`, `/paiements`, `/devis`, `/factures`, `/journal`) : renvoient aussi `page` et `limit` (par défaut 50, maximum 200).
- **`/parametres` (PUT)** : fusion partielle (un champ absent garde sa valeur). Bornes : textes de `entreprise` ≤ 200 caractères (nom non vide, e-mail valide ou vide) ; `prix.arrondi_pas` entier 0..10 000 ; `prix.tva_taux` 0..100 ; `prix.surface_min_m2` 0..100 ; `livreur_jours_historique` entier 1..90 ; `fuseau` = nom IANA connu de PostgreSQL. Journalisé sous `parametres_modifies` avec `{cle:{avant,apres}}`.
- **`/clients`** : `items[]` contient aussi `adresse` et `total_paye`. `reste_du` = Σ par dossier de max(0, montant − paiements validés), dossiers supprimés exclus. Tri : dernier dossier le plus récent d'abord. `POST /clients` renvoie 409 (`details.client_id`) si un client actif a déjà le même nom et le même téléphone. `GET /clients/:id` renvoie la fiche même fusionnée (`fusionne_dans`, `fusionne_dans_nom`) ; `PATCH` d'une fiche fusionnée : 409. `POST /clients/:id/fusionner` renvoie la fiche de destination (format de `GET /clients/:id`) plus `fusion:{dossiers,devis,factures}` ; les coordonnées manquantes de la destination sont complétées par la source. Journalisé (`client_fusionne`, `client_modifie`).
- **`/paiements`** : filtres supplémentaires `mode` et `dossier_id` ; `statut` accepte une liste (`a_valider,valide`). `livreur_id` filtre sur l'encaisseur (quel que soit son rôle) et n'est pris en compte que pour l'administrateur. `q` (100 caractères au plus) cherche dans le numéro du dossier, le nom du client et la référence ; `importe=1|0` ne garde que les paiements repris de l'ancienne plateforme (ou les autres) ; `tri=ancien` trie du plus ancien au plus récent (défaut : plus récent d'abord). Chaque élément porte aussi `encaisse_par`, `valide_par`, `dossier_supprime`, `importe` (paiement importé, `legacy_id` renseigné), `dossier_statut` et `machine`. `valide_par_nom`/`valide_at` désignent aussi la personne et la date d'un **refus**. `somme` = Σ des montants filtrés, tous statuts confondus.
- **Validation (unitaire, groupée, historique)** : mêmes contrôles partout, dans une transaction, après verrouillage des paiements puis des dossiers (par id croissant) ; le total déjà validé de chaque dossier est **relu après le verrou** (défaut A8). Un paiement n'est validé que s'il est « à valider », que son dossier n'est pas à la corbeille et que le total validé ne dépasse pas le montant du dossier (pas de plafond si le montant est vide). Plusieurs paiements d'un même dossier sont examinés du plus ancien au plus récent, chacun s'ajoutant au déjà payé. Chaque validation ajoute l'événement `paiement/valide` à l'historique du dossier (`data.origine` = `groupe` ou `historique` le cas échéant).
- **`POST /paiements/valider-groupe`** : `ids` = tableau de 1 à 500 entiers (doublons ignorés), sinon 400. Les paiements valides sont validés, les autres sont listés dans `refuses` avec `code` : `introuvable`, `deja_valide`, `refuse`, `dossier_supprime`, `depassement` (avec `details:{deja_paye,montant_dossier}`). Journal : une ligne `paiement_valide` par paiement (`data.groupe=true`) et une ligne `paiements_valides_groupe` (`demandes`, `valides`, `somme`, `refuses`). Chaque encaisseur (hors l'administrateur lui-même) reçoit une seule notification `paiement_valide` récapitulative.
- **Historique importé** (`GET /paiements/historique`, `POST /paiements/valider-historique`) : concerne les paiements « à valider » importés (`legacy_id` non nul) de dossiers **livrés ou terminés**, non supprimés, encaissés **avant** `avant`. `avant` = `AAAA-MM-JJ` (début de ce jour dans le fuseau des paramètres) ou date-heure ISO 8601 avec fuseau ; 400 si absente, invalide ou dans le futur. Le POST exige `mot_de_passe` (celui de l'administrateur connecté, vérifié avec bcrypt) : 400 si absent ou faux (`champs.mot_de_passe`, journal `validation_historique_refusee`), 429 après 5 échecs en une heure. Les paiements qui dépasseraient le montant de leur dossier restent « à valider » et sont comptés dans `ignores` (`ignores.depassement`, 20 `exemples` au plus). Journal `paiements_historique_valides` (`avant`, `borne`, `valides`, `somme`, `ignores`, `somme_ignoree`, `ids`). Pas de notification aux encaisseurs (données importées).
- **`POST /dossiers/:id/paiements`** : 201 avec le paiement (même format que la liste). Le livreur ne peut encaisser que sur un dossier qu'il voit (404 sinon). Valider ou refuser un paiement déjà traité : 409. À la validation, si le total validé dépassait le montant du dossier : 409 avec `details:{deja_paye, montant_dossier}`. Valider et refuser sont journalisés et notifient l'encaisseur (`paiement_valide`, `paiement_refuse`).
- **`GET /caisse`** : objet `{ par_encaisseur: [{user_id,nom,role,a_valider:{n,somme},valide_aujourdhui:{n,somme},refuse_aujourdhui:{n,somme}}], par_mode: [{mode,libelle,a_valider,valide_aujourdhui,refuse_aujourdhui}], totaux:{a_valider,valide_aujourdhui,refuse_aujourdhui} }`. « Aujourd'hui » = jour civil dans le fuseau des paramètres ; `refuse_aujourdhui` compte les refus prononcés aujourd'hui (`valide_at` du refus).
- **`/devis`** : chaque devis porte `statut_label`, `date_validite` (AAAA-MM-JJ), `expire`, `created_by_nom`, `dossier_numero`, et dans la fiche `transitions[]`, `peut_modifier`, `peut_supprimer`, `peut_convertir`. Un préparateur ne voit que ses devis (404 sinon). Circuit : brouillon → envoye → accepte | refuse ; en plus, accepte → refuse (le client se rétracte) et refuse → envoye (nouvelle proposition). `PATCH` ne recalcule le prix que si `machine` ou `specs` sont fournis. `detail_prix` contient aussi `tva_applicable`, `tva_taux`, `prix_saisis_ht` (règle appliquée au chiffrage).
- **`POST /devis/:id/convertir`** : 201 `{dossier_id, numero}`. Corps facultatif `{urgent?, date_promise?, consignes?, adresse_livraison?, mode_paiement_prevu?}` repris sur le dossier. Le `detail_prix` du dossier est celui du devis (prix convenus). Deuxième conversion : 409 avec `details.dossier_id`.
- **`/factures`** : `somme_ttc` ne compte que les factures émises (pas les annulées) parmi les résultats filtrés ; filtres supplémentaires `client_id`, `dossier_id`, `statut` en liste. `from`/`to` portent sur `date_emission`. `GET /factures/:id` ajoute `dossier_numero`, `deja_paye`, `en_attente_validation`, `reste`, `situation_paiement`, `created_by_nom`, `annulee_par_nom`. `GET /factures/:id` ajoute aussi `origine`, `client_email`, `remise`, `notes`, `conditions_paiement`, `date_echeance`, `vosfactures`, `vosfactures_actif` (voir « Facturation »). Lignes : `{designation, detail, quantite, unite, prix_unitaire, total}` ; quand la TVA s'applique elles sont exprimées hors taxes et leur somme vaut `total_ht` (une ligne « Remise », « Arrondi » ou « Ajustement au prix convenu » rend l'écart explicite). Un dossier sans montant ou à 0 : 409. Émission et annulation sont journalisées.
- **PDF** (`/devis/:id/pdf`, `/factures/:id/pdf`, `/dossiers/:id/bon-de-travail.pdf`) : affichés dans le navigateur ; `?telecharger=1` force le téléchargement. Le QR code du bon de travail pointe vers `${APP_URL}/dossiers/:id` (chemin relatif imprimé en clair si `APP_URL` n'est pas défini).
- **`/stats/apercu`** : `periode` vaut `mois` par défaut ; réponse enrichie de `du`, `au` (jours civils), `fuseau`, `encaisse.nb`, `reste_a_encaisser.nb_dossiers`. `production.par_statut` = `{statut: n}` (tous les statuts, photographie actuelle) et `production.par_machine` = `{roland:{statut:n}, xerox:{statut:n}}`. Définitions détaillées en tête de `api/src/modules/stats/routes.ts` (dossiers supprimés et leurs paiements exclus partout).
- **`/stats/evolution`** : `periode` = premier jour de la période (AAAA-MM-JJ) ; par défaut 30 jours (`jour`), 12 semaines (`semaine`) ou 12 mois (`mois`) jusqu'à aujourd'hui ; 400 au-delà de 400/260/120 points.
- **`/stats/production`** : `{du, au, delais:{creation_validation, validation_fin_impression, fin_impression_livraison}, par_machine:[{machine,crees,montant,imprimes,livres,delais}], par_utilisateur:[{user_id,nom,role,nb_actions,actions:{action:n}}]}` ; chaque délai vaut `{heures_moyennes, nb}` et porte sur les dossiers dont l'étape se termine dans la période. Par défaut : du 1er du mois à aujourd'hui (idem `/stats/top-clients`, `limit` 10 par défaut, 100 maximum).
- **`/journal`** : filtres `action` et `cible` acceptent une liste ; chaque élément porte aussi `user_id`.
- **`/corbeille`** : ajoute `machine`, `montant`, `deleted_by`, `motif` (dernier motif de suppression) et `nb_paiements` ; 500 éléments au plus.
- **Exports CSV** : sans `from`/`to`, tout l'historique. Dossiers : par date de création (supprimés exclus) ; paiements : par date d'encaissement ; factures : par date d'émission. Booléens « Oui »/« Non », taux de TVA avec virgule décimale ; une cellule commençant par `=`, `@`, `+` ou `-` (hors numéro de téléphone) est préfixée d'une apostrophe pour neutraliser les formules.
- **`/sante`** : `base:{ok, latence_ms}` (ou `{ok:false, erreur}`), `stockage:{chemin, libre_octets, total_octets}`, `derniere_sauvegarde` ajoute `fichier`, `migrations:{a_jour, en_attente:[...]}`.

## Modèles de dossier

| Méthode | Route | Rôles | Réponse |
|---|---|---|---|
| GET | /modeles | admin, preparateur | mes modèles + ceux partagés : `[{id, nom, machine, specs, description, consignes, mode_remise, partage, cree_par_nom, mien, usages, created_at, updated_at}]`, les plus utilisés d'abord |
| POST | /modeles `{nom, machine, specs, description?, consignes?, mode_remise?, partage}` | admin, preparateur | 201 ; 400 si les spécifications sont incomplètes ou vides |
| PATCH | /modeles/:id | auteur ou admin | modèle |
| DELETE | /modeles/:id | auteur ou admin | 204 (suppression logique) |
| POST | /modeles/:id/utiliser | auteur, ou tous si partagé | 204 : compte une utilisation |
