import { describe, expect, it } from 'vitest';
import { calculerPrix, PARAMS_PRIX_DEFAUT, type ParamsPrix, type Tarif } from '../src/pricing';
import { TARIFS_DEFAUT } from '../src/tarifs-defaut';
import { parseMontant, formatFCFA } from '../src/format';
import { actionsDisponibles, ACTIONS_BY_ID, verifierAction } from '../src/workflow';
import { situationPaiement } from '../src/domain';

const sansArrondi: ParamsPrix = { ...PARAMS_PRIX_DEFAUT, arrondi_pas: 0 };

describe('moteur de prix Roland', () => {
  it('bâche 300 × 200 cm + découpe : 45 000 FCFA (le bogue de l\'ancienne version donnait 4 200 003 000)', () => {
    const r = calculerPrix(
      'roland',
      { lignes: [{ support: 'bache_m2', largeur: 300, hauteur: 200, unite: 'cm', quantite: 1, finitions: [{ code: 'coupage_decoupe' }], options: [] }], forfaits: [] },
      TARIFS_DEFAUT,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lignes.map((l) => l.total)).toEqual([42000, 3000]);
    expect(r.total_ttc).toBe(45000);
  });

  it('multiplie la surface par la quantité', () => {
    const r = calculerPrix(
      'roland',
      { lignes: [{ support: 'bache_m2', largeur: 3, hauteur: 2, unite: 'm', quantite: 2, finitions: [{ code: 'coupage_decoupe' }], options: [] }], forfaits: [] },
      TARIFS_DEFAUT,
    );
    expect(r.ok && r.total_ttc).toBe(87000);
  });

  it('convertit les millimètres : 1000 × 1000 mm = 1 m²', () => {
    const r = calculerPrix(
      'roland',
      { lignes: [{ support: 'vinyle_m2', largeur: 1000, hauteur: 1000, unite: 'mm', quantite: 1, finitions: [], options: [] }], forfaits: [] },
      TARIFS_DEFAUT,
      sansArrondi,
    );
    expect(r.ok && r.lignes[0]?.quantite).toBe(1);
    expect(r.ok && r.total_ttc).toBe(9500);
  });

  it('applique la surface minimale par exemplaire', () => {
    const r = calculerPrix(
      'roland',
      { lignes: [{ support: 'bache_m2', largeur: 50, hauteur: 50, unite: 'cm', quantite: 3, finitions: [], options: [] }], forfaits: [] },
      TARIFS_DEFAUT,
      { ...sansArrondi, surface_min_m2: 1 },
    );
    expect(r.ok && r.total_ttc).toBe(21000);
  });

  it('refuse un tarif sans prix au lieu de compter 0', () => {
    const r = calculerPrix(
      'roland',
      { lignes: [{ support: 'mesh_m2', largeur: 100, hauteur: 100, unite: 'cm', quantite: 1, finitions: [], options: [] }], forfaits: [] },
      TARIFS_DEFAUT,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs[0]).toContain('Bâche mesh');
  });

  it('refuse un code inconnu', () => {
    const r = calculerPrix(
      'roland',
      { lignes: [{ support: 'inconnu', largeur: 1, hauteur: 1, unite: 'm', quantite: 1, finitions: [], options: [] }], forfaits: [] },
      TARIFS_DEFAUT,
    );
    expect(r.ok).toBe(false);
  });

  it('compte l\'ourlet au périmètre', () => {
    const tarifs: Tarif[] = TARIFS_DEFAUT.map((t) => (t.code === 'ourlet' ? { ...t, prix: 500 } : t));
    const r = calculerPrix(
      'roland',
      { lignes: [{ support: 'bache_m2', largeur: 2, hauteur: 1, unite: 'm', quantite: 1, finitions: [{ code: 'ourlet' }], options: [] }], forfaits: [] },
      tarifs,
      sansArrondi,
    );
    // 2 m² × 7000 + 6 m × 500
    expect(r.ok && r.total_ttc).toBe(17000);
  });
});

describe('moteur de prix Xerox', () => {
  it('10 pages × 20 exemplaires en A4 N&B + reliure spirale', () => {
    const r = calculerPrix(
      'xerox',
      { lignes: [{ support: 'papier_a4_nb', pages: 10, recto_verso: false, quantite: 20, finitions: [{ code: 'reliure_spirale' }], options: [] }], forfaits: [] },
      TARIFS_DEFAUT,
    );
    expect(r.ok && r.lignes.map((l) => l.total)).toEqual([10000, 500]);
    expect(r.ok && r.total_ttc).toBe(10500);
  });

  it('ajoute le supplément recto-verso par face', () => {
    const r = calculerPrix(
      'xerox',
      { lignes: [{ support: 'papier_a4_couleur', pages: 4, recto_verso: true, quantite: 10, finitions: [], options: [] }], forfaits: [] },
      TARIFS_DEFAUT,
      sansArrondi,
    );
    // 40 faces × 100 + 40 × 20
    expect(r.ok && r.total_ttc).toBe(4800);
  });

  it('additionne plusieurs sections et les forfaits du dossier', () => {
    const r = calculerPrix(
      'xerox',
      {
        lignes: [
          { support: 'papier_a4_couleur', pages: 1, recto_verso: false, quantite: 100, finitions: [], options: [] },
          { support: 'papier_a3_nb', pages: 2, recto_verso: false, quantite: 5, finitions: [], options: [] },
        ],
        forfaits: [{ code: 'conception_graphique' }],
      },
      TARIFS_DEFAUT,
      sansArrondi,
    );
    expect(r.ok && r.total_ttc).toBe(10000 + 1000 + 15000);
  });
});

