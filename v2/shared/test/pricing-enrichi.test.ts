// Formulaire de commande enrichi : choix structurés (papier, pelliculage, numérotation, bords et
// œillets), forfaits du dossier, combinaisons de tarifs impossibles (A4), arrondi unique (A15).

import { describe, expect, it } from 'vitest';
import {
  calculerPrix,
  codeSupportXerox,
  detailsLigne,
  nombreOeillets,
  PARAMS_PRIX_DEFAUT,
  resumeLigne,
  UNITES_PERMISES,
  ventilerTTC,
  verifierCombinaisonTarif,
  type ParamsPrix,
  type Tarif,
} from '../src/pricing';
import { CATEGORIES_TARIF } from '../src/pricing';
import { corrigerTarifImporte, TARIFS_DEFAUT } from '../src/tarifs-defaut';
import { ligneXeroxSchema, specsRolandSchema, specsXeroxSchema, type LigneRoland, type LigneXerox } from '../src/schemas';

const sansArrondi: ParamsPrix = { ...PARAMS_PRIX_DEFAUT, arrondi_pas: 0 };
/** Grille de départ avec des prix posés sur les codes créés sans prix. */
const avecPrix = (prix: Record<string, number>): Tarif[] => TARIFS_DEFAUT.map((t) => (t.code in prix ? { ...t, prix: prix[t.code]! } : t));

const xerox = (l: Partial<LigneXerox>): LigneXerox => ligneXeroxSchema.parse({ support: 'papier_a4_couleur', pages: 1, recto_verso: false, quantite: 100, ...l });
const roland = (l: Partial<LigneRoland>) => specsRolandSchema.parse({ lignes: [{ support: 'bache_m2', largeur: 300, hauteur: 100, unite: 'cm', quantite: 1, ...l }] }).lignes[0]!;

describe('grille de départ', () => {
  it('ne contient que des combinaisons unité × machine × catégorie possibles', () => {
    for (const t of TARIFS_DEFAUT) expect(verifierCombinaisonTarif(t), `${t.machine}/${t.code}`).toBeNull();
  });
  it('codes uniques par machine, livraison commune aux deux machines', () => {
    const cles = TARIFS_DEFAUT.map((t) => `${t.machine}:${t.code}`);
    expect(new Set(cles).size).toBe(cles.length);
    expect(TARIFS_DEFAUT.find((t) => t.code === 'livraison')?.machine).toBe('global');
  });
  it('chaque format du formulaire a son code de support', () => {
    const supports = new Set(TARIFS_DEFAUT.filter((t) => t.machine === 'xerox' && t.categorie === 'support').map((t) => t.code));
    for (const f of ['a6', 'a5', 'a4', 'a3', 'sra3'] as const) {
      expect(supports.has(codeSupportXerox(f, 'couleur')!)).toBe(true);
      expect(supports.has(codeSupportXerox(f, 'nb')!)).toBe(true);
    }
    for (const f of ['cdv_85x55', 'cdv_90x50', '10x15', '13x18', '20x30'] as const) expect(supports.has(codeSupportXerox(f, 'nb')!)).toBe(true);
    expect(codeSupportXerox('perso', 'couleur')).toBeNull();
  });
});

