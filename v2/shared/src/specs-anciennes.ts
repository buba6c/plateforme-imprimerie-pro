// Dossiers repris de l'ancienne plateforme : lecture du formulaire d'origine (`specs.legacy`),
// rangé en sections nettes (document, papier, finitions, façonnage… ; support, dimensions, œillets)
// pour l'écran, le bon de travail PDF et le résumé des cartes. Rien n'est perdu : les champs
// inconnus vont dans « Autres informations ».

import { formatDecimal, formatEntier } from './format';
import type { Machine } from './domain';

type Donnees = Record<string, unknown>;

export type CleSectionAncienne =
  | 'document'
  | 'quantite'
  | 'papier'
  | 'finition'
  | 'faconnage'
  | 'conditionnement'
  | 'numerotation'
  | 'support'
  | 'dimensions'
  | 'autres';

export interface SectionAncienne {
  cle: CleSectionAncienne;
  titre: string;
  /** Couples libellé / valeur (déjà filtrés : jamais de valeur vide). */
  items: [string, string][];
  /** Étiquettes (finitions, façonnage, conditionnement). */
  tags: string[];
  /** Chiffre mis en avant (quantité, dimensions). */
  grand?: { valeur: string; unite: string; detail?: string };
  /** Texte à montrer quand la section n'a rien : l'atelier doit savoir qu'il n'y a rien à faire. */
  vide: string;
  /** Section large (document, support) ou à signaler (numérotation demandée). */
  accent?: 'large' | 'alerte';
}

export interface FormulaireAncien {
  id: number | null;
  date_saisie: string | null;
  type: Machine;
  sections: SectionAncienne[];
}

const COULEURS: Record<string, string> = {
  couleur: 'Couleur',
  quadri: 'Couleur (quadri)',
  noir_blanc: 'Noir et blanc',
  noir_et_blanc: 'Noir et blanc',
  nb: 'Noir et blanc',
  noir: 'Noir et blanc',
};
const IMPRESSION: Record<string, string> = {
  recto_verso: 'Recto-verso',
  recto: 'Recto seul',
  recto_seul: 'Recto seul',
  verso: 'Verso seul',
};

const CLES_CONNUES = new Set([
  'client',
  'type_document',
  'type_document_autre',
  'format',
  'format_personnalise',
  'couleur_impression',
  'mode_impression',
  'nombre_pages',
  'nombre_exemplaires',
  'grammage',
  'grammage_autre',
  'finition',
  'faconnage',
  'faconnage_autre',
  'conditionnement',
  'numerotation',
  'debut_numerotation',
  'nombre_chiffres',
  'type_support',
  'type_support_autre',
  'largeur',
  'hauteur',
  'unite',
  'surface_m2',
  'finition_oeillets',
  'finition_position',
]);

export function texteAncien(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (Array.isArray(v)) return v.map(texteAncien).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    return Object.entries(v as Donnees)
      .filter(([, x]) => texteAncien(x) !== '')
      .map(([k, x]) => `${cleLisible(k)} : ${texteAncien(x)}`)
      .join(' · ');
  }
  return String(v).trim();
}

function liste(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(texteAncien).filter(Boolean);
  const t = texteAncien(v);
  return t ? [t] : [];
}

