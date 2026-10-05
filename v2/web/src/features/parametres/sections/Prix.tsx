import { useState } from 'react';
import { arrondirHaut, formatDecimal, formatFCFA, type ParamsPrix } from '@evocom/shared';
import { Card, Checkbox, Segmented, TextField } from '../../../ui';
import { nombre, SectionForm, useBrouillon, useSignalerModifie, type SectionProps } from '../form';

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

export function SectionPrix({ p, onModifie }: SectionProps) {
  const { f, setF, modifie, annuler } = useBrouillon(
    () => ({
      arrondi_pas: String(p.prix.arrondi_pas),
      tva_applicable: p.prix.tva_applicable,
      tva_taux: formatDecimal(p.prix.tva_taux),
      prix_saisis_ht: p.prix.prix_saisis_ht,
      surface_min_m2: formatDecimal(p.prix.surface_min_m2),
    }),
    [p.prix],
  );
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  useSignalerModifie(modifie, onModifie);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  const apercu: ParamsPrix = {
    arrondi_pas: Math.max(0, Math.floor(nombre(f.arrondi_pas) ?? 0)),
    tva_applicable: f.tva_applicable,
    tva_taux: nombre(f.tva_taux) ?? 0,
    prix_saisis_ht: f.prix_saisis_ht,
    surface_min_m2: nombre(f.surface_min_m2) ?? 0,
  };

  const verifier = () => {
    const e: Record<string, string> = {};
    const pas = nombre(f.arrondi_pas);
    if (pas === null || !Number.isInteger(pas) || pas < 0 || pas > 10_000) e['prix.arrondi_pas'] = 'Nombre entier de FCFA entre 0 et 10 000.';
    const taux = nombre(f.tva_taux);
    if (taux === null || taux < 0 || taux > 100) e['prix.tva_taux'] = 'Taux entre 0 et 100 %.';
    const surf = nombre(f.surface_min_m2);
    if (surf === null || surf < 0 || surf > 100) e['prix.surface_min_m2'] = 'Surface entre 0 et 100 m².';
    if (Object.keys(e).length) return { erreurs: e };
    return { body: { prix: { arrondi_pas: pas!, tva_applicable: f.tva_applicable, tva_taux: taux!, prix_saisis_ht: f.prix_saisis_ht, surface_min_m2: surf! } } };
  };

  return (
    <SectionForm titre="Prix et TVA" modifie={modifie} verifier={verifier} annuler={annuler} onErreurs={setErreurs}>
      <Card title="Calcul des prix">
        <div className="stack">
          <p className="adm-explain">Ces règles s’appliquent aux nouveaux calculs : estimations, dossiers, devis et factures. Les documents déjà émis ne changent pas.</p>
          <div className="ev-form-grid">
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
                <span className="ev-label">Les prix de la grille sont</span>
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
                <span className="ev-help">{f.prix_saisis_ht ? 'La TVA s’ajoute au prix de la grille.' : 'La TVA est déjà incluse : elle est extraite du total.'}</span>
              </div>
            </div>
          )}
          <div className="adm-example" aria-live="polite">
            <strong>Exemple</strong>
            <br />
            {exemplePrix(apercu)}
            <br />
            {exempleSurface(apercu.surface_min_m2)}
          </div>
        </div>
      </Card>
    </SectionForm>
  );
}
