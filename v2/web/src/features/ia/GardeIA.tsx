// Garde IA (Administration > Assistant IA) : plafonds de consommation de l'assistant et jauges du jour
// et du mois. Au-delà d'un plafond, l'assistant se met en pause tout seul ; l'application continue
// avec ses réglages automatiques. Les administrateurs sont prévenus au seuil d'alerte.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { formatEntier } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, Card, Checkbox, LoadingRows, TextField, useToast } from '../../ui';

interface Garde {
  active: boolean;
  jetons_jour: number;
  jetons_mois: number;
  appels_jour: number;
  appels_utilisateur_jour: number;
  alerte_pct: number;
}
interface Reponse {
  garde: Garde & { updated_at: string | null; updated_by_nom: string | null };
  consommation: { jour: { jetons: number; appels: number }; mois: { jetons: number; appels: number } };
}

function Jauge({ libelle, valeur, plafond, alerte, unite }: { libelle: string; valeur: number; plafond: number; alerte: number; unite: string }) {
  const pct = plafond > 0 ? Math.min(100, Math.round((valeur / plafond) * 100)) : 0;
  const ton = plafond > 0 && pct >= 100 ? 'ko' : plafond > 0 && pct >= alerte ? 'warn' : undefined;
  return (
    <div className="stack-sm" style={{ gap: 4 }}>
      <div className="row-between" style={{ fontSize: 13 }}>
        <strong>{libelle}</strong>
        <span className="ev-muted ev-num">
          {formatEntier(valeur)} {plafond > 0 ? `/ ${formatEntier(plafond)}` : ''} {unite} {plafond > 0 ? `· ${pct} %` : '· sans plafond'}
        </span>
      </div>
      <div className="adm-meter" data-tone={ton} role="meter" aria-label={libelle} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function GardeIA() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['ia', 'garde'], queryFn: () => api.get<Reponse>('/ia/garde'), refetchInterval: 60_000 });
  const [f, setF] = useState<Record<keyof Omit<Garde, 'active'>, string> & { active: boolean } | null>(null);
  useEffect(() => {
    if (q.data && !f) {
      const g = q.data.garde;
      setF({ active: g.active, jetons_jour: String(g.jetons_jour), jetons_mois: String(g.jetons_mois), appels_jour: String(g.appels_jour), appels_utilisateur_jour: String(g.appels_utilisateur_jour), alerte_pct: String(g.alerte_pct) });
    }
  }, [q.data, f]);
  const enregistrer = useMutation({
    mutationFn: (b: Partial<Garde>) => api.put<Reponse>('/ia/garde', b),
    onSuccess: (r) => {
      qc.setQueryData(['ia', 'garde'], r);
      toast.success('Garde IA enregistrée', r.garde.active ? 'Plafonds appliqués à chaque appel.' : 'Garde désactivée : aucun plafond.');
    },
    onError: (e) => toast.error('Garde non enregistrée', messageErreur(e)),
  });
  if (q.isError) return <Alert tone="error">La garde IA n’a pas pu être chargée : {messageErreur(q.error)}</Alert>;
  if (!q.data || !f) return <LoadingRows rows={3} />;
  const g = q.data.garde;
  const c = q.data.consommation;
  const n = (v: string) => Math.max(0, Math.round(Number(v.replace(/\s/g, '')) || 0));
  return (
    <Card
      title={
        <span className="row" style={{ gap: 8 }}>
          <ShieldCheck aria-hidden="true" width={18} height={18} /> Garde IA
        </span>
      }
      actions={<span className="ev-badge ev-pay" data-pay={g.active ? 'paye' : 'non_paye'}>{g.active ? 'Active' : 'Désactivée'}</span>}
    >
      <div className="stack">
        <p className="adm-explain" style={{ margin: 0 }}>
          Protège le quota de votre compte IA. Au-delà d’un plafond, l’assistant se met en pause jusqu’au lendemain (ou au mois suivant) : l’application continue
          avec ses réglages automatiques. Une même demande n’est jamais facturée deux fois (réponses réutilisées 24 h). Les administrateurs sont prévenus au seuil
          d’alerte.
        </p>
        <div className="stack-sm">
          <Jauge libelle="Aujourd’hui" valeur={c.jour.jetons} plafond={g.active ? g.jetons_jour : 0} alerte={g.alerte_pct} unite="jetons" />
          <Jauge libelle="Ce mois-ci" valeur={c.mois.jetons} plafond={g.active ? g.jetons_mois : 0} alerte={g.alerte_pct} unite="jetons" />
          <Jauge libelle="Appels aujourd’hui" valeur={c.jour.appels} plafond={g.active ? g.appels_jour : 0} alerte={g.alerte_pct} unite="appels" />
        </div>
        <Checkbox label="Activer la garde (plafonds appliqués à chaque appel)" checked={f.active} onChange={(active) => setF({ ...f, active })} />
        <div className="ev-form-grid">
          <TextField label="Jetons par jour" inputMode="numeric" mono value={f.jetons_jour} onChange={(e) => setF({ ...f, jetons_jour: e.target.value })} help="0 = sans plafond. Une proposition coûte environ 1 500 à 3 000 jetons." />
          <TextField label="Jetons par mois" inputMode="numeric" mono value={f.jetons_mois} onChange={(e) => setF({ ...f, jetons_mois: e.target.value })} help="Avec GPT-4o mini, 3 millions de jetons coûtent moins d’un dollar." />
          <TextField label="Appels par jour (toute l’équipe)" inputMode="numeric" mono value={f.appels_jour} onChange={(e) => setF({ ...f, appels_jour: e.target.value })} />
          <TextField label="Appels par personne et par jour" inputMode="numeric" mono value={f.appels_utilisateur_jour} onChange={(e) => setF({ ...f, appels_utilisateur_jour: e.target.value })} />
          <TextField label="Alerte aux administrateurs à" inputMode="numeric" mono addon="%" value={f.alerte_pct} onChange={(e) => setF({ ...f, alerte_pct: e.target.value })} help="Une notification par jour et par mois au plus." />
        </div>
        <div className="row">
          <Button
            variant="primary"
            busy={enregistrer.isPending}
            onClick={() =>
              enregistrer.mutate({
                active: f.active,
                jetons_jour: n(f.jetons_jour),
                jetons_mois: n(f.jetons_mois),
                appels_jour: n(f.appels_jour),
                appels_utilisateur_jour: n(f.appels_utilisateur_jour),
                alerte_pct: Math.min(100, Math.max(10, n(f.alerte_pct))),
              })
            }
          >
            Enregistrer la garde
          </Button>
          {g.updated_at && <span className="ev-muted" style={{ fontSize: 12 }}>Modifiée {g.updated_by_nom ? `par ${g.updated_by_nom}` : ''}</span>}
        </div>
      </div>
    </Card>
  );
}
