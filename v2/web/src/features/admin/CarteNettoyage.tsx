// « Libérer de l'espace » (Sauvegardes et état) : vider la corbeille (fichiers à la corbeille et fichiers des
// dossiers supprimés) ou effacer les fichiers des commandes finies depuis plus de N mois. Les dossiers restent ;
// seuls leurs fichiers d'impression partent du serveur. Mot de passe et mot SUPPRIMER avant d'agir.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Broom, Trash2 } from 'lucide-react';
import { formatEntier, formatTaille } from '@evocom/shared';
import { api, ApiError, messageErreur } from '../../lib/api';
import { Alert, Button, Dialog, LoadingRows, Segmented, TextField } from '../../ui';
import './sante.css';

type Cible = 'corbeille' | 'anciens';
const MOIS = ['3', '6', '12', '24'] as const;
type Mois = (typeof MOIS)[number];
const MOT = 'SUPPRIMER';

interface Bloc {
  nb: number;
  taille: number;
  dossiers: number;
}
export interface ApercuNettoyage {
  corbeille: Bloc & { fichiers_corbeille: number; dossiers_supprimes: number };
  anciens: Bloc & { mois: number };
  lot_max: number;
}
export interface BilanNettoyage {
  cible: Cible;
  mois: number | null;
  purges: number;
  dossiers: number;
  reste: number;
  supprimes_du_disque: number;
  octets_liberes_maintenant: number;
  octets_partages: number;
  fichiers_partages: number;
  absents: number;
  erreurs: { id: number; nom: string; message: string }[];
}

const fichiers = (n: number) => `${formatEntier(n)} ${n > 1 ? 'fichiers' : 'fichier'}`;
const dossiers = (n: number) => `${formatEntier(n)} ${n > 1 ? 'dossiers' : 'dossier'}`;

export function CarteNettoyage() {
  const qc = useQueryClient();
  const [mois, setMois] = useState<Mois>('6');
  const [dialogue, setDialogue] = useState<Cible | null>(null);
  const q = useQuery({ queryKey: ['nettoyage', mois], queryFn: () => api.get<ApercuNettoyage>('/systeme/nettoyage', { mois }), staleTime: 30_000 });
  const a = q.data;
  const termine = () => {
    void qc.invalidateQueries({ queryKey: ['nettoyage'] });
    void qc.invalidateQueries({ queryKey: ['stockage'] });
    void qc.invalidateQueries({ queryKey: ['sante'] });
    void qc.invalidateQueries({ queryKey: ['dossiers'] });
    void qc.invalidateQueries({ queryKey: ['fichiers'] });
  };

  return (
    <section className="ev-card sante-carte">
      <header className="sante-carte__tete">
        <div className="sante-carte__titre-icone">
          <span className="sante-icone" aria-hidden="true">
            <Broom />
          </span>
          <div>
            <h2 className="ev-card__title">Libérer de l’espace</h2>
            <p className="sante-texte">Efface des fichiers d’impression du serveur. Les dossiers, leurs paiements et leur historique restent.</p>
          </div>
        </div>
      </header>
      <div className="sante-carte__corps">
        {q.isError ? (
          <Alert tone="error">Le calcul n’a pas abouti : {messageErreur(q.error)}</Alert>
        ) : !a ? (
          <LoadingRows rows={3} />
        ) : (
          <div className="stack">
            <div className="nettoyage-bloc" data-tone="corbeille">
              <div className="nettoyage-bloc__texte">
                <strong>Vider la corbeille</strong>
                <span className="sante-discret">
                  {a.corbeille.nb === 0
                    ? 'Rien à la corbeille.'
                    : `${fichiers(a.corbeille.nb)} · ${formatTaille(a.corbeille.taille)} : ${fichiers(a.corbeille.fichiers_corbeille)} mis à la corbeille${
                        a.corbeille.dossiers_supprimes ? ` et les fichiers de ${dossiers(a.corbeille.dossiers_supprimes)} supprimés` : ''
                      }.`}
                </span>
              </div>
              <Button variant="danger" size="sm" icon={<Trash2 />} disabled={a.corbeille.nb === 0} onClick={() => setDialogue('corbeille')}>
                Vider ({formatTaille(a.corbeille.taille)})
              </Button>
            </div>

            <div className="nettoyage-bloc" data-tone="anciens">
              <div className="nettoyage-bloc__texte">
                <strong>Fichiers des commandes finies depuis plus de</strong>
                <Segmented<Mois>
                  name="nettoyage-mois"
                  label="Ancienneté"
                  value={mois}
                  onChange={setMois}
                  options={MOIS.map((m) => ({ value: m, label: `${m} mois` }))}
                />
                <span className="sante-discret">
                  {q.isFetching && !q.data ? 'Calcul…' : a.anciens.nb === 0 ? 'Aucun fichier à effacer pour cette ancienneté.' : `${fichiers(a.anciens.nb)} de ${dossiers(a.anciens.dossiers)} livrés, clôturés ou annulés · ${formatTaille(a.anciens.taille)}.`}
                </span>
              </div>
              <Button variant="danger" size="sm" icon={<Trash2 />} disabled={a.anciens.nb === 0} onClick={() => setDialogue('anciens')}>
                Effacer ({formatTaille(a.anciens.taille)})
              </Button>
            </div>
            <p className="ev-help" style={{ margin: 0 }}>
              Les fichiers partagés avec l’ancienne application ou les sauvegardes disparaissent d’ici, mais la place ne revient qu’après leur fin (environ
              deux semaines). Chaque passage traite au plus {formatEntier(a.lot_max)} fichiers, les plus lourds d’abord.
            </p>
          </div>
        )}
      </div>
      {dialogue && a && (
        <DialogueNettoyage
          cible={dialogue}
          mois={Number(mois)}
          attendu={dialogue === 'corbeille' ? a.corbeille : a.anciens}
          onClose={() => setDialogue(null)}
          onTermine={termine}
        />
      )}
    </section>
  );
}

