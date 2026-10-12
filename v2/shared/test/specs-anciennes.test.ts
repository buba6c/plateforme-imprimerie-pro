import { describe, expect, it } from 'vitest';
import { formatDecimal, formatEntier } from '../src/format';
import { formulairesAnciens, resumeAncien, sectionAncienneTexte } from '../src/specs-anciennes';

const xerox = {
  sections: [],
  supports: [],
  formulaires: [
    {
      id: 3265,
      details: {
        client: 'Mbaye Sow',
        format: 'A5',
        finition: ['Pelliculage Mat Recto'],
        grammage: '170g',
        faconnage: [],
        numerotation: true,
        type_document: 'Flyer',
        grammage_autre: '',
        conditionnement: ['Liasses de 100'],
        faconnage_autre: '',
        mode_impression: 'recto_verso',
        nombre_chiffres: '4',
        couleur_impression: 'couleur',
        debut_numerotation: '1001',
        nombre_exemplaires: '1000',
        format_personnalise: '',
        type_document_autre: '',
        champ_inconnu: 'valeur gardée',
      },
      dossier_id: 3090,
      date_saisie: '2026-10-08T17:23:41.668068',
      type_formulaire: 'xerox',
    },
  ],
  data_formulaire: { client: 'Mbaye Sow' },
};

const roland = {
  formulaires: [
    { id: 1, details: { unite: 'cm', hauteur: '100', largeur: '300', surface_m2: '3.00', type_support: 'Bâche', finition_oeillets: 'Découpé', finition_position: 'Tous les côtés', nombre_exemplaires: '2' }, type_formulaire: 'roland' },
    { id: 2, details: { unite: 'cm', hauteur: '200', largeur: '85', surface_m2: '1.70', type_support: 'Autre', type_support_autre: 'Kakémono', nombre_exemplaires: '1' }, type_formulaire: 'roland', date_saisie: '2026-10-09T10:00:00' },
  ],
};

describe('formulaire de l’ancienne plateforme', () => {
  it('range un formulaire Xerox en sections, sans rien perdre', () => {
    const [f] = formulairesAnciens('xerox', xerox);
    expect(f).toBeTruthy();
    expect(f!.type).toBe('xerox');
    expect(f!.date_saisie).toBe('2026-10-08T17:23:41.668068');
    const par = Object.fromEntries(f!.sections.map((s) => [s.cle, s]));
    expect(par.document!.items).toEqual([
      ['Type', 'Flyer'],
      ['Format', 'A5'],
      ['Couleur', 'Couleur'],
      ['Impression', 'Recto-verso'],
    ]);
    expect(par.quantite!.grand).toEqual({ valeur: formatEntier(1000), unite: 'exemplaires', detail: undefined });
    expect(par.papier!.items).toEqual([['Grammage', '170g']]);
    expect(par.finition!.tags).toEqual(['Pelliculage Mat Recto']);
    expect(par.faconnage!.tags).toEqual([]);
    expect(sectionAncienneTexte(par.faconnage!)).toBe('Aucun façonnage demandé');
    expect(par.conditionnement!.tags).toEqual(['Liasses de 100']);
    expect(par.numerotation!.accent).toBe('alerte');
    expect(sectionAncienneTexte(par.numerotation!)).toBe('Numéroter : Oui · À partir de : 1001 · Chiffres : 4');
    expect(par.autres!.items).toEqual([['Champ inconnu', 'valeur gardée']]);
    expect(resumeAncien('xerox', xerox)).toBe(`Flyer A5 · Couleur · ${formatEntier(1000)} ex.`);
  });

  it('Roland : dimensions, surface, support « autre », le plus récent d’abord', () => {
    const forms = formulairesAnciens('roland', roland);
    expect(forms.map((f) => f.id)).toEqual([2, 1]);
    const ancien = forms[1]!;
    const par = Object.fromEntries(ancien.sections.map((s) => [s.cle, s]));
    expect(par.support!.items).toEqual([['Support', 'Bâche']]);
    expect(par.dimensions!.grand).toEqual({ valeur: '300 × 100', unite: 'cm', detail: `${formatDecimal(3, 2)} m² l’unité · ${formatDecimal(6, 2)} m² au total` });
    expect(par.finition!.items).toEqual([
      ['Finition', 'Découpé'],
      ['Position', 'Tous les côtés'],
    ]);
    expect(forms[0]!.sections.find((s) => s.cle === 'support')!.items).toEqual([['Support', 'Kakémono']]);
    expect(resumeAncien('roland', roland)).toBe('Kakémono · 85 × 200 cm · 1 ex.');
  });

  it('retombe sur data_formulaire, et ne renvoie rien sans données', () => {
    expect(formulairesAnciens('xerox', { data_formulaire: { type_document: 'Affiche', nombre_exemplaires: 5 } })[0]!.sections[0]!.items).toEqual([['Type', 'Affiche']]);
    expect(formulairesAnciens('xerox', null)).toEqual([]);
    expect(formulairesAnciens('xerox', { sections: [], supports: [] })).toEqual([]);
    expect(resumeAncien('xerox', {})).toBeNull();
  });
});