function nombre(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function cleLisible(k: string): string {
  const s = k.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Valeur ou sa variante « autre » quand elle est renseignée (ex. format personnalisé). */
function avecAutre(d: Donnees, cle: string, cleAutre: string): string {
  const autre = texteAncien(d[cleAutre]);
  const v = texteAncien(d[cle]);
  if (autre && (!v || /^autre/i.test(v))) return autre;
  return autre && v ? `${v} (${autre})` : v;
}

export function valeurVide(v: unknown): boolean {
  return v === null || v === undefined || v === '' || v === false || (Array.isArray(v) && v.length === 0);
}

function items(paires: [string, string][]): [string, string][] {
  return paires.filter(([, v]) => v);
}

function sectionsXerox(d: Donnees): SectionAncienne[] {
  const exemplaires = nombre(d.nombre_exemplaires);
  const pages = nombre(d.nombre_pages);
  const couleur = texteAncien(d.couleur_impression);
  const impression = texteAncien(d.mode_impression);
  const numerote = d.numerotation === true || /^(oui|true|1)$/i.test(texteAncien(d.numerotation));
  return [
    {
      cle: 'document',
      titre: 'Document',
      accent: 'large',
      items: items([
        ['Type', avecAutre(d, 'type_document', 'type_document_autre')],
        ['Format', avecAutre(d, 'format', 'format_personnalise')],
        ['Couleur', COULEURS[couleur.toLowerCase()] ?? cleLisible(couleur)],
        ['Impression', IMPRESSION[impression.toLowerCase()] ?? cleLisible(impression)],
      ]),
      tags: [],
      vide: 'Non précisé',
    },
    {
      cle: 'quantite',
      titre: 'Quantité',
      items: [],
      tags: [],
      grand:
        exemplaires !== null
          ? { valeur: formatEntier(exemplaires), unite: exemplaires > 1 ? 'exemplaires' : 'exemplaire', detail: pages !== null ? `${formatEntier(pages)} page${pages > 1 ? 's' : ''} par exemplaire` : undefined }
          : undefined,
      vide: 'Non précisée',
    },
    { cle: 'papier', titre: 'Papier', items: items([['Grammage', avecAutre(d, 'grammage', 'grammage_autre')]]), tags: [], vide: 'Non précisé' },
    { cle: 'finition', titre: 'Finitions', items: [], tags: liste(d.finition), vide: 'Aucune finition demandée' },
    { cle: 'faconnage', titre: 'Façonnage', items: [], tags: [...liste(d.faconnage), ...liste(d.faconnage_autre)], vide: 'Aucun façonnage demandé' },
    { cle: 'conditionnement', titre: 'Conditionnement', items: [], tags: liste(d.conditionnement), vide: 'Non précisé' },
    {
      cle: 'numerotation',
      titre: 'Numérotation',
      accent: numerote ? 'alerte' : undefined,
      items: numerote
        ? items([
            ['Numéroter', 'Oui'],
            ['À partir de', texteAncien(d.debut_numerotation)],
            ['Chiffres', texteAncien(d.nombre_chiffres)],
          ])
        : [],
      tags: [],
      vide: 'Sans numérotation',
    },
  ];
}

function sectionsRoland(d: Donnees): SectionAncienne[] {
  const largeur = nombre(d.largeur);
  const hauteur = nombre(d.hauteur);
  const unite = texteAncien(d.unite) || 'cm';
  const exemplaires = nombre(d.nombre_exemplaires);
  const surface = nombre(d.surface_m2);
  const total = surface !== null && exemplaires !== null ? surface * exemplaires : null;
  return [
    { cle: 'support', titre: 'Support', accent: 'large', items: items([['Support', avecAutre(d, 'type_support', 'type_support_autre')]]), tags: [], vide: 'Non précisé' },
    {
      cle: 'dimensions',
      titre: 'Dimensions',
      items: [],
      tags: [],
      grand:
        largeur !== null && hauteur !== null
          ? {
              valeur: `${formatDecimal(largeur)} × ${formatDecimal(hauteur)}`,
              unite,
              detail: surface !== null ? `${formatDecimal(surface, 2)} m² l’unité${total !== null && (exemplaires ?? 0) > 1 ? ` · ${formatDecimal(total, 2)} m² au total` : ''}` : undefined,
            }
          : undefined,
      vide: 'Non précisées',
    },
    {
      cle: 'quantite',
      titre: 'Quantité',
      items: [],
      tags: [],
      grand: exemplaires !== null ? { valeur: formatEntier(exemplaires), unite: exemplaires > 1 ? 'exemplaires' : 'exemplaire' } : undefined,
      vide: 'Non précisée',
    },
    {
      cle: 'finition',
      titre: 'Finitions et œillets',
      items: items([
        ['Finition', texteAncien(d.finition_oeillets)],
        ['Position', texteAncien(d.finition_position)],
      ]),
      tags: [],
      vide: 'Aucune finition demandée',
    },
  ];
}

function sectionAutres(d: Donnees): SectionAncienne | null {
  const autres = Object.entries(d).filter(([k, v]) => !CLES_CONNUES.has(k) && !valeurVide(v));
  if (!autres.length) return null;
  return { cle: 'autres', titre: 'Autres informations du formulaire', items: autres.map(([k, v]) => [cleLisible(k), texteAncien(v)]), tags: [], vide: '' };
}

interface FormulaireBrut {
  id?: unknown;
  details?: unknown;
  date_saisie?: unknown;
  type_formulaire?: unknown;
}

/** Les formulaires d'origine, le plus récent d'abord. Vide si le dossier n'en a pas. */
export function formulairesAnciens(machine: Machine, legacy: unknown): FormulaireAncien[] {
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return [];
  const l = legacy as { formulaires?: unknown; data_formulaire?: unknown };
  let bruts: FormulaireBrut[] = Array.isArray(l.formulaires) ? (l.formulaires as unknown[]).filter((f): f is FormulaireBrut => !!f && typeof f === 'object') : [];
  bruts = [...bruts].reverse();
  if (!bruts.length && l.data_formulaire && typeof l.data_formulaire === 'object' && !Array.isArray(l.data_formulaire)) bruts = [{ details: l.data_formulaire }];
  return bruts.map((f) => {
    const d = (f.details && typeof f.details === 'object' && !Array.isArray(f.details) ? f.details : {}) as Donnees;
    const type: Machine = (f.type_formulaire ?? machine) === 'roland' ? 'roland' : 'xerox';
    const sections = type === 'roland' ? sectionsRoland(d) : sectionsXerox(d);
    const autres = sectionAutres(d);
    return {
      id: typeof f.id === 'number' ? f.id : null,
      date_saisie: typeof f.date_saisie === 'string' ? f.date_saisie : null,
      type,
      sections: autres ? [...sections, autres] : sections,
    };
  });
}

/** Une section en une ligne de texte (PDF, exports) : « Document : Type Flyer · Format A5 ». */
export function sectionAncienneTexte(s: SectionAncienne): string {
  if (s.grand) return `${s.grand.valeur} ${s.grand.unite}${s.grand.detail ? ` (${s.grand.detail})` : ''}`;
  if (s.tags.length) return s.tags.join(', ');
  if (s.items.length) return s.items.map(([k, v]) => `${k} : ${v}`).join(' · ');
  return s.vide;
}

/** Résumé court pour une carte : « Flyer A5 · Couleur · 1 000 ex. » ou « Bâche · 300 × 100 cm · 2 ex. ». */
export function resumeAncien(machine: Machine, legacy: unknown): string | null {
  const f = formulairesAnciens(machine, legacy)[0];
  if (!f) return null;
  const par = (cle: CleSectionAncienne) => f.sections.find((s) => s.cle === cle);
  const morceaux: string[] = [];
  if (f.type === 'roland') {
    const support = par('support')?.items[0]?.[1];
    const dims = par('dimensions')?.grand;
    if (support) morceaux.push(support);
    if (dims) morceaux.push(`${dims.valeur} ${dims.unite}`);
  } else {
    const doc = par('document');
    const type = doc?.items.find(([k]) => k === 'Type')?.[1];
    const format = doc?.items.find(([k]) => k === 'Format')?.[1];
    const couleur = doc?.items.find(([k]) => k === 'Couleur')?.[1];
    if (type || format) morceaux.push([type, format].filter(Boolean).join(' '));
    if (couleur) morceaux.push(couleur);
  }
  const q = par('quantite')?.grand;
  if (q) morceaux.push(`${q.valeur} ex.`);
  return morceaux.length ? morceaux.join(' · ') : null;
}
