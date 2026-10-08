// Brouillon de spécifications tel que saisi dans le formulaire (nombres en texte, pour
// accepter « 1,5 » ou un champ vide), et conversion vers les spécifications de l'API.
// La validation finale passe par les schémas partagés (specsSchemaFor).

import {
  CODES_TARIF,
  ESPACEMENT_OEILLETS_DEFAUT_CM,
  specsSchemaFor,
  ligneRolandSchema,
  ligneXeroxSchema,
  type BordsRoland,
  type Conditionnement,
  type CouleurImpression,
  type FormatXerox,
  type LigneRoland,
  type LigneXerox,
  type Machine,
  type PapierXerox,
  type PartieLigne,
  type PositionOeillets,
  type Specs,
  type TypeDocument,
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
  /** '' : non précisé (anciennes lignes). */
  bords: BordsRoland | '';
  oeillets_position: PositionOeillets;
  oeillets_espacement: string;
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
  type_document: TypeDocument | '';
  partie: PartieLigne | '';
  /** '' : support choisi directement dans la grille (anciennes lignes). */
  format: FormatXerox | '';
  format_largeur: string;
  format_hauteur: string;
  couleur: CouleurImpression | '';
  papier: PapierXerox | '';
  pelliculage: '' | 'mat' | 'brillant';
  pelliculage_faces: 'recto' | 'recto_verso';
  numerotation: boolean;
  numerotation_depart: string;
  numerotation_chiffres: string;
  conditionnement: Conditionnement[];
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
  /** La conception graphique est offerte (sa valeur est déduite, visible sur le devis). */
  conception_offerte: boolean;
  /** Personne à contacter sur place pour la livraison. */
  livraison_contact: string;
  /** Données d'un dossier importé, conservées telles quelles. */
  legacy?: unknown;
}

let seq = 0;
export const nouvelleCle = () => `l${Date.now().toString(36)}${(++seq).toString(36)}`;

export function ligneRolandVide(): LigneRolandDraft {
  return {
    key: nouvelleCle(),
    support: '',
    largeur: '',
    hauteur: '',
    unite: 'cm',
    quantite: '1',
    finitions: [],
    options: [],
    description: '',
    bords: 'aucun',
    oeillets_position: 'tous_cotes',
    oeillets_espacement: String(ESPACEMENT_OEILLETS_DEFAUT_CM),
  };
}

export function ligneXeroxVide(): LigneXeroxDraft {
  return {
    key: nouvelleCle(),
    support: '',
    pages: '1',
    recto_verso: false,
    quantite: '',
    finitions: [],
    options: [],
    description: '',
    type_document: '',
    partie: '',
    format: '',
    format_largeur: '',
    format_hauteur: '',
    couleur: 'couleur',
    papier: '',
    pelliculage: '',
    pelliculage_faces: 'recto',
    numerotation: false,
    numerotation_depart: '1',
    numerotation_chiffres: '4',
    conditionnement: [],
  };
}

