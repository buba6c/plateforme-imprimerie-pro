// Panneau latéral d'aperçu d'un fichier : image affichée, PDF dans un cadre (adresse blob:),
// autres formats : type + téléchargement. Les données passent par /api/fichiers/:id/contenu,
// qui vérifie les droits sur le dossier à chaque lecture.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ExternalLink, FolderOpen, X } from 'lucide-react';
import { formatDateHeure, formatTaille } from '@evocom/shared';
import { fichierUrl } from '../../lib/api';
import { Button, IconButton, MachineChip, StatusBadge } from '../../ui';
import { extension } from '../fichiers/ListeFichiers';
import type { FichierGlobal } from './types';

/** Formats que le navigateur affiche (le serveur les sert « inline »). */
const IMAGES_AFFICHABLES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
/** Au-delà, l'aperçu PDF n'est chargé qu'à la demande (le fichier entier passe en mémoire). */
const PDF_AUTO_MAX = 40 * 1024 * 1024;

export function modeApercu(f: Pick<FichierGlobal, 'mime'>): 'pdf' | 'image' | null {
  if (f.mime === 'application/pdf') return 'pdf';
  if (f.mime && IMAGES_AFFICHABLES.includes(f.mime)) return 'image';
  return null;
}

/**
 * PDF chargé en mémoire puis affiché depuis une adresse blob: : le visionneur PDF du
 * navigateur refuse de s'ouvrir dans un document servi avec « Content-Security-Policy: sandbox ».
 */
function usePdfBlob(id: number, actif: boolean) {
  const [etat, setEtat] = useState<{
    url: string | null;
    erreur: string | null;
  }>({ url: null, erreur: null });
  useEffect(() => {
    setEtat({ url: null, erreur: null });
    if (!actif) return;
    let url: string | null = null;
    const ctrl = new AbortController();
    fetch(fichierUrl(id), { credentials: 'same-origin', signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 404 ? 'Le fichier est introuvable sur le serveur : signalez-le à l’administrateur.' : `Aperçu impossible (erreur ${r.status}).`,
          );
        }
        const b = await r.blob();
        url = URL.createObjectURL(new Blob([b], { type: 'application/pdf' }));
        setEtat({ url, erreur: null });
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setEtat({ url: null, erreur: e.message || 'Aperçu impossible.' });
      });
    return () => {
      ctrl.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, actif]);
  return etat;
}

