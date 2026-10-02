// Éditeur de spécifications d'impression, partagé par le dossier et le devis.
// Roland : support, dimensions, quantité, finitions, options. Xerox : format, pages,
// recto-verso, exemplaires, finitions, options. Plus les forfaits du dossier et la remise.

import { useId, useMemo } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import {
  formatDecimal,
  formatEntier,
  UNITES_DIMENSION,
  type ErreurPrix,
  type Machine,
  type ParamsPrix,
  type ResultatPrix,
  type UniteDimension,
} from '@evocom/shared';
import type { Tarif } from '../../lib/types';
import { Button, Checkbox, IconButton } from '../../ui';
import {
  lignesDe,
  lireEntier,
  ligneRolandVide,
  ligneXeroxVide,
  nouvelleCle,
  surfaceLigne,
  type ChoixDraft,
  type Conversion,
  type LigneRolandDraft,
  type LigneXeroxDraft,
  type SpecsDraft,
} from './draft';
import { suffixeUnite } from './PrixPanel';
import './specs.css';

export interface SpecsEditorProps {
  machine: Machine;
  value: SpecsDraft;
  onChange: (v: SpecsDraft) => void;
  tarifs: Tarif[] | undefined;
  params: ParamsPrix;
  /** Erreurs par chemin (« lignes.0.largeur »), affichées sous les champs. */
  erreurs?: Record<string, string>;
  /** Résultat du calcul en direct, pour le total de chaque ligne. */
  resultat?: ResultatPrix | ErreurPrix | null;
  conversion?: Conversion;
  /** Proposer les modèles rapides. */
  modeles?: boolean;
}

interface Modele {
  id: string;
  machine: Machine;
  label: string;
  roland?: Partial<LigneRolandDraft>;
  xerox?: Partial<LigneXeroxDraft>;
}

// Modèles repris de l'ancienne plateforme ; proposés seulement si le support existe dans la grille.
const MODELES: Modele[] = [
  { id: 'bache', machine: 'roland', label: 'Bâche 300 × 100 cm', roland: { support: 'bache_m2', largeur: '300', hauteur: '100', unite: 'cm', quantite: '1', description: 'Découpé, tous les côtés' } },
  { id: 'vitrine', machine: 'roland', label: 'Vinyle vitrine 200 × 80 cm', roland: { support: 'vinyle_m2', largeur: '200', hauteur: '80', unite: 'cm', quantite: '1', description: 'Collage' } },
  { id: 'cdv', machine: 'xerox', label: 'Cartes de visite', xerox: { support: 'carte_visite', pages: '1', recto_verso: true, quantite: '100', description: '350 g, pelliculage mat recto-verso' } },
  { id: 'flyer', machine: 'xerox', label: 'Flyers A5', xerox: { support: 'papier_a5_couleur', pages: '1', recto_verso: false, quantite: '1000', description: '170 g' } },
  { id: 'brochure', machine: 'xerox', label: 'Brochure A4 piquée', xerox: { support: 'papier_a4_couleur', pages: '', recto_verso: true, quantite: '200', description: '170 g, piquée' } },
];

function prixTexte(t: Tarif): string {
  if (t.prix === null) return 'prix à définir';
  if (t.unite === 'pourcent') return `+${t.prix} %`;
  return `${formatEntier(t.prix)} FCFA${suffixeUnite(t.unite)}`;
}

function estVide(machine: Machine, l: LigneRolandDraft | LigneXeroxDraft): boolean {
  if (machine === 'roland') {
    const r = l as LigneRolandDraft;
    return !r.support && !r.largeur && !r.hauteur && !r.finitions.length && !r.options.length && !r.description;
  }
  const x = l as LigneXeroxDraft;
  return !x.support && !x.quantite && !x.finitions.length && !x.options.length && !x.description;
}