describe('A4 : combinaisons de tarifs impossibles', () => {
  it('refuse le m² et le mètre linéaire sur Xerox, la face sur Roland, le pourcentage hors forfaits', () => {
    expect(verifierCombinaisonTarif({ machine: 'xerox', categorie: 'finition', unite: 'm2' })).toContain('au m²');
    expect(verifierCombinaisonTarif({ machine: 'xerox', categorie: 'support', unite: 'ml' })).not.toBeNull();
    expect(verifierCombinaisonTarif({ machine: 'roland', categorie: 'support', unite: 'page' })).not.toBeNull();
    expect(verifierCombinaisonTarif({ machine: 'roland', categorie: 'finition', unite: 'pourcent' })).not.toBeNull();
    expect(verifierCombinaisonTarif({ machine: 'global', categorie: 'support', unite: 'exemplaire' })).toContain('une machine');
    expect(verifierCombinaisonTarif({ machine: 'global', categorie: 'divers', unite: 'pourcent' })).toBeNull();
    for (const m of ['roland', 'xerox', 'global'] as const) for (const c of CATEGORIES_TARIF) expect(Array.isArray(UNITES_PERMISES[m][c])).toBe(true);
  });

  it('le moteur lève une erreur au lieu de compter 0 (m² sur Xerox)', () => {
    const tarifs = avecPrix({}).map((t) => (t.code === 'plastification' ? { ...t, unite: 'm2' as const } : t));
    const r = calculerPrix('xerox', { lignes: [xerox({ finitions: [{ code: 'plastification' }] })], forfaits: [] }, tarifs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs[0]).toContain('mal réglé dans Tarifs');
  });

  it('un pourcentage sur une finition bloque (il était ignoré sans rien dire)', () => {
    const tarifs = TARIFS_DEFAUT.map((t) => (t.code === 'vernis' ? { ...t, unite: 'pourcent' as const } : t));
    const r = calculerPrix('roland', { lignes: [roland({ finitions: [{ code: 'vernis' }] })], forfaits: [] }, tarifs);
    expect(r.ok).toBe(false);
  });

  it('un forfait au m² dans les forfaits du dossier bloque au lieu de compter 0', () => {
    const r = calculerPrix('roland', { lignes: [roland({})], forfaits: [{ code: 'pelliculage' }] }, TARIFS_DEFAUT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs[0]).toContain('ajoutez-le sur une ligne');
  });

  it('un pourcentage du dossier s’applique au sous-total', () => {
    const tarifs: Tarif[] = [...TARIFS_DEFAUT, { machine: 'global', categorie: 'divers', code: 'majoration', libelle: 'Majoration week-end', unite: 'pourcent', prix: 10, actif: true }];
    const r = calculerPrix('roland', { lignes: [roland({})], forfaits: [{ code: 'majoration' }] }, tarifs, sansArrondi);
    expect(r.ok && r.total_ttc).toBe(21000 + 2100);
  });

  it('un code sans prix bloque avec un message clair', () => {
    const r = calculerPrix('xerox', { lignes: [xerox({ support: 'papier_a6_couleur' })], forfaits: [] }, TARIFS_DEFAUT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs[0]).toBe('Ligne 1 : prix de « A6 couleur » à renseigner dans Tarifs.');
  });
});

