import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { api, messageErreur } from '../../lib/api';
import type { DossierDetail, DossierResume } from '../../lib/types';
import { Button, Dialog, TextareaField, TextField, useToast } from '../../ui';
import { useDossierMutation } from '../dossiers/hooks';
import { jourA, libelleRendezVous, valeurDateHeure } from './dates';

const RACCOURCIS: { label: string; jours: number; heure: number }[] = [
  { label: 'Demain 9 h', jours: 1, heure: 9 },
  { label: 'Demain 15 h', jours: 1, heure: 15 },
  { label: 'Après-demain 9 h', jours: 2, heure: 9 },
];

const MOTIFS = ['Client absent', 'Client injoignable', 'À la demande du client', 'Adresse à préciser'];

/** Nouvelle date de passage pour une livraison de la tournée (POST /dossiers/:id/reporter). */
export function ReporterDialog({ dossier, onClose }: { dossier: Pick<DossierResume, 'id' | 'numero' | 'client_nom' | 'livraison_prevue_at'>; onClose: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(valeurDateHeure(jourA(1, 9)));
  const [motif, setMotif] = useState('');
  const mutation = useDossierMutation((v: { date_prevue: string; motif: string | null }) => api.post<DossierDetail>(`/dossiers/${dossier.id}/reporter`, v));

  const choisie = date ? new Date(date) : null;
  const erreur = !choisie || Number.isNaN(choisie.getTime()) ? 'Choisissez une date et une heure.' : choisie.getTime() <= Date.now() ? 'Choisissez un moment à venir.' : null;

  const valider = () => {
    if (erreur || !choisie) return;
    mutation.mutate(
      { date_prevue: choisie.toISOString(), motif: motif.trim() || null },
      {
        onSuccess: () => {
          toast.success('Livraison reportée', `${dossier.numero} · ${libelleRendezVous(choisie)}`);
          onClose();
        },
        onError: (e) => toast.error('Report impossible', messageErreur(e)),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Reporter la livraison"
      description={
        dossier.livraison_prevue_at
          ? `${dossier.numero} · ${dossier.client_nom}. Prévue jusqu’ici ${libelleRendezVous(dossier.livraison_prevue_at).toLowerCase()}.`
          : `${dossier.numero} · ${dossier.client_nom}.`
      }
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" icon={<CalendarClock />} busy={mutation.isPending} disabled={!!erreur} onClick={valider}>
            Reporter
          </Button>
        </>
      }
    >
      <div className="lv-raccourcis" role="group" aria-label="Dates rapides">
        {RACCOURCIS.map((r) => {
          const v = valeurDateHeure(jourA(r.jours, r.heure));
          return (
            <Button key={r.label} size="sm" aria-pressed={date === v} className={date === v ? 'lv-choisi' : undefined} onClick={() => setDate(v)}>
              {r.label}
            </Button>
          );
        })}
      </div>
      <TextField
        label="Nouvelle date et heure"
        type="datetime-local"
        required
        value={date}
        min={valeurDateHeure(new Date())}
        onChange={(e) => setDate(e.target.value)}
        error={date ? erreur : null}
      />
      <div className="stack-sm">
        <div className="lv-raccourcis" role="group" aria-label="Motifs fréquents">
          {MOTIFS.map((m) => (
            <Button key={m} size="sm" variant="ghost" aria-pressed={motif === m} className={motif === m ? 'lv-choisi' : undefined} onClick={() => setMotif(m)}>
              {m}
            </Button>
          ))}
        </div>
        <TextareaField label="Motif" rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} help="Facultatif. Visible dans l’historique du dossier." />
      </div>
    </Dialog>
  );
}
