import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Undo2 } from 'lucide-react';
import { arrondirHaut, formatDecimal, formatFCFA, type ParamsPrix } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, Card, Checkbox, LoadingRows, PageHeader, Segmented, SelectField, TextareaField, TextField, useToast } from '../../ui';
import { champsErreur, useParametres } from '../../features/admin/hooks';
import type { Parametres as P } from '../../features/admin/types';
import '../../features/admin/admin.css';

const FUSEAUX: { value: string; label: string }[] = [
  { value: 'Africa/Dakar', label: 'Dakar — Sénégal (UTC+0)' },
  { value: 'Africa/Abidjan', label: 'Abidjan — Côte d’Ivoire (UTC+0)' },
  { value: 'Africa/Bamako', label: 'Bamako — Mali (UTC+0)' },
  { value: 'Africa/Conakry', label: 'Conakry — Guinée (UTC+0)' },
  { value: 'Africa/Nouakchott', label: 'Nouakchott — Mauritanie (UTC+0)' },
  { value: 'Africa/Ouagadougou', label: 'Ouagadougou — Burkina Faso (UTC+0)' },
  { value: 'Africa/Lome', label: 'Lomé — Togo (UTC+0)' },
  { value: 'Africa/Casablanca', label: 'Casablanca — Maroc (UTC+1)' },
  { value: 'Africa/Porto-Novo', label: 'Porto-Novo — Bénin (UTC+1)' },
  { value: 'Africa/Niamey', label: 'Niamey — Niger (UTC+1)' },
  { value: 'Africa/Douala', label: 'Douala — Cameroun (UTC+1)' },
  { value: 'Africa/Libreville', label: 'Libreville — Gabon (UTC+1)' },
  { value: 'Africa/Lagos', label: 'Lagos — Nigeria (UTC+1)' },
];

interface Form {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  ninea: string;
  rccm: string;
  pied_facture: string;
  arrondi_pas: string;
  tva_applicable: boolean;
  tva_taux: string;
  prix_saisis_ht: boolean;
  surface_min_m2: string;
  livreur_jours_historique: string;
  fuseau: string;
}

function versForm(p: P): Form {
  return {
    ...p.entreprise,
    arrondi_pas: String(p.prix.arrondi_pas),
    tva_applicable: p.prix.tva_applicable,
    tva_taux: formatDecimal(p.prix.tva_taux),
    prix_saisis_ht: p.prix.prix_saisis_ht,
    surface_min_m2: formatDecimal(p.prix.surface_min_m2),
    livreur_jours_historique: String(p.livreur_jours_historique),
    fuseau: p.fuseau,
  };
}

function nombre(v: string): number | null {
  const s = v.replace(/[\s  ]/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Contrôles locaux ; l'API refait les mêmes et renvoie ses propres messages. */
function verifier(f: Form): { erreurs: Record<string, string>; body: P | null } {
  const e: Record<string, string> = {};
  if (!f.nom.trim()) e['entreprise.nom'] = "Le nom de l'entreprise ne peut pas être vide.";
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e['entreprise.email'] = 'Adresse e-mail invalide.';
  const pas = nombre(f.arrondi_pas);
  if (pas === null || !Number.isInteger(pas) || pas < 0 || pas > 10_000) e['prix.arrondi_pas'] = 'Nombre entier de FCFA entre 0 et 10 000.';
  const taux = nombre(f.tva_taux);
  if (taux === null || taux < 0 || taux > 100) e['prix.tva_taux'] = 'Taux entre 0 et 100 %.';
  const surf = nombre(f.surface_min_m2);
  if (surf === null || surf < 0 || surf > 100) e['prix.surface_min_m2'] = 'Surface entre 0 et 100 m².';
  const jours = nombre(f.livreur_jours_historique);
  if (jours === null || !Number.isInteger(jours) || jours < 1 || jours > 90) e.livreur_jours_historique = 'Nombre entier de jours entre 1 et 90.';
  for (const k of ['nom', 'adresse', 'telephone', 'email', 'ninea', 'rccm', 'pied_facture'] as const) {
    if (f[k].trim().length > 200) e[`entreprise.${k}`] = '200 caractères au maximum.';
  }
  if (Object.keys(e).length) return { erreurs: e, body: null };
  return {
    erreurs: {},
    body: {
      entreprise: {
        nom: f.nom.trim(),
        adresse: f.adresse.trim(),
        telephone: f.telephone.trim(),
        email: f.email.trim(),
        ninea: f.ninea.trim(),
        rccm: f.rccm.trim(),
        pied_facture: f.pied_facture.trim(),
      },
      prix: { arrondi_pas: pas!, tva_applicable: f.tva_applicable, tva_taux: taux!, prix_saisis_ht: f.prix_saisis_ht, surface_min_m2: surf! },
      livreur_jours_historique: jours!,
      fuseau: f.fuseau,
    },
  };
}

function heureDans(fuseau: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, hour: '2-digit', minute: '2-digit', weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date(),
    );
  } catch {
    return '—';
  }
}

const EXEMPLE = 45_230;

