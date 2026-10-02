// Brouillon de spécifications tel que saisi dans le formulaire (nombres en texte, pour
// accepter « 1,5 » ou un champ vide), et conversion vers les spécifications de l'API.
// La validation finale passe par les schémas partagés (specsSchemaFor).

import {
  specsSchemaFor,
  ligneRolandSchema,
  ligneXeroxSchema,
  type LigneRoland,
  type LigneXerox,
  type Machine,
  type Specs,
  type UniteDimension,
} from '@evocom/shared';

export interface ChoixDraft {
  code: string;
  /** Quantité saisie (vide = valeur par défaut du moteur de prix). */
  quantite: string;
}

export interface LigneRolandDraft {
  key: string;
  support: string;
  largeur: string;
  hauteur: string;
  unite: UniteDimension;
  quantite: string;
  finitions: ChoixDraft[];
  options: string[];
  description: string;
}

export interface LigneXeroxDraft {
  key: string;
  support: string;
  pages: string;
  recto_verso: boolean;
  quantite: string;
  finitions: ChoixDraft[];
  options: string[];
  description: string;
}

export interface RemiseDraft {
  type: 'montant' | 'pourcent';
  valeur: string;
  motif: string;
}

/** Les lignes des deux machines sont gardées : changer de machine ne perd pas la saisie. */
export interface SpecsDraft {
  roland: LigneRolandDraft[];
  xerox: LigneXeroxDraft[];
  forfaits: ChoixDraft[];
  remise: RemiseDraft | null;
  /** Données d'un dossier importé, conservées telles quelles. */
  legacy?: unknown;
}

let seq = 0;
export const nouvelleCle = () => `l${Date.now().toString(36)}${(++seq).toString(36)}`;

export function ligneRolandVide(): LigneRolandDraft {
  return { key: nouvelleCle(), support: '', largeur: '', hauteur: '', unite: 'cm', quantite: '1', finitions: [], options: [], description: '' };
}

export function ligneXeroxVide(): LigneXeroxDraft {
  return { key: nouvelleCle(), support: '', pages: '1', recto_verso: false, quantite: '', finitions: [], options: [], description: '' };
}

export function specsDraftVide(machine: Machine): SpecsDraft {
  return {
    roland: machine === 'roland' ? [ligneRolandVide()] : [],
    xerox: machine === 'xerox' ? [ligneXeroxVide()] : [],
    forfaits: [],
    remise: null,
  };
}

const txt = (n: number | undefined | null) => (n === undefined || n === null ? '' : String(n).replace('.', ','));

export function specsVersDraft(machine: Machine, specs: Partial<Specs> | null | undefined): SpecsDraft {
  const lignes = (specs?.lignes ?? []) as (LigneRoland | LigneXerox)[];
  const choix = (c: { code: string; quantite?: number }[] | undefined) => (c ?? []).map((x) => ({ code: x.code, quantite: txt(x.quantite) }));
  const d: SpecsDraft = {
    roland: [],
    xerox: [],
    forfaits: choix(specs?.forfaits),
    remise: specs?.remise ? { type: specs.remise.type, valeur: txt(specs.remise.valeur), motif: specs.remise.motif ?? '' } : null,
    legacy: specs?.legacy,
  };
  if (machine === 'roland') {
    d.roland = (lignes as LigneRoland[]).map((l) => ({
      key: nouvelleCle(),
      support: l.support ?? '',
      largeur: txt(l.largeur),
      hauteur: txt(l.hauteur),
      unite: l.unite ?? 'cm',
      quantite: txt(l.quantite),
      finitions: choix(l.finitions),
      options: [...(l.options ?? [])],
      description: l.description ?? '',
    }));
  } else {
    d.xerox = (lignes as LigneXerox[]).map((l) => ({
      key: nouvelleCle(),
      support: l.support ?? '',
      pages: txt(l.pages),
      recto_verso: !!l.recto_verso,
      quantite: txt(l.quantite),
      finitions: choix(l.finitions),
      options: [...(l.options ?? [])],
      description: l.description ?? '',
    }));
  }
  return d;
}

/** « 1,5 » -> 1.5 ; vide ou illisible -> NaN (le schéma produit alors le message d'erreur). */
export function lireDecimal(s: string): number {
  const t = s.replace(/[\s  ]/g, '').replace(',', '.');
  if (t === '' || !/^\d*\.?\d+$/.test(t)) return Number.NaN;
  return Number(t);
}

export function lireEntier(s: string): number {
  const t = s.replace(/[\s  ]/g, '');
  if (!/^\d+$/.test(t)) return Number.NaN;
  return Number(t);
}

