// Aperçu d'un dossier PAR-DESSUS la page courante : panneau latéral large sur ordinateur,
// plein écran sur téléphone. Montre l'essentiel (montants, paiements, prochaines actions,
// fichiers, historique court) et renvoie à la fiche complète.
//
// Accessibilité : rôle « dialog » modal, focus piégé dans le panneau, Échap / clic dehors /
// bouton pour fermer, focus rendu à l'élément d'origine. Les boîtes de dialogue ouvertes depuis
// le panneau (actions, aperçu PDF) gardent la main sur Échap et Tab tant qu'elles sont ouvertes.

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Download, Eye, FileText, Phone, RotateCw, X } from 'lucide-react';
import {
  ACTIONS_BY_ID,
  formatDateHeure,
  formatFCFA,
  formatRelatif,
  formatTaille,
  isStatut,
  MODE_PAIEMENT_LABELS,
  STATUT_LABELS,
  type ActionId,
  type ModePaiement,
} from '@evocom/shared';
import { ApiError, fichierUrl, messageErreur } from '../../lib/api';
import type { DossierDetail, Evenement, Fichier, PaiementDossier } from '../../lib/types';
import { Alert, Button, Dialog, IconButton, MachineChip, PaiementStatutBadge, Skeleton, StatusBadge, UrgentTag } from '../../ui';
import { DossierActions } from '../dossiers/DossierActions';
import { useDossier } from '../dossiers/hooks';
import { ModePastille } from '../paiements/ModePastille';
import { EN_CLAIR } from './enClair';
import '../paiements/dossier-apercu.css';

// PDF.js n'est chargé qu'à la première ouverture d'un aperçu PDF.
const ApercuPdf = lazy(() => import('../fichiers/ApercuPdf').then((m) => ({ default: m.ApercuPdf })));

const DUREE_SORTIE = 180;
const HISTORIQUE_COURT = 6;

function mouvementReduit(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const FOCUSABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DossierApercuProps {
  dossierId: number;
  onClose: () => void;
  /** Paiement à mettre en évidence dans la liste des paiements (facultatif). */
  paiementId?: number | null;
}

export function DossierApercu({ dossierId, onClose, paiementId }: DossierApercuProps) {
  const panneau = useRef<HTMLDivElement>(null);
  const [sortie, setSortie] = useState(false);
  const q = useDossier(dossierId);
  const d = q.data;

  const demanderFermeture = useCallback(() => {
    if (sortie) return;
    if (mouvementReduit()) {
      onClose();
      return;
    }
    setSortie(true);
    window.setTimeout(onClose, DUREE_SORTIE);
  }, [onClose, sortie]);
  const fermerRef = useRef(demanderFermeture);
  fermerRef.current = demanderFermeture;

  // Focus initial, piège du focus, Échap, défilement de la page bloqué, focus rendu à la fermeture.
  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    panneau.current?.querySelector<HTMLElement>('[data-fermer]')?.focus();
    const dansPanneau = () => !!panneau.current && panneau.current.contains(document.activeElement);
    const onKey = (e: KeyboardEvent) => {
      // Une boîte de dialogue ouverte depuis le panneau (portail hors du panneau) garde la main.
      const autreDialogue = !dansPanneau() && document.activeElement !== document.body && !!document.activeElement?.closest('[role="dialog"]');
      if (autreDialogue) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        fermerRef.current();
        return;
      }
      if (e.key === 'Tab' && panneau.current) {
        const f = Array.from(panneau.current.querySelectorAll<HTMLElement>(FOCUSABLES)).filter((n) => n.offsetParent !== null || n === document.activeElement);
        if (!f.length) return;
        const premier = f[0]!;
        const dernier = f[f.length - 1]!;
        if (!dansPanneau()) {
          e.preventDefault();
          premier.focus();
        } else if (e.shiftKey && document.activeElement === premier) {
          e.preventDefault();
          dernier.focus();
        } else if (!e.shiftKey && document.activeElement === dernier) {
          e.preventDefault();
          premier.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      precedent?.focus?.();
    };
  }, []);

  const titreId = `dap-titre-${dossierId}`;
  const style = d ? ({ '--dap-s': `var(--s-${d.statut.replace(/_/g, '-')})` } as CSSProperties) : undefined;

  return createPortal(
    <div
      className="dap"
      data-etat={sortie ? 'sortie' : 'ouvert'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) demanderFermeture();
      }}
    >
      <div ref={panneau} className="dap__panneau" role="dialog" aria-modal="true" aria-labelledby={titreId} style={style}>
        <header className="dap__barre">
          <div className="dap__barre-titre">
            <span className="dap__surtitre">Aperçu du dossier</span>
            <h2 id={titreId} className="ev-numero dap__numero">
              {d?.numero ?? (q.isError ? 'Dossier' : '…')}
            </h2>
          </div>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            {d && (
              <Link to={`/dossiers/${d.id}`} className="ev-btn ev-btn--sm dap__lien-fiche" onClick={() => onClose()}>
                <ArrowUpRight aria-hidden="true" />
                <span>Ouvrir la fiche complète</span>
              </Link>
            )}
            <IconButton label="Fermer l’aperçu" onClick={demanderFermeture} data-fermer="">
              <X />
            </IconButton>
          </div>
        </header>

        <div className="dap__corps">
          {q.isError ? (
            <div className="dap-carte">
              <Alert tone="error">
                {q.error instanceof ApiError && q.error.status === 404
                  ? 'Ce dossier n’existe plus ou ne vous est pas accessible.'
                  : `Le dossier n’a pas pu être chargé : ${messageErreur(q.error)}`}
              </Alert>
              <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                <Button size="sm" icon={<RotateCw />} onClick={() => q.refetch()}>
                  Réessayer
                </Button>
              </div>
            </div>
          ) : !d ? (
            <Chargement />
          ) : (
            <Contenu d={d} paiementId={paiementId ?? null} onNaviguer={onClose} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Chargement() {
  return (
    <div className="stack" aria-busy="true" aria-label="Chargement du dossier">
      <div className="dap-carte stack-sm">
        <Skeleton h={28} w="40%" />
        <Skeleton h={18} w="60%" />
      </div>
      <div className="dap-carte">
        <div className="dap-montants">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} h={52} />
          ))}
        </div>
      </div>
      <div className="dap-carte stack-sm">
        <Skeleton h={44} />
        <Skeleton h={44} />
      </div>
    </div>
  );
}

