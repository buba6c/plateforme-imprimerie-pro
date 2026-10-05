import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { formatEntier, formatTaille } from '@evocom/shared';
import { api, messageErreur } from '../../../lib/api';
import { Alert, Button, Card, Dialog, LoadingRows, TextField } from '../../../ui';
import { champsErreur } from '../../admin/hooks';
import { useEtatReinitialisation } from '../api';
import type { BilanReinitialisation, LigneVolume } from '../types';

function Volumes({ lignes, compact }: { lignes: LigneVolume[]; compact?: boolean }) {
  return (
    <ul className={compact ? 'prm-volumes prm-volumes--compact' : 'prm-volumes'}>
      {lignes.map((l) => (
        <li key={l.table}>
          <span>{l.libelle}</span>
          <span className="ev-num">{formatEntier(l.nombre)}</span>
        </li>
      ))}
    </ul>
  );
}

export function SectionZoneDangereuse() {
  const q = useEtatReinitialisation();
  const qc = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [mdp, setMdp] = useState('');
  const [phrase, setPhrase] = useState('');
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [bilan, setBilan] = useState<BilanReinitialisation | null>(null);

  const m = useMutation({
    mutationFn: () => api.post<BilanReinitialisation>('/systeme/reinitialiser', { mot_de_passe: mdp, phrase }),
    onSuccess: (b) => {
      setBilan(b);
      fermer();
      // Toutes les données affichées ont changé.
      qc.invalidateQueries();
    },
    onError: (e) => {
      setErreurs(champsErreur(e));
      setErreur(messageErreur(e));
      setMdp('');
      q.refetch();
    },
  });

  function fermer() {
    setOuvert(false);
    setMdp('');
    setPhrase('');
    setErreurs({});
    setErreur(null);
  }

  if (q.isError) return <Alert tone="error">L’état de la réinitialisation n’a pas pu être chargé : {messageErreur(q.error)}</Alert>;
  if (!q.data) return <LoadingRows rows={3} />;
  const e = q.data;
  const pret = mdp.length > 0 && phrase.trim() === e.phrase_attendue && e.tentatives_restantes > 0;

  return (
    <div className="stack-lg">
      {bilan && (
        <Alert tone="success">
          <strong>La plateforme a été réinitialisée.</strong> Sauvegarde complète : <span className="ev-ref">{bilan.sauvegarde.chemin}</span> (
          {formatTaille(bilan.sauvegarde.taille)}). {formatEntier(bilan.fichiers.deplaces)} fichier{bilan.fichiers.deplaces > 1 ? 's' : ''} déplacé
          {bilan.fichiers.deplaces > 1 ? 's' : ''} dans <span className="ev-ref">{bilan.fichiers.dossier}</span> du stockage
          {bilan.fichiers.absents > 0 && ` (${bilan.fichiers.absents} déjà absent${bilan.fichiers.absents > 1 ? 's' : ''} du disque)`}.{' '}
          {bilan.sessions_fermees} autre{bilan.sessions_fermees > 1 ? 's' : ''} compte{bilan.sessions_fermees > 1 ? 's' : ''} déconnecté
          {bilan.sessions_fermees > 1 ? 's' : ''}.
        </Alert>
      )}

      <Card title="Réinitialiser la plateforme">
        <div className="stack">
          <p className="adm-explain">
            Repart d’une plateforme vide, par exemple après une période d’essai. Une sauvegarde complète de la base est faite d’abord ; si elle échoue, rien
            n’est effacé.
          </p>
          {!e.autorisee ? (
            <Alert tone="warning">
              <strong>La réinitialisation est désactivée sur ce serveur.</strong> Pour l’autoriser, la personne qui administre le serveur ajoute la ligne{' '}
              <span className="ev-ref">{e.variable}=true</span> dans le fichier <span className="ev-ref">.env</span> de l’API, puis redémarre l’API. Remettez{' '}
              <span className="ev-ref">{e.variable}=false</span> une fois l’opération terminée.
            </Alert>
          ) : e.tentatives_restantes === 0 ? (
            <Alert tone="warning">Trois tentatives ont déjà été faites dans l’heure : réessayez plus tard.</Alert>
          ) : null}
          <div className="grid-2">
            <div className="stack-sm">
              <h3 className="section-title">Sera effacé</h3>
              <Volumes lignes={e.ce_qui_est_efface} />
            </div>
            <div className="stack-sm">
              <h3 className="section-title">Sera conservé</h3>
              <Volumes lignes={e.ce_qui_est_conserve} />
            </div>
          </div>
          {e.autorisee && (
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="danger" icon={<RotateCcw />} disabled={e.tentatives_restantes === 0} onClick={() => setOuvert(true)}>
                Réinitialiser la plateforme
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Dialog
        open={ouvert}
        onClose={() => !m.isPending && fermer()}
        title="Réinitialiser la plateforme ?"
        description="Les données ci-dessous sont effacées pour tout le monde. Une sauvegarde complète est faite juste avant ; les fichiers sont déplacés, pas supprimés."
        width={760}
        footer={
          <>
            <Button onClick={fermer} disabled={m.isPending}>
              Annuler
            </Button>
            <Button variant="danger" icon={<RotateCcw />} disabled={!pret} busy={m.isPending} onClick={() => m.mutate()}>
              Effacer les données
            </Button>
          </>
        }
      >
        <form className="stack" onSubmit={(ev) => ev.preventDefault()}>
          {erreur && <Alert tone="error">{erreur}</Alert>}
          <div className="prm-deux">
            <div className="stack-sm">
              <h3 className="section-title">Effacé</h3>
              <Volumes lignes={e.ce_qui_est_efface} compact />
            </div>
            <div className="stack-sm">
              <h3 className="section-title">Conservé</h3>
              <Volumes lignes={e.ce_qui_est_conserve} compact />
            </div>
          </div>
          <TextField
            label="Votre mot de passe"
            type="password"
            autoComplete="current-password"
            value={mdp}
            onChange={(ev) => setMdp(ev.target.value)}
            error={erreurs.mot_de_passe}
            data-autofocus
          />
          <TextField
            label={
              <>
                Recopiez <span className="ev-ref">{e.phrase_attendue}</span>
              </>
            }
            autoComplete="off"
            spellCheck={false}
            mono
            value={phrase}
            onChange={(ev) => setPhrase(ev.target.value)}
            error={erreurs.phrase}
            help={`En majuscules, sans accent. ${e.tentatives_restantes} tentative${e.tentatives_restantes > 1 ? 's' : ''} possible${e.tentatives_restantes > 1 ? 's' : ''} dans l’heure.`}
          />
        </form>
      </Dialog>
    </div>
  );
}
