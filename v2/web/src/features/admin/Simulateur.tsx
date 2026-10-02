// Simulateur de prix : même moteur que le serveur (calculerPrix), sur la grille affichée,
// y compris les prix en cours de saisie, pour voir l'effet d'un changement avant de l'enregistrer.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculerPrix,
  CODE_RECTO_VERSO,
  formatDecimal,
  formatFCFA,
  MACHINE_LABELS,
  PARAMS_PRIX_DEFAUT,
  UNITE_TARIF_LABELS,
  UNITES_DIMENSION,
  type Machine,
  type ParamsPrix,
  type Specs,
  type Tarif as TarifMoteur,
  type UniteDimension,
  type UniteTarif,
} from '@evocom/shared';
import type { Tarif } from '../../lib/types';
import { Alert, Card, Checkbox, Segmented, SelectField, TextField } from '../../ui';

const UNITE_COURTE: Record<UniteTarif, string> = {
  m2: 'm²',
  ml: 'm',
  page: 'face',
  feuille: 'feuille',
  exemplaire: 'ex.',
  unite: 'u.',
  forfait: 'forfait',
  pourcent: '%',
};

function entier(v: string): number | null {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function Simulateur({
  tarifs,
  params,
  paramsIndisponibles,
  brouillons,
  machineInitiale,
}: {
  tarifs: Tarif[];
  params: ParamsPrix | undefined;
  paramsIndisponibles: boolean;
  brouillons: number;
  machineInitiale: Machine;
}) {
  const [machine, setMachine] = useState<Machine>(machineInitiale);
  const initiale = useRef(machineInitiale);
  useEffect(() => {
    if (initiale.current !== machineInitiale) {
      initiale.current = machineInitiale;
      changerMachine(machineInitiale);
    }
  });

  const pour = (cat: Tarif['categorie']) =>
    tarifs.filter((t) => t.actif && t.categorie === cat && (t.machine === machine || t.machine === 'global')).sort((a, b) => a.ordre - b.ordre);
  const supports = pour('support');
  const finitions = pour('finition');
  const options = pour('option').filter((t) => t.code !== CODE_RECTO_VERSO);
  const forfaits = tarifs.filter((t) => t.actif && t.categorie === 'divers' && (t.machine === machine || t.machine === 'global'));

  const [support, setSupport] = useState('');
  const [largeur, setLargeur] = useState('100');
  const [hauteur, setHauteur] = useState('200');
  const [unite, setUnite] = useState<UniteDimension>('cm');
  const [pages, setPages] = useState('10');
  const [rectoVerso, setRectoVerso] = useState(false);
  const [quantite, setQuantite] = useState('1');
  const [fins, setFins] = useState<Record<string, string>>({});
  const [opts, setOpts] = useState<string[]>([]);
  const [forf, setForf] = useState<string[]>([]);

  // Support par défaut : le premier qui a un prix.
  const premier = supports.find((t) => t.prix !== null) ?? supports[0];
  const supportEffectif = supports.some((t) => t.code === support) ? support : (premier?.code ?? '');

  function changerMachine(m: Machine) {
    setMachine(m);
    setSupport('');
    setFins({});
    setOpts([]);
    setForf([]);
  }

  const q = Math.floor(entier(quantite) ?? 0);
  const specs: Specs | null = useMemo(() => {
    const support = supportEffectif;
    if (!support || q <= 0) return null;
    const finitionsChoisies = Object.entries(fins).map(([code, qte]) => {
      const n = Math.floor(entier(qte) ?? 0);
      return n > 0 ? { code, quantite: n } : { code };
    });
    const base = { forfaits: forf.map((code) => ({ code })), remise: null };
    if (machine === 'roland') {
      const l = entier(largeur);
      const h = entier(hauteur);
      if (!l || !h) return null;
      return { ...base, lignes: [{ support, largeur: l, hauteur: h, unite, quantite: q, finitions: finitionsChoisies, options: opts }] };
    }
    const p = Math.floor(entier(pages) ?? 0);
    if (p <= 0) return null;
    return { ...base, lignes: [{ support, pages: p, recto_verso: rectoVerso, quantite: q, finitions: finitionsChoisies, options: opts }] };
  }, [supportEffectif, q, fins, forf, machine, largeur, hauteur, unite, opts, pages, rectoVerso]);

  const resultat = useMemo(() => {
    if (!specs) return null;
    return calculerPrix(machine, specs, tarifs as unknown as TarifMoteur[], params ?? PARAMS_PRIX_DEFAUT);
  }, [machine, specs, tarifs, params]);

  const p = params ?? PARAMS_PRIX_DEFAUT;

  return (
    <Card title="Simulateur de prix" className="adm-sticky">
      <div className="stack">
        <p className="adm-explain">
          Calcul instantané avec la grille ci-contre et les règles de Paramètres : c’est le même calcul que celui des devis et des dossiers.
        </p>
        {brouillons > 0 && (
          <Alert tone="info">
            Le calcul inclut {brouillons} {brouillons > 1 ? 'prix saisis non enregistrés' : 'prix saisi non enregistré'}.
          </Alert>
        )}
        {paramsIndisponibles && <Alert tone="warning">Paramètres de calcul indisponibles : le calcul utilise l’arrondi à 100 FCFA sans TVA, à vérifier.</Alert>}
        <Segmented<Machine>
          name="sim-machine"
          label="Machine"
          value={machine}
          onChange={changerMachine}
          options={[
            { value: 'roland', label: MACHINE_LABELS.roland },
            { value: 'xerox', label: MACHINE_LABELS.xerox },
          ]}
        />
        <SelectField
          label={machine === 'roland' ? 'Support' : 'Format'}
          value={supportEffectif}
          onChange={(e) => setSupport(e.target.value)}
          options={supports.map((s) => ({ value: s.code, label: `${s.libelle}${s.prix === null ? ' (prix à définir)' : ''}` }))}
          placeholder={supports.length ? undefined : 'Aucun support actif'}
        />
        {machine === 'roland' ? (
          <div className="adm-sim-grid">
            <TextField label="Largeur" inputMode="decimal" value={largeur} onChange={(e) => setLargeur(e.target.value)} mono />
            <TextField label="Hauteur" inputMode="decimal" value={hauteur} onChange={(e) => setHauteur(e.target.value)} mono />
            <SelectField
              label="Unité"
              value={unite}
              onChange={(e) => setUnite(e.target.value as UniteDimension)}
              options={UNITES_DIMENSION.map((u) => ({ value: u, label: u }))}
            />
            <TextField label="Exemplaires" inputMode="numeric" value={quantite} onChange={(e) => setQuantite(e.target.value)} mono />
          </div>
        ) : (
          <div className="adm-sim-grid">
            <TextField label="Pages par exemplaire" inputMode="numeric" value={pages} onChange={(e) => setPages(e.target.value)} mono />
            <TextField label="Exemplaires" inputMode="numeric" value={quantite} onChange={(e) => setQuantite(e.target.value)} mono />
            <div style={{ gridColumn: '1 / -1' }}>
              <Checkbox label="Recto-verso" checked={rectoVerso} onChange={setRectoVerso} />
            </div>
          </div>
        )}

        {finitions.length > 0 && (
          <fieldset className="adm-fieldset">
            <legend className="section-title">Finitions</legend>
            <div className="adm-choices">
              {finitions.map((t) => {
                const coche = t.code in fins;
                const avecQte = t.unite === 'unite' || t.unite === 'forfait';
                return (
                  <div key={t.code} className="adm-choice">
                    <Checkbox
                      label={
                        <span>
                          {t.libelle} <span className="ev-muted">· {UNITE_TARIF_LABELS[t.unite as UniteTarif] ?? t.unite}</span>
                        </span>
                      }
                      checked={coche}
                      onChange={(v) =>
                        setFins((f) => {
                          const n = { ...f };
                          if (v) n[t.code] = '';
                          else delete n[t.code];
                          return n;
                        })
                      }
                    />
                    {coche && avecQte && (
                      <input
                        className="ev-input ev-mono"
                        inputMode="numeric"
                        aria-label={`Quantité pour ${t.libelle}`}
                        placeholder={t.unite === 'forfait' ? '1' : String(q || 1)}
                        value={fins[t.code]}
                        onChange={(e) => setFins((f) => ({ ...f, [t.code]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}
        {options.length > 0 && (
          <fieldset className="adm-fieldset">
            <legend className="section-title">Options</legend>
            <div className="adm-choices">
              {options.map((t) => (
                <Checkbox
                  key={t.code}
                  label={t.libelle}
                  checked={opts.includes(t.code)}
                  onChange={(v) => setOpts((o) => (v ? [...o, t.code] : o.filter((c) => c !== t.code)))}
                />
              ))}
            </div>
          </fieldset>
        )}
        {forfaits.length > 0 && (
          <fieldset className="adm-fieldset">
            <legend className="section-title">Forfaits et services</legend>
            <div className="adm-choices">
              {forfaits.map((t) => (
                <Checkbox
                  key={t.code}
                  label={t.libelle}
                  checked={forf.includes(t.code)}
                  onChange={(v) => setForf((o) => (v ? [...o, t.code] : o.filter((c) => c !== t.code)))}
                />
              ))}
            </div>
          </fieldset>
        )}

        <div className="stack-sm" aria-live="polite">
          {!specs ? (
            <p className="ev-muted" style={{ margin: 0, fontSize: 13 }}>
              Choisissez un support et des quantités supérieures à zéro.
            </p>
          ) : resultat && !resultat.ok ? (
            <Alert tone="warning">
              <strong>Prix incalculable</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {resultat.erreurs.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          ) : resultat && resultat.ok ? (
            <>
              <table className="adm-sim-lines">
                <tbody>
                  {resultat.lignes.map((l, i) => (
                    <tr key={`${l.code}-${i}`}>
                      <td>
                        {l.libelle}
                        <span className="adm-sub">
                          {l.unite === 'pourcent'
                            ? 'sur le sous-total'
                            : `${formatDecimal(l.quantite)} ${UNITE_COURTE[l.unite]} × ${formatFCFA(l.prix_unitaire)}`}
                        </span>
                      </td>
                      <td className="ev-num text-right nowrap">{formatFCFA(l.total)}</td>
                    </tr>
                  ))}
                  {resultat.arrondi !== 0 && (
                    <tr>
                      <td className="ev-muted">Arrondi au pas de {formatFCFA(p.arrondi_pas)}</td>
                      <td className="ev-num text-right nowrap">+{formatFCFA(resultat.arrondi)}</td>
                    </tr>
                  )}
                  {p.tva_applicable && (
                    <>
                      <tr>
                        <td className="ev-muted">Total HT</td>
                        <td className="ev-num text-right nowrap">{formatFCFA(resultat.total_ht)}</td>
                      </tr>
                      <tr>
                        <td className="ev-muted">TVA {formatDecimal(p.tva_taux)} %</td>
                        <td className="ev-num text-right nowrap">{formatFCFA(resultat.tva)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
              <div className="adm-sim-total">
                <span>{p.tva_applicable ? 'Total TTC' : 'Total'}</span>
                <strong>{formatFCFA(resultat.total_ttc)}</strong>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
