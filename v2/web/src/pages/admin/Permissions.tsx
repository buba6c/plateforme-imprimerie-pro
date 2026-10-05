import { Fragment, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import { ROLE_LABELS, ROLES, STATUT_LABELS, STATUTS_MODIFIABLES, type Role } from '@evocom/shared';
import { Alert, Card, PageHeader, StatusBadge } from '../../ui';
import { useParametres, useUsers } from '../../features/admin/hooks';
import { tableauCircuit, tableauEcrans, type AccesEcran, type Portee } from '../../features/permissions/droits';
import '../../features/permissions/permissions.css';

const PORTEE: Record<Portee, { libelle: string; classe: string }> = {
  oui: { libelle: 'Oui', classe: 'pm-oui' },
  proprietaire: { libelle: 'Ses dossiers', classe: 'pm-partiel' },
  machine: { libelle: 'Sa machine', classe: 'pm-partiel' },
  non: { libelle: 'Non', classe: 'pm-non' },
};

function Cellule({ portee }: { portee: Portee }) {
  const p = PORTEE[portee];
  return (
    <span className={p.classe}>
      {portee === 'non' ? <Minus aria-hidden="true" /> : <Check aria-hidden="true" />}
      {portee === 'non' ? <span className="sr-only">{p.libelle}</span> : p.libelle}
    </span>
  );
}

function CelluleEcran({ acces, libelleLigne }: { acces: AccesEcran; libelleLigne: string }) {
  if (acces.menu) {
    return (
      <span className="pm-oui">
        <Check aria-hidden="true" />
        {acces.libelle === libelleLigne ? 'Menu' : `Menu « ${acces.libelle} »`}
      </span>
    );
  }
  if (acces.parAdresse) {
    return (
      <span className="pm-partiel" title="Absent du menu, mais l’écran s’ouvre par son adresse ou un lien">
        <Check aria-hidden="true" />
        Par lien
      </span>
    );
  }
  return (
    <span className="pm-non">
      <Minus aria-hidden="true" />
      <span className="sr-only">Non</span>
    </span>
  );
}

/** En-têtes de colonnes : un rôle par colonne, avec le nombre de comptes actifs. */
function EntetesRoles({ comptes }: { comptes: Partial<Record<Role, number>> | null }) {
  return (
    <>
      {ROLES.map((r) => (
        <th key={r} scope="col" className="pm-role">
          {ROLE_LABELS[r]}
          {comptes && (
            <span className="pm-comptes">
              {comptes[r] ?? 0} {(comptes[r] ?? 0) > 1 ? 'comptes' : 'compte'}
            </span>
          )}
        </th>
      ))}
    </>
  );
}

type Ligne = { titre: string; detail?: string; roles: Record<Role, ReactNode> };

/**
 * Visibilité et opérations hors circuit. Chaque phrase a été vérifiée dans le code de l'API
 * (dossiers/access.ts, modules paiements, devis, factures, clients, tarifs, stats, admin, fichiers) :
 * à mettre à jour avec lui.
 */
function lignesDonnees(joursLivreur: number | null): { groupe: string; lignes: Ligne[] }[] {
  const jours = joursLivreur === null ? 'quelques jours (Paramètres)' : `${joursLivreur} jour${joursLivreur > 1 ? 's' : ''}`;
  const imprimeur = (machine: string) => `Ceux de la ${machine}, à partir de leur première validation`;
  const tous = (texte: string): Record<Role, ReactNode> => Object.fromEntries(ROLES.map((r) => [r, texte])) as Record<Role, ReactNode>;
  const non = '—';
  const modifiables = STATUTS_MODIFIABLES.map((st) => `« ${STATUT_LABELS[st]} »`).join(' ou ');
  return [
    {
      groupe: 'Dossiers',
      lignes: [
        {
          titre: 'Dossiers visibles',
          detail: 'Liste, fiche, historique et commentaires',
          roles: {
            admin: 'Tous, et la corbeille des dossiers',
            preparateur: 'Tous les dossiers en cours (pas seulement les siens)',
            imprimeur_roland: imprimeur('Roland'),
            imprimeur_xerox: imprimeur('Xerox'),
            livreur: `Prêts à livrer et en livraison, puis livrés ou terminés pendant ${jours}`,
          },
        },
        {
          titre: 'Montants',
          detail: 'Montant, déjà payé, reste à payer',
          roles: {
            admin: 'Oui, avec le détail du prix',
            preparateur: 'Oui, avec le détail du prix',
            imprimeur_roland: non,
            imprimeur_xerox: non,
            livreur: 'Oui, sans le détail du prix',
          },
        },
        {
          titre: 'Coordonnées du client',
          detail: 'Téléphone, e-mail, adresse de livraison',
          roles: { admin: 'Oui', preparateur: 'Oui', imprimeur_roland: non, imprimeur_xerox: non, livreur: 'Oui' },
        },
        {
          titre: 'Modifications dans l’historique',
          detail: 'Détail avant → après de chaque modification',
          roles: { ...tous(non), admin: 'Oui' },
        },
        {
          titre: 'Créer, modifier un dossier',
          roles: {
            admin: 'Oui, tant qu’il n’est pas à la corbeille',
            preparateur: `Créer : oui. Modifier : ses dossiers ${modifiables}`,
            imprimeur_roland: non,
            imprimeur_xerox: non,
            livreur: non,
          },
        },
        {
          titre: 'Supprimer, restaurer un dossier',
          roles: {
            admin: 'Oui (corbeille, restauration)',
            preparateur: `Supprimer ses dossiers « ${STATUT_LABELS.en_cours} » sans aucun paiement`,
            imprimeur_roland: non,
            imprimeur_xerox: non,
            livreur: non,
          },
        },
        {
          titre: 'Marquer urgent',
          roles: { ...tous(non), admin: 'Oui', preparateur: 'Ses dossiers' },
        },
        {
          titre: 'Affecter un imprimeur ou un livreur, forcer un statut',
          roles: { ...tous(non), admin: 'Oui' },
        },
        {
          titre: 'Reporter une livraison',
          roles: { ...tous(non), admin: 'Oui', livreur: 'Oui' },
        },
      ],
    },
    {
      groupe: 'Fichiers',
      lignes: [
        {
          titre: 'Voir et télécharger les fichiers',
          detail: 'Des dossiers visibles',
          roles: { admin: 'Oui', preparateur: 'Oui', imprimeur_roland: 'Dossiers de sa machine', imprimeur_xerox: 'Dossiers de sa machine', livreur: non },
        },
        {
          titre: 'Déposer, supprimer des fichiers',
          roles: {
            admin: 'Oui, quel que soit le statut',
            preparateur: `Ses dossiers ${modifiables}`,
            imprimeur_roland: non,
            imprimeur_xerox: non,
            livreur: non,
          },
        },
        {
          titre: 'Marquer un fichier à réimprimer',
          roles: { admin: 'Oui', preparateur: 'Ses dossiers', imprimeur_roland: 'Sa machine', imprimeur_xerox: 'Sa machine', livreur: non },
        },
        {
          titre: 'Bon de travail (PDF atelier, sans montant)',
          roles: { admin: 'Oui', preparateur: 'Oui', imprimeur_roland: 'Sa machine', imprimeur_xerox: 'Sa machine', livreur: non },
        },
        {
          titre: 'Écran Fichiers',
          roles: {
            admin: 'Oui, avec la corbeille des fichiers et le contrôle du stockage',
            preparateur: 'Liste des fichiers',
            imprimeur_roland: non,
            imprimeur_xerox: non,
            livreur: non,
          },
        },
      ],
    },
    {
      groupe: 'Argent',
      lignes: [
        {
          titre: 'Encaisser un paiement',
          roles: {
            admin: 'Oui, validé d’office',
            preparateur: 'Oui, à valider par l’administrateur',
            imprimeur_roland: non,
            imprimeur_xerox: non,
            livreur: 'Oui, à valider par l’administrateur',
          },
        },
        {
          titre: 'Liste des paiements',
          roles: {
            admin: 'Tous, avec la caisse',
            preparateur: 'Ceux qu’il a encaissés',
            imprimeur_roland: non,
            imprimeur_xerox: non,
            livreur: 'Ceux qu’il a encaissés',
          },
        },
        {
          titre: 'Valider ou refuser un paiement',
          roles: { admin: 'Oui', preparateur: non, imprimeur_roland: non, imprimeur_xerox: non, livreur: non },
        },
        {
          titre: 'Devis',
          roles: { admin: 'Tous', preparateur: 'Les siens', imprimeur_roland: non, imprimeur_xerox: non, livreur: non },
        },
        {
          titre: 'Factures',
          roles: {
            admin: 'Toutes ; émettre et annuler',
            preparateur: 'Toutes ; émettre (pas annuler)',
            imprimeur_roland: non,
            imprimeur_xerox: non,
            livreur: non,
          },
        },
        {
          titre: 'Clients',
          roles: { admin: 'Oui, et fusionner des fiches', preparateur: 'Oui', imprimeur_roland: non, imprimeur_xerox: non, livreur: non },
        },
        {
          titre: 'Tarifs',
          roles: {
            admin: 'Prix visibles et modifiables',
            preparateur: 'Prix visibles',
            imprimeur_roland: 'Libellés, sans les prix',
            imprimeur_xerox: 'Libellés, sans les prix',
            livreur: 'Libellés, sans les prix',
          },
        },
      ],
    },
    {
      groupe: 'Pilotage et administration',
      lignes: [
        {
          titre: 'Vue d’ensemble et statistiques',
          roles: { ...tous(non), admin: 'Oui' },
        },
        {
          titre: 'Administration',
          detail: 'Utilisateurs, paramètres, journal, corbeille, exports, sauvegardes',
          roles: { ...tous(non), admin: 'Oui' },
        },
      ],
    },
  ];
}

export default function Permissions() {
  const users = useUsers();
  const parametres = useParametres();
  const circuit = useMemo(() => tableauCircuit(), []);
  const ecrans = useMemo(() => tableauEcrans(), []);
  const donnees = lignesDonnees(parametres.data?.livreur_jours_historique ?? null);
  const comptes = users.data
    ? users.data.filter((u) => u.is_active).reduce<Partial<Record<Role, number>>>((acc, u) => ({ ...acc, [u.role]: (acc[u.role] ?? 0) + 1 }), {})
    : null;

  return (
    <>
      <PageHeader title="Rôles et droits" subtitle="Ce que chaque rôle voit et peut faire dans Evocom Print." />

      <Alert tone="info">
        Les droits sont fixés et appliqués par le serveur : cet écran les présente et ne permet pas de les modifier. Pour changer le rôle d’une personne, ouvrez{' '}
        <Link className="ev-link" to="/admin/utilisateurs">
          Utilisateurs
        </Link>
        .
      </Alert>

      <section className="stack-sm" aria-labelledby="pm-circuit">
        <h2 className="ev-h-title" id="pm-circuit">
          Qui peut faire quoi dans le circuit
        </h2>
        <p className="ev-muted pm-intro">
          Une ligne par action du circuit des dossiers, telle que le serveur la vérifie, avec ses conditions sous son nom. « Ses dossiers » : seulement sur les dossiers que la personne a créés.
          « Sa machine » : seulement sur les dossiers de la machine de l’imprimeur.
        </p>
        <div className="ev-table-wrap">
          <table className="ev-table pm-table">
            <thead>
              <tr>
                <th scope="col" className="pm-fixe">
                  Action
                </th>
                <th scope="col">Statut de départ</th>
                <th scope="col">Statut d’arrivée</th>
                <EntetesRoles comptes={comptes} />
              </tr>
            </thead>
            <tbody>
              {circuit.map(({ action, roles, conditions }) => (
                <tr key={action.id}>
                  <th scope="row" className="pm-fixe pm-action">
                    {action.label}
                    {conditions.map((c) => (
                      <span key={c} className="pm-cond">
                        {c}
                      </span>
                    ))}
                  </th>
                  <td>
                    <div className="pm-statuts">
                      {action.from.map((s) => (
                        <StatusBadge key={s} statut={s} />
                      ))}
                    </div>
                  </td>
                  <td>
                    <StatusBadge statut={action.to} />
                  </td>
                  {ROLES.map((r) => (
                    <td key={r} className="pm-role">
                      <Cellule portee={roles[r]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ev-muted pm-intro">
          Chaque rôle n’agit que sur les dossiers qu’il voit (tableau suivant). Le statut d’un dossier ne change que par ces actions, sauf « Forcer le statut »,
          réservé à l’administrateur avec un commentaire obligatoire.
        </p>
      </section>

      <section className="stack-sm" aria-labelledby="pm-voir">
        <h2 className="ev-h-title" id="pm-voir">
          Qui voit quoi
        </h2>
        <p className="ev-muted pm-intro">Le serveur filtre chaque liste et chaque fiche selon le rôle : ce qui n’est pas autorisé n’est jamais envoyé.</p>

        <Card title="Écrans du menu" flush>
          <div className="ev-table-wrap pm-wrap-carte">
            <table className="ev-table pm-table">
              <thead>
                <tr>
                  <th scope="col" className="pm-fixe">
                    Écran
                  </th>
                  <EntetesRoles comptes={null} />
                </tr>
              </thead>
              <tbody>
                {ecrans.map((e) => (
                  <tr key={e.chemin}>
                    <th scope="row" className="pm-fixe pm-action">
                      {e.libelle}
                    </th>
                    {ROLES.map((r) => (
                      <td key={r} className="pm-role">
                        <CelluleEcran acces={e.roles[r]} libelleLigne={e.libelle} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Données et opérations" flush>
          <div className="ev-table-wrap pm-wrap-carte">
            <table className="ev-table pm-table">
              <thead>
                <tr>
                  <th scope="col" className="pm-fixe">
                    Élément
                  </th>
                  <EntetesRoles comptes={null} />
                </tr>
              </thead>
              <tbody>
                {donnees.map((g) => (
                  <Fragment key={g.groupe}>
                    <tr className="pm-groupe">
                      <th scope="colgroup" colSpan={ROLES.length + 1}>
                        {g.groupe}
                      </th>
                    </tr>
                    {g.lignes.map((l) => (
                      <tr key={l.titre}>
                        <th scope="row" className="pm-fixe pm-action">
                          {l.titre}
                          {l.detail && <span className="pm-cond">{l.detail}</span>}
                        </th>
                        {ROLES.map((r) => (
                          <td key={r} className="pm-cell">
                            {l.roles[r] === '—' ? (
                              <span className="pm-non">
                                <Minus aria-hidden="true" />
                                <span className="sr-only">Non</span>
                              </span>
                            ) : (
                              l.roles[r]
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </>
  );
}
