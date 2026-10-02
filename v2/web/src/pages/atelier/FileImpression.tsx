// File d'impression : le poste de travail des imprimeurs Roland et Xerox.
// Trois colonnes (prêts, en impression, imprimés depuis 48 h), onglets sur téléphone,
// et une bande des dossiers renvoyés en révision. Mise à jour par le temps réel.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Inbox, Printer, RotateCw, Volume2, VolumeX } from 'lucide-react';
import { formatHeure, formatRelatif, MACHINE_LABELS, machineOfRole, type ActionId, type Machine } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { useDossiers } from '../../features/dossiers/hooks';
import { DossierActions } from '../../features/dossiers/DossierActions';
import { JobCard } from '../../features/dossiers/JobCard';
import { jouerCarillon, useSonAtelier } from '../../features/atelier/son';
import { useArrivees } from '../../features/atelier/useArrivees';
import '../../features/atelier/atelier.css';
import { messageErreur } from '../../lib/api';
import type { DossierResume } from '../../lib/types';
import { Alert, Button, Count, EmptyState, PageHeader, Ref, Segmented, Skeleton, Tabs } from '../../ui';

type Colonne = 'pret' | 'encours' | 'imprime';

const COLONNES: { id: Colonne; titre: string; court: string; vide: string; aide: string; icone: React.ReactNode }[] = [
  {
    id: 'pret',
    titre: 'Prêt à imprimer',
    court: 'À imprimer',
    vide: 'Aucun dossier en attente',
    aide: 'Les dossiers validés par les préparateurs arrivent ici, les urgents en premier puis par date promise.',
    icone: <Inbox aria-hidden="true" />,
  },
  {
    id: 'encours',
    titre: 'En impression',
    court: 'En cours',
    vide: 'Rien en cours d’impression',
    aide: 'Démarrez un dossier prêt à imprimer : il reste ici jusqu’à ce que vous le marquiez comme imprimé.',
    icone: <Printer aria-hidden="true" />,
  },
  {
    id: 'imprime',
    titre: 'Imprimé (48 h)',
    court: 'Imprimés',
    vide: 'Aucun dossier imprimé ces dernières 48 h',
    aide: 'Les dossiers marqués comme imprimés restent visibles 48 h, le temps que le livreur les prenne en charge.',
    icone: <CheckCircle2 aria-hidden="true" />,
  },
];

const H48 = 48 * 3600 * 1000;
const PRINCIPALES: ActionId[] = ['demarrer', 'marquer_imprime'];
const SECONDAIRES: ActionId[] = ['demander_revision', 'remettre_en_attente'];
/** Sur la carte, seulement les actions d'atelier (l'administrateur a aussi celles de livraison). */
const principales = (d: DossierResume): DossierResume => ({ ...d, actions: d.actions.filter((a) => PRINCIPALES.includes(a)) });
/** Actions secondaires proposées sous la carte (la carte porte déjà l'action principale). */
const secondaires = (d: DossierResume): DossierResume => ({ ...d, actions: d.actions.filter((a) => SECONDAIRES.includes(a)) });
const recent = (iso: string | null | undefined) => !!iso && Date.now() - new Date(iso).getTime() < H48;
const temps = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);

