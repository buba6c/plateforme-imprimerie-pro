// Fiche dossier, commune à tous les rôles (l'API ne renvoie que ce que le rôle peut voir).

import { ParcoursDossier } from '../../features/dossiers-ui/ParcoursDossier';
import { ReimpressionDialog } from '../../features/dossiers-ui/ReimpressionDialog';
import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, Copy, FileDown, Files, History, ListChecks, Pencil, Route, ShieldAlert, Trash2, UserCog, UserRound, Zap, ZapOff } from 'lucide-react';
import {
  formatDate,
  formatDateHeure,
  MODE_PAIEMENT_LABELS,
  type LigneRoland,
  type LigneXerox,
} from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { api, ApiError, messageErreur } from '../../lib/api';
import type { DossierDetail } from '../../lib/types';
import { DossierActions } from '../../features/dossiers/DossierActions';
import { useDossier, useDossierMutation } from '../../features/dossiers/hooks';
import { CarteMontant } from '../../features/dossiers-ui/CarteMontant';
import { AffecterDialog, ForcerStatutDialog, MenuActions, ReporterDialog, SupprimerDialog, type Annuaire, type ElementMenu } from '../../features/dossiers-ui/Dialogues';
import { Historique } from '../../features/dossiers-ui/Historique';
import { SpecsLecture } from '../../features/dossiers-ui/SpecsLecture';
import { ListeFichiers } from '../../features/fichiers/ListeFichiers';
import { useLibelles, useParamsPrix, useTarifs } from '../../features/specs/useTarifs';
import { Alert, Button, Card, Count, EmptyState, LoadingRows, MachineChip, StatusBadge, UrgentTag, useToast } from '../../ui';
import '../../features/dossiers-ui/dossiers-ui.css';

// Chargé seulement pour ceux qui déposent des fichiers (tus-js-client).
const Televersement = lazy(() => import('../../features/fichiers/Televersement').then((m) => ({ default: m.Televersement })));

type Dossier = DossierDetail & { client_email?: string | null; devis_id?: number | null };
type Dialogue = 'forcer' | 'affecter' | 'reporter' | 'supprimer' | 'reimprimer' | null;

