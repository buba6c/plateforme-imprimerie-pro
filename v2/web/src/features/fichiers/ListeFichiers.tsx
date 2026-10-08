// Liste des fichiers d'impression d'un dossier : aperçu, téléchargement, marquage
// « à réimprimer », suppression tant que le dossier est modifiable.

import { ApercuPdf } from './ApercuPdf';
import { VignettePdf } from '../fichiers-admin/VignettePdf';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Eye, ExternalLink, RotateCcw, Trash2 } from 'lucide-react';
import { formatDateHeure, formatTaille } from '@evocom/shared';
import { api, fichierUrl, messageErreur } from '../../lib/api';
import type { Fichier } from '../../lib/types';
import { ConfirmDialog, Dialog, IconButton, useToast } from '../../ui';
import './fichiers.css';

const APERCU_IMAGE = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export function extension(nom: string): string {
  const i = nom.lastIndexOf('.');
  if (i <= 0 || i === nom.length - 1) return 'FIC';
  return nom.slice(i + 1).toUpperCase().slice(0, 4);
}

function typeApercu(f: Fichier): 'pdf' | 'image' | null {
  if (f.mime === 'application/pdf') return 'pdf';
  if (f.mime && APERCU_IMAGE.includes(f.mime)) return 'image';
  return null;
}

export function ListeFichiers({ dossierId, fichiers, peutMarquer, peutSupprimer }: {
  dossierId: number;
  fichiers: Fichier[];
  peutMarquer: boolean;
  peutSupprimer: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [apercu, setApercu] = useState<Fichier | null>(null);
  const [aSupprimer, setASupprimer] = useState<Fichier | null>(null);
  const [occupe, setOccupe] = useState<number | null>(null);

  const rafraichir = () => {
    void qc.invalidateQueries({ queryKey: ['dossier', dossierId] });
    void qc.invalidateQueries({ queryKey: ['dossiers'] });
  };

  const basculer = async (f: Fichier) => {
    setOccupe(f.id);
    try {
      await api.patch(`/fichiers/${f.id}`, { a_reimprimer: !f.a_reimprimer });
      toast.success(f.a_reimprimer ? 'Réimpression annulée' : 'Fichier marqué à réimprimer', f.nom_original);
      rafraichir();
    } catch (e) {
      toast.error('Modification impossible', messageErreur(e));
    } finally {
      setOccupe(null);
    }
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    setOccupe(aSupprimer.id);
    try {
      await api.del(`/fichiers/${aSupprimer.id}`);
      toast.success('Fichier supprimé', aSupprimer.nom_original);
      setASupprimer(null);
      rafraichir();
    } catch (e) {
      toast.error('Suppression impossible', messageErreur(e));
    } finally {
      setOccupe(null);
    }
  };

  return (
    <>
      <ul className="fi-grille">
        {fichiers.map((f, i) => {
          const type = typeApercu(f);
          const ext = extension(f.nom_original);
          const tuile = <span className="fi-carte__tuile">{ext}</span>;
          return (
            <li key={f.id} className="fi-carte" data-reimprimer={f.a_reimprimer || undefined} style={{ '--i': i } as React.CSSProperties}>
              <button type="button" className="fi-carte__vignette" onClick={() => (type ? setApercu(f) : window.open(fichierUrl(f.id, true)))} aria-label={type ? `Voir ${f.nom_original}` : `Télécharger ${f.nom_original}`}>
                {type === 'image' ? (
                  <img src={fichierUrl(f.id)} alt="" loading="lazy" />
                ) : type === 'pdf' ? (
                  <VignettePdf id={f.id} taille={f.taille} nom={f.nom_original} repli={tuile} />
                ) : (
                  tuile
                )}
                <span className="fi-carte__type">{ext}</span>
                {type && (
                  <span className="fi-carte__voile" aria-hidden="true">
                    <Eye />
                    Voir
                  </span>
                )}
              </button>
              <div className="fi-carte__infos">
                <span className="fi-carte__nom" title={f.nom_original}>
                  {f.nom_original}
                </span>
                <span className="fi-carte__meta">
                  {formatTaille(f.taille)}
                  {f.uploaded_by_nom ? ` · ${f.uploaded_by_nom}` : ''} · {formatDateHeure(f.created_at)}
                </span>
                {f.a_reimprimer && <span className="fi-tag-reimp">À réimprimer</span>}
              </div>
              <div className="fi-carte__actions">
                <a className="ev-icon-btn ev-icon-btn--sm" href={fichierUrl(f.id, true)} download aria-label={`Télécharger ${f.nom_original}`} title="Télécharger">
                  <Download />
                </a>
                {peutMarquer && (
                  <IconButton
                    label={f.a_reimprimer ? `Annuler la réimpression de ${f.nom_original}` : `Marquer ${f.nom_original} à réimprimer`}
                    size="sm"
                    aria-pressed={f.a_reimprimer}
                    className="fi-reimp-btn"
                    disabled={occupe === f.id}
                    onClick={() => void basculer(f)}
                  >
                    <RotateCcw />
                  </IconButton>
                )}
                {peutSupprimer && (
                  <IconButton label={`Supprimer ${f.nom_original}`} size="sm" disabled={occupe === f.id} onClick={() => setASupprimer(f)}>
                    <Trash2 />
                  </IconButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {apercu && <ApercuFichier fichier={apercu} onClose={() => setApercu(null)} />}

      <ConfirmDialog
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={() => void supprimer()}
        title="Supprimer le fichier"
        description={aSupprimer ? `« ${aSupprimer.nom_original} » sera retiré du dossier. L'opération est notée dans l'historique.` : undefined}
        confirmLabel="Supprimer le fichier"
        danger
        busy={occupe !== null && occupe === aSupprimer?.id}
      />
    </>
  );
}

/**
 * PDF chargé en mémoire puis affiché depuis une adresse blob: : le visionneur PDF du
 * navigateur refuse de s'ouvrir dans un document servi avec « Content-Security-Policy: sandbox ».
 */
export function usePdfBlob(id: number, actif: boolean) {
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

export function ApercuFichier({ fichier, onClose }: { fichier: Fichier; onClose: () => void }) {
  const type = typeApercu(fichier);
  const url = fichierUrl(fichier.id);
  return (
    <Dialog
      open
      onClose={onClose}
      title={fichier.nom_original}
      description={`${formatTaille(fichier.taille)}${fichier.uploaded_by_nom ? ` · envoyé par ${fichier.uploaded_by_nom}` : ''} · ${formatDateHeure(fichier.created_at)}`}
      width={1040}
      footer={
        <>
          <a className="ev-btn" href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            Ouvrir dans un onglet
          </a>
          <a className="ev-btn ev-btn--primary" href={fichierUrl(fichier.id, true)} download>
            <Download aria-hidden="true" />
            Télécharger
          </a>
        </>
      }
    >
      <div className="fi-apercu">
        {type === 'image' ? (
          <img src={url} alt={`Aperçu de ${fichier.nom_original}`} />
        ) : type === 'pdf' ? (
          <ApercuPdf id={fichier.id} nom={fichier.nom_original} />
        ) : (
          <p className="ev-muted">Aperçu indisponible pour ce type de fichier : téléchargez-le pour l'ouvrir.</p>
        )}
      </div>
    </Dialog>
  );
}
