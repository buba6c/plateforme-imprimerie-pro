// Éditeur de spécifications d'impression, partagé par le dossier et le devis.
// Roland : support, dimensions, quantité, bords (œillets calculés, ourlet, collage), finitions, options.
// Xerox : type de document (pré-remplit la ligne), format et couleur (donnent le tarif), papier, pages,
// recto-verso, exemplaires, pelliculage, façonnage, numérotation, conditionnement.
// Plus les autres forfaits du dossier et la remise. Le prix vient toujours du moteur (PrixPanel).

import { useId, useMemo, type ReactNode } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import {
  BORDS_LABELS,
  codeSupportXerox,
  CODES_STRUCTURES,
  CONDITIONNEMENT_LABELS,
  CONDITIONNEMENTS,
  COULEUR_LABELS,
  FORMAT_XEROX_LABELS,
  FORMAT_XEROX_MM,
  FORMATS_XEROX,
  formatCouleurSeule,
  formatDecimal,
  formatEntier,
  nombreOeillets,
  PAPIER_LABELS,
  PAPIERS_XEROX,
  PARTIE_LABELS,
  PARTIES_LIGNE,
  POSITION_OEILLETS_LABELS,
  TARIF_BORDS,
  TARIF_PAPIER,
  TARIF_PELLICULAGE,
  TYPE_DOCUMENT_LABELS,
  TYPES_DOCUMENT,
  UNITES_DIMENSION,
  type BordsRoland,
  type ErreurPrix,
  type FormatXerox,
  type Machine,
  type ParamsPrix,
  type ResultatPrix,
  type TypeDocument,
  type UniteDimension,
} from '@evocom/shared';
import type { Tarif } from '../../lib/types';
import { Button, Checkbox, IconButton, Segmented } from '../../ui';
import {
  lignesDe,
  lireDecimal,
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
  /** Proposer les modèles rapides (grand format). */
  modeles?: boolean;
}

interface Modele {
  id: string;
  label: string;
  roland: Partial<LigneRolandDraft>;
}

// Modèles grand format repris de l'ancienne plateforme ; proposés seulement si le support existe dans la grille.
// En Xerox, le « type de document » de chaque ligne joue ce rôle.
const MODELES: Modele[] = [
  { id: 'bache', label: 'Bâche 300 × 100 cm à œillets', roland: { support: 'bache_m2', largeur: '300', hauteur: '100', unite: 'cm', quantite: '1', bords: 'oeillets', oeillets_position: 'tous_cotes', oeillets_espacement: '50' } },
  { id: 'vitrine', label: 'Vinyle vitrine 200 × 80 cm', roland: { support: 'vinyle_m2', largeur: '200', hauteur: '80', unite: 'cm', quantite: '1', description: 'Collage en vitrine' } },
  { id: 'kakemono', label: 'Kakémono 85 × 200 cm', roland: { support: 'kakemono', largeur: '85', hauteur: '200', unite: 'cm', quantite: '1' } },
];

/** Ce que chaque type de document pré-remplit (le préparateur corrige ensuite). */
const PRESETS: Record<TypeDocument, Partial<LigneXeroxDraft> & { faconnage?: string[] }> = {
  carte_visite: { format: 'cdv_85x55', couleur: 'couleur', papier: 'couche_350', pages: '2', recto_verso: true, quantite: '100', faconnage: ['coupe'] },
  flyer: { format: 'a5', couleur: 'couleur', papier: 'couche_135', pages: '1', recto_verso: false },
  brochure: { format: 'a4', couleur: 'couleur', papier: 'couche_135', pages: '8', recto_verso: true, partie: 'unique', faconnage: ['agrafage'] },
  depliant: { format: 'a4', couleur: 'couleur', papier: 'couche_170', pages: '2', recto_verso: true, faconnage: ['rainage_pliage'] },
  affiche: { format: 'a3', couleur: 'couleur', papier: 'couche_170', pages: '1', recto_verso: false },
  catalogue: { format: 'a4', couleur: 'couleur', papier: 'couche_135', pages: '16', recto_verso: true, partie: 'unique', faconnage: ['dos_carre_colle'] },
  document: { format: 'a4', couleur: 'nb', papier: 'ordinaire_80', pages: '10', recto_verso: false },
  autre: {},
};
const TYPES_EN_PARTIES: readonly TypeDocument[] = ['brochure', 'catalogue', 'depliant'];