describe('Xerox : papier, pelliculage, numérotation', () => {
  const tarifs = avecPrix({ papier_a5_couleur: 60, papier_couche_170: 25, pelliculage_mat: 150, numerotation: 10, carte_visite: 150, papier_carte_250_350: 40 });

  it('flyer A5 couché 170 g recto-verso, pelliculage mat recto-verso, numéroté', () => {
    const l = xerox({ support: 'papier_a5_couleur', format: 'a5', couleur: 'couleur', pages: 2, recto_verso: true, quantite: 500, papier: 'couche_170', pelliculage: { type: 'mat', faces: 'recto_verso' }, numerotation: { depart: 1, chiffres: 4 } });
    const r = calculerPrix('xerox', { lignes: [l], forfaits: [] }, tarifs, sansArrondi);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const par = Object.fromEntries(r.lignes.map((x) => [x.code, x]));
    expect(par.papier_a5_couleur!.total).toBe(1000 * 60); // 1 000 faces
    expect(par.papier_couche_170!.total).toBe(500 * 25); // 500 feuilles
    expect(par.pelliculage_mat!.quantite).toBe(1000); // 500 feuilles × 2 faces
    expect(par.pelliculage_mat!.libelle).toBe('Pelliculage mat recto-verso');
    expect(par.numerotation!.total).toBe(500 * 10);
    expect(par.numerotation!.explication).toBe('Du n° 0001 au n° 0500');
    expect(par.impression_recto_verso!.total).toBe(500 * 20);
    expect(r.total_ttc).toBe(60000 + 12500 + 150000 + 5000 + 10000);
  });

  it('papier ordinaire : aucun supplément', () => {
    const r = calculerPrix('xerox', { lignes: [xerox({ papier: 'ordinaire_80' })], forfaits: [] }, tarifs, sansArrondi);
    expect(r.ok && r.lignes.map((x) => x.code)).toEqual(['papier_a4_couleur']);
  });

  it('cartes de visite 350 g : 100 cartes = 100 × le prix unitaire (A3)', () => {
    const l = xerox({ support: 'carte_visite', format: 'cdv_85x55', pages: 2, recto_verso: true, quantite: 100, papier: 'couche_350' });
    const r = calculerPrix('xerox', { lignes: [l], forfaits: [] }, tarifs, sansArrondi);
    expect(r.ok && r.lignes.find((x) => x.code === 'carte_visite')?.total).toBe(15000);
  });

  it('un code de pelliculage cochée en double n’est compté qu’une fois', () => {
    const l = xerox({ pelliculage: { type: 'mat', faces: 'recto' }, finitions: [{ code: 'pelliculage_mat' }] });
    const r = calculerPrix('xerox', { lignes: [l], forfaits: [] }, tarifs, sansArrondi);
    expect(r.ok && r.lignes.filter((x) => x.code === 'pelliculage_mat')).toHaveLength(1);
  });

  it('alerte sur un recto-verso à 1 page, sans bloquer (A15)', () => {
    const r = calculerPrix('xerox', { lignes: [xerox({ pages: 1, recto_verso: true })], forfaits: [] }, tarifs);
    expect(r.ok).toBe(true);
    expect(r.ok && r.avertissements?.[0]).toContain('1 seule page');
    const ok = calculerPrix('xerox', { lignes: [xerox({ pages: 2, recto_verso: true })], forfaits: [] }, tarifs);
    expect(ok.ok && ok.avertissements).toEqual([]);
  });

  it('précisions pour l’atelier et résumé', () => {
    const l = xerox({ type_document: 'brochure', partie: 'couverture', format: 'a4', couleur: 'couleur', papier: 'couche_300', pelliculage: { type: 'brillant', faces: 'recto' }, conditionnement: ['filme'] });
    expect(detailsLigne('xerox', l)).toEqual(['Brochure', 'Couverture', 'A4', 'Couleur', 'Couché 300 g', 'Pelliculage brillant recto', 'Filmé']);
    expect(resumeLigne('xerox', l, 'A4 couleur')).toBe('A4 couleur · Couché 300 g · 1 p. · 100 ex.');
  });

  it('les anciennes spécifications (sans les nouveaux champs) restent valides', () => {
    const r = specsXeroxSchema.safeParse({ lignes: [{ support: 'papier_a4_nb', pages: 3, recto_verso: false, quantite: 2, finitions: [], options: [] }], forfaits: [] });
    expect(r.success).toBe(true);
  });
});

