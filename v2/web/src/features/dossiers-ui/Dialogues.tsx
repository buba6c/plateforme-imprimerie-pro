// Boîtes de dialogue de la fiche dossier : forcer le statut, affecter, reporter la livraison,
// supprimer. Menu « Plus d'actions ».

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { STATUT_LABELS, STATUTS, type Statut } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import type { DossierDetail } from '../../lib/types';
import { Alert, Button, ConfirmDialog, Dialog, SelectField, TextareaField, TextField } from '../../ui';
import { useDossierMutation } from '../dossiers/hooks';
import './dossiers-ui.css';

export interface Annuaire {
  id: number;
  nom: string;
  role: string;
}

export interface ElementMenu {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  tone?: 'danger';
  separe?: boolean;
  href?: string;
}

/** Menu déroulant accessible (Échap, flèches, clic extérieur). */
export function MenuActions({ items, label = 'Plus d’actions', vers = 'bas' }: { items: ElementMenu[]; label?: string; vers?: 'bas' | 'haut' }) {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (!boite.current?.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOuvert(false);
        bouton.current?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const els = Array.from(boite.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        const i = els.indexOf(document.activeElement as HTMLElement);
        const n = e.key === 'ArrowDown' ? (i + 1) % els.length : (i - 1 + els.length) % els.length;
        els[n]?.focus();
      }
    };
    document.addEventListener('mousedown', clic);
    document.addEventListener('keydown', touche);
    boite.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', clic);
      document.removeEventListener('keydown', touche);
    };
  }, [ouvert]);
  if (!items.length) return null;
  return (
    <div className="fd-menu" ref={boite}>
      <button
        ref={bouton}
        type="button"
        className="ev-btn"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label={label}
        title={label}
        onClick={() => setOuvert((o) => !o)}
        style={{ paddingInline: 10 }}
      >
        <MoreHorizontal />
      </button>
      {ouvert && (
        <div className="fd-menu__liste" role="menu" aria-label={label} style={vers === 'haut' ? { top: 'auto', bottom: 'calc(100% + 6px)' } : undefined}>
          {items.map((it) => (
            <div key={it.id}>
              {it.separe && <div className="fd-menu__sep" role="separator" />}
              {it.href ? (
                <a role="menuitem" className="fd-menu__item" href={it.href} target="_blank" rel="noopener noreferrer" onClick={() => setOuvert(false)}>
                  {it.icon}
                  {it.label}
                </a>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className="fd-menu__item"
                  data-tone={it.tone}
                  onClick={() => {
                    setOuvert(false);
                    it.onSelect();
                  }}
                >
                  {it.icon}
                  {it.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ForcerStatutDialog({ d, onClose }: { d: DossierDetail; onClose: () => void }) {
  const [statut, setStatut] = useState<Statut | ''>('');
  const [commentaire, setCommentaire] = useState('');
  const m = useDossierMutation((v: { statut: Statut; commentaire: string }) => api.post<DossierDetail>(`/dossiers/${d.id}/forcer-statut`, v));
  const ok = !!statut && commentaire.trim().length >= 3;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Forcer le statut"
      description={`Le dossier ${d.numero} passe directement au statut choisi, sans les contrôles du circuit. À réserver aux corrections.`}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="danger" busy={m.isPending} disabled={!ok} onClick={() => statut && m.mutate({ statut, commentaire: commentaire.trim() }, { onSuccess: onClose })}>
            Forcer le statut
          </Button>
        </>
      }
    >
      {m.isError && <Alert tone="error">{messageErreur(m.error)}</Alert>}
      <p style={{ margin: 0 }}>
        Statut actuel : <strong>{STATUT_LABELS[d.statut]}</strong>
      </p>
      <SelectField
        label="Nouveau statut"
        required
        value={statut}
        onChange={(e) => setStatut(e.target.value as Statut)}
        placeholder="Choisir un statut"
        options={STATUTS.filter((s) => s !== d.statut).map((s) => ({ value: s, label: STATUT_LABELS[s] }))}
        data-autofocus
      />
      <TextareaField label="Motif" required rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} help="Obligatoire, au moins 3 caractères. Visible dans l'historique." />
    </Dialog>
  );
}

export function AffecterDialog({ d, annuaire, onClose }: { d: DossierDetail; annuaire: Annuaire[]; onClose: () => void }) {
  const [imprimeur, setImprimeur] = useState(d.imprimeur_id ? String(d.imprimeur_id) : '');
  const [livreur, setLivreur] = useState(d.livreur_id ? String(d.livreur_id) : '');
  const m = useDossierMutation((v: { imprimeur_id?: number | null; livreur_id?: number | null }) => api.post<DossierDetail>(`/dossiers/${d.id}/affecter`, v));
  const imprimeurs = annuaire.filter((u) => u.role === `imprimeur_${d.machine}`);
  const livreurs = annuaire.filter((u) => u.role === 'livreur');
  const corps: { imprimeur_id?: number | null; livreur_id?: number | null } = {};
  if ((imprimeur ? Number(imprimeur) : null) !== (d.imprimeur_id ?? null)) corps.imprimeur_id = imprimeur ? Number(imprimeur) : null;
  if ((livreur ? Number(livreur) : null) !== (d.livreur_id ?? null)) corps.livreur_id = livreur ? Number(livreur) : null;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Affecter le dossier"
      description="La personne choisie est prévenue par une notification."
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" busy={m.isPending} disabled={!Object.keys(corps).length} onClick={() => m.mutate(corps, { onSuccess: onClose })}>
            Enregistrer l’affectation
          </Button>
        </>
      }
    >
      {m.isError && <Alert tone="error">{messageErreur(m.error)}</Alert>}
      <SelectField
        label={`Imprimeur ${d.machine === 'roland' ? 'Roland' : 'Xerox'}`}
        value={imprimeur}
        onChange={(e) => setImprimeur(e.target.value)}
        placeholder="Non affecté"
        options={imprimeurs.map((u) => ({ value: String(u.id), label: u.nom }))}
        data-autofocus
      />
      <SelectField label="Livreur" value={livreur} onChange={(e) => setLivreur(e.target.value)} placeholder="Non affecté" options={livreurs.map((u) => ({ value: String(u.id), label: u.nom }))} />
    </Dialog>
  );
}

function versLocal(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 86_400_000);
  if (Number.isNaN(d.getTime())) return '';
  if (!iso) d.setHours(9, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function ReporterDialog({ d, onClose }: { d: DossierDetail; onClose: () => void }) {
  const [date, setDate] = useState(() => {
    const base = d.livraison_prevue_at ? new Date(new Date(d.livraison_prevue_at).getTime() + 86_400_000).toISOString() : null;
    return versLocal(base);
  });
  const [motif, setMotif] = useState('');
  const m = useDossierMutation((v: { date_prevue: string; motif: string | null }) => api.post<DossierDetail>(`/dossiers/${d.id}/reporter`, v));
  return (
    <Dialog
      open
      onClose={onClose}
      title="Reporter la livraison"
      description={`Nouvelle date de livraison pour ${d.numero}.`}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" busy={m.isPending} disabled={!date} onClick={() => m.mutate({ date_prevue: date, motif: motif.trim() || null }, { onSuccess: onClose })}>
            Reporter
          </Button>
        </>
      }
    >
      {m.isError && <Alert tone="error">{messageErreur(m.error)}</Alert>}
      <TextField label="Nouvelle date et heure" type="datetime-local" required mono value={date} onChange={(e) => setDate(e.target.value)} data-autofocus />
      <TextareaField label="Motif" rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Client absent, adresse à confirmer…" />
    </Dialog>
  );
}

export function SupprimerDialog({ d, onClose, onSupprime }: { d: DossierDetail; onClose: () => void; onSupprime: () => void }) {
  const [motif, setMotif] = useState('');
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Supprimer le dossier"
      description={`${d.numero} · ${d.client_nom} part à la corbeille. Un administrateur peut le restaurer.`}
      confirmLabel="Supprimer le dossier"
      danger
      busy={busy}
      onConfirm={async () => {
        setBusy(true);
        setErreur(null);
        try {
          await api.del(`/dossiers/${d.id}`, { motif: motif.trim() || null });
          onSupprime();
        } catch (e) {
          setErreur(messageErreur(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {erreur && <Alert tone="error">{erreur}</Alert>}
      <TextareaField label="Motif" rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Doublon, commande annulée par le client…" help="Conservé dans l'historique du dossier." data-autofocus />
    </ConfirmDialog>
  );
}