function Contenu({ d, paiementId, onNaviguer }: { d: DossierDetail; paiementId: number | null; onNaviguer: () => void }) {
  const [pdf, setPdf] = useState<Fichier | null>(null);
  const montantsVisibles = d.deja_paye !== undefined;
  const attente = d.en_attente_validation ?? 0;
  const deja = d.deja_paye ?? 0;
  const reste = d.montant === null || d.montant === undefined ? null : Math.max(0, d.montant - deja - attente);
  const enClair = EN_CLAIR[d.statut];
  const historique = d.historique.slice(0, HISTORIQUE_COURT);

  return (
    <div className="stack">
      {/* En-tête : client, statut, machine */}
      <section className="dap-carte dap-entete" aria-label="Dossier">
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <StatusBadge statut={d.statut} />
          <MachineChip machine={d.machine} />
          {d.urgent && <UrgentTag />}
          {d.importe && <span className="dap-etiquette">Importé</span>}
        </div>
        <p className="dap-client">{d.client_nom}</p>
        {d.client_telephone && (
          <a className="dap-tel ev-link" href={`tel:${d.client_telephone.replace(/\s+/g, '')}`}>
            <Phone aria-hidden="true" />
            {d.client_telephone}
          </a>
        )}
        {(d.resume_specs || d.description) && <p className="dap-resume">{d.resume_specs || d.description}</p>}
        <p className="dap-suite">
          <strong>{enClair?.etiquette ?? STATUT_LABELS[d.statut]}</strong> · {enClair ? enClair.suite(d) : ''}
        </p>
      </section>

      {/* Montants */}
      {montantsVisibles && (
        <section className="dap-carte" aria-labelledby="dap-montants">
          <h3 id="dap-montants" className="dap-titre">
            Paiement
          </h3>
          <div className="dap-montants">
            <Montant libelle="Montant" valeur={d.montant ?? null} />
            <Montant libelle="Déjà payé" valeur={deja} ton="paye" />
            <Montant libelle="En attente" valeur={attente} ton={attente > 0 ? 'attente' : undefined} aide="Encaissé, pas encore validé" />
            <Montant libelle="Reste à encaisser" valeur={reste} ton={reste && reste > 0 ? 'reste' : undefined} />
          </div>
          {d.montant === null && <p className="dap-note">Montant non renseigné : le reste à encaisser ne peut pas être calculé.</p>}
          {d.montant !== null && d.montant !== undefined && deja + attente > d.montant && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Alert tone="warning">
                Les paiements en attente dépassent de {formatFCFA(deja + attente - d.montant)} ce qui reste à payer : tous ne pourront pas être validés. Refusez
                celui qui est en trop, ou corrigez le montant du dossier.
              </Alert>
            </div>
          )}
          {d.facture && (
            <p className="dap-note">
              Facture <span className="ev-ref">{d.facture.numero}</span> émise · {formatFCFA(d.facture.total_ttc)} TTC
            </p>
          )}
        </section>
      )}

      {/* Paiements du dossier */}
      {montantsVisibles && (
        <section className="dap-carte" aria-labelledby="dap-paiements">
          <h3 id="dap-paiements" className="dap-titre">
            Paiements <span className="ev-count">{d.paiements.length}</span>
          </h3>
          {d.paiements.length === 0 ? (
            <p className="dap-vide">Aucun encaissement sur ce dossier pour l’instant.</p>
          ) : (
            <ul className="dap-liste">
              {d.paiements.map((p) => (
                <LignePaiement key={p.id} p={p} active={p.id === paiementId} />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Prochaines actions */}
      <section className="dap-carte" aria-labelledby="dap-actions">
        <h3 id="dap-actions" className="dap-titre">
          Prochaines actions
        </h3>
        {d.actions.length ? (
          <DossierActions dossier={d} size="sm" />
        ) : (
          <p className="dap-vide">Aucune action à faire de votre part sur ce dossier.</p>
        )}
      </section>

      {/* Fichiers */}
      {d.fichiers.length > 0 && (
        <section className="dap-carte" aria-labelledby="dap-fichiers">
          <h3 id="dap-fichiers" className="dap-titre">
            Fichiers <span className="ev-count">{d.fichiers.length}</span>
          </h3>
          <ul className="dap-liste">
            {d.fichiers.map((f) => (
              <li key={f.id} className="dap-fichier">
                <FileText aria-hidden="true" className="dap-fichier__icone" />
                <span className="dap-fichier__nom">
                  <span className="truncate" title={f.nom_original}>
                    {f.nom_original}
                  </span>
                  <span className="dap-meta">
                    {formatTaille(f.taille)} · {formatRelatif(f.created_at)}
                    {f.a_reimprimer ? ' · à réimprimer' : ''}
                  </span>
                </span>
                {estPdf(f) ? (
                  <Button size="sm" variant="ghost" icon={<Eye />} onClick={() => setPdf(f)} aria-label={`Voir ${f.nom_original}`}>
                    Voir
                  </Button>
                ) : (
                  <a className="ev-btn ev-btn--sm ev-btn--ghost" href={fichierUrl(f.id, true)} download={f.nom_original} aria-label={`Télécharger ${f.nom_original}`}>
                    <Download aria-hidden="true" />
                    Télécharger
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Historique court */}
      <section className="dap-carte" aria-labelledby="dap-historique">
        <h3 id="dap-historique" className="dap-titre">
          Derniers événements
        </h3>
        {historique.length === 0 ? (
          <p className="dap-vide">Aucun événement enregistré.</p>
        ) : (
          <ol className="dap-histo">
            {historique.map((e) => (
              <li key={e.id}>
                <span className="dap-histo__titre">{decrire(e)}</span>
                <span className="dap-meta">
                  {e.user_nom ?? 'Système'} · <time dateTime={e.created_at}>{formatDateHeure(e.created_at)}</time>
                </span>
                {e.commentaire && <span className="dap-histo__note">{e.commentaire}</span>}
              </li>
            ))}
          </ol>
        )}
        {d.historique.length > HISTORIQUE_COURT && (
          <Link to={`/dossiers/${d.id}`} className="ev-link dap-plus" onClick={onNaviguer}>
            Voir tout l’historique ({d.historique.length} événements)
          </Link>
        )}
      </section>

      <Link to={`/dossiers/${d.id}`} className="ev-btn ev-btn--block dap-pied" onClick={onNaviguer}>
        <ArrowUpRight aria-hidden="true" />
        Ouvrir la fiche complète du dossier {d.numero}
      </Link>

      {pdf && (
        <Dialog open onClose={() => setPdf(null)} title={pdf.nom_original} width={960}>
          <Suspense fallback={<Skeleton h={320} />}>
            <ApercuPdf id={pdf.id} nom={pdf.nom_original} hauteur="70vh" />
          </Suspense>
        </Dialog>
      )}
    </div>
  );
}

function Montant({ libelle, valeur, ton, aide }: { libelle: string; valeur: number | null; ton?: 'paye' | 'attente' | 'reste'; aide?: string }) {
  return (
    <div className="dap-montant" data-ton={ton}>
      <span className="dap-montant__libelle">{libelle}</span>
      <span className="dap-montant__valeur ev-num">{valeur === null ? '—' : formatFCFA(valeur)}</span>
      {aide && <span className="dap-montant__aide">{aide}</span>}
    </div>
  );
}

function LignePaiement({ p, active }: { p: PaiementDossier; active: boolean }) {
  return (
    <li className="dap-paiement" data-actif={active || undefined} data-statut={p.statut}>
      <div className="dap-paiement__haut">
        <span className="dap-paiement__montant ev-num">{formatFCFA(p.montant)}</span>
        <PaiementStatutBadge statut={p.statut} />
      </div>
      <div className="dap-paiement__infos">
        <ModePastille mode={p.mode} taille="sm" />
        {p.reference && (
          <span>
            Réf. <span className="ev-ref">{p.reference}</span>
          </span>
        )}
        <span>
          {p.encaisse_par_nom ?? 'Encaisseur inconnu'} · {formatDateHeure(p.encaisse_at)}
        </span>
      </div>
      {p.statut === 'refuse' && p.motif_refus && <p className="dap-paiement__motif">Refusé : {p.motif_refus}</p>}
      {p.statut === 'valide' && p.valide_par_nom && (
        <p className="dap-meta" style={{ margin: 0 }}>
          Validé par {p.valide_par_nom} · {formatDateHeure(p.valide_at)}
        </p>
      )}
    </li>
  );
}

function estPdf(f: Fichier): boolean {
  return f.mime === 'application/pdf' || /\.pdf$/i.test(f.nom_original);
}

const LIBELLES_TYPE: Record<string, string> = {
  creation: 'Dossier créé',
  modification: 'Dossier modifié',
  fichier: 'Fichiers mis à jour',
  commentaire: 'Commentaire',
  livraison: 'Livraison mise à jour',
  urgence: 'Urgence modifiée',
  affectation: 'Affectation modifiée',
  suppression: 'Mis à la corbeille',
  restauration: 'Restauré depuis la corbeille',
  import: 'Importé de l’ancienne plateforme',
};

function decrire(e: Evenement): ReactNode {
  if (e.type === 'statut') {
    const a = e.action ? ACTIONS_BY_ID[e.action as ActionId] : undefined;
    if (a) return a.journal;
    if (e.vers_statut && isStatut(e.vers_statut)) return `Statut : ${STATUT_LABELS[e.vers_statut]}`;
    return 'Changement de statut';
  }
  if (e.type === 'paiement') {
    const m = typeof e.data?.montant === 'number' ? formatFCFA(e.data.montant) : 'Paiement';
    const mode = e.data?.mode ? ` (${MODE_PAIEMENT_LABELS[e.data.mode as ModePaiement] ?? e.data.mode})` : '';
    switch (e.action) {
      case 'encaisse':
        return `${m}${mode} encaissé, à valider`;
      case 'encaisse_valide':
        return `${m}${mode} encaissé et validé`;
      case 'valide':
        return `Paiement de ${m}${mode} validé`;
      case 'refuse':
        return `Paiement de ${m}${mode} refusé`;
      default:
        return 'Paiement';
    }
  }
  if (e.type === 'fichier' && e.action === 'ajout') return 'Fichier ajouté';
  return LIBELLES_TYPE[e.type] ?? e.type;
}