function exemplePrix(p: ParamsPrix): string {
  const net = EXEMPLE;
  const pas = p.arrondi_pas > 0 ? ` (arrondi au multiple de ${formatFCFA(p.arrondi_pas)} supérieur)` : ' (sans arrondi)';
  if (p.tva_applicable && p.prix_saisis_ht) {
    const tva = Math.round((net * p.tva_taux) / 100);
    const ttc = arrondirHaut(net + tva, p.arrondi_pas);
    return `Un total de ${formatFCFA(net)} HT devient ${formatFCFA(ttc)} TTC : TVA ${formatDecimal(p.tva_taux)} % de ${formatFCFA(tva)} ajoutée, soit ${formatFCFA(net + tva)}${pas}.`;
  }
  const ttc = arrondirHaut(net, p.arrondi_pas);
  if (p.tva_applicable) {
    const ht = Math.round(ttc / (1 + p.tva_taux / 100));
    return `Un total de ${formatFCFA(net)} devient ${formatFCFA(ttc)} TTC${pas}, dont ${formatFCFA(ttc - ht)} de TVA (${formatFCFA(ht)} HT).`;
  }
  return `Un total de ${formatFCFA(net)} devient ${formatFCFA(ttc)}${pas}. Aucune TVA n’apparaît sur les documents.`;
}

function exempleSurface(min: number): string {
  const reelle = 0.12;
  if (min > reelle) return `Une affiche de 30 × 40 cm (0,12 m²) est facturée ${formatDecimal(min)} m² par exemplaire.`;
  return 'Une affiche de 30 × 40 cm est facturée 0,12 m², sa surface réelle.';
}