export function SpecsEditor({ machine, value, onChange, tarifs, params, erreurs = {}, resultat, conversion, modeles = true }: SpecsEditorProps) {
  const actifs = useMemo(() => (tarifs ?? []).filter((t) => t.actif).sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, 'fr')), [tarifs]);
  const parCat = useMemo(() => {
    const pour = (cat: Tarif['categorie']) => actifs.filter((t) => t.machine === machine && t.categorie === cat);
    return {
      support: pour('support'),
      finition: pour('finition'),
      option: pour('option'),
      divers: actifs.filter((t) => (t.machine === 'global' || t.machine === machine) && t.categorie === 'divers'),
    };
  }, [actifs, machine]);

  const lignes = lignesDe(machine, value);
  const setLignes = (ls: (LigneRolandDraft | LigneXeroxDraft)[]) =>
    onChange(machine === 'roland' ? { ...value, roland: ls as LigneRolandDraft[] } : { ...value, xerox: ls as LigneXeroxDraft[] });
  const majLigne = (i: number, patch: Partial<LigneRolandDraft & LigneXeroxDraft>) => setLignes(lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const ajouter = () => setLignes([...lignes, machine === 'roland' ? ligneRolandVide() : ligneXeroxVide()]);
  const dupliquer = (i: number) => {
    const src = lignes[i];
    if (!src) return;
    const copie = { ...src, key: nouvelleCle(), finitions: src.finitions.map((f) => ({ ...f })), options: [...src.options] };
    setLignes([...lignes.slice(0, i + 1), copie, ...lignes.slice(i + 1)]);
  };
  const retirer = (i: number) => setLignes(lignes.filter((_, j) => j !== i));

  const modelesDispo = modeles
    ? MODELES.filter((m) => m.machine === machine && parCat.support.some((t) => t.code === (m.roland?.support ?? m.xerox?.support)))
    : [];
  const appliquerModele = (m: Modele) => {
    const base = machine === 'roland' ? { ...ligneRolandVide(), ...m.roland } : { ...ligneXeroxVide(), ...m.xerox };
    const derniere = lignes[lignes.length - 1];
    if (derniere && estVide(machine, derniere)) setLignes([...lignes.slice(0, -1), base]);
    else setLignes([...lignes, base]);
  };

  // Total calculé par ligne d'origine (les lignes incomplètes ne sont pas dans l'aperçu).
  const totalLigne = (i: number): number | null => {
    if (!resultat || !resultat.ok || !conversion || conversion.incompletes.includes(i)) return null;
    const g = i - conversion.incompletes.filter((k) => k < i).length;
    return resultat.lignes.filter((l) => l.groupe === g).reduce((s, l) => s + l.total, 0);
  };

  const err = (i: number, champ: string) => erreurs[`lignes.${i}.${champ}`] ?? null;

  return (
    <div className="sp-editor">
      {modelesDispo.length > 0 && (
        <div className="sp-modeles">
          <span className="ev-muted">Modèles rapides</span>
          {modelesDispo.map((m) => (
            <Button key={m.id} size="sm" variant="ghost" icon={<Plus />} onClick={() => appliquerModele(m)}>
              {m.label}
            </Button>
          ))}
        </div>
      )}

      {lignes.length === 0 && (
        <div className="sp-aucune">
          <p className="ev-muted" style={{ margin: 0 }}>
            Aucune ligne. Ajoutez {machine === 'roland' ? 'un support avec ses dimensions' : 'un format avec le nombre de pages et d’exemplaires'} pour calculer le prix.
          </p>
        </div>
      )}

      {lignes.map((l, i) => (
        <fieldset key={l.key} className="sp-ligne">
          <legend className="sr-only">Ligne {i + 1}</legend>
          <div className="sp-ligne__head">
            <span className="sp-ligne__num ev-mono">{String(i + 1).padStart(2, '0')}</span>
            <span className="sp-ligne__titre">Ligne {i + 1}</span>
            <span className="grow" />
            {totalLigne(i) !== null && <span className="ev-num sp-ligne__total">{formatEntier(totalLigne(i)!)} FCFA</span>}
            <IconButton label={`Dupliquer la ligne ${i + 1}`} size="sm" onClick={() => dupliquer(i)}>
              <Copy />
            </IconButton>
            <IconButton label={`Supprimer la ligne ${i + 1}`} size="sm" onClick={() => retirer(i)}>
              <Trash2 />
            </IconButton>
          </div>
          {machine === 'roland' ? (
            <LigneRoland l={l as LigneRolandDraft} i={i} supports={parCat.support} maj={(p) => majLigne(i, p)} err={(c) => err(i, c)} params={params} />
          ) : (
            <LigneXerox l={l as LigneXeroxDraft} i={i} supports={parCat.support} maj={(p) => majLigne(i, p)} err={(c) => err(i, c)} />
          )}
          <Choix
            titre="Finitions"
            tarifs={parCat.finition}
            valeur={l.finitions}
            avecQuantite={(t) => t.unite === 'unite'}
            aideQuantite={machine === 'roland' ? 'Nombre (par défaut : 1 par exemplaire)' : 'Nombre'}
            onChange={(finitions) => majLigne(i, { finitions })}
            erreur={err(i, 'finitions')}
          />
          <Choix
            titre="Options"
            tarifs={parCat.option.filter((t) => !(machine === 'xerox' && t.code === 'impression_recto_verso'))}
            valeur={l.options.map((code) => ({ code, quantite: '' }))}
            onChange={(c) => majLigne(i, { options: c.map((x) => x.code) })}
          />
          <ChampTexte
            label="Précisions"
            value={l.description}
            onChange={(description) => majLigne(i, { description })}
            placeholder={machine === 'roland' ? 'Pose, emplacement des œillets, sens de lecture…' : 'Grammage, type de papier, façonnage, numérotation…'}
            erreur={err(i, 'description')}
          />
        </fieldset>
      ))}

      <div>
        <Button size="sm" icon={<Plus />} onClick={ajouter}>
          Ajouter une ligne
        </Button>
      </div>

      {parCat.divers.length > 0 && (
        <div className="sp-bloc">
          <Choix
            titre="Forfaits et services du dossier"
            tarifs={parCat.divers}
            valeur={value.forfaits}
            onChange={(forfaits) => onChange({ ...value, forfaits })}
            erreur={erreurs.forfaits ?? null}
          />
        </div>
      )}

      <div className="sp-bloc">
        <Checkbox
          label="Accorder une remise"
          checked={!!value.remise}
          onChange={(v) => onChange({ ...value, remise: v ? { type: 'pourcent', valeur: '', motif: '' } : null })}
        />
        {value.remise && (
          <div className="sp-remise">
            <ChampSelect
              label="Type de remise"
              value={value.remise.type}
              onChange={(type) => onChange({ ...value, remise: { ...value.remise!, type: type as 'montant' | 'pourcent' } })}
              options={[
                { value: 'pourcent', label: 'Pourcentage' },
                { value: 'montant', label: 'Montant en FCFA' },
              ]}
            />
            <ChampTexte
              label="Valeur"
              value={value.remise.valeur}
              onChange={(valeur) => onChange({ ...value, remise: { ...value.remise!, valeur } })}
              addon={value.remise.type === 'pourcent' ? '%' : 'FCFA'}
              inputMode="decimal"
              mono
              erreur={erreurs['remise.valeur'] ?? erreurs.remise ?? null}
            />
            <ChampTexte label="Motif" value={value.remise.motif} onChange={(motif) => onChange({ ...value, remise: { ...value.remise!, motif } })} placeholder="Client fidèle, geste commercial…" />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function optionsSupport(supports: Tarif[], code: string) {
  const opts = supports.map((t) => ({
    value: t.code,
    label: `${t.libelle} · ${t.prix === null ? 'prix à définir' : `${formatEntier(t.prix)}${suffixeUnite(t.unite)}`}`,
  }));
  if (code && !supports.some((t) => t.code === code)) opts.unshift({ value: code, label: `${code} (retiré de la grille)` });
  return opts;
}

function LigneRoland({ l, i, supports, maj, err, params }: {
  l: LigneRolandDraft; i: number; supports: Tarif[]; maj: (p: Partial<LigneRolandDraft>) => void; err: (c: string) => string | null; params: ParamsPrix;
}) {
  const s = surfaceLigne(l);
  const q = lireEntier(l.quantite);
  const min = params.surface_min_m2 > 0 && s && s.unitaire < params.surface_min_m2;
  return (
    <>
      <div className="sp-grid sp-grid--roland">
        <ChampSelect
          className="sp-col-support"
          label="Support"
          required
          value={l.support}
          onChange={(support) => maj({ support })}
          options={optionsSupport(supports, l.support)}
          placeholder="Choisir un support"
          erreur={err('support')}
        />
        <ChampTexte label="Largeur" required value={l.largeur} onChange={(largeur) => maj({ largeur })} inputMode="decimal" mono erreur={err('largeur')} />
        <ChampTexte label="Hauteur" required value={l.hauteur} onChange={(hauteur) => maj({ hauteur })} inputMode="decimal" mono erreur={err('hauteur')} />
        <ChampSelect
          label="Unité"
          value={l.unite}
          onChange={(u) => maj({ unite: u as UniteDimension })}
          options={UNITES_DIMENSION.map((u) => ({ value: u, label: u }))}
        />
        <ChampTexte label="Quantité" required value={l.quantite} onChange={(quantite) => maj({ quantite })} inputMode="numeric" mono addon="ex." erreur={err('quantite')} />
      </div>
      <p className="sp-calcul ev-mono" aria-live="polite" id={`surface-${i}`}>
        {s ? (
          <>
            Surface {formatDecimal(s.unitaire, 2)} m²{q > 1 ? ` × ${formatEntier(q)} = ${formatDecimal(s.totale, 2)} m²` : ''}
            {min ? ` · minimum facturé ${formatDecimal(params.surface_min_m2, 2)} m² par exemplaire` : ''}
          </>
        ) : (
          'Surface calculée dès que largeur et hauteur sont saisies'
        )}
      </p>
    </>
  );
}

function LigneXerox({ l, supports, maj, err }: {
  l: LigneXeroxDraft; i: number; supports: Tarif[]; maj: (p: Partial<LigneXeroxDraft>) => void; err: (c: string) => string | null;
}) {
  const pages = lireEntier(l.pages);
  const ex = lireEntier(l.quantite);
  const ok = pages > 0 && ex > 0;
  return (
    <>
      <div className="sp-grid sp-grid--xerox">
        <ChampSelect
          className="sp-col-support"
          label="Format et papier"
          required
          value={l.support}
          onChange={(support) => maj({ support })}
          options={optionsSupport(supports, l.support)}
          placeholder="Choisir un format"
          erreur={err('support')}
        />
        <ChampTexte label="Pages par exemplaire" required value={l.pages} onChange={(p) => maj({ pages: p })} inputMode="numeric" mono erreur={err('pages')} />
        <ChampTexte label="Exemplaires" required value={l.quantite} onChange={(quantite) => maj({ quantite })} inputMode="numeric" mono erreur={err('quantite')} />
        <div className="sp-rv">
          <Checkbox label="Recto-verso" checked={l.recto_verso} onChange={(recto_verso) => maj({ recto_verso })} />
        </div>
      </div>
      <p className="sp-calcul ev-mono" aria-live="polite">
        {ok
          ? `${formatEntier(pages * ex)} face${pages * ex > 1 ? 's' : ''} imprimée${pages * ex > 1 ? 's' : ''} · ${formatEntier(Math.ceil(pages / (l.recto_verso ? 2 : 1)) * ex)} feuilles`
          : 'Faces imprimées calculées dès que pages et exemplaires sont saisis'}
      </p>
    </>
  );
}

function Choix({ titre, tarifs, valeur, onChange, avecQuantite, aideQuantite, erreur }: {
  titre: string;
  tarifs: Tarif[];
  valeur: ChoixDraft[];
  onChange: (v: ChoixDraft[]) => void;
  avecQuantite?: (t: Tarif) => boolean;
  aideQuantite?: string;
  erreur?: string | null;
}) {
  const id = useId();
  const codes = new Set(valeur.map((v) => v.code));
  const inconnus = valeur.filter((v) => !tarifs.some((t) => t.code === v.code));
  if (!tarifs.length && !inconnus.length) return null;
  const basculer = (code: string, on: boolean) => onChange(on ? [...valeur, { code, quantite: '' }] : valeur.filter((v) => v.code !== code));
  return (
    <div className="sp-choix" role="group" aria-labelledby={`${id}-t`}>
      <span className="sp-choix__titre" id={`${id}-t`}>
        {titre}
      </span>
      <div className="sp-choix__liste">
        {tarifs.map((t) => {
          const on = codes.has(t.code);
          const v = valeur.find((x) => x.code === t.code);
          return (
            <span key={t.code} className="sp-pill-groupe">
              <label className="sp-pill" data-on={on}>
                <input type="checkbox" checked={on} onChange={(e) => basculer(t.code, e.target.checked)} />
                <span className="ev-check__box" aria-hidden="true" />
                <span>{t.libelle}</span>
                <span className="sp-pill__prix" data-manquant={t.prix === null}>
                  {prixTexte(t)}
                </span>
              </label>
              {on && avecQuantite?.(t) && (
                <input
                  className="ev-input ev-mono sp-pill__qte"
                  inputMode="numeric"
                  aria-label={`Nombre : ${t.libelle}`}
                  title={aideQuantite}
                  placeholder="Nb"
                  value={v?.quantite ?? ''}
                  onChange={(e) => onChange(valeur.map((x) => (x.code === t.code ? { ...x, quantite: e.target.value } : x)))}
                />
              )}
            </span>
          );
        })}
        {inconnus.map((v) => (
          <label key={v.code} className="sp-pill" data-on="true">
            <input type="checkbox" checked onChange={() => basculer(v.code, false)} />
            <span className="ev-check__box" aria-hidden="true" />
            <span>{v.code}</span>
            <span className="sp-pill__prix" data-manquant="true">
              retiré de la grille
            </span>
          </label>
        ))}
      </div>
      {erreur && <span className="ev-error">{erreur}</span>}
    </div>
  );
}

// Champs compacts (même rendu que TextField / SelectField, sans espace réservé à l'aide).

function ChampTexte({ label, value, onChange, required, erreur, addon, mono, inputMode, placeholder, className }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; erreur?: string | null; addon?: string; mono?: boolean;
  inputMode?: 'decimal' | 'numeric' | 'text'; placeholder?: string; className?: string;
}) {
  const id = useId();
  const input = (
    <input
      id={id}
      className={['ev-input', mono && 'ev-mono'].filter(Boolean).join(' ')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={inputMode}
      placeholder={placeholder}
      aria-invalid={erreur ? true : undefined}
      aria-describedby={erreur ? `${id}-e` : undefined}
      aria-required={required || undefined}
    />
  );
  return (
    <div className={['ev-field', className].filter(Boolean).join(' ')}>
      <label className="ev-label" htmlFor={id}>
        {label}
        {required && <span className="ev-req" aria-hidden="true">*</span>}
      </label>
      {addon ? (
        <div className="ev-input-group">
          {input}
          <span className="ev-input-addon">{addon}</span>
        </div>
      ) : (
        input
      )}
      {erreur && (
        <span className="ev-error" id={`${id}-e`}>
          {erreur}
        </span>
      )}
    </div>
  );
}

function ChampSelect({ label, value, onChange, options, placeholder, required, erreur, className }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string;
  required?: boolean; erreur?: string | null; className?: string;
}) {
  const id = useId();
  return (
    <div className={['ev-field', className].filter(Boolean).join(' ')}>
      <label className="ev-label" htmlFor={id}>
        {label}
        {required && <span className="ev-req" aria-hidden="true">*</span>}
      </label>
      <select
        id={id}
        className="ev-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur ? `${id}-e` : undefined}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {erreur && (
        <span className="ev-error" id={`${id}-e`}>
          {erreur}
        </span>
      )}
    </div>
  );
}