describe('Roland : bords et œillets', () => {
  const tarifs = avecPrix({ oeillets: 100, ourlet: 500, collage: 400, kakemono: 25000, contrecollage_m2: 6000 });

  it('œillets tout autour tous les 50 cm : périmètre ÷ espacement, par exemplaire × quantité', () => {
    const l = roland({ largeur: 300, hauteur: 100, quantite: 2, bords: 'oeillets', oeillets: { position: 'tous_cotes', espacement_cm: 50 } });
    expect(nombreOeillets(l)).toEqual({ parExemplaire: 16, total: 32 });
    const r = calculerPrix('roland', { lignes: [l], forfaits: [] }, tarifs, sansArrondi);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const o = r.lignes.find((x) => x.code === 'oeillets')!;
    expect(o).toMatchObject({ quantite: 32, total: 3200, libelle: 'Œillets (16 par exemplaire)' });
    expect(r.total_ttc).toBe(2 * 3 * 7000 + 3200);
  });

  it('œillets aux 4 coins, et jamais moins de 4', () => {
    expect(nombreOeillets(roland({ bords: 'oeillets', oeillets: { position: 'angles', espacement_cm: 50 }, quantite: 3 }))).toEqual({ parExemplaire: 4, total: 12 });
    expect(nombreOeillets(roland({ largeur: 20, hauteur: 20, bords: 'oeillets', oeillets: { position: 'tous_cotes', espacement_cm: 100 } }))?.parExemplaire).toBe(4);
  });

  it('œillets sans prix : le calcul bloque', () => {
    const r = calculerPrix('roland', { lignes: [roland({ bords: 'oeillets', oeillets: { position: 'angles', espacement_cm: 50 } })], forfaits: [] }, TARIFS_DEFAUT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs[0]).toContain('prix de « Œillets » à renseigner dans Tarifs');
  });

  it('ourlet et collage au périmètre ; kakémono par exemplaire ; contrecollage au m²', () => {
    const ourlet = calculerPrix('roland', { lignes: [roland({ largeur: 2, hauteur: 1, unite: 'm', bords: 'ourlet' })], forfaits: [] }, tarifs, sansArrondi);
    expect(ourlet.ok && ourlet.total_ttc).toBe(14000 + 6 * 500);
    const collage = calculerPrix('roland', { lignes: [roland({ largeur: 2, hauteur: 1, unite: 'm', bords: 'collage' })], forfaits: [] }, tarifs, sansArrondi);
    expect(collage.ok && collage.total_ttc).toBe(14000 + 6 * 400);
    const kakemono = calculerPrix('roland', { lignes: [roland({ support: 'kakemono', largeur: 85, hauteur: 200, quantite: 2, finitions: [{ code: 'contrecollage_m2' }] })], forfaits: [] }, tarifs, sansArrondi);
    expect(kakemono.ok && kakemono.total_ttc).toBe(50000 + Math.round(0.85 * 2 * 2 * 6000));
  });

  it('découpe à la forme par exemplaire (A5)', () => {
    const r = calculerPrix('roland', { lignes: [roland({ quantite: 4, finitions: [{ code: 'coupage_decoupe' }] })], forfaits: [] }, TARIFS_DEFAUT, sansArrondi);
    expect(r.ok && r.lignes.find((x) => x.code === 'coupage_decoupe')?.total).toBe(12000);
  });

  it('explique la surface en clair', () => {
    const r = calculerPrix('roland', { lignes: [roland({ quantite: 2 })], forfaits: [] }, TARIFS_DEFAUT);
    expect(r.ok && r.lignes[0]?.explication).toBe('3 m × 1 m = 3 m² par exemplaire × 2 ex.');
  });

  it('précisions pour l’atelier', () => {
    expect(detailsLigne('roland', roland({ bords: 'oeillets', oeillets: { position: 'tous_cotes', espacement_cm: 50 } }))).toEqual(['Œillets tout autour tous les 50 cm : 16 par exemplaire']);
  });
});

describe('forfaits du dossier', () => {
  it('livraison commune : trouvée aussi pour un dossier Xerox', () => {
    const r = calculerPrix('xerox', { lignes: [xerox({})], forfaits: [{ code: 'livraison' }] }, TARIFS_DEFAUT, sansArrondi);
    expect(r.ok && r.lignes.map((l) => l.code)).toEqual(['papier_a4_couleur', 'livraison']);
  });

  it('une livraison déjà en option sur une ligne n’est pas comptée deux fois', () => {
    const r = calculerPrix('roland', { lignes: [roland({ options: ['livraison'] })], forfaits: [{ code: 'livraison' }] }, TARIFS_DEFAUT, sansArrondi);
    expect(r.ok && r.lignes.filter((l) => l.code === 'livraison')).toHaveLength(1);
  });

  it('conception offerte : déduite sur une ligne visible', () => {
    const r = calculerPrix('xerox', { lignes: [xerox({})], forfaits: [{ code: 'conception_graphique' }, { code: 'urgence_48h' }, { code: 'epreuve_numerique' }], conception_offerte: true }, TARIFS_DEFAUT, sansArrondi);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lignes.find((l) => l.libelle === 'Conception graphique offerte')?.total).toBe(-15000);
    expect(r.total_ttc).toBe(10000 + 5000 + 2000);
  });

  it('conception offerte sans conception : avertissement, rien de déduit', () => {
    const r = calculerPrix('xerox', { lignes: [xerox({})], forfaits: [], conception_offerte: true }, TARIFS_DEFAUT, sansArrondi);
    expect(r.ok && r.total_ttc).toBe(10000);
    expect(r.ok && r.avertissements?.join(' ')).toContain('Conception offerte');
  });
});