export default function Parametres() {
  const q = useParametres();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState<Form | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (q.data && !f) setF(versForm(q.data));
  }, [q.data, f]);

  const origine = useMemo(() => (q.data ? JSON.stringify(versForm(q.data)) : ''), [q.data]);
  const modifie = !!f && JSON.stringify(f) !== origine;

  const m = useMutation({
    mutationFn: (body: P) => api.put<P>('/parametres', body),
    onSuccess: (p) => {
      qc.setQueryData(['parametres'], p);
      qc.invalidateQueries({ queryKey: ['stats'] });
      setF(versForm(p));
      setErreurs({});
      setErreur(null);
      toast.success('Paramètres enregistrés', 'Ils s’appliquent dès maintenant aux nouveaux calculs et documents.');
    },
    onError: (e) => {
      const c = champsErreur(e);
      setErreurs(c);
      setErreur(Object.keys(c).length ? 'Certains champs sont invalides : corrigez-les puis enregistrez de nouveau.' : messageErreur(e));
    },
  });

  if (q.isError) return <Alert tone="error">Les paramètres n’ont pas pu être chargés : {messageErreur(q.error)}</Alert>;
  if (!f) {
    return (
      <>
        <PageHeader title="Paramètres" />
        <LoadingRows rows={8} />
      </>
    );
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const prixApercu: ParamsPrix = {
    arrondi_pas: Math.max(0, Math.floor(nombre(f.arrondi_pas) ?? 0)),
    tva_applicable: f.tva_applicable,
    tva_taux: nombre(f.tva_taux) ?? 0,
    prix_saisis_ht: f.prix_saisis_ht,
    surface_min_m2: nombre(f.surface_min_m2) ?? 0,
  };
  const fuseaux = FUSEAUX.some((z) => z.value === f.fuseau) ? FUSEAUX : [{ value: f.fuseau, label: f.fuseau }, ...FUSEAUX];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = verifier(f);
    setErreurs(v.erreurs);
    if (!v.body) {
      setErreur('Certains champs sont invalides : corrigez-les puis enregistrez de nouveau.');
      return;
    }
    setErreur(null);
    m.mutate(v.body);
  };

  return (
    <form className="stack-lg" onSubmit={submit} noValidate>
      <PageHeader title="Paramètres" subtitle="Coordonnées de l’entreprise, règles de calcul des prix et réglages de l’application." />
      {erreur && <Alert tone="error">{erreur}</Alert>}

      <Card title="Entreprise">
        <div className="stack">
          <p className="adm-explain">Ces informations figurent en en-tête et en pied des devis et des factures PDF.</p>
          <div className="ev-form-grid">
            <TextField
              label="Nom de l’entreprise"
              required
              value={f.nom}
              onChange={(e) => set('nom', e.target.value)}
              error={erreurs['entreprise.nom']}
              maxLength={200}
            />
            <TextField
              label="Téléphone"
              type="tel"
              value={f.telephone}
              onChange={(e) => set('telephone', e.target.value)}
              error={erreurs['entreprise.telephone']}
              maxLength={200}
            />
            <TextField
              label="E-mail"
              type="email"
              value={f.email}
              onChange={(e) => set('email', e.target.value)}
              error={erreurs['entreprise.email']}
              maxLength={200}
            />
          </div>
          <TextField label="Adresse" value={f.adresse} onChange={(e) => set('adresse', e.target.value)} error={erreurs['entreprise.adresse']} maxLength={200} />
          <div className="ev-form-grid">
            <TextField
              label="NINEA"
              mono
              value={f.ninea}
              onChange={(e) => set('ninea', e.target.value)}
              error={erreurs['entreprise.ninea']}
              maxLength={200}
              help="Numéro d’identification fiscale."
            />
            <TextField
              label="RCCM"
              mono
              value={f.rccm}
              onChange={(e) => set('rccm', e.target.value)}
              error={erreurs['entreprise.rccm']}
              maxLength={200}
              help="Registre du commerce."
            />
          </div>
          <TextareaField
            label="Pied de facture"
            rows={2}
            value={f.pied_facture}
            onChange={(e) => set('pied_facture', e.target.value)}
            error={erreurs['entreprise.pied_facture']}
            maxLength={200}
            help={`Mentions affichées en bas de chaque document : conditions de paiement, coordonnées bancaires… (${f.pied_facture.length}/200)`}
          />
        </div>
      </Card>

      <Card title="Calcul des prix">
        <div className="stack">
          <div className="ev-form-grid">
            <div className="stack-sm">
              <TextField
                label="Arrondi du total"
                inputMode="numeric"
                mono
                addon="FCFA"
                value={f.arrondi_pas}
                onChange={(e) => set('arrondi_pas', e.target.value)}
                error={erreurs['prix.arrondi_pas']}
                help="Le total est arrondi vers le haut au multiple de ce montant. 0 = aucun arrondi."
              />
            </div>
            <div className="stack-sm">
              <TextField
                label="Surface minimale facturée"
                inputMode="decimal"
                mono
                addon="m²"
                value={f.surface_min_m2}
                onChange={(e) => set('surface_min_m2', e.target.value)}
                error={erreurs['prix.surface_min_m2']}
                help="Grand format (Roland) : chaque exemplaire est facturé au moins cette surface. 0 = surface réelle."
              />
            </div>
          </div>
          <div className="stack-sm">
            <Checkbox label="Appliquer la TVA" checked={f.tva_applicable} onChange={(v) => set('tva_applicable', v)} />
            <span className="ev-help">Si la TVA est appliquée, elle est calculée et détaillée sur les devis et les factures.</span>
          </div>
          {f.tva_applicable && (
            <div className="ev-form-grid">
              <TextField
                label="Taux de TVA"
                inputMode="decimal"
                mono
                addon="%"
                value={f.tva_taux}
                onChange={(e) => set('tva_taux', e.target.value)}
                error={erreurs['prix.tva_taux']}
              />
              <div className="ev-field">
                <span className="ev-label" id="prix-saisis">
                  Les prix de la grille sont
                </span>
                <Segmented<'ttc' | 'ht'>
                  name="prix_saisis"
                  label="Les prix de la grille sont"
                  value={f.prix_saisis_ht ? 'ht' : 'ttc'}
                  onChange={(v) => set('prix_saisis_ht', v === 'ht')}
                  options={[
                    { value: 'ttc', label: 'TVA comprise (TTC)' },
                    { value: 'ht', label: 'Hors taxes (HT)' },
                  ]}
                />
                <span className="ev-help">
                  {f.prix_saisis_ht ? 'La TVA s’ajoute au prix de la grille.' : 'La TVA est déjà incluse : elle est extraite du total.'}
                </span>
              </div>
            </div>
          )}
          <div className="adm-example" aria-live="polite">
            <strong>Exemple</strong>
            <br />
            {exemplePrix(prixApercu)}
            <br />
            {exempleSurface(prixApercu.surface_min_m2)}
          </div>
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Livraison">
          <TextField
            label="Historique visible par le livreur"
            inputMode="numeric"
            mono
            addon="jours"
            value={f.livreur_jours_historique}
            onChange={(e) => set('livreur_jours_historique', e.target.value)}
            error={erreurs.livreur_jours_historique}
            help="Nombre de jours pendant lesquels un dossier livré et payé reste dans la liste du livreur (1 à 90)."
          />
        </Card>
        <Card title="Fuseau horaire">
          <SelectField
            label="Fuseau de l’entreprise"
            value={f.fuseau}
            onChange={(e) => set('fuseau', e.target.value)}
            options={fuseaux}
            error={erreurs.fuseau}
            help={`Sert à dater les documents et à découper les journées des statistiques. En ce moment : ${heureDans(f.fuseau)}.`}
          />
        </Card>
      </div>

      <div className={modifie ? 'adm-savebar adm-savebar--sticky' : 'adm-savebar'}>
        {modifie ? (
          <span className="ev-muted" style={{ fontSize: 13 }}>
            Modifications non enregistrées
          </span>
        ) : (
          <span className="ev-muted" style={{ fontSize: 13 }}>
            Tout est enregistré
          </span>
        )}
        <Button icon={<Undo2 />} disabled={!modifie || m.isPending} onClick={() => q.data && (setF(versForm(q.data)), setErreurs({}), setErreur(null))}>
          Annuler les modifications
        </Button>
        <Button type="submit" variant="primary" icon={<Save />} busy={m.isPending} disabled={!modifie}>
          Enregistrer les paramètres
        </Button>
      </div>
    </form>
  );
}
