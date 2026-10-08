// Fenêtre de suppression définitive : ce qui va se passer en mots simples, mot de passe, mot SUPPRIMER,
// puis le résultat (place libérée maintenant, place qui reviendra plus tard).
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { formatTaille } from '@evocom/shared';
import { api, ApiError, messageErreur } from '../../lib/api';
import { Alert, Button, Dialog, TextField } from '../../ui';
import type { FichierSupprime, ResultatPurge } from './types';

const MOT = 'SUPPRIMER';

export function DialoguePurge({
  open,
  fichiers,
  onClose,
  onTermine,
}: {
  open: boolean;
  fichiers: FichierSupprime[];
  onClose: () => void;
  onTermine: (r: ResultatPurge, ids: number[]) => void;
}) {
  const [motDePasse, setMotDePasse] = useState('');
  const [mot, setMot] = useState('');
  const [resultat, setResultat] = useState<ResultatPurge | null>(null);

  useEffect(() => {
    if (open) {
      setMotDePasse('');
      setMot('');
      setResultat(null);
    }
  }, [open]);

  const nb = fichiers.length;
  const taille = fichiers.reduce((t, f) => t + f.taille, 0);
  const partages = fichiers.filter((f) => f.partage);
  const taillePartagee = partages.reduce((t, f) => t + f.taille, 0);

  const purger = useMutation({
    mutationFn: () => api.post<ResultatPurge>('/gestion-fichiers/purger', { ids: fichiers.map((f) => f.id), mot_de_passe: motDePasse }),
    onSuccess: (r) => {
      setResultat(r);
      onTermine(r, fichiers.map((f) => f.id));
    },
  });
  useEffect(() => {
    if (open) purger.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const erreur = purger.error;
  const erreurMdp = erreur instanceof ApiError && erreur.champs?.mot_de_passe ? erreur.champs.mot_de_passe : null;
  const pret = motDePasse.length > 0 && mot.trim() === MOT && nb > 0;

  if (resultat) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title={resultat.purges > 1 ? `${resultat.purges} fichiers supprimés définitivement` : 'Fichier supprimé définitivement'}
        footer={
          <Button variant="primary" onClick={onClose}>
            Fermer
          </Button>
        }
      >
        <div className="stack">
          <dl className="fa-bilan">
            <div>
              <dt>Place libérée tout de suite</dt>
              <dd className="ev-num">{formatTaille(resultat.octets_liberes_maintenant)}</dd>
            </div>
            <div>
              <dt>Place libérée plus tard</dt>
              <dd className="ev-num">{formatTaille(resultat.octets_partages)}</dd>
            </div>
          </dl>
          {resultat.octets_partages > 0 && (
            <p className="ev-muted" style={{ margin: 0 }}>
              {resultat.fichiers_partages > 1 ? `${resultat.fichiers_partages} fichiers étaient partagés` : 'Un fichier était partagé'} avec l’ancienne
              application ou les sauvegardes : ils ont disparu d’ici, mais la place ne reviendra qu’après l’arrêt de l’ancienne application et la fin des
              anciennes sauvegardes.
            </p>
          )}
          {resultat.absents > 0 && (
            <p className="ev-muted" style={{ margin: 0 }}>
              {resultat.absents > 1 ? `${resultat.absents} fichiers n’étaient déjà plus sur le disque.` : 'Un fichier n’était déjà plus sur le disque.'}
            </p>
          )}
          {resultat.erreurs.length > 0 && (
            <Alert tone="warning">
              <strong>
                {resultat.erreurs.length > 1 ? `${resultat.erreurs.length} fichiers sont restés sur le disque :` : 'Un fichier est resté sur le disque :'}
              </strong>
              <ul className="fa-bilan__erreurs">
                {resultat.erreurs.slice(0, 20).map((e) => (
                  <li key={e.id}>
                    « {e.nom} » : {e.message}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={purger.isPending ? () => {} : onClose}
      title={nb > 1 ? `Supprimer définitivement ${nb} fichiers ?` : 'Supprimer définitivement ce fichier ?'}
      width={560}
      footer={
        <>
          <Button onClick={onClose} disabled={purger.isPending}>
            Annuler
          </Button>
          <Button variant="danger" icon={<Trash2 />} disabled={!pret} busy={purger.isPending} onClick={() => purger.mutate()}>
            Supprimer définitivement ({nb})
          </Button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (pret && !purger.isPending) purger.mutate();
        }}
      >
        <dl className="fa-bilan">
          <div>
            <dt>Fichiers</dt>
            <dd className="ev-num">{nb}</dd>
          </div>
          <div>
            <dt>Taille</dt>
            <dd className="ev-num">{formatTaille(taille)}</dd>
          </div>
        </dl>
        <Alert tone="error">
          Ces fichiers seront <strong>effacés du serveur</strong>. On ne pourra plus les ouvrir, les télécharger ni les restaurer. La commande garde une trace
          de leur nom.
        </Alert>
        {partages.length > 0 && (
          <Alert tone="info">
            <strong>
              {partages.length > 1 ? `${partages.length} de ces fichiers (${formatTaille(taillePartagee)}) sont partagés` : `Un de ces fichiers (${formatTaille(taillePartagee)}) est partagé`}
            </strong>{' '}
            avec l’ancienne application ou les sauvegardes : ce sont les mêmes fichiers, rangés à deux endroits. Ils disparaîtront d’ici, mais la place ne
            sera libérée qu’après l’arrêt de l’ancienne application et la fin des sauvegardes qui les contiennent (environ deux semaines). Place libérée tout
            de suite : environ {formatTaille(taille - taillePartagee)}.
          </Alert>
        )}
        <TextField
          label="Votre mot de passe"
          type="password"
          autoComplete="current-password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          error={erreurMdp}
          required
          data-autofocus
        />
        <TextField
          label={`Pour confirmer, tapez ${MOT}`}
          value={mot}
          onChange={(e) => setMot(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          help={mot && mot.trim() !== MOT ? `Tapez exactement ${MOT}, en majuscules.` : undefined}
        />
        {erreur && !erreurMdp && <Alert tone="error">{messageErreur(erreur)}</Alert>}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}