describe('A15 : une seule règle d’arrondi et un plafond', () => {
  const specs = { lignes: [xerox({ support: 'papier_a4_nb', quantite: 201 })], forfaits: [] };

  it('grille hors taxes : HT + TVA = TTC, identique à la ventilation de la facture', () => {
    const params = { ...PARAMS_PRIX_DEFAUT, tva_applicable: true, tva_taux: 18, prix_saisis_ht: true };
    const r = calculerPrix('xerox', specs, TARIFS_DEFAUT, params);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 10 050 HT + 1 809 de TVA = 11 859, arrondi à 11 900 TTC (l'ancienne règle affichait HT 10 050 + TVA 1 809 ≠ 11 900).
    expect(r.total_ttc).toBe(11900);
    expect(r.arrondi).toBe(41);
    expect(r.total_ht + r.tva).toBe(r.total_ttc);
    expect({ ht: r.total_ht, tva: r.tva }).toEqual({ ht: ventilerTTC(11900, params).ht, tva: ventilerTTC(11900, params).tva });
  });

  it('grille TTC avec TVA : même ventilation', () => {
    const params = { ...PARAMS_PRIX_DEFAUT, tva_applicable: true, tva_taux: 18 };
    const r = calculerPrix('xerox', specs, TARIFS_DEFAUT, params);
    expect(r.ok && r.total_ttc).toBe(10100);
    expect(r.ok && r.total_ht + r.tva).toBe(10100);
  });

  it('plafond : un total au-delà d’un milliard est refusé avec un message clair', () => {
    const r = calculerPrix('roland', { lignes: [roland({ largeur: 100, hauteur: 100, unite: 'm', quantite: 100_000 })], forfaits: [] }, TARIFS_DEFAUT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs[0]).toContain('Le total dépasse');
  });
});

describe('A3 : correction des tarifs importés', () => {
  it('carte de visite importée en « papier » ou en « divers à l’unité » : support Xerox par exemplaire', () => {
    expect(corrigerTarifImporte({ machine: 'xerox', categorie: 'papier', code: 'carte_visite', unite: 'unite' })).toMatchObject({ machine: 'xerox', categorie: 'support', unite: 'exemplaire' });
    expect(corrigerTarifImporte({ machine: 'global', categorie: 'divers', code: 'carte_visite', unite: 'unite' })).toMatchObject({ machine: 'xerox', categorie: 'support', unite: 'exemplaire' });
  });
  it('« papier » : un format devient support, un papier devient option par feuille', () => {
    expect(corrigerTarifImporte({ machine: 'xerox', categorie: 'papier', code: 'papier_a5_couleur', unite: 'page' })).toMatchObject({ categorie: 'support', unite: 'page' });
    expect(corrigerTarifImporte({ machine: 'xerox', categorie: 'papier', code: 'papier_couche_170', unite: 'unite' })).toMatchObject({ categorie: 'option', unite: 'feuille' });
  });
  it('livraison commune ; reliure par exemplaire ; un tarif correct ne change pas', () => {
    expect(corrigerTarifImporte({ machine: 'roland', categorie: 'option', code: 'livraison', unite: 'forfait' })).toMatchObject({ machine: 'global', categorie: 'option' });
    expect(corrigerTarifImporte({ machine: 'xerox', categorie: 'finition', code: 'reliure_spirale', unite: 'forfait' })).toMatchObject({ unite: 'exemplaire' });
    expect(corrigerTarifImporte({ machine: 'roland', categorie: 'support', code: 'bache_m2', unite: 'm2' })).toBeNull();
  });
});