describe('remise, arrondi et TVA', () => {
  const specs = { lignes: [{ support: 'papier_a4_nb', pages: 1, recto_verso: false, quantite: 123, finitions: [], options: [] }], forfaits: [] };

  it('arrondit le total à la centaine supérieure', () => {
    const r = calculerPrix('xerox', specs, TARIFS_DEFAUT);
    expect(r.ok && r.total_ttc).toBe(6200);
    expect(r.ok && r.arrondi).toBe(50);
  });

  it('applique une remise en pourcentage avant arrondi', () => {
    const r = calculerPrix('xerox', { ...specs, remise: { type: 'pourcent', valeur: 10 } }, TARIFS_DEFAUT, sansArrondi);
    expect(r.ok && r.remise).toBe(615);
    expect(r.ok && r.total_ttc).toBe(5535);
  });

  it('ventile une grille TTC à 18 %', () => {
    const r = calculerPrix('xerox', specs, TARIFS_DEFAUT, { ...sansArrondi, tva_applicable: true, tva_taux: 18 });
    expect(r.ok && r.total_ttc).toBe(6150);
    expect(r.ok && r.total_ht + r.tva).toBe(6150);
  });

  it('ajoute 18 % à une grille hors taxes', () => {
    const r = calculerPrix('xerox', specs, TARIFS_DEFAUT, { ...sansArrondi, tva_applicable: true, tva_taux: 18, prix_saisis_ht: true });
    expect(r.ok && r.total_ht).toBe(6150);
    expect(r.ok && r.tva).toBe(1107);
    expect(r.ok && r.total_ttc).toBe(7257);
  });
});

describe('formats', () => {
  it('lit les montants saisis à la française', () => {
    expect(parseMontant('45 000')).toBe(45000);
    expect(parseMontant('45.000')).toBe(45000);
    expect(parseMontant('45000 FCFA')).toBe(45000);
    expect(parseMontant('15,5')).toBeNull();
    expect(parseMontant('abc')).toBeNull();
  });
  it('affiche les montants avec espace fine', () => {
    expect(formatFCFA(1245000)).toBe('1 245 000 FCFA');
    expect(formatFCFA(null)).toBe('—');
  });
});

describe('circuit des dossiers', () => {
  const dossier = { statut: 'pret_impression' as const, machine: 'roland' as const, preparateur_id: 7, nb_fichiers: 1 };

  it("un imprimeur Xerox ne peut pas démarrer un dossier Roland", () => {
    const r = verifierAction(ACTIONS_BY_ID.demarrer, { id: 3, role: 'imprimeur_xerox' }, dossier);
    expect(r.ok).toBe(false);
  });
  it("l'imprimeur Roland peut démarrer et demander une révision", () => {
    const ids = actionsDisponibles({ id: 3, role: 'imprimeur_roland' }, dossier).map((a) => a.id);
    expect(ids).toEqual(['demarrer', 'demander_revision']);
  });
  it('la révision exige un commentaire', () => {
    const r = verifierAction(ACTIONS_BY_ID.demander_revision, { id: 3, role: 'imprimeur_roland' }, dossier, { commentaire: '' });
    expect(r.ok).toBe(false);
  });
  it("un préparateur ne valide que ses dossiers, et seulement avec un fichier", () => {
    const d = { ...dossier, statut: 'en_cours' as const, nb_fichiers: 0 };
    expect(verifierAction(ACTIONS_BY_ID.valider, { id: 8, role: 'preparateur' }, { ...d, nb_fichiers: 1 }).ok).toBe(false);
    const r = verifierAction(ACTIONS_BY_ID.valider, { id: 7, role: 'preparateur' }, d);
    expect(r.ok === false && r.code).toBe('fichiers');
  });
  it('le livreur ne peut pas clôturer', () => {
    const d = { ...dossier, statut: 'livre' as const };
    expect(actionsDisponibles({ id: 5, role: 'livreur' }, d)).toEqual([]);
  });
});

describe('situation de paiement', () => {
  it('dérive la situation du montant et des paiements validés', () => {
    expect(situationPaiement(45000, 0)).toBe('non_paye');
    expect(situationPaiement(45000, 20000)).toBe('partiel');
    expect(situationPaiement(45000, 45000)).toBe('paye');
    expect(situationPaiement(null, 0)).toBe('sans_montant');
  });
});