export default function FicheDossier() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const [sp] = useSearchParams();
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const bureau = user.role === 'admin' || user.role === 'preparateur';
  const imprimeur = user.role === 'imprimeur_roland' || user.role === 'imprimeur_xerox';

  const q = useDossier(Number.isFinite(id) ? id : undefined);
  const tarifs = useTarifs(bureau);
  const { params } = useParamsPrix(user.role !== 'livreur' && !imprimeur);
  const libelle = useLibelles(tarifs.data);
  const annuaire = useQuery({
    queryKey: ['users', 'annuaire'],
    queryFn: () => api.get<Annuaire[]>('/users/annuaire'),
    enabled: user.role === 'admin',
    staleTime: 5 * 60_000,
    retry: false,
  });
  const bon = useQuery({
    queryKey: ['dossier', id, 'bon-de-travail'],
    queryFn: async () => {
      const r = await fetch(`/api/dossiers/${id}/bon-de-travail.pdf`, { method: 'HEAD', credentials: 'same-origin' });
      return r.ok;
    },
    enabled: Number.isFinite(id) && (bureau || imprimeur),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const urgence = useDossierMutation((urgent: boolean) => api.post<DossierDetail>(`/dossiers/${id}/urgence`, { urgent }));
  const [dialogue, setDialogue] = useState<Dialogue>(null);

  const d = q.data as Dossier | undefined;
  const nomUtilisateur = useMemo(() => {
    const m = new Map((annuaire.data ?? []).map((u) => [u.id, u.nom]));
    return (uid: number) => m.get(uid) ?? null;
  }, [annuaire.data]);

  const retour = user.role === 'livreur' ? { to: '/livraisons', label: 'À livrer' } : imprimeur ? { to: '/dossiers', label: 'Historique' } : { to: '/dossiers', label: 'Dossiers' };

  if (q.isLoading) {
    return (
      <>
        <nav className="ev-crumbs" aria-label="Fil d'Ariane">
          <Link to={retour.to}>{retour.label}</Link>
        </nav>
        <LoadingRows rows={6} />
      </>
    );
  }
  if (q.isError || !d) {
    const introuvable = q.error instanceof ApiError && q.error.status === 404;
    return (
      <>
        <nav className="ev-crumbs" aria-label="Fil d'Ariane">
          <Link to={retour.to}>{retour.label}</Link>
        </nav>
        <Card>
          <EmptyState
            title={introuvable ? 'Dossier introuvable' : 'Le dossier ne s’est pas chargé'}
            action={
              <Button onClick={() => (introuvable ? navigate(retour.to) : void q.refetch())}>{introuvable ? `Revenir à ${retour.label.toLowerCase()}` : 'Réessayer'}</Button>
            }
          >
            {messageErreur(q.error)}
          </EmptyState>
        </Card>
      </>
    );
  }

  const proprietaire = user.role === 'preparateur' && d.preparateur_id === user.id;
  const peutUrgence = (user.role === 'admin' || proprietaire) && !['livre', 'termine'].includes(d.statut);
  const peutReporter = (user.role === 'admin' || user.role === 'livreur') && d.statut === 'en_livraison';
  const voirFichiers = user.role !== 'livreur';
  const voirMontants = d.montant !== undefined;
  const revision = d.statut === 'a_revoir' && d.commentaire_revision ? d.historique.find((e) => e.action === 'demander_revision') : undefined;

  const basculerUrgence = () =>
    urgence.mutate(!d.urgent, {
      onSuccess: (r) => toast.success(r.urgent ? 'Dossier marqué urgent' : 'Urgence retirée', d.numero),
      onError: (e) => toast.error('Modification impossible', messageErreur(e)),
    });

  const menu: ElementMenu[] = [];
  if (peutUrgence) menu.push({ id: 'urgence', label: d.urgent ? 'Retirer l’urgence' : 'Marquer urgent', icon: d.urgent ? <ZapOff /> : <Zap />, onSelect: basculerUrgence });
  if (user.role === 'admin') {
    menu.push({ id: 'affecter', label: 'Affecter…', icon: <UserCog />, onSelect: () => setDialogue('affecter') });
    menu.push({ id: 'forcer', label: 'Forcer le statut…', icon: <ShieldAlert />, onSelect: () => setDialogue('forcer') });
  }
  if (bureau) menu.push({ id: 'reimprimer', label: user.role === 'admin' ? 'Réimprimer ou dupliquer…' : 'Nouvelle commande identique…', icon: <Copy />, onSelect: () => setDialogue('reimprimer') });
  if (peutReporter) menu.push({ id: 'reporter', label: 'Reporter la livraison…', icon: <CalendarClock />, onSelect: () => setDialogue('reporter') });
  if (bon.data) menu.push({ id: 'bon', label: 'Bon de travail (PDF)', icon: <FileDown />, onSelect: () => {}, href: `/api/dossiers/${d.id}/bon-de-travail.pdf` });
  if (d.peut_supprimer) menu.push({ id: 'supprimer', label: 'Supprimer le dossier…', icon: <Trash2 />, onSelect: () => setDialogue('supprimer'), tone: 'danger', separe: menu.length > 0 });

  const libelleGroupe = (g: number) => {
    if (g === -1) return 'Forfaits du dossier';
    const l = (d.specs?.lignes ?? [])[g] as LigneRoland | LigneXerox | undefined;
    return `Ligne ${g + 1}${l ? ` · ${libelle(d.machine, l.support)}` : ''}`;
  };

  const boutonModifier = d.peut_modifier && bureau && (
    <Button icon={<Pencil />} onClick={() => navigate(`/dossiers/${d.id}/modifier`)}>
      Modifier
    </Button>
  );

  return (
    <>
      <header className="fd-head" data-machine={d.machine}>
        <Button className="fd-retour" icon={<ArrowLeft />} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(retour.to))}>
          Retour
        </Button>
        <nav className="ev-crumbs" aria-label="Fil d'Ariane">
          <Link to={retour.to}>{retour.label}</Link>
          <span aria-hidden="true">/</span>
          <span className="ev-ref" style={{ fontSize: 13 }}>{d.numero}</span>
        </nav>
        <div className="fd-head__top">
          <div className="fd-head__titre">
            <h1 className="ev-h-display">{d.client_nom}</h1>
            <div className="fd-head__badges">
              <span className="fd-head__numero">{d.numero}</span>
              <StatusBadge statut={d.statut} />
              <MachineChip machine={d.machine} />
              {d.urgent && <UrgentTag />}
              {d.importe && <span className="ev-badge">Repris de l’ancienne plateforme</span>}
              {d.mode_remise === 'retrait' && <span className="ev-badge fd-retrait">Le client vient le chercher</span>}
              {d.liens?.origine && (
                <Link className="ev-badge fd-lien" to={`/dossiers/${d.liens.origine.id}`}>
                  {d.origine_type === 'reimpression' ? 'Réimpression de' : 'Copie de'} {d.liens.origine.numero}
                </Link>
              )}
              {d.liens?.copies.map((c) => (
                <Link key={c.id} className="ev-badge fd-lien" to={`/dossiers/${c.id}`}>
                  {c.origine_type === 'reimpression' ? 'Réimprimé dans' : 'Recommandé dans'} {c.numero}
                </Link>
              ))}
            </div>
          </div>
          <div className="fd-head__actions fd-head__actions--principal">
            {boutonModifier}
            {bon.data && (
              <a className="ev-btn" href={`/api/dossiers/${d.id}/bon-de-travail.pdf`} target="_blank" rel="noopener noreferrer">
                <FileDown aria-hidden="true" />
                Bon de travail
              </a>
            )}
            <MenuActions items={menu.filter((m) => m.id !== 'bon')} />
            <DossierActions dossier={d} />
          </div>
          <ParcoursDossier d={d} />
        </div>
      </header>

      {revision || (d.statut === 'a_revoir' && d.commentaire_revision) ? (
        <Alert tone="warning">
          <strong>
            Révision demandée
            {revision?.user_nom ? ` par ${revision.user_nom}` : ''}
            {revision ? ` le ${formatDateHeure(revision.created_at)}` : ''}
          </strong>
          <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{d.commentaire_revision}</div>
          {d.peut_modifier && <div style={{ marginTop: 6 }}>Corrigez le dossier ou ses fichiers, puis validez-le à nouveau.</div>}
        </Alert>
      ) : null}

      {sp.get('nouveau') === '1' && d.statut === 'en_cours' && d.nb_fichiers === 0 && d.peut_deposer_fichiers && (
        <Alert tone="success">
          <strong>Dossier {d.numero} créé.</strong> Ajoutez maintenant les fichiers d’impression ci-dessous, puis validez le dossier pour l’envoyer à l’atelier.
        </Alert>
      )}

      <div className="fd-layout">
        <div className="fd-col">
          {voirFichiers && (
            <Card
              className="fd-o-fichiers"
              title={
                <span className="fd-titre">
                  <span className="fd-titre__icone"><Files aria-hidden="true" /></span>
                  Fichiers d’impression <Count n={d.fichiers.length} />
                </span>
              }
              actions={d.fichiers.some((f) => f.a_reimprimer) ? <span className="fd-card-head-meta">{d.fichiers.filter((f) => f.a_reimprimer).length} à réimprimer</span> : undefined}
            >
              <div className="stack">
                {d.fichiers.length > 0 ? (
                  <ListeFichiers
                    dossierId={d.id}
                    fichiers={d.fichiers}
                    peutMarquer={user.role === 'admin' || imprimeur}
                    peutSupprimer={d.peut_deposer_fichiers}
                  />
                ) : !d.peut_deposer_fichiers ? (
                  <p className="ev-muted" style={{ margin: 0 }}>Aucun fichier d’impression.</p>
                ) : null}
                {d.peut_deposer_fichiers && (
                  <Suspense fallback={<div className="ev-dropzone fi-dropzone" aria-busy="true" />}>
                    <Televersement dossierId={d.id} />
                  </Suspense>
                )}
                {d.peut_deposer_fichiers && d.fichiers.length === 0 && d.actions.includes('valider') && (
                  <p className="ev-help" style={{ margin: 0 }}>Le dossier ne peut pas être validé sans au moins un fichier.</p>
                )}
              </div>
            </Card>
          )}

          <Card className="fd-o-specs" title={<span className="fd-titre"><span className="fd-titre__icone"><ListChecks aria-hidden="true" /></span>Spécifications</span>} actions={<MachineChip machine={d.machine} />}>
            <div className="stack">
              {d.description && <p style={{ margin: 0, fontWeight: 500 }}>{d.description}</p>}
              <SpecsLecture machine={d.machine} specs={d.specs} libelle={libelle} voirRemise={voirMontants} importe={d.importe} />
              {d.consignes && (
                <div className="stack-sm">
                  <h3 className="section-title">Consignes pour l’atelier</h3>
                  <p className="fd-note">{d.consignes}</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="fd-o-histo" title={<span className="fd-titre"><span className="fd-titre__icone"><History aria-hidden="true" /></span>Historique</span>}>
            <Historique dossier={d} libelle={libelle} nomUtilisateur={nomUtilisateur} />
          </Card>
        </div>

        <div className="fd-col">
          <Card
            className="fd-o-client"
            title={<span className="fd-titre"><span className="fd-titre__icone"><UserRound aria-hidden="true" /></span>Client</span>}
            actions={bureau && d.client_id ? <Link className="ev-link" style={{ fontSize: 13 }} to={`/clients/${d.client_id}`}>Voir la fiche client</Link> : undefined}
          >
            <dl className="fd-kv">
              <dt>Nom</dt>
              <dd style={{ fontWeight: 500 }}>{d.client_nom}</dd>
              {d.client_telephone !== undefined && (
                <>
                  <dt>Téléphone</dt>
                  <dd>{d.client_telephone ? <a className="ev-link ev-mono" href={`tel:${d.client_telephone.replace(/[^+0-9]/g, '')}`}>{d.client_telephone}</a> : '—'}</dd>
                </>
              )}
              {d.client_email !== undefined && (
                <>
                  <dt>E-mail</dt>
                  <dd>{d.client_email ? <a className="ev-link" href={`mailto:${d.client_email}`}>{d.client_email}</a> : '—'}</dd>
                </>
              )}
              {d.adresse_livraison !== undefined && (
                <>
                  <dt>Livraison</dt>
                  <dd>{d.adresse_livraison || '—'}</dd>
                </>
              )}
              {d.notes_livraison && (
                <>
                  <dt>Notes</dt>
                  <dd>{d.notes_livraison}</dd>
                </>
              )}
            </dl>
          </Card>

          {voirMontants && (
            <div className="fd-o-montant">
              <CarteMontant d={d} peutEncaisser={bureau} peutFacturer={bureau} params={params} libelleGroupe={libelleGroupe} />
            </div>
          )}

          <Card className="fd-o-suivi" title={<span className="fd-titre"><span className="fd-titre__icone"><Route aria-hidden="true" /></span>Suivi</span>}>
            <dl className="fd-kv">
              <dt>Préparateur</dt>
              <dd>{d.preparateur_nom ?? '—'}</dd>
              <dt>Imprimeur</dt>
              <dd>{d.imprimeur_nom ?? '—'}</dd>
              <dt>Livreur</dt>
              <dd>{d.livreur_nom ?? '—'}</dd>
              <dt>Pour le</dt>
              <dd className="ev-mono">{formatDate(d.date_promise)}</dd>
              {d.mode_paiement_prevu !== undefined && (
                <>
                  <dt>Paiement prévu</dt>
                  <dd>{d.mode_paiement_prevu ? MODE_PAIEMENT_LABELS[d.mode_paiement_prevu] : '—'}</dd>
                </>
              )}
            </dl>
            <dl className="fd-kv" style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--line)' }}>
              <LigneDate label="Créé" v={d.created_at} />
              <LigneDate label="Validé" v={d.date_validation} />
              <LigneDate label="Impression" v={d.date_debut_impression} />
              <LigneDate label="Imprimé" v={d.date_fin_impression} />
              <LigneDate label="Livraison prévue" v={d.livraison_prevue_at} />
              <LigneDate label="Livré" v={d.livre_at} />
              <LigneDate label="Terminé" v={d.termine_at} />
            </dl>
            {user.role === 'admin' && d.devis_id ? (
              <p style={{ margin: 'var(--space-4) 0 0', fontSize: 13 }}>
                <Link className="ev-link" to={`/devis/${d.devis_id}`}>Voir le devis d’origine</Link>
              </p>
            ) : null}
          </Card>
        </div>
      </div>

      {(d.actions.length > 0 || menu.length > 0 || boutonModifier) && (
        <div className="du-barre fd-mobile-actions" role="region" aria-label="Actions du dossier">
          <div className="du-barre__actions fd-mobile-actions__ligne">
            <MenuActions items={menu} vers="haut" />
            {d.peut_modifier && bureau && (
              <Button icon={<Pencil />} onClick={() => navigate(`/dossiers/${d.id}/modifier`)} aria-label="Modifier le dossier">
                Modifier
              </Button>
            )}
            <div className="grow fd-mobile-actions__flux">
              <DossierActions dossier={d} />
            </div>
          </div>
        </div>
      )}

      {dialogue === 'reimprimer' && <ReimpressionDialog d={d} admin={user.role === 'admin'} onClose={() => setDialogue(null)} />}
      {dialogue === 'forcer' && <ForcerStatutDialog d={d} onClose={() => setDialogue(null)} />}
      {dialogue === 'affecter' && <AffecterDialog d={d} annuaire={annuaire.data ?? []} onClose={() => setDialogue(null)} />}
      {dialogue === 'reporter' && <ReporterDialog d={d} onClose={() => setDialogue(null)} />}
      {dialogue === 'supprimer' && (
        <SupprimerDialog
          d={d}
          onClose={() => setDialogue(null)}
          onSupprime={() => {
            toast.success('Dossier supprimé', `${d.numero} est dans la corbeille.`);
            navigate('/dossiers');
          }}
        />
      )}
    </>
  );
}

function LigneDate({ label, v }: { label: string; v: string | null | undefined }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className="ev-mono" style={{ fontSize: 13, color: v ? undefined : 'var(--text-muted)' }}>
        {v ? formatDateHeure(v) : '—'}
      </dd>
    </>
  );
}