function Zone({ fichier }: { fichier: FichierGlobal }) {
  const mode = modeApercu(fichier);
  const [demande, setDemande] = useState(false);
  const [imageKo, setImageKo] = useState(false);
  useEffect(() => {
    setDemande(false);
    setImageKo(false);
  }, [fichier.id]);
  const auto = fichier.taille <= PDF_AUTO_MAX;
  const pdf = usePdfBlob(fichier.id, mode === 'pdf' && (auto || demande));

  if (mode === 'image' && !imageKo) {
    return (
      <div className="fa-apercu__zone">
        <img src={fichierUrl(fichier.id)} alt={`Aperçu de ${fichier.nom_original}`} onError={() => setImageKo(true)} />
      </div>
    );
  }
  if (mode === 'pdf') {
    if (!auto && !demande) {
      return (
        <div className="fa-apercu__zone fa-apercu__zone--vide">
          <span className="ev-file__type" aria-hidden="true">
            PDF
          </span>
          <p>Fichier volumineux ({formatTaille(fichier.taille)}) : l’aperçu le charge entièrement.</p>
          <Button size="sm" onClick={() => setDemande(true)}>
            Afficher l’aperçu
          </Button>
        </div>
      );
    }
    return (
      <div className="fa-apercu__zone fa-apercu__zone--pdf">
        {pdf.url ? (
          <iframe src={pdf.url} title={`Aperçu de ${fichier.nom_original}`} />
        ) : (
          <p className={pdf.erreur ? 'ev-error' : 'ev-muted'} role={pdf.erreur ? 'alert' : undefined}>
            {pdf.erreur ?? 'Chargement de l’aperçu…'}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="fa-apercu__zone fa-apercu__zone--vide">
      <span className="ev-file__type" aria-hidden="true">
        {extension(fichier.nom_original)}
      </span>
      <p>
        {imageKo
          ? 'L’image n’a pas pu être affichée. Téléchargez-la pour l’ouvrir.'
          : 'Aperçu indisponible pour ce format : téléchargez le fichier pour l’ouvrir avec le bon logiciel.'}
      </p>
    </div>
  );
}

/** Sous 1280 px, le panneau recouvre la page (voir fichiers-admin.css) et se comporte en dialogue. */
const SUPERPOSE = '(max-width: 1279px)';

function useSuperpose(): boolean {
  const [v, setV] = useState(() => window.matchMedia(SUPERPOSE).matches);
  useEffect(() => {
    const mq = window.matchMedia(SUPERPOSE);
    const maj = () => setV(mq.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);
  return v;
}

export function ApercuPanneau({ fichier, onClose }: { fichier: FichierGlobal; onClose: () => void }) {
  const panneau = useRef<HTMLElement>(null);
  const titre = useRef<HTMLHeadingElement>(null);
  const mode = modeApercu(fichier);
  const superpose = useSuperpose();

  // Le focus revient à l'élément qui a ouvert l'aperçu.
  useEffect(() => {
    const avant = document.activeElement as HTMLElement | null;
    return () => {
      if (avant?.isConnected) avant.focus();
    };
  }, []);

  useEffect(() => {
    titre.current?.focus();
  }, [fichier.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.ev-backdrop')) onClose();
      if (e.key === 'Tab' && superpose && panneau.current) {
        const f = Array.from(panneau.current.querySelectorAll<HTMLElement>('button, [href], iframe, [tabindex]:not([tabindex="-1"])')).filter(
          (n) => !n.hasAttribute('disabled'),
        );
        if (!f.length) return;
        const premier = f[0]!;
        const dernier = f[f.length - 1]!;
        if (!panneau.current.contains(document.activeElement)) {
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
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, superpose]);

  useEffect(() => {
    if (!superpose) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [superpose]);

  return (
    <>
      <div className="fa-apercu-fond" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panneau}
        className="fa-apercu ev-card"
        aria-labelledby="fa-apercu-titre"
        role={superpose ? 'dialog' : undefined}
        aria-modal={superpose || undefined}
      >
        <header className="fa-apercu__tete">
          <div className="stack-sm" style={{ gap: 2, minWidth: 0 }}>
            <span className="section-title">Aperçu</span>
            <h2 className="ev-h-heading fa-apercu__titre" id="fa-apercu-titre" ref={titre} tabIndex={-1}>
              {fichier.nom_original}
            </h2>
          </div>
          <IconButton label="Fermer l’aperçu" size="sm" onClick={onClose}>
            <X />
          </IconButton>
        </header>

        <Zone fichier={fichier} />

        <div className="fa-apercu__actions">
          <a className="ev-btn ev-btn--primary ev-btn--sm" href={fichierUrl(fichier.id, true)} download>
            <Download aria-hidden="true" />
            Télécharger
          </a>
          {mode && (
            <a className="ev-btn ev-btn--sm" href={fichierUrl(fichier.id)} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Ouvrir dans un onglet
            </a>
          )}
          <Link className="ev-btn ev-btn--sm ev-btn--ghost" to={`/dossiers/${fichier.dossier_id}`}>
            <FolderOpen aria-hidden="true" />
            Ouvrir le dossier
          </Link>
        </div>

        <dl className="kv fa-apercu__kv">
          <dt>Dossier</dt>
          <dd>
            <span className="row" style={{ gap: 6 }}>
              <Link className="ev-link ev-ref" to={`/dossiers/${fichier.dossier_id}`}>
                {fichier.dossier_numero}
              </Link>
              <MachineChip machine={fichier.machine} />
            </span>
          </dd>
          <dt>Client</dt>
          <dd>{fichier.client_nom}</dd>
          <dt>Statut</dt>
          <dd>
            <StatusBadge statut={fichier.dossier_statut} />
          </dd>
          <dt>Taille</dt>
          <dd className="ev-num">{formatTaille(fichier.taille)}</dd>
          <dt>Format</dt>
          <dd className="ev-mono fa-petit">{fichier.mime ?? '—'}</dd>
          <dt>Envoyé par</dt>
          <dd>{fichier.uploaded_by_nom ?? (fichier.importe ? 'Ancienne plateforme' : '—')}</dd>
          <dt>Le</dt>
          <dd className="ev-ref">{formatDateHeure(fichier.created_at)}</dd>
          {fichier.a_reimprimer && (
            <>
              <dt>Impression</dt>
              <dd>
                <span className="fi-tag-reimp">À réimprimer</span>
              </dd>
            </>
          )}
        </dl>
      </aside>
    </>
  );
}
