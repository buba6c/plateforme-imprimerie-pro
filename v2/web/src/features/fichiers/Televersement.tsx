// Envoi reprenable des fichiers d'impression (protocole tus) : glisser-déposer ou sélection,
// plusieurs fichiers (cinquante, cent…), progression par fichier, pause, reprise et annulation.
//
// File d'attente : SIMULTANES envois à la fois, les autres attendent leur tour. Tout lancer d'un coup
// partageait la connexion entre des dizaines de flux : chaque morceau dépassait le délai du serveur
// (408), la reprise tombait sur un décalage (409), et presque rien n'arrivait (journal du 13/10/2026).

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload as UploadIcon, Pause, Play, X, CheckCircle2, AlertTriangle, RotateCw } from 'lucide-react';
import { Upload, DetailedError } from 'tus-js-client';
import { useRegles } from '../parametres/api';
import { formatTaille } from '@evocom/shared';
import { Button, IconButton, useToast } from '../../ui';
import { extension } from './ListeFichiers';
import { prendreEnAttente } from './enAttente';
import './fichiers.css';

type Etat = 'attente' | 'envoi' | 'pause' | 'termine' | 'erreur';

interface Envoi {
  id: string;
  nom: string;
  taille: number;
  octets: number;
  etat: Etat;
  erreur?: string;
}