function DialogueNettoyage({ cible, mois, attendu, onClose, onTermine }: { cible: Cible; mois: number; attendu: Bloc; onClose: () => void; onTermine: () => void }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [mot, setMot] = useState('');
  const [resultat, setResultat] = useState<BilanNettoyage | null>(null);
  const lancer = useMutation({
    mutationFn: () => api.post<BilanNettoyage>('/systeme/nettoyage', { cible, mois, mot_de_passe: motDePasse }),
    onSuccess: (r) => {
      setResultat(r);
      onTermine();
    },
  });
  useEffect(() => lancer.reset(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const erreur = lancer.error;
  const erreurMdp = erreur instanceof ApiError && erreur.champs?.mot_de_passe ? erreur.champs.mot_de_passe : null;
  const pret = motDePasse.length > 0 && mot.trim() === MOT && attendu.nb > 0;
  const titre = cible === 'corbeille' ? 'Vider la corbeille ?' : `Effacer les fichiers des commandes finies depuis plus de ${mois} mois ?`;

  if (resultat) {
    return (
      <Dialog
        open
        onClose={onClose}
        title={resultat.purges > 1 ? `${formatEntier(resultat.purges)} fichiers effacés` : resultat.purges === 1 ? 'Fichier effacé' : 'Rien à effacer'}
        footer={
          <Button variant="primary" onClick={onClose}>
            Fermer
          </Button>
        }
      >
        <div className="stack">
          <dl className="kv">
            <dt>Place libérée tout de suite</dt>
            <dd className="ev-num">{formatTaille(resultat.octets_liberes_maintenant)}</dd>
            <dt>Place libérée plus tard</dt>
            <dd className="ev-num">{formatTaille(resultat.octets_partages)}</dd>
            <dt>Dossiers concernés</dt>
            <dd className="ev-num">{formatEntier(resultat.dossiers)}</dd>
          </dl>
          {resultat.reste > 0 && (
            <Alert tone="info">
              Il reste {fichiers(resultat.reste)} à traiter : relancez l’opération pour continuer.
            </Alert>
          )}
          {resultat.absents > 0 && (
            <p className="ev-muted" style={{ margin: 0 }}>
              {resultat.absents > 1 ? `${resultat.absents} fichiers n’étaient déjà plus sur le disque.` : 'Un fichier n’était déjà plus sur le disque.'}
            </p>
          )}
          {resultat.erreurs.length > 0 && (
            <Alert tone="warning">
              <strong>{resultat.erreurs.length > 1 ? `${resultat.erreurs.length} fichiers sont restés sur le disque :` : 'Un fichier est resté sur le disque :'}</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
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
      open
      onClose={lancer.isPending ? () => {} : onClose}
      title={titre}
      width={560}
      footer={
        <>
          <Button onClick={onClose} disabled={lancer.isPending}>
            Annuler
          </Button>
          <Button variant="danger" icon={<Trash2 />} disabled={!pret} busy={lancer.isPending} onClick={() => lancer.mutate()}>
            {cible === 'corbeille' ? 'Vider la corbeille' : 'Effacer ces fichiers'}
          </Button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (pret && !lancer.isPending) lancer.mutate();
        }}
      >
        <dl className="kv">
          <dt>Fichiers</dt>
          <dd className="ev-num">{formatEntier(attendu.nb)}</dd>
          <dt>Taille</dt>
          <dd className="ev-num">{formatTaille(attendu.taille)}</dd>
          <dt>Dossiers</dt>
          <dd className="ev-num">{formatEntier(attendu.dossiers)}</dd>
        </dl>
        <Alert tone="error">
          Ces fichiers seront <strong>effacés du serveur</strong> : on ne pourra plus les ouvrir, les télécharger ni les restaurer.{' '}
          {cible === 'anciens'
            ? 'Les dossiers restent dans les listes avec leur historique, leurs paiements et une trace des fichiers effacés. Pour réimprimer, il faudra redemander le fichier au client.'
            : 'Les dossiers supprimés restent dans la corbeille et peuvent toujours être restaurés, mais sans leurs fichiers.'}
        </Alert>
        <TextField label="Votre mot de passe" type="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} error={erreurMdp} required data-autofocus />
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
