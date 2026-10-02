// Envoi reprenable des fichiers d'impression (protocole tus) : glisser-déposer ou sélection,
// plusieurs fichiers, progression par fichier, pause, reprise et annulation.

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload as UploadIcon, Pause, Play, X, CheckCircle2, AlertTriangle, RotateCw } from 'lucide-react';
import { Upload, DetailedError } from 'tus-js-client';
import { formatTaille } from '@evocom/shared';
import { Button, IconButton, useToast } from '../../ui';
import { extension } from './ListeFichiers';
import './fichiers.css';

type Etat = 'envoi' | 'pause' | 'termine' | 'erreur';

interface Envoi {
  id: string;
  nom: string;
  taille: number;
  octets: number;
  etat: Etat;
  erreur?: string;
}

const CHUNK = 8 * 1024 * 1024;
const RETRY = [0, 1000, 3000, 5000, 10000];

/** Message clair à partir d'une erreur tus (le serveur répond en texte brut). */
export function messageEnvoi(err: Error | DetailedError): string {
  const res = err instanceof DetailedError ? err.originalResponse : null;
  if (!res) {
    return navigator.onLine === false
      ? 'Connexion internet coupée. Cliquez sur Reprendre quand elle revient : l’envoi repart là où il s’est arrêté.'
      : 'Connexion au serveur interrompue. Cliquez sur Reprendre : l’envoi repart là où il s’est arrêté.';
  }
  const status = res.getStatus();
  const corps = (res.getBody() ?? '').trim();
  if (status === 413) return 'Fichier trop volumineux : il dépasse la taille maximale acceptée par le serveur.';
  if (status === 401) return 'Votre session a expiré. Reconnectez-vous, puis relancez l’envoi.';
  if (status >= 500) return 'Le serveur a rencontré une erreur pendant l’envoi. Réessayez ; si cela persiste, prévenez l’administrateur.';
  // Les refus métier (dossier validé, droits…) sont rédigés en français par le serveur.
  if (corps && corps.length < 300 && !/^[{<]/.test(corps) && /[a-zà-ÿ]/i.test(corps)) return corps;
  if (status === 403) return 'Vous ne pouvez pas ajouter de fichier à ce dossier.';
  if (status === 404) return 'L’envoi n’existe plus sur le serveur. Ajoutez à nouveau le fichier.';
  return `L’envoi a échoué (erreur ${status}). Réessayez.`;
}

export function Televersement({ dossierId }: { dossierId: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [envois, setEnvois] = useState<Envoi[]>([]);
  const [survol, setSurvol] = useState(false);
  const uploads = useRef(new Map<string, Upload>());
  const input = useRef<HTMLInputElement>(null);

  const maj = useCallback((id: string, patch: Partial<Envoi>) => setEnvois((l) => l.map((e) => (e.id === id ? { ...e, ...patch } : e))), []);
  const retirer = useCallback((id: string) => {
    uploads.current.delete(id);
    setEnvois((l) => l.filter((e) => e.id !== id));
  }, []);

  // Prévenir avant de quitter la page pendant un envoi.
  const enCours = envois.some((e) => e.etat === 'envoi');
  useEffect(() => {
    if (!enCours) return;
    const avant = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', avant);
    return () => window.removeEventListener('beforeunload', avant);
  }, [enCours]);

  // Interrompre proprement les envois si l'on quitte la fiche (ils restent reprenables).
  useEffect(() => {
    const map = uploads.current;
    return () => {
      map.forEach((u) => void u.abort());
    };
  }, []);

  const ajouter = (fichiers: FileList | File[]) => {
    for (const file of Array.from(fichiers)) {
      if (file.size === 0) {
        toast.error('Fichier vide', `${file.name} ne contient aucune donnée.`);
        continue;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const upload = new Upload(file, {
        endpoint: '/api/uploads',
        chunkSize: CHUNK,
        retryDelays: RETRY,
        removeFingerprintOnSuccess: true,
        metadata: { dossierId: String(dossierId), filename: file.name, filetype: file.type || 'application/octet-stream' },
        onProgress: (octets, total) => maj(id, { octets, taille: total }),
        onError: (err) => maj(id, { etat: 'erreur', erreur: messageEnvoi(err) }),
        onSuccess: () => {
          maj(id, { etat: 'termine', octets: file.size });
          toast.success('Fichier ajouté', file.name);
          void qc.invalidateQueries({ queryKey: ['dossier', dossierId] });
          void qc.invalidateQueries({ queryKey: ['dossiers'] });
          setTimeout(() => retirer(id), 2500);
        },
      });
      uploads.current.set(id, upload);
      setEnvois((l) => [...l, { id, nom: file.name, taille: file.size, octets: 0, etat: 'envoi' }]);
      // Reprendre un envoi interrompu du même fichier, pour ce même dossier.
      upload
        .findPreviousUploads()
        .then((precedents) => {
          const p = precedents.find((x) => x.metadata?.dossierId === String(dossierId));
          if (p) upload.resumeFromPreviousUpload(p);
        })
        .catch(() => {})
        .finally(() => upload.start());
    }
  };

  const pause = (id: string) => {
    void uploads.current.get(id)?.abort();
    maj(id, { etat: 'pause' });
  };
  const reprendre = (id: string) => {
    uploads.current.get(id)?.start();
    maj(id, { etat: 'envoi', erreur: undefined });
  };
  const annuler = (id: string) => {
    const u = uploads.current.get(id);
    if (u) void u.abort(true).catch(() => {});
    retirer(id);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setSurvol(false);
    if (e.dataTransfer.files?.length) ajouter(e.dataTransfer.files);
  };

  return (
    <div className="fi-envoi">
      <div
        className="ev-dropzone fi-dropzone"
        data-over={survol}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (!survol) setSurvol(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setSurvol(false);
        }}
        onDrop={onDrop}
      >
        <UploadIcon aria-hidden="true" className="fi-dropzone__icone" />
        <div>
          <strong>Déposez les fichiers ici</strong> <span>ou</span>{' '}
          <button type="button" className="ev-link fi-dropzone__choisir" onClick={() => input.current?.click()}>
            choisissez-les sur l’ordinateur
          </button>
        </div>
        <span className="fi-dropzone__aide">PDF, images, fichiers de mise en page. Plusieurs fichiers à la fois ; un envoi coupé reprend où il s’est arrêté.</span>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) ajouter(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {envois.length > 0 && (
        <ul className="fi-envois" aria-label="Envois en cours">
          {envois.map((e) => {
            const pct = e.taille ? Math.min(100, Math.round((e.octets / e.taille) * 100)) : 0;
            return (
              <li key={e.id} className="fi-envoi-item" data-etat={e.etat}>
                <span className="ev-file__type" aria-hidden="true">{extension(e.nom)}</span>
                <div className="fi-envoi-item__main">
                  <div className="fi-envoi-item__ligne">
                    <span className="ev-file__name">{e.nom}</span>
                    <span className="fi-envoi-item__etat ev-mono">
                      {e.etat === 'termine' ? (
                        <>
                          <CheckCircle2 aria-hidden="true" /> Envoyé
                        </>
                      ) : e.etat === 'erreur' ? (
                        <>
                          <AlertTriangle aria-hidden="true" /> Échec
                        </>
                      ) : e.etat === 'pause' ? (
                        `En pause · ${pct} %`
                      ) : (
                        `${pct} %`
                      )}
                    </span>
                  </div>
                  <div
                    className="ev-progress"
                    role="progressbar"
                    aria-label={`Envoi de ${e.nom}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    style={{ ['--value' as string]: `${pct}%` }}
                  >
                    <span />
                  </div>
                  <span className="ev-file__meta ev-mono">
                    {formatTaille(e.octets)} sur {formatTaille(e.taille)}
                  </span>
                  {e.erreur && <span className="ev-error">{e.erreur}</span>}
                </div>
                <div className="ev-file__actions">
                  {e.etat === 'envoi' && (
                    <IconButton label={`Mettre en pause l'envoi de ${e.nom}`} size="sm" onClick={() => pause(e.id)}>
                      <Pause />
                    </IconButton>
                  )}
                  {e.etat === 'pause' && (
                    <IconButton label={`Reprendre l'envoi de ${e.nom}`} size="sm" onClick={() => reprendre(e.id)}>
                      <Play />
                    </IconButton>
                  )}
                  {e.etat === 'erreur' && (
                    <Button size="sm" icon={<RotateCw />} onClick={() => reprendre(e.id)}>
                      Reprendre
                    </Button>
                  )}
                  {e.etat !== 'termine' && (
                    <IconButton label={`Annuler l'envoi de ${e.nom}`} size="sm" onClick={() => annuler(e.id)}>
                      <X />
                    </IconButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