/** Morceaux de 2 Mo : chacun passe en quelques secondes même sur une liaison lente. */
const CHUNK = 2 * 1024 * 1024;
/** Reprises automatiques, de plus en plus espacées (coupure de quelques minutes comprise). */
const RETRY = [0, 1000, 3000, 5000, 10000, 20000, 30000, 60000, 60000, 60000];
/** Envois menés en même temps ; les suivants attendent leur tour. */
const SIMULTANES = 2;

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
  const lisible = corps && corps.length < 300 && !/^[{<]/.test(corps) && /[a-zà-ÿ]/i.test(corps);
  // Taille ou type refusés : le serveur précise la règle en vigueur (Paramètres > Fichiers).
  if ((status === 413 || status === 415) && lisible) return corps;
  if (status === 413) return 'Fichier trop volumineux : il dépasse la taille maximale acceptée par le serveur.';
  if (status === 401) return 'Votre session a expiré. Reconnectez-vous, puis relancez l’envoi.';
  if (status >= 500) return 'Le serveur a rencontré une erreur pendant l’envoi. Réessayez ; si cela persiste, prévenez l’administrateur.';
  // Les refus métier (dossier validé, droits…) sont rédigés en français par le serveur.
  if (lisible) return corps;
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
  // File d'attente : ordre d'arrivée, et envois actuellement lancés.
  const fileAttente = useRef<string[]>([]);
  const actifs = useRef(new Set<string>());
  // Lot en cours : un seul message à la fin plutôt qu'un par fichier.
  const lot = useRef({ ok: 0, echecs: 0 });
  const rafraichir = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maj = useCallback((id: string, patch: Partial<Envoi>) => setEnvois((l) => l.map((e) => (e.id === id ? { ...e, ...patch } : e))), []);
  const retirer = useCallback((id: string) => {
    uploads.current.delete(id);
    setEnvois((l) => l.filter((e) => e.id !== id));
  }, []);

  /** Recharge la fiche au plus toutes les 2 s pendant un gros lot. */
  const rafraichirFiche = useCallback(() => {
    if (rafraichir.current) return;
    rafraichir.current = setTimeout(() => {
      rafraichir.current = null;
      void qc.invalidateQueries({ queryKey: ['dossier', dossierId] });
      void qc.invalidateQueries({ queryKey: ['dossiers'] });
    }, 2000);
  }, [qc, dossierId]);

  /** Lance les envois en attente tant qu'il reste une place ; annonce la fin du lot. */
  const lancerSuivants = useCallback(() => {
    while (actifs.current.size < SIMULTANES && fileAttente.current.length) {
      const id = fileAttente.current.shift()!;
      const u = uploads.current.get(id);
      if (!u) continue;
      actifs.current.add(id);
      maj(id, { etat: 'envoi', erreur: undefined });
      u.start();
    }
    if (!actifs.current.size && !fileAttente.current.length && lot.current.ok + lot.current.echecs > 0) {
      const { ok, echecs } = lot.current;
      lot.current = { ok: 0, echecs: 0 };
      if (ok) toast.success(ok > 1 ? `${ok} fichiers ajoutés` : 'Fichier ajouté', echecs ? `${echecs} envoi${echecs > 1 ? 's' : ''} à reprendre dans la liste.` : undefined);
    }
  }, [maj, toast]);

  const terminer = useCallback(
    (id: string) => {
      actifs.current.delete(id);
      lancerSuivants();
    },
    [lancerSuivants],
  );

  // Prévenir avant de quitter la page pendant un envoi.
  const enCours = envois.some((e) => e.etat === 'envoi' || e.etat === 'attente');
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

  const regles = useRegles().data?.fichiers;
  const extensions = regles?.extensions ?? [];

  const ajouter = (fichiers: FileList | File[]) => {
    for (const file of Array.from(fichiers)) {
      if (file.size === 0) {
        toast.error('Fichier vide', `${file.name} ne contient aucune donnée.`);
        continue;
      }
      // Contrôles faits aussi par le serveur ; ici, ils évitent d'envoyer des gigaoctets pour rien.
      if (regles && file.size > regles.taille_max_mo * 1024 * 1024) {
        toast.error('Fichier trop volumineux', `${file.name} dépasse ${regles.taille_max_mo} Mo, la taille maximale fixée par l’administrateur.`);
        continue;
      }
      const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
      if (extensions.length && !extensions.includes(ext)) {
        toast.error('Type de fichier refusé', `${file.name} : extensions acceptées ${extensions.map((e) => `.${e}`).join(', ')}.`);
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
        onError: (err) => {
          maj(id, { etat: 'erreur', erreur: messageEnvoi(err) });
          lot.current.echecs++;
          terminer(id);
        },
        onSuccess: () => {
          maj(id, { etat: 'termine', octets: file.size });
          lot.current.ok++;
          rafraichirFiche();
          setTimeout(() => retirer(id), 2500);
          terminer(id);
        },
      });
      uploads.current.set(id, upload);
      setEnvois((l) => [...l, { id, nom: file.name, taille: file.size, octets: 0, etat: 'attente' }]);
      // Reprendre un envoi interrompu du même fichier, pour ce même dossier ; puis prendre son tour.
      upload
        .findPreviousUploads()
        .then((precedents) => {
          const p = precedents.find((x) => x.metadata?.dossierId === String(dossierId));
          if (p) upload.resumeFromPreviousUpload(p);
        })
        .catch(() => {})
        .finally(() => {
          if (!uploads.current.has(id)) return; // annulé entre-temps
          fileAttente.current.push(id);
          lancerSuivants();
        });
    }
  };

  // Fichiers choisis dans le formulaire de création : ils partent dès l'arrivée sur la fiche.
  const attenteTraitee = useRef(false);
  useEffect(() => {
    if (attenteTraitee.current) return;
    attenteTraitee.current = true;
    const attente = prendreEnAttente(dossierId);
    if (attente.length) ajouter(attente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossierId]);

  const pause = (id: string) => {
    void uploads.current.get(id)?.abort();
    fileAttente.current = fileAttente.current.filter((x) => x !== id);
    maj(id, { etat: 'pause' });
    terminer(id);
  };
  /** Reprise (pause ou échec) : l'envoi reprend sa place dans la file, en tête. */
  const reprendre = (id: string) => {
    if (!uploads.current.has(id) || actifs.current.has(id)) return;
    fileAttente.current = [id, ...fileAttente.current.filter((x) => x !== id)];
    maj(id, { etat: 'attente', erreur: undefined });
    lancerSuivants();
  };
  const annuler = (id: string) => {
    const u = uploads.current.get(id);
    if (u) void u.abort(true).catch(() => {});
    fileAttente.current = fileAttente.current.filter((x) => x !== id);
    retirer(id);
    terminer(id);
  };
  const toutReprendre = () => envois.filter((e) => e.etat === 'erreur' || e.etat === 'pause').forEach((e) => reprendre(e.id));
  const toutAnnuler = () => envois.filter((e) => e.etat !== 'termine').forEach((e) => annuler(e.id));

  const compte = {
    total: envois.length,
    termines: envois.filter((e) => e.etat === 'termine').length,
    enCours: envois.filter((e) => e.etat === 'envoi').length,
    attente: envois.filter((e) => e.etat === 'attente').length,
    echecs: envois.filter((e) => e.etat === 'erreur').length,
    pause: envois.filter((e) => e.etat === 'pause').length,
  };
  const octetsTotal = envois.reduce((t, e) => t + e.taille, 0);
  const octetsFaits = envois.reduce((t, e) => t + (e.etat === 'termine' ? e.taille : e.octets), 0);

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
        <span className="fi-dropzone__aide">
          {extensions.length ? `Extensions acceptées : ${extensions.map((e) => `.${e}`).join(', ')}.` : 'PDF, images, fichiers de mise en page.'}
          {regles ? ` ${regles.taille_max_mo >= 1024 ? `${String(Math.round((regles.taille_max_mo / 1024) * 10) / 10).replace('.', ',')} Go` : `${regles.taille_max_mo} Mo`} au plus par fichier.` : ''}
          {' '}Autant de fichiers que nécessaire (cinquante, cent…) : ils partent {SIMULTANES} par {SIMULTANES}, un envoi coupé reprend où il s’est arrêté.
        </span>
        <input
          ref={input}
          type="file"
          multiple
          accept={extensions.length ? extensions.map((e) => `.${e}`).join(',') : undefined}
          hidden
          onChange={(e) => {
            if (e.target.files?.length) ajouter(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {envois.length > 1 && (
        <div className="fi-envois-resume" role="status" aria-live="polite">
          <span className="ev-mono">
            {compte.termines} / {compte.total} envoyé{compte.termines > 1 ? 's' : ''}
            {compte.enCours ? ` · ${compte.enCours} en cours` : ''}
            {compte.attente ? ` · ${compte.attente} en attente` : ''}
            {compte.pause ? ` · ${compte.pause} en pause` : ''}
            {compte.echecs ? ` · ${compte.echecs} en échec` : ''}
            {' · '}
            {formatTaille(octetsFaits)} sur {formatTaille(octetsTotal)}
          </span>
          <div
            className="ev-progress"
            role="progressbar"
            aria-label="Progression de l’ensemble des envois"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={octetsTotal ? Math.round((octetsFaits / octetsTotal) * 100) : 0}
            style={{ ['--value' as string]: `${octetsTotal ? Math.round((octetsFaits / octetsTotal) * 100) : 0}%` }}
          >
            <span />
          </div>
          <div className="fi-envois-resume__actions">
            {(compte.echecs > 0 || compte.pause > 0) && (
              <Button size="sm" icon={<RotateCw />} onClick={toutReprendre}>
                Tout reprendre
              </Button>
            )}
            {compte.termines < compte.total && (
              <Button size="sm" icon={<X />} onClick={toutAnnuler}>
                Tout annuler
              </Button>
            )}
          </div>
        </div>
      )}

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
                      ) : e.etat === 'attente' ? (
                        'En attente'
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
