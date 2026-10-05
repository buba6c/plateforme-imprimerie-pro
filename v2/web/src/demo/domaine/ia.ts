// Assistant IA de la démonstration : aucune IA n'est appelée. La demande est lue simplement
// (machine, dimensions, quantité, quelques mots-clés) pour proposer des spécifications d'exemple,
// dont le prix est calculé par le vrai moteur de prix avec la grille en mémoire.

import { calculerPrix, specsSchemaFor, type Machine, type Specs } from '@evocom/shared';
import { z } from 'zod';
import { E, type TarifDemo, type UserDemo } from '../etat';
import { ErreurDemo, forbidden } from '../http';
import { tarifsPrix } from './dossiers';

const schema = z.object({
  description: z
    .string({ required_error: 'Décrivez la demande du client', invalid_type_error: 'Description : texte attendu' })
    .trim()
    .min(1, 'Décrivez la demande du client')
    .max(2000, 'Description : 2000 caractères au maximum'),
  machine: z.enum(['roland', 'xerox'], { errorMap: () => ({ message: 'Machine : roland ou xerox' }) }).optional(),
});

const sansAccents = (s: string) => s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const GRAND_FORMAT = /bache|banderole|vinyle|adhesif|kakemono|roll|enseigne|panneau|toile|canvas|backlit|mesh|vitrine|m2|metre carre|grand format/;

function utilisables(machine: Machine, categorie: TarifDemo['categorie']) {
  return E().tarifs.filter((t) => t.machine === machine && t.categorie === categorie && t.actif && t.prix !== null);
}

function choisir(machine: Machine, categorie: TarifDemo['categorie'], texte: string, motsCles: [RegExp, string][]): TarifDemo | undefined {
  const liste = utilisables(machine, categorie);
  for (const [re, code] of motsCles) if (re.test(texte)) {
    const t = liste.find((x) => x.code.includes(code));
    if (t) return t;
  }
  return liste[0];
}

function quantite(texte: string): number | null {
  const m = /(\d[\d\s]{0,6})\s*(ex\b|exemplaires?|pieces?|unites?|flyers?|cartes?|affiches?|baches?|brochures?|copies?|tracts?|depliants?)/.exec(texte);
  if (!m) return null;
  const n = Number(m[1]!.replace(/\s/g, ''));
  return Number.isInteger(n) && n > 0 ? Math.min(n, 100_000) : null;
}

function dimensions(texte: string): { largeur: number; hauteur: number; unite: 'cm' | 'm' } | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(m|cm)?\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(m|cm)?/.exec(texte);
  if (!m) return null;
  const l = Number(m[1]!.replace(',', '.'));
  const h = Number(m[3]!.replace(',', '.'));
  const unite = (m[4] ?? m[2]) === 'm' || (!m[2] && !m[4] && l <= 20 && h <= 20) ? 'm' : 'cm';
  return l > 0 && h > 0 ? { largeur: l, hauteur: h, unite } : null;
}

export function suggestion(user: UserDemo, body: unknown) {
  if (user.role !== 'admin' && user.role !== 'preparateur') throw forbidden();
  const { description, machine: imposee } = schema.parse(body ?? {});
  if (!E().ia.actif) throw new ErreurDemo(409, "L'assistant n'est pas activé.", undefined, 'ia_inactif');
  const texte = sansAccents(description);
  const machine: Machine = imposee ?? (GRAND_FORMAT.test(texte) ? 'roland' : 'xerox');
  const avertissements: string[] = [];
  let specs: Specs;

  if (machine === 'roland') {
    const support = choisir('roland', 'support', texte, [
      [/mesh/, 'mesh'],
      [/vinyle|adhesif|autocollant|vitrine/, 'vinyle'],
      [/toile|canvas/, 'toile'],
      [/photo/, 'photo'],
      [/bache|banderole/, 'bache'],
    ]);
    const dim = dimensions(texte);
    if (!dim) avertissements.push('Dimensions non précisées : 300 × 200 cm proposés, à corriger.');
    const finitions: { code: string; quantite?: number }[] = [];
    const n = quantite(texte) ?? 1;
    if (/oeillet/.test(texte)) {
      const t = utilisables('roland', 'finition').find((x) => x.code.includes('oeillet'));
      if (t) finitions.push({ code: t.code, quantite: 8 * n });
    }
    if (/pellicul/.test(texte)) {
      const t = utilisables('roland', 'finition').find((x) => x.code.includes('pellicul'));
      if (t) finitions.push({ code: t.code });
    }
    specs = specsSchemaFor('roland').parse({
      lignes: [
        {
          support: support?.code ?? 'bache_m2',
          largeur: dim?.largeur ?? 300,
          hauteur: dim?.hauteur ?? 200,
          unite: dim?.unite ?? 'cm',
          quantite: n,
          finitions,
          options: /pose|install|montage/.test(texte) ? utilisables('roland', 'option').filter((t) => t.code.includes('montage')).map((t) => t.code) : [],
          description: null,
        },
      ],
      forfaits: [],
    }) as Specs;
  } else {
    const support = choisir('xerox', 'support', texte, [
      [/carte(s)? de visite/, 'carte_visite'],
      [/a3.*(nb|noir)|(nb|noir).*a3/, 'a3_nb'],
      [/a3/, 'a3_couleur'],
      [/a5|flyer|tract/, 'a5'],
      [/(nb|noir et blanc|noir & blanc)/, 'a4_nb'],
      [/a4|couleur|brochure|document/, 'a4_couleur'],
    ]);
    const n = quantite(texte);
    if (!n) avertissements.push('Quantité non précisée : 100 exemplaires proposés, à corriger.');
    const pages = /(\d{1,4})\s*pages?/.exec(texte);
    const finitions: { code: string }[] = [];
    for (const [re, code] of [
      [/spirale/, 'reliure_spirale'],
      [/thermique/, 'reliure_thermique'],
      [/plastifi/, 'plastification'],
      [/agraf/, 'agrafage'],
    ] as const) {
      if (re.test(texte) && utilisables('xerox', 'finition').some((t) => t.code === code)) finitions.push({ code });
    }
    specs = specsSchemaFor('xerox').parse({
      lignes: [
        {
          support: support?.code ?? 'papier_a4_couleur',
          pages: pages ? Math.max(1, Number(pages[1])) : 1,
          recto_verso: /recto[\s-]?verso/.test(texte),
          quantite: n ?? 100,
          finitions,
          options: /premium|epais|couche/.test(texte) ? ['papier_premium'] : [],
          description: null,
        },
      ],
      forfaits: [],
    }) as Specs;
  }
  if (/urgent|24\s*h|demain/.test(texte) && E().tarifs.some((t) => t.code === 'urgence_24h' && t.actif)) specs.forfaits = [{ code: 'urgence_24h' }];

  const calcul = calculerPrix(machine, specs, tarifsPrix(), E().parametres.prix);
  return {
    machine,
    specs,
    prix: calcul.ok ? { total: calcul.total_ttc, ...calcul } : null,
    ...(calcul.ok ? {} : { erreur_prix: calcul.erreurs.join(' ') }),
    avertissements,
    remarques: 'Démonstration : proposition d’exemple établie sans IA à partir de quelques mots-clés ; le prix vient de la grille tarifaire.',
  };
}