export function specsDraftVide(machine: Machine): SpecsDraft {
  return {
    roland: machine === 'roland' ? [ligneRolandVide()] : [],
    xerox: machine === 'xerox' ? [ligneXeroxVide()] : [],
    forfaits: [],
    remise: null,
    conception_offerte: false,
    livraison_contact: '',
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
    conception_offerte: !!specs?.conception_offerte,
    livraison_contact: specs?.livraison_contact ?? '',
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
      bords: l.bords ?? '',
      oeillets_position: l.oeillets?.position ?? 'tous_cotes',
      oeillets_espacement: txt(l.oeillets?.espacement_cm ?? ESPACEMENT_OEILLETS_DEFAUT_CM),
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
      type_document: l.type_document ?? '',
      partie: l.partie ?? '',
      format: l.format ?? '',
      format_largeur: txt(l.format_largeur),
      format_hauteur: txt(l.format_hauteur),
      couleur: l.couleur ?? '',
      papier: l.papier ?? '',
      pelliculage: l.pelliculage?.type ?? '',
      pelliculage_faces: l.pelliculage?.faces ?? 'recto',
      numerotation: !!l.numerotation,
      numerotation_depart: txt(l.numerotation?.depart ?? 1),
      numerotation_chiffres: txt(l.numerotation?.chiffres ?? 4),
      conditionnement: [...(l.conditionnement ?? [])],
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
  // Les champs facultatifs ne sont envoyés que s'ils sont renseignés : une ancienne ligne relue puis
  // renvoyée sans changement reste identique.
  if (machine === 'roland') {
    const r = l as LigneRolandDraft;
    const out: Record<string, unknown> = {
      support: r.support,
      largeur: lireDecimal(r.largeur),
      hauteur: lireDecimal(r.hauteur),
      unite: r.unite,
      quantite: lireEntier(r.quantite),
      finitions: choixVersApi(r.finitions),
      options: r.options,
      description,
    };
    if (r.bords) out.bords = r.bords;
    if (r.bords === 'oeillets') {
      out.oeillets = { position: r.oeillets_position, espacement_cm: r.oeillets_position === 'angles' ? ESPACEMENT_OEILLETS_DEFAUT_CM : lireDecimal(r.oeillets_espacement) };
    }
    return out;
  }
  const x = l as LigneXeroxDraft;
  const out: Record<string, unknown> = {
    support: x.support,
    pages: lireEntier(x.pages),
    recto_verso: x.recto_verso,
    quantite: lireEntier(x.quantite),
    finitions: choixVersApi(x.finitions),
    options: x.options,
    description,
  };
  if (x.type_document) out.type_document = x.type_document;
  if (x.partie) out.partie = x.partie;
  if (x.format) {
    out.format = x.format;
    if (x.couleur) out.couleur = x.couleur;
  }
  if (x.format === 'perso') {
    out.format_largeur = x.format_largeur.trim() ? lireDecimal(x.format_largeur) : null;
    out.format_hauteur = x.format_hauteur.trim() ? lireDecimal(x.format_hauteur) : null;
  }
  if (x.papier) out.papier = x.papier;
  if (x.pelliculage) out.pelliculage = { type: x.pelliculage, faces: x.pelliculage_faces };
  if (x.numerotation) out.numerotation = { depart: lireEntier(x.numerotation_depart), chiffres: lireEntier(x.numerotation_chiffres) };
  if (x.conditionnement.length) out.conditionnement = x.conditionnement;
  return out;
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
  if (d.conception_offerte) brut.conception_offerte = true;
  if (d.livraison_contact.trim()) brut.livraison_contact = d.livraison_contact.trim();
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
  const apercu = {
    lignes: completes,
    forfaits: choixVersApi(d.forfaits),
    remise: remise && Number.isFinite(remise.valeur) ? remise : null,
    conception_offerte: d.conception_offerte || undefined,
  } as Specs;
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
      case 'espacement_cm':
        return 'Indiquez l’espacement en cm';
      case 'depart':
        return 'Indiquez le premier numéro';
      case 'chiffres':
        return 'Indiquez le nombre de chiffres';
      case 'format_largeur':
      case 'format_hauteur':
        return 'Indiquez la dimension en mm';
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

// ---------------------------------------------------------------------------
// Forfaits du dossier pilotés par l'en-tête (remise, urgence, fichiers, BAT)

export type Urgence = 'normal' | '48h' | '24h';
export type EtatFichiers = 'fournis' | 'a_creer' | 'a_corriger';

const aCode = (d: SpecsDraft, code: string) => d.forfaits.some((f) => f.code === code);
const sansCodes = (d: SpecsDraft, codes: string[]) => d.forfaits.filter((f) => !codes.includes(f.code));

export function aForfait(d: SpecsDraft, code: string): boolean {
  return aCode(d, code);
}

/** Ajoute ou retire un forfait du dossier. */
export function avecForfait(d: SpecsDraft, code: string, on: boolean): SpecsDraft {
  if (on === aCode(d, code)) return d;
  return { ...d, forfaits: on ? [...d.forfaits, { code, quantite: '' }] : sansCodes(d, [code]) };
}

export function urgenceDe(d: SpecsDraft): Urgence {
  if (aCode(d, CODES_TARIF.urgence24)) return '24h';
  if (aCode(d, CODES_TARIF.urgence48)) return '48h';
  return 'normal';
}

export function avecUrgence(d: SpecsDraft, u: Urgence): SpecsDraft {
  const forfaits = sansCodes(d, [CODES_TARIF.urgence24, CODES_TARIF.urgence48]);
  if (u === '24h') forfaits.push({ code: CODES_TARIF.urgence24, quantite: '' });
  if (u === '48h') forfaits.push({ code: CODES_TARIF.urgence48, quantite: '' });
  return { ...d, forfaits };
}

export function fichiersDe(d: SpecsDraft): EtatFichiers {
  if (aCode(d, CODES_TARIF.conception)) return 'a_creer';
  if (aCode(d, CODES_TARIF.correction)) return 'a_corriger';
  return 'fournis';
}

export function avecFichiers(d: SpecsDraft, f: EtatFichiers): SpecsDraft {
  const forfaits = sansCodes(d, [CODES_TARIF.conception, CODES_TARIF.correction]);
  if (f === 'a_creer') forfaits.push({ code: CODES_TARIF.conception, quantite: '' });
  if (f === 'a_corriger') forfaits.push({ code: CODES_TARIF.correction, quantite: '' });
  return { ...d, forfaits, conception_offerte: f === 'a_creer' ? d.conception_offerte : false };
}

/** La livraison est facturée : forfait du dossier, ou option posée sur une ligne (anciennes saisies). */
export function livraisonFacturee(d: SpecsDraft): boolean {
  return aCode(d, CODES_TARIF.livraison) || [...d.roland, ...d.xerox].some((l) => l.options.includes(CODES_TARIF.livraison));
}

export function avecLivraison(d: SpecsDraft, on: boolean): SpecsDraft {
  if (on) return livraisonFacturee(d) ? d : avecForfait(d, CODES_TARIF.livraison, true);
  const sansOption = <T extends LigneRolandDraft | LigneXeroxDraft>(l: T): T =>
    l.options.includes(CODES_TARIF.livraison) ? { ...l, options: l.options.filter((o) => o !== CODES_TARIF.livraison) } : l;
  return { ...avecForfait(d, CODES_TARIF.livraison, false), roland: d.roland.map(sansOption), xerox: d.xerox.map(sansOption) };
}