export default function FileImpression() {
  const user = useUser();
  const [params, setParams] = useSearchParams();
  const machineRole = machineOfRole(user.role);
  const machine: Machine = machineRole ?? (params.get('machine') === 'xerox' ? 'xerox' : 'roland');
  const [onglet, setOnglet] = useState<Colonne>('pret');
  const son = useSonAtelier();

  const q = useDossiers(
    machineRole
      ? { file: 'travail', limit: 200 }
      : { machine, statut: ['pret_impression', 'en_impression', 'pret_livraison', 'a_revoir'], limit: 200 },
    { refetchInterval: 30_000 },
  );
  const chargee = q.data && !q.isPlaceholderData ? q.data : undefined;

  const colonnes = useMemo(() => {
    const items = (chargee?.items ?? []).filter((d) => d.machine === machine);
    const imprimes = items
      .filter((d) => d.statut === 'pret_livraison' && recent(d.updated_at))
      .sort((a, b) => temps(b.date_fin_impression ?? b.updated_at) - temps(a.date_fin_impression ?? a.updated_at));
    return {
      pret: items.filter((d) => d.statut === 'pret_impression'),
      encours: items.filter((d) => d.statut === 'en_impression'),
      imprime: imprimes,
      revision: items
        .filter((d) => d.statut === 'a_revoir' && recent(d.updated_at))
        .sort((a, b) => temps(b.updated_at) - temps(a.updated_at)),
    } satisfies Record<Colonne | 'revision', DossierResume[]>;
  }, [chargee, machine]);

  const urgents = colonnes.pret.filter((d) => d.urgent).length;

  const onArrivee = useCallback(
    (n: number) => {
      // Le message « Nouveau dossier à imprimer » vient déjà des notifications du serveur.
      if (son.etat === 'on' && n > 0) jouerCarillon();
    },
    [son.etat],
  );
  const nouveaux = useArrivees(
    chargee ? colonnes.pret.map((d) => d.id) : undefined,
    chargee ? colonnes.encours.map((d) => d.id) : undefined,
    machine,
    onArrivee,
  );

  // Le nombre de dossiers à imprimer reste visible dans l'onglet du navigateur.
  useEffect(() => {
    const avant = document.title;
    if (chargee) document.title = `${colonnes.pret.length ? `(${colonnes.pret.length}) ` : ''}File ${MACHINE_LABELS[machine]} · Evocom Print`;
    return () => {
      document.title = avant;
    };
  }, [chargee, colonnes.pret.length, machine]);

  const changerMachine = (m: Machine) => {
    const p = new URLSearchParams(params);
    p.set('machine', m);
    setParams(p, { replace: true });
  };

  return (
    <>
      <PageHeader
        title={`File ${MACHINE_LABELS[machine]}`}
        subtitle={
          chargee ? (
            <span className="atelier-compteurs" aria-label="Compteurs de la file">
              <span>
                <strong>{colonnes.pret.length}</strong> à imprimer
                {urgents > 0 && <span className="atelier-compteurs__urgent">, dont {urgents} urgent{urgents > 1 ? 's' : ''}</span>}
              </span>
              <span>
                <strong>{colonnes.encours.length}</strong> en impression
              </span>
              <span>
                <strong>{colonnes.imprime.length}</strong> imprimé{colonnes.imprime.length > 1 ? 's' : ''} en 48 h
              </span>
            </span>
          ) : (
            'Chargement de la file…'
          )
        }
        actions={
          <div className="atelier-head-actions">
            {!machineRole && (
              <Segmented
                name="machine"
                label="Machine affichée"
                value={machine}
                onChange={changerMachine}
                options={[
                  { value: 'roland', label: 'Roland' },
                  { value: 'xerox', label: 'Xerox' },
                ]}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={son.etat === 'on' ? <Volume2 /> : <VolumeX />}
              aria-pressed={son.etat === 'on'}
              disabled={son.etat === 'indisponible'}
              onClick={() => void son.basculer()}
              title={
                son.etat === 'on'
                  ? 'Un signal sonore retentit quand un nouveau dossier arrive. Cliquer pour couper.'
                  : son.etat === 'bloque'
                    ? 'Le navigateur attend un geste pour jouer le son : cliquez pour le réactiver.'
                    : 'Jouer un signal sonore quand un nouveau dossier arrive.'
              }
            >
              {son.etat === 'on' ? 'Son activé' : son.etat === 'bloque' ? 'Réactiver le son' : son.etat === 'indisponible' ? 'Son indisponible' : 'Activer le son'}
            </Button>
          </div>
        }
      />

      {q.isError && !q.data ? (
        <Alert tone="error">
          <div className="stack-sm">
            <span>La file n’a pas pu être chargée : {messageErreur(q.error)}</span>
            <div>
              <Button size="sm" icon={<RotateCw />} onClick={() => void q.refetch()} busy={q.isFetching}>
                Réessayer
              </Button>
            </div>
          </div>
        </Alert>
      ) : (
        <>
          {q.isError && (
            <Alert tone="warning">La file n’a pas pu être actualisée ({messageErreur(q.error)}). Les informations affichées datent de {formatHeure(new Date(q.dataUpdatedAt))}.</Alert>
          )}
          <div className="atelier-onglets">
            <Tabs<Colonne>
              label="Colonnes de la file"
              value={onglet}
              onChange={setOnglet}
              tabs={COLONNES.map((c) => ({ value: c.id, label: c.court, count: chargee ? colonnes[c.id].length : undefined }))}
            />
          </div>
          <div className="ev-board atelier-board">
            {COLONNES.map((c) => (
              <section key={c.id} className="ev-column" data-colonne={c.id} data-actif={onglet === c.id} aria-labelledby={`col-${c.id}`}>
                <div className="ev-column__head">
                  <h2 className="atelier-col-titre" id={`col-${c.id}`}>
                    {c.titre}
                  </h2>
                  {chargee && <Count n={colonnes[c.id].length} />}
                </div>
                {!chargee ? (
                  <>
                    <Skeleton h={148} />
                    <Skeleton h={148} />
                  </>
                ) : colonnes[c.id].length === 0 ? (
                  <div className="atelier-vide">
                    <EmptyState title={c.vide} icon={c.icone}>
                      {c.aide}
                    </EmptyState>
                  </div>
                ) : (
                  colonnes[c.id].map((d) => (
                    <div key={d.id} className="atelier-item" data-nouveau={c.id === 'pret' && nouveaux.has(d.id)} data-plus={secondaires(d).actions.length > 0}>
                      {c.id === 'pret' && nouveaux.has(d.id) && <span className="ev-badge atelier-nouveau">Nouveau</span>}
                      <JobCard d={principales(d)} contexte="atelier" />
                      {secondaires(d).actions.length > 0 && (
                        <div className="atelier-item__plus">
                          <DossierActions dossier={secondaires(d)} size="sm" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </section>
            ))}
          </div>

          {chargee && colonnes.revision.length > 0 && (
            <section className="ev-card atelier-revisions" aria-labelledby="titre-revisions">
              <header className="ev-card__head">
                <h2 className="ev-card__title row" id="titre-revisions">
                  Renvoyés en révision <Count n={colonnes.revision.length} />
                </h2>
                <span className="ev-muted" style={{ fontSize: 13 }}>
                  Chez le préparateur. Ils reviendront dans « Prêt à imprimer » une fois corrigés.
                </span>
              </header>
              <ul className="atelier-revisions__liste">
                {colonnes.revision.map((d) => (
                  <li key={d.id}>
                    <Link className="atelier-rev" to={`/dossiers/${d.id}`}>
                      <Ref>{d.numero}</Ref>
                      <span className="atelier-rev__client">{d.client_nom}</span>
                      <span className="atelier-rev__quand">{formatRelatif(d.updated_at)}</span>
                      {d.commentaire_revision && <span className="atelier-rev__motif">« {d.commentaire_revision} »</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {chargee && (
            <p className="atelier-maj">
              Mise à jour automatique. Dernière actualisation à {formatHeure(new Date(q.dataUpdatedAt))}.
            </p>
          )}
        </>
      )}
    </>
  );
}
