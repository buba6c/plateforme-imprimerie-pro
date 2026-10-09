import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RotateCcw, Save, Undo2 } from 'lucide-react';
import { messageErreur } from '../../lib/api';
import { Alert, Button, Card, Checkbox, LoadingRows, TextareaField, TextField, useToast } from '../../ui';
import { champsErreur } from '../admin/hooks';
import { useEnregistrerParametresWhatsApp, useParametresWhatsApp } from './api';
import { apercuModele, VARIABLE_LABELS, type EvenementWhatsApp, type ParametresWhatsApp } from './types';

const EVENEMENTS: { id: EvenementWhatsApp; quand: string }[] = [
  { id: 'pret_livraison', quand: 'Quand la commande est marquée imprimée et qu’elle doit être livrée.' },
  { id: 'pret_retrait', quand: 'Quand la commande est marquée imprimée et que le client vient la chercher.' },
  { id: 'en_livraison', quand: 'Quand une livraison est programmée (date prévue).' },
  { id: 'livre', quand: 'Quand la commande est livrée ou remise au client.' },
];

interface Brouillon {
  actif: boolean;
  debut: string;
  fin: string;
  par_heure: string;
  par_jour: string;
  min_s: string;
  max_s: string;
  signature: string;
  modeles: Record<EvenementWhatsApp, string>;
}

function depuis(p: ParametresWhatsApp): Brouillon {
  return {
    actif: p.actif,
    debut: p.heures.debut,
    fin: p.heures.fin,
    par_heure: String(p.limites.par_heure),
    par_jour: String(p.limites.par_jour),
    min_s: String(p.delai.min_s),
    max_s: String(p.delai.max_s),
    signature: p.signature,
    modeles: { ...p.modeles },
  };
}

function entier(v: string, min: number, max: number): number | string {
  const n = Number(v.replace(/\s/g, ''));
  if (v.trim() === '' || !Number.isInteger(n) || n < min || n > max) return `Nombre entier entre ${min} et ${max}.`;
  return n;
}

