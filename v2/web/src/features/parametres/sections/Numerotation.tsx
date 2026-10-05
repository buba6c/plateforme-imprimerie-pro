import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Undo2 } from 'lucide-react';
import { api, messageErreur } from '../../../lib/api';
import { Alert, Button, Card, ConfirmDialog, LoadingRows, TextField, useToast } from '../../../ui';
import { champsErreur } from '../../admin/hooks';
import { useNumerotation } from '../api';
import { nombre } from '../form';
import type { Numerotation, Serie } from '../types';

const apercu = (serie: string, annee: number, n: number) => `${serie}-${annee}-${String(n).padStart(4, '0')}`;

export function SectionNumerotation({ onModifie }: { onModifie: (m: boolean) => void }) {
  const q = useNumerotation();
  const qc = useQueryClient();
  const toast = useToast();
  const initial = useMemo(() => Object.fromEntries((q.data?.series ?? []).map((s) => [s.serie, String(s.prochain)])) as Record<Serie, string>, [q.data]);
  const [f, setF] = useState(initial);
  useEffect(() => setF(initial), [initial]);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState<Partial<Record<Serie, number>> | null>(null);
  const modifie = JSON.stringify(f) !== JSON.stringify(initial);
  useEffect(() => onModifie(modifie), [modifie, onModifie]);

  const m = useMutation({
    mutationFn: (body: Partial<Record<Serie, number>>) => api.put<Numerotation>('/systeme/numerotation', body),
    onSuccess: (n) => {
      qc.setQueryData(['systeme', 'numerotation'], n);
      setConfirmer(null);
      setErreurs({});
      setErreur(null);
      toast.success('Numérotation avancée', 'Les prochains documents prendront les nouveaux numéros.');
    },
    onError: (e) => {
      setConfirmer(null);
      const c = champsErreur(e);
      setErreurs(c);
      setErreur(Object.keys(c).length ? 'Un numéro ne peut pas revenir en arrière : corrigez les valeurs signalées.' : messageErreur(e));
    },
  });

  if (q.isError) return <Alert tone="error">La numérotation n’a pas pu être chargée : {messageErreur(q.error)}</Alert>;
  if (!q.data) return <LoadingRows rows={3} />;
  const { annee, series } = q.data;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const body: Partial<Record<Serie, number>> = {};
    for (const s of series) {
      if (f[s.serie] === initial[s.serie]) continue;
      const n = nombre(f[s.serie] ?? '');
      if (n === null || !Number.isInteger(n) || n > 999_999) err[s.serie] = 'Nombre entier attendu (999 999 au plus).';
      else if (n < s.prochain) err[s.serie] = `Au moins ${s.prochain} : ${s.dernier_numero ?? 'ce numéro'} est déjà attribué.`;
      else body[s.serie] = n;
    }
    setErreurs(err);
    if (Object.keys(err).length) {
      setErreur('Un numéro ne peut pas revenir en arrière : corrigez les valeurs signalées.');
      return;
    }
    setErreur(null);
    if (Object.keys(body).length) setConfirmer(body);
  };

  return (
    <form className="stack-lg" onSubmit={submit} noValidate>
      {erreur && <Alert tone="error">{erreur}</Alert>}
      <Card title={`Prochains numéros de ${annee}`}>
        <div className="stack">
          <p className="adm-explain">
            Utile pour reprendre la suite d’un ancien carnet ou d’un autre logiciel. Un numéro peut seulement avancer : il ne revient jamais en dessous du dernier
            numéro attribué, et les numéros sautés ne sont pas réutilisés. Chaque changement est inscrit au journal.
          </p>
          <div className="ev-form-grid">
            {series.map((s) => {
              const n = nombre(f[s.serie] ?? '');
              return (
                <TextField
                  key={s.serie}
                  label={`${s.libelle} (${s.serie})`}
                  inputMode="numeric"
                  mono
                  value={f[s.serie] ?? ''}
                  onChange={(e) => setF({ ...f, [s.serie]: e.target.value })}
                  error={erreurs[s.serie]}
                  help={
                    <>
                      Prochain : <span className="ev-ref">{n && Number.isInteger(n) && n > 0 ? apercu(s.serie, annee, n) : '—'}</span>
                      <br />
                      Dernier attribué : <span className="ev-ref">{s.dernier_numero ?? 'aucun cette année'}</span>
                    </>
                  }
                />
              );
            })}
          </div>
        </div>
      </Card>
      <div className={modifie ? 'adm-savebar adm-savebar--sticky' : 'adm-savebar'}>
        <span className="ev-muted" style={{ fontSize: 13 }}>
          {modifie ? 'Modifications non enregistrées' : 'Tout est enregistré'}
        </span>
        <Button icon={<Undo2 />} disabled={!modifie || m.isPending} onClick={() => (setF(initial), setErreurs({}), setErreur(null))}>
          Annuler les modifications
        </Button>
        <Button type="submit" variant="primary" icon={<Save />} busy={m.isPending} disabled={!modifie}>
          Enregistrer
        </Button>
      </div>
      <ConfirmDialog
        open={!!confirmer}
        onClose={() => setConfirmer(null)}
        onConfirm={() => confirmer && m.mutate(confirmer)}
        busy={m.isPending}
        title="Avancer la numérotation ?"
        description="Ce changement est définitif : la numérotation ne pourra plus revenir en arrière."
        confirmLabel="Avancer la numérotation"
      >
        <ul className="prm-liste">
          {Object.entries(confirmer ?? {}).map(([serie, n]) => (
            <li key={serie}>
              {series.find((s) => s.serie === serie)?.libelle} : prochain numéro <span className="ev-ref">{apercu(serie, annee, n)}</span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </form>
  );
}