function choixVersApi(c: ChoixDraft[]) {
  return c.map((x) => {
    const q = lireEntier(x.quantite);
    return Number.isFinite(q) && q > 0 ? { code: x.code, quantite: q } : { code: x.code };
  });
}

function ligneVersApi(machine: Machine, l: LigneRolandDraft | LigneXeroxDraft) {
  const description = l.description.trim() || null;
  if (machine === 'roland') {
    const r = l as LigneRolandDraft;
    return {
      support: r.support,
      largeur: lireDecimal(r.largeur),
      hauteur: lireDecimal(r.hauteur),
      unite: r.unite,
      quantite: lireEntier(r.quantite),
      finitions: choixVersApi(r.finitions),
      options: r.options,
      description,
    };
  }
  const x = l as LigneXeroxDraft;
  return {
    support: x.support,
    pages: lireEntier(x.pages),
    recto_verso: x.recto_verso,
    quantite: lireEntier(x.quantite),
    finitions: choixVersApi(x.finitions),
    options: x.options,
    description,
  };
}

export function lignesDe(machine: Machine, d: SpecsDraft): (LigneRolandDraft | LigneXeroxDraft)[] {
  return machine === 'roland' ? d.roland : d.xerox;
}

export interface Conversion {
  /** Spécifications complètes et valides, ou null s'il reste des erreurs. */
  specs: Specs | null;
  /** Spécifications limitées aux lignes complètes, pour l'aperçu du prix. */
  apercu: Specs;
  /** Index des lignes incomplètes. */
  incompletes: number[];
  /** Erreurs par chemin (« lignes.0.largeur », « remise.valeur »…). */
  erreurs: Record<string, string>;
}

export function convertirSpecs(machine: Machine, d: SpecsDraft): Conversion {
  const lignes = lignesDe(machine, d).map((l) => ligneVersApi(machine, l));
  const remiseValeur = d.remise ? lireDecimal(d.remise.valeur) : Number.NaN;
  const remise = d.remise && d.remise.valeur.trim() !== '' ? { type: d.remise.type, valeur: remiseValeur, motif: d.remise.motif.trim() || null } : null;
  const brut: Record<string, unknown> = { lignes, forfaits: choixVersApi(d.forfaits), remise };
  if (d.legacy !== undefined) brut.legacy = d.legacy;

  const erreurs: Record<string, string> = {};
  const r = specsSchemaFor(machine).safeParse(brut);
  if (!r.success) {
    for (const issue of r.error.issues) {
      const k = issue.path.join('.');
      if (!erreurs[k]) erreurs[k] = messageChamp(issue.path, issue.message);
    }
  }
  const schemaLigne = machine === 'roland' ? ligneRolandSchema : ligneXeroxSchema;
  const completes: unknown[] = [];
  const incompletes: number[] = [];
  lignes.forEach((l, i) => {
    const p = schemaLigne.safeParse(l);
    if (p.success) completes.push(p.data);
    else incompletes.push(i);
  });
  const apercu = { lignes: completes, forfaits: choixVersApi(d.forfaits), remise: remise && Number.isFinite(remise.valeur) ? remise : null } as Specs;
  return { specs: r.success ? (r.data as Specs) : null, apercu, incompletes, erreurs };
}

/** Messages lisibles pour les erreurs de type (NaN, champ vide). */
function messageChamp(path: (string | number)[], message: string): string {
  const champ = String(path[path.length - 1]);
  if (/Expected number|received nan|Invalid input|Required/i.test(message)) {
    switch (champ) {
      case 'largeur':
        return 'Indiquez la largeur';
      case 'hauteur':
        return 'Indiquez la hauteur';
      case 'quantite':
        return 'Indiquez une quantité entière';
      case 'pages':
        return 'Indiquez le nombre de pages';
      case 'valeur':
        return 'Indiquez la valeur de la remise';
      default:
        return 'Valeur invalide';
    }
  }
  if (/Number must be greater than 0/i.test(message)) return 'Doit être supérieur à 0';
  if (/Expected integer/i.test(message)) return 'Nombre entier attendu';
  return message;
}

/** Surface d'une ligne Roland en m² (toutes quantités), ou null si incomplète. */
export function surfaceLigne(l: LigneRolandDraft): { unitaire: number; totale: number } | null {
  const k = { mm: 0.001, cm: 0.01, m: 1 }[l.unite];
  const la = lireDecimal(l.largeur);
  const ha = lireDecimal(l.hauteur);
  const q = lireEntier(l.quantite);
  if (!(la > 0 && ha > 0)) return null;
  const unitaire = la * k * (ha * k);
  return { unitaire, totale: unitaire * (q > 0 ? q : 1) };
}