function Formulaire({ p }: { p: ParametresWhatsApp }) {
  const initial = useMemo(() => depuis(p), [p]);
  const [f, setF] = useState<Brouillon>(initial);
  useEffect(() => setF(initial), [initial]);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useEnregistrerParametresWhatsApp();
  const toast = useToast();
  const modifie = JSON.stringify(f) !== JSON.stringify(initial);
  const maj = (patch: Partial<Brouillon>) => setF((x) => ({ ...x, ...patch }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const parHeure = entier(f.par_heure, 1, 60);
    const parJour = entier(f.par_jour, 1, 500);
    const minS = entier(f.min_s, 5, 600);
    const maxS = entier(f.max_s, 5, 900);
    if (typeof parHeure === 'string') err['limites.par_heure'] = parHeure;
    if (typeof parJour === 'string') err['limites.par_jour'] = parJour;
    if (typeof minS === 'string') err['delai.min_s'] = minS;
    if (typeof maxS === 'string') err['delai.max_s'] = maxS;
    if (typeof minS === 'number' && typeof maxS === 'number' && minS > maxS) err['delai.max_s'] = 'Le délai maximum doit être au moins égal au minimum.';
    if (!/^\d{2}:\d{2}$/.test(f.debut)) err['heures.debut'] = 'Heure au format HH:MM.';
    if (!/^\d{2}:\d{2}$/.test(f.fin)) err['heures.fin'] = 'Heure au format HH:MM.';
    if (!err['heures.debut'] && !err['heures.fin'] && f.debut >= f.fin) err['heures.fin'] = 'L’heure de fin doit être après l’heure de début.';
    for (const ev of EVENEMENTS) {
      const t = f.modeles[ev.id].trim();
      if (t.length < 10) err[`modeles.${ev.id}`] = 'Au moins 10 caractères.';
      else if (t.length > 700) err[`modeles.${ev.id}`] = '700 caractères au maximum.';
    }
    if (Object.keys(err).length) {
      setErreurs(err);
      setErreur('Certains champs sont invalides : corrigez-les puis enregistrez de nouveau.');
      return;
    }
    setErreurs({});
    setErreur(null);
    m.mutate(
      {
        actif: f.actif,
        heures: { debut: f.debut, fin: f.fin },
        limites: { par_heure: parHeure as number, par_jour: parJour as number },
        delai: { min_s: minS as number, max_s: maxS as number },
        signature: f.signature.trim(),
        modeles: Object.fromEntries(EVENEMENTS.map((ev) => [ev.id, f.modeles[ev.id].trim()])) as Record<EvenementWhatsApp, string>,
      },
      {
        onSuccess: () => toast.success('Réglages WhatsApp enregistrés', 'Ils s’appliquent aux prochains messages.'),
        onError: (e) => {
          const c = champsErreur(e);
          setErreurs(c);
          setErreur(Object.keys(c).length ? `Enregistrement refusé : ${Object.values(c).join(' ; ')}` : messageErreur(e));
        },
      },
    );
  };

  return (
    <form className="stack-lg" onSubmit={submit} noValidate>
      {erreur && <Alert tone="error">{erreur}</Alert>}

      <Card title="Envoi automatique">
        <div className="stack">
          <Checkbox label="Envoyer automatiquement un message WhatsApp au client" checked={f.actif} onChange={(v) => maj({ actif: v })} />
          <span className="ev-help prm-aide-check">
            Désactivé : les messages sont quand même tracés dans le journal, marqués « ignoré », pour voir ce qui serait parti.
          </span>
        </div>
      </Card>

      <Card title="Heures et limites">
        <div className="stack">
          <p className="adm-explain">
            Ces garde-fous protègent le numéro : WhatsApp bloque les comptes qui envoient trop, trop vite ou la nuit. En dehors des heures, les messages attendent
            l’ouverture.
          </p>
          <div className="wa-form-grid">
            <TextField label="Début des envois" type="time" value={f.debut} onChange={(e) => maj({ debut: e.target.value })} error={erreurs['heures.debut']} help="Heure de l’entreprise (fuseau des Paramètres)." />
            <TextField label="Fin des envois" type="time" value={f.fin} onChange={(e) => maj({ fin: e.target.value })} error={erreurs['heures.fin']} />
            <TextField label="Messages par heure, au plus" inputMode="numeric" value={f.par_heure} onChange={(e) => maj({ par_heure: e.target.value })} error={erreurs['limites.par_heure']} help="Conseillé : 20." />
            <TextField label="Messages par jour, au plus" inputMode="numeric" value={f.par_jour} onChange={(e) => maj({ par_jour: e.target.value })} error={erreurs['limites.par_jour']} help="Conseillé : 120." />
            <TextField label="Pause minimale entre deux envois" inputMode="numeric" addon="s" value={f.min_s} onChange={(e) => maj({ min_s: e.target.value })} error={erreurs['delai.min_s']} help="La pause réelle est tirée au sort entre le minimum et le maximum." />
            <TextField label="Pause maximale entre deux envois" inputMode="numeric" addon="s" value={f.max_s} onChange={(e) => maj({ max_s: e.target.value })} error={erreurs['delai.max_s']} />
          </div>
        </div>
      </Card>

      <Card title="Textes des messages">
        <div className="stack-lg">
          <div className="stack-sm">
            <p className="adm-explain">
              Écrivez simplement, comme à un client au téléphone. Les mots entre accolades sont remplacés automatiquement. Pas de lien raccourci (bit.ly…) :
              WhatsApp les prend pour du spam.
            </p>
            <div className="wa-variables" aria-label="Variables disponibles">
              {p.variables.map((v) => (
                <code key={v} title={VARIABLE_LABELS[v] ?? v}>{`{${v}}`}</code>
              ))}
            </div>
            <span className="ev-help">
              {p.variables.map((v) => `{${v}} = ${VARIABLE_LABELS[v] ?? v}`).join(' · ')}
            </span>
          </div>
          <TextField
            label="Signature (ajoutée à la fin de chaque message)"
            value={f.signature}
            onChange={(e) => maj({ signature: e.target.value })}
            placeholder="Ex. L’équipe Evocom Print · 33 800 00 00"
            maxLength={120}
          />
          {EVENEMENTS.map((ev) => (
            <div key={ev.id} className="wa-modele">
              <div className="wa-modele__titre">
                <h3>{p.evenements[ev.id]}</h3>
                <Button size="sm" variant="ghost" icon={<RotateCcw />} disabled={f.modeles[ev.id] === p.defauts.modeles[ev.id]} onClick={() => maj({ modeles: { ...f.modeles, [ev.id]: p.defauts.modeles[ev.id] } })}>
                  Texte par défaut
                </Button>
              </div>
              <TextareaField label={ev.quand} rows={3} value={f.modeles[ev.id]} onChange={(e) => maj({ modeles: { ...f.modeles, [ev.id]: e.target.value } })} error={erreurs[`modeles.${ev.id}`]} />
              <div className="wa-apercu">
                <span className="wa-apercu__label">Aperçu avec un exemple</span>
                <div className="wa-bulle">{apercuModele(f.modeles[ev.id], f.signature)}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className={modifie ? 'adm-savebar adm-savebar--sticky' : 'adm-savebar'}>
        <span className="ev-muted" style={{ fontSize: 13 }}>
          {modifie ? 'Modifications non enregistrées' : 'Tout est enregistré'}
        </span>
        <Button
          icon={<Undo2 />}
          disabled={!modifie || m.isPending}
          onClick={() => {
            setF(initial);
            setErreurs({});
            setErreur(null);
          }}
        >
          Annuler
        </Button>
        <Button type="submit" variant="primary" icon={<Save />} busy={m.isPending} disabled={!modifie}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

export function Reglages() {
  const q = useParametresWhatsApp();
  if (q.isLoading) return <LoadingRows rows={6} />;
  if (q.isError || !q.data) return <Alert tone="error">Les réglages n’ont pas pu être lus : {messageErreur(q.error)}</Alert>;
  return <Formulaire p={q.data} />;
}