export function prixTexte(t: Tarif | undefined | null): string {
  if (!t) return 'absent de la grille';
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
      // Les forfaits de l'en-tête (livraison, urgence, conception, correction, BAT) ont leurs propres champs.
      divers: actifs.filter((t) => (t.machine === 'global' || t.machine === machine) && t.categorie === 'divers' && !CODES_STRUCTURES.dossier.has(t.code)),
    };
  }, [actifs, machine]);
  /** Tarif d'un code pour cette machine (ou commun). */
  const tarif = useMemo(() => {
    const m = new Map((tarifs ?? []).map((t) => [`${t.machine}:${t.code}`, t]));
    return (code: string) => m.get(`${machine}:${code}`) ?? m.get(`global:${code}`);
  }, [tarifs, machine]);

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

  const modelesDispo = modeles && machine === 'roland' ? MODELES.filter((m) => parCat.support.some((t) => t.code === m.roland.support)) : [];
  const appliquerModele = (m: Modele) => {
    const base = { ...ligneRolandVide(), ...m.roland };
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
  // Finitions et options génériques : sans les codes qui ont un champ dédié (sauf s'ils sont déjà cochés).
  const generiques = (liste: Tarif[], choisis: string[]) => liste.filter((t) => !CODES_STRUCTURES[machine].has(t.code) || choisis.includes(t.code));

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
            Aucune ligne. Ajoutez {machine === 'roland' ? 'un support avec ses dimensions' : 'un document avec son format, ses pages et ses exemplaires'} pour calculer le prix.
          </p>
        </div>
      )}

      {lignes.map((l, i) => {
        const total = totalLigne(i);
        const finitionsChoisies = l.finitions.map((f) => f.code);
        return (
          <fieldset key={l.key} className="sp-ligne">
            <legend className="sr-only">Ligne {i + 1}</legend>
            <div className="sp-ligne__head">
              <span className="sp-ligne__num ev-mono">{String(i + 1).padStart(2, '0')}</span>
              <span className="sp-ligne__titre">{titreLigne(machine, l, i)}</span>
              <span className="grow" />
              {total !== null && <span className="ev-num sp-ligne__total">{formatEntier(total)} FCFA</span>}
              <IconButton label={`Dupliquer la ligne ${i + 1}`} size="sm" onClick={() => dupliquer(i)}>
                <Copy />
              </IconButton>
              <IconButton label={`Supprimer la ligne ${i + 1}`} size="sm" onClick={() => retirer(i)}>
                <Trash2 />
              </IconButton>
            </div>
            {machine === 'roland' ? (
              <LigneRoland l={l as LigneRolandDraft} i={i} supports={parCat.support} tarif={tarif} maj={(p) => majLigne(i, p)} err={(c) => err(i, c)} params={params} />
            ) : (
              <LigneXerox l={l as LigneXeroxDraft} supports={parCat.support} finitions={parCat.finition} tarif={tarif} maj={(p) => majLigne(i, p)} err={(c) => err(i, c)} />
            )}
            <Choix
              titre={machine === 'roland' ? 'Finitions' : 'Façonnage et finitions'}
              tarifs={generiques(parCat.finition, finitionsChoisies)}
              valeur={l.finitions}
              avecQuantite={(t) => t.unite === 'unite'}
              aideQuantite={machine === 'roland' ? 'Nombre (par défaut : 1 par exemplaire)' : 'Nombre'}
              onChange={(finitions) => majLigne(i, { finitions })}
              erreur={err(i, 'finitions')}
            />
            <Choix
              titre="Options"
              tarifs={generiques(parCat.option, l.options)}
              valeur={l.options.map((code) => ({ code, quantite: '' }))}
              onChange={(c) => majLigne(i, { options: c.map((x) => x.code) })}
            />
            {machine === 'xerox' && <Finale l={l as LigneXeroxDraft} tarif={tarif} maj={(p) => majLigne(i, p)} err={(c) => err(i, c)} />}
            <ChampTexte
              label="Précisions pour l'atelier"
              value={l.description}
              onChange={(description) => majLigne(i, { description })}
              placeholder={machine === 'roland' ? 'Pose, sens de lecture, emplacement…' : 'Fond perdu, sens, remarque sur le fichier…'}
              erreur={err(i, 'description')}
            />
          </fieldset>
        );
      })}

      <div>
        <Button size="sm" icon={<Plus />} onClick={ajouter}>
          {machine === 'xerox' ? 'Ajouter un document ou une partie' : 'Ajouter une ligne'}
        </Button>
      </div>

      {parCat.divers.length > 0 && (
        <div className="sp-bloc">
          <Choix
            titre="Autres forfaits et services"
            tarifs={parCat.divers}
            valeur={value.forfaits.filter((f) => !CODES_STRUCTURES.dossier.has(f.code))}
            onChange={(autres) => onChange({ ...value, forfaits: [...value.forfaits.filter((f) => CODES_STRUCTURES.dossier.has(f.code)), ...autres] })}
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

function titreLigne(machine: Machine, l: LigneRolandDraft | LigneXeroxDraft, i: number): string {
  if (machine === 'xerox') {
    const x = l as LigneXeroxDraft;
    const type = x.type_document ? TYPE_DOCUMENT_LABELS[x.type_document] : null;
    const partie = x.partie && x.partie !== 'unique' ? PARTIE_LABELS[x.partie].toLowerCase() : null;
    if (type) return partie ? `${type} · ${partie}` : type;
  }
  return `Ligne ${i + 1}`;
}

// ---------------------------------------------------------------------------

function optionsSupport(supports: Tarif[], code: string) {
  const opts = supports.map((t) => ({ value: t.code, label: `${t.libelle} · ${prixTexte(t)}` }));
  if (code && !supports.some((t) => t.code === code)) opts.unshift({ value: code, label: `${code} (retiré de la grille)` });
  return opts;
}

type Trouver = (code: string) => Tarif | undefined;

/** Rappel du tarif appliqué, avec un avertissement s'il manque ou n'a pas de prix. */
function TarifApplique({ code, tarif, prefixe = 'Tarif', siProbleme }: { code: string; tarif: Trouver; prefixe?: string; siProbleme?: boolean }) {
  if (!code) return null;
  const t = tarif(code);
  const probleme = !t || t.prix === null || !t.actif;
  if (siProbleme && !probleme) return null;
  return (
    <p className="sp-tarif" data-alerte={probleme}>
      {prefixe} : {t ? t.libelle : code} · {t && !t.actif ? 'désactivé dans Tarifs' : t?.prix === null ? 'prix à renseigner dans Tarifs' : prixTexte(t)}
    </p>
  );
}

function LigneRoland({ l, i, supports, tarif, maj, err, params }: {
  l: LigneRolandDraft; i: number; supports: Tarif[]; tarif: Trouver; maj: (p: Partial<LigneRolandDraft>) => void; err: (c: string) => string | null; params: ParamsPrix;
}) {
  const s = surfaceLigne(l);
  const q = lireEntier(l.quantite);
  const min = params.surface_min_m2 > 0 && s && s.unitaire < params.surface_min_m2;
  const changerSupport = (support: string) => {
    // Kakémono : dimensions standard proposées si rien n'est saisi.
    if (support === 'kakemono' && !l.largeur && !l.hauteur) maj({ support, largeur: '85', hauteur: '200', unite: 'cm' });
    else maj({ support });
  };
  const bords = l.bords || 'aucun';
  const espacement = lireDecimal(l.oeillets_espacement);
  const oeillets =
    bords === 'oeillets'
      ? nombreOeillets({
          largeur: lireDecimal(l.largeur),
          hauteur: lireDecimal(l.hauteur),
          unite: l.unite,
          quantite: q > 0 ? q : 1,
          oeillets: { position: l.oeillets_position, espacement_cm: espacement > 0 ? espacement : 50 },
        })
      : null;
  return (
    <>
      <div className="sp-grid sp-grid--roland">
        <ChampSelect
          className="sp-col-support"
          label="Support"
          required
          value={l.support}
          onChange={changerSupport}
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

      <SousBloc titre="Bords">
        <div className="sp-grid sp-grid--bords">
          <ChampSelect
            label="Finition des bords"
            value={bords}
            onChange={(b) => maj({ bords: b as BordsRoland })}
            options={(['aucun', 'oeillets', 'ourlet', 'collage'] as const).map((b) => ({
              value: b,
              label: b === 'aucun' ? 'Aucune (bords coupés)' : `${BORDS_LABELS[b]} · ${prixTexte(tarif(TARIF_BORDS[b]))}`,
            }))}
          />
          {bords === 'oeillets' && (
            <ChampGroupe label="Où poser les œillets ?">
              <Segmented
                name={`oeillets-${l.key}`}
                label="Où poser les œillets ?"
                value={l.oeillets_position}
                onChange={(oeillets_position) => maj({ oeillets_position })}
                options={(['angles', 'tous_cotes'] as const).map((p) => ({ value: p, label: POSITION_OEILLETS_LABELS[p] }))}
              />
            </ChampGroupe>
          )}
          {bords === 'oeillets' && l.oeillets_position === 'tous_cotes' && (
            <ChampTexte label="Un œillet tous les" value={l.oeillets_espacement} onChange={(oeillets_espacement) => maj({ oeillets_espacement })} inputMode="decimal" mono addon="cm" erreur={err('oeillets.espacement_cm')} />
          )}
        </div>
        {bords === 'oeillets' && (
          <p className="sp-calcul ev-mono" aria-live="polite">
            {oeillets
              ? `${formatEntier(oeillets.parExemplaire)} œillets par exemplaire${q > 1 ? ` · ${formatEntier(oeillets.total)} au total` : ''}`
              : 'Nombre d’œillets calculé dès que largeur et hauteur sont saisies'}
          </p>
        )}
        {bords !== 'aucun' && <TarifApplique code={TARIF_BORDS[bords as Exclude<BordsRoland, 'aucun'>]} tarif={tarif} prefixe={BORDS_LABELS[bords]} siProbleme />}
      </SousBloc>
    </>
  );
}

function LigneXerox({ l, supports, finitions, tarif, maj, err }: {
  l: LigneXeroxDraft; supports: Tarif[]; finitions: Tarif[]; tarif: Trouver; maj: (p: Partial<LigneXeroxDraft>) => void; err: (c: string) => string | null;
}) {
  const pages = lireEntier(l.pages);
  const exemplaires = lireEntier(l.quantite);
  const ok = pages > 0 && exemplaires > 0;
  // Ligne enregistrée avant les formats (support choisi directement) : on garde la liste des tarifs.
  const parGrille = !l.format && !!l.support;
  const formatValeur = l.format || (parGrille ? '__grille' : '');

  const changerType = (type: TypeDocument | '') => {
    if (!type) return maj({ type_document: '' });
    const { faconnage = [], ...p } = PRESETS[type];
    const patch: Partial<LigneXeroxDraft> = { ...p, type_document: type };
    if (l.quantite && p.quantite) delete patch.quantite; // la quantité saisie est gardée
    if (p.format) patch.support = codeSupportXerox(p.format, p.couleur || l.couleur || 'couleur') ?? l.support;
    if (!TYPES_EN_PARTIES.includes(type)) patch.partie = '';
    const ajouts = faconnage.filter((c) => finitions.some((t) => t.code === c) && !l.finitions.some((f) => f.code === c));
    if (ajouts.length) patch.finitions = [...l.finitions, ...ajouts.map((code) => ({ code, quantite: '' }))];
    maj(patch);
  };
  const changerFormat = (v: string) => {
    if (v === '__grille') return maj({ format: '', support: l.support || supports[0]?.code || '' });
    const format = v as FormatXerox | '';
    if (!format) return maj({ format: '' });
    const couleur = formatCouleurSeule(format) ? 'couleur' : l.couleur || 'couleur';
    maj({ format, couleur, support: format === 'perso' ? (l.format === 'perso' ? l.support : '') : codeSupportXerox(format, couleur) ?? '' });
  };
  const changerCouleur = (couleur: 'couleur' | 'nb') => maj({ couleur, support: l.format && l.format !== 'perso' ? codeSupportXerox(l.format, couleur) ?? l.support : l.support });

  const dims = l.format && l.format !== 'perso' ? FORMAT_XEROX_MM[l.format] : null;
  const papierCode = l.papier ? TARIF_PAPIER[l.papier] : null;
  const rvUnePage = l.recto_verso && pages === 1;

  return (
    <>
      <div className="sp-grid sp-grid--doc">
        <ChampSelect
          label="Type de document"
          value={l.type_document}
          onChange={(v) => changerType(v as TypeDocument | '')}
          options={TYPES_DOCUMENT.map((t) => ({ value: t, label: TYPE_DOCUMENT_LABELS[t] }))}
          placeholder="Choisir (pré-remplit la ligne)"
        />
        {(TYPES_EN_PARTIES.includes(l.type_document as TypeDocument) || (l.partie && l.partie !== 'unique')) && (
          <ChampSelect
            label="Partie du document"
            value={l.partie || 'unique'}
            onChange={(v) => maj({ partie: v as LigneXeroxDraft['partie'] })}
            options={PARTIES_LIGNE.map((p) => ({ value: p, label: PARTIE_LABELS[p] }))}
            aide="Une ligne par partie : couverture en 300 g, intérieur en 135 g…"
          />
        )}
      </div>

      <div className="sp-grid sp-grid--format">
        <ChampSelect
          className="sp-col-format"
          label="Format"
          required
          value={formatValeur}
          onChange={changerFormat}
          options={[
            ...FORMATS_XEROX.map((f) => ({ value: f, label: FORMAT_XEROX_LABELS[f] })),
            { value: '__grille', label: 'Autre tarif de la grille' },
          ]}
          placeholder="Choisir un format"
          erreur={!l.format ? err('support') : null}
        />
        {l.format && !formatCouleurSeule(l.format) && (
          <ChampGroupe label="Impression">
            <Segmented
              name={`couleur-${l.key}`}
              label="Impression"
              value={(l.couleur || 'couleur') as 'couleur' | 'nb'}
              onChange={changerCouleur}
              options={(['couleur', 'nb'] as const).map((c) => ({ value: c, label: COULEUR_LABELS[c] }))}
            />
          </ChampGroupe>
        )}
        {l.format === 'perso' && (
          <>
            <ChampTexte label="Largeur finie" value={l.format_largeur} onChange={(format_largeur) => maj({ format_largeur })} inputMode="decimal" mono addon="mm" erreur={err('format_largeur')} />
            <ChampTexte label="Hauteur finie" value={l.format_hauteur} onChange={(format_hauteur) => maj({ format_hauteur })} inputMode="decimal" mono addon="mm" erreur={err('format_hauteur')} />
          </>
        )}
        {(l.format === 'perso' || parGrille || formatValeur === '__grille') && (
          <ChampSelect
            className="sp-col-format"
            label={l.format === 'perso' ? 'Imprimé sur (tarif appliqué)' : 'Tarif de la grille'}
            required
            value={l.support}
            onChange={(support) => maj({ support })}
            options={optionsSupport(supports, l.support)}
            placeholder="Choisir un tarif"
            erreur={err('support')}
          />
        )}
      </div>
      {l.format && l.format !== 'perso' && (
        <TarifApplique code={l.support} tarif={tarif} prefixe={dims ? `${FORMAT_XEROX_LABELS[l.format]} (${dims[0]} × ${dims[1]} mm)` : 'Tarif'} />
      )}

      <div className="sp-grid sp-grid--xerox">
        <ChampSelect
          className="sp-col-papier"
          label="Papier"
          value={l.papier || 'ordinaire_80'}
          onChange={(v) => maj({ papier: v as LigneXeroxDraft['papier'] })}
          options={PAPIERS_XEROX.map((p) => {
            const code = TARIF_PAPIER[p];
            return { value: p, label: code ? `${PAPIER_LABELS[p]} · +${prixTexte(tarif(code))}` : `${PAPIER_LABELS[p]} · compris` };
          })}
        />
        <ChampTexte label="Pages" required value={l.pages} onChange={(p) => maj({ pages: p })} inputMode="numeric" mono erreur={err('pages')} aide="Faces imprimées d’un exemplaire" />
        <ChampTexte label="Exemplaires" required value={l.quantite} onChange={(quantite) => maj({ quantite })} inputMode="numeric" mono erreur={err('quantite')} />
        <div className="sp-rv">
          <Checkbox label="Recto-verso" checked={l.recto_verso} onChange={(recto_verso) => maj({ recto_verso, pages: recto_verso && l.pages.trim() === '1' ? '2' : l.pages })} />
        </div>
      </div>
      <p className="sp-calcul ev-mono" aria-live="polite">
        {ok
          ? `${formatEntier(pages * exemplaires)} face${pages * exemplaires > 1 ? 's' : ''} imprimée${pages * exemplaires > 1 ? 's' : ''} · ${formatEntier(Math.ceil(pages / (l.recto_verso ? 2 : 1)) * exemplaires)} feuilles`
          : 'Faces et feuilles calculées dès que pages et exemplaires sont saisis'}
      </p>
      {rvUnePage && (
        <p className="sp-alerte" role="status">
          Recto-verso avec 1 seule page : le verso n’est pas compté. Indiquez 2 pages (recto + verso).
        </p>
      )}
      {papierCode && <TarifApplique code={papierCode} tarif={tarif} prefixe="Papier" siProbleme />}

      <div className="sp-grid sp-grid--pell">
        <ChampSelect
          label="Pelliculage"
          value={l.pelliculage}
          onChange={(v) => maj({ pelliculage: v as LigneXeroxDraft['pelliculage'] })}
          options={[
            { value: '', label: 'Aucun' },
            { value: 'mat', label: `Mat · ${prixTexte(tarif(TARIF_PELLICULAGE.mat))}` },
            { value: 'brillant', label: `Brillant · ${prixTexte(tarif(TARIF_PELLICULAGE.brillant))}` },
          ]}
        />
        {l.pelliculage && (
          <ChampGroupe label="Faces pelliculées">
            <Segmented
              name={`pell-${l.key}`}
              label="Faces pelliculées"
              value={l.pelliculage_faces}
              onChange={(pelliculage_faces) => maj({ pelliculage_faces })}
              options={[
                { value: 'recto', label: 'Recto' },
                { value: 'recto_verso', label: 'Recto-verso' },
              ]}
            />
          </ChampGroupe>
        )}
      </div>
    </>
  );
}

/** Numérotation et conditionnement (Xerox), après le façonnage. */
function Finale({ l, tarif, maj, err }: { l: LigneXeroxDraft; tarif: Trouver; maj: (p: Partial<LigneXeroxDraft>) => void; err: (c: string) => string | null }) {
  const id = useId();
  const basculer = (c: (typeof CONDITIONNEMENTS)[number], on: boolean) =>
    maj({ conditionnement: on ? [...l.conditionnement, c] : l.conditionnement.filter((x) => x !== c) });
  return (
    <>
      <div className="sp-sousbloc">
        <Checkbox label={<>Numéroter les exemplaires <span className="sp-pill__prix">{prixTexte(tarif('numerotation'))}</span></>} checked={l.numerotation} onChange={(numerotation) => maj({ numerotation })} />
        {l.numerotation && (
          <div className="sp-grid sp-grid--num">
            <ChampTexte label="Premier numéro" value={l.numerotation_depart} onChange={(numerotation_depart) => maj({ numerotation_depart })} inputMode="numeric" mono erreur={err('numerotation.depart')} />
            <ChampTexte label="Nombre de chiffres" value={l.numerotation_chiffres} onChange={(numerotation_chiffres) => maj({ numerotation_chiffres })} inputMode="numeric" mono erreur={err('numerotation.chiffres')} aide="4 chiffres : 0001, 0002…" />
          </div>
        )}
      </div>
      <div className="sp-choix" role="group" aria-labelledby={`${id}-c`}>
        <span className="sp-choix__titre" id={`${id}-c`}>
          Conditionnement <span className="ev-muted sp-info">pour l’atelier, sans effet sur le prix</span>
        </span>
        <div className="sp-choix__liste">
          {CONDITIONNEMENTS.map((c) => {
            const on = l.conditionnement.includes(c);
            return (
              <label key={c} className="sp-pill" data-on={on}>
                <input type="checkbox" checked={on} onChange={(e) => basculer(c, e.target.checked)} />
                <span className="ev-check__box" aria-hidden="true" />
                <span>{CONDITIONNEMENT_LABELS[c]}</span>
              </label>
            );
          })}
        </div>
      </div>
    </>
  );
}

function SousBloc({ titre, children }: { titre: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="sp-sousbloc" role="group" aria-labelledby={id}>
      <span className="sp-choix__titre" id={id}>
        {titre}
      </span>
      {children}
    </div>
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

/** Libellé visible au-dessus d'un groupe de boutons (Segmented n'a qu'un libellé pour les lecteurs d'écran). */
function ChampGroupe({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ev-field sp-groupe">
      <span className="ev-label" aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  );
}

export function ChampTexte({ label, value, onChange, required, erreur, addon, mono, inputMode, placeholder, className, aide }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; erreur?: string | null; addon?: string; mono?: boolean;
  inputMode?: 'decimal' | 'numeric' | 'text'; placeholder?: string; className?: string; aide?: string;
}) {
  const id = useId();
  const decrit = [erreur && `${id}-e`, aide && `${id}-a`].filter(Boolean).join(' ') || undefined;
  const input = (
    <input
      id={id}
      className={['ev-input', mono && 'ev-mono'].filter(Boolean).join(' ')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={inputMode}
      placeholder={placeholder}
      aria-invalid={erreur ? true : undefined}
      aria-describedby={decrit}
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
      {aide && !erreur && (
        <span className="sp-aide" id={`${id}-a`}>
          {aide}
        </span>
      )}
      {erreur && (
        <span className="ev-error" id={`${id}-e`}>
          {erreur}
        </span>
      )}
    </div>
  );
}

export function ChampSelect({ label, value, onChange, options, placeholder, required, erreur, className, aide }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string;
  required?: boolean; erreur?: string | null; className?: string; aide?: string;
}) {
  const id = useId();
  const decrit = [erreur && `${id}-e`, aide && `${id}-a`].filter(Boolean).join(' ') || undefined;
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
        aria-describedby={decrit}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {aide && !erreur && (
        <span className="sp-aide" id={`${id}-a`}>
          {aide}
        </span>
      )}
      {erreur && (
        <span className="ev-error" id={`${id}-e`}>
          {erreur}
        </span>
      )}
    </div>
  );
}
