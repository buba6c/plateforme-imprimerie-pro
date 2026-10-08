// Formulaire de commande enrichi : devis (remise au client, délai, acompte, conditions), conversion
// en dossier, écran Tarifs (combinaisons impossibles, A4), migration 008 (livraison commune, carte de
// visite, reliures par exemplaire), estimation avec les choix structurés.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { invalidateTarifs } from '../src/lib/tarifs';
import { agent, app, comptes } from './helpers';

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep' | 'livreur', Agent>;

/** La grille est partagée avec les autres suites : elle est remise telle quelle à la fin. */
let grilleAvant: Record<string, unknown>[] = [];

async function poserPrix(prix: Record<string, number | null>) {
  for (const [code, p] of Object.entries(prix)) await getPool().query(`UPDATE tarifs SET prix = $2 WHERE code = $1`, [code, p]);
  invalidateTarifs();
}

const flyersA5 = {
  machine: 'xerox',
  client_nom: 'Lycée Lamine Guèye',
  description: '1 000 flyers A5 portes ouvertes',
  specs: {
    lignes: [
      {
        support: 'papier_a5_couleur',
        pages: 2,
        recto_verso: true,
        quantite: 1000,
        finitions: [],
        options: [],
        type_document: 'flyer',
        format: 'a5',
        couleur: 'couleur',
        papier: 'couche_170',
        pelliculage: { type: 'mat', faces: 'recto' },
        conditionnement: ['liasse_100'],
      },
    ],
    forfaits: [{ code: 'livraison' }, { code: 'urgence_48h' }, { code: 'conception_graphique' }, { code: 'epreuve_numerique' }],
    conception_offerte: true,
    livraison_contact: 'M. Diallo, 77 000 00 00',
  },
};

beforeAll(async () => {
  await app();
  grilleAvant = (await getPool().query(`SELECT * FROM tarifs ORDER BY id`)).rows;
  for (const k of ['admin', 'prep', 'livreur'] as const) A[k] = await agent(comptes[k]);
});

afterAll(async () => {
  const pool = getPool();
  await pool.query(`DELETE FROM tarifs WHERE id <> ALL($1::int[])`, [grilleAvant.map((t) => t.id)]);
  for (const t of grilleAvant) {
    await pool.query(`UPDATE tarifs SET machine = $2, categorie = $3, unite = $4, prix = $5, actif = $6, libelle = $7 WHERE id = $1`, [t.id, t.machine, t.categorie, t.unite, t.prix, t.actif, t.libelle]);
  }
  invalidateTarifs();
});

describe('migration 008 et grille de départ', () => {
  it('livraison commune, carte de visite en support par exemplaire, reliures et découpe par exemplaire', async () => {
    const pool = getPool();
    // Base existante simulée : état d'avant la migration (comme l'import du 8 octobre).
    await pool.query(`UPDATE tarifs SET machine = 'roland' WHERE code = 'livraison'`);
    await pool.query(`UPDATE tarifs SET categorie = 'divers', unite = 'unite', prix = 150 WHERE code = 'carte_visite'`);
    await pool.query(`UPDATE tarifs SET unite = 'forfait' WHERE code IN ('reliure_spirale', 'reliure_thermique', 'coupage_decoupe')`);
    await pool.query(`DELETE FROM tarifs WHERE code IN ('papier_a6_nb', 'collage')`);
    const ici = path.dirname(fileURLToPath(import.meta.url));
    const sql = fs.readFileSync(path.join(ici, '../src/db/migrations/008_tarifs_enrichis.sql'), 'utf8');
    // Les étapes de données (1 à 4) sont rejouables ; l'ajout de colonnes (5) est déjà fait.
    await pool.query(sql.split('-- 5.')[0]!);
    invalidateTarifs();
    const t = async (code: string) => (await pool.query(`SELECT machine, categorie, unite, prix FROM tarifs WHERE code = $1`, [code])).rows;
    expect(await t('livraison')).toEqual([{ machine: 'global', categorie: 'option', unite: 'forfait', prix: 5000 }]);
    expect(await t('carte_visite')).toEqual([{ machine: 'xerox', categorie: 'support', unite: 'exemplaire', prix: 150 }]);
    expect((await t('reliure_spirale'))[0]).toMatchObject({ unite: 'exemplaire', prix: 500 });
    expect((await t('coupage_decoupe'))[0]).toMatchObject({ unite: 'exemplaire', prix: 3000 });
    expect(await t('papier_a6_nb')).toEqual([{ machine: 'xerox', categorie: 'support', unite: 'page', prix: null }]);
    expect(await t('collage')).toEqual([{ machine: 'roland', categorie: 'finition', unite: 'ml', prix: null }]);
    const doublons = await pool.query(`SELECT machine, code FROM tarifs GROUP BY machine, code HAVING count(*) > 1`);
    expect(doublons.rowCount).toBe(0);
  });

  it('100 cartes de visite valent 100 fois le prix unitaire (A3)', async () => {
    const r = await A.prep.post('/api/tarifs/estimer').send({
      machine: 'xerox',
      specs: { lignes: [{ support: 'carte_visite', pages: 2, recto_verso: true, quantite: 100, finitions: [], options: [], format: 'cdv_85x55' }], forfaits: [] },
    });
    expect(r.status).toBe(200);
    expect(r.body.lignes[0]).toMatchObject({ code: 'carte_visite', quantite: 100, total: 15000 });
  });

  it('la livraison est trouvée pour un dossier Xerox', async () => {
    const r = await A.prep.post('/api/tarifs/estimer').send({
      machine: 'xerox',
      specs: { lignes: [{ support: 'papier_a4_couleur', pages: 1, quantite: 10, finitions: [], options: [] }], forfaits: [{ code: 'livraison' }] },
    });
    expect(r.body.ok).toBe(true);
    expect(r.body.lignes.map((l: { code: string }) => l.code)).toEqual(['papier_a4_couleur', 'livraison']);
  });
});

describe('Tarifs : combinaisons impossibles refusées (A4)', () => {
  it('refuse le m² sur Xerox, le pourcentage sur une finition, un support commun aux deux machines', async () => {
    const m2 = await A.admin.post('/api/tarifs').send({ machine: 'xerox', categorie: 'finition', code: 'test_m2_xerox', libelle: 'Essai', unite: 'm2', prix: 100 });
    expect(m2.status).toBe(400);
    expect(m2.body.champs.unite).toContain('au m²');
    expect((await A.admin.post('/api/tarifs').send({ machine: 'roland', categorie: 'finition', code: 'test_pct', libelle: 'Essai', unite: 'pourcent', prix: 10 })).status).toBe(400);
    expect((await A.admin.post('/api/tarifs').send({ machine: 'global', categorie: 'support', code: 'test_sup', libelle: 'Essai', unite: 'exemplaire', prix: 10 })).status).toBe(400);
    const ok = await A.admin.post('/api/tarifs').send({ machine: 'global', categorie: 'divers', code: 'test_majoration', libelle: 'Majoration', unite: 'pourcent', prix: 10 });
    expect(ok.status).toBe(201);
    // Modification : la machine reste, la nouvelle unité est vérifiée.
    const plast = (await getPool().query(`SELECT id FROM tarifs WHERE code = 'plastification'`)).rows[0];
    expect((await A.admin.patch(`/api/tarifs/${plast.id}`).send({ unite: 'm2' })).status).toBe(400);
    expect((await A.admin.patch(`/api/tarifs/${plast.id}`).send({ prix: 300 })).status).toBe(200);
  });

  it('le moteur lève une erreur au lieu de compter 0 pour un tarif incohérent déjà en base', async () => {
    await getPool().query(`UPDATE tarifs SET unite = 'm2' WHERE code = 'plastification'`);
    invalidateTarifs();
    const r = await A.prep.post('/api/tarifs/estimer').send({
      machine: 'xerox',
      specs: { lignes: [{ support: 'papier_a4_couleur', pages: 1, quantite: 10, finitions: [{ code: 'plastification' }], options: [] }], forfaits: [] },
    });
    expect(r.body.ok).toBe(false);
    expect(r.body.erreurs[0]).toContain('mal réglé dans Tarifs');
    await getPool().query(`UPDATE tarifs SET unite = 'page' WHERE code = 'plastification'`);
    invalidateTarifs();
  });
});

describe('devis : remise au client, délai, acompte, conditions', () => {
  let devisId: number;

  it('refuse tant que les nouveaux tarifs n’ont pas de prix, avec un message clair', async () => {
    const r = await A.prep.post('/api/devis').send(flyersA5);
    expect(r.status).toBe(422);
    expect(r.body.details.erreurs.join(' ')).toContain('prix de « A5 couleur » à renseigner dans Tarifs');
  });

  it('chiffre les choix structurés et enregistre les conditions', async () => {
    await poserPrix({ papier_a5_couleur: 60, papier_couche_170: 25, pelliculage_mat: 150 });
    const r = await A.prep.post('/api/devis').send({
      ...flyersA5,
      mode_remise: 'livraison',
      adresse_livraison: 'Médina, rue 22',
      delai_jours: 3,
      acompte_pourcent: 50,
      conditions_paiement: 'Solde à la livraison',
    });
    expect(r.status).toBe(201);
    devisId = r.body.id;
    // 2 000 faces × 60 + 1 000 feuilles × (25 + 150 + 20 recto-verso) + livraison 5 000 + urgence 5 000
    // + conception 15 000 − conception offerte 15 000 + BAT 2 000
    expect(r.body.total_ttc).toBe(120000 + 25000 + 150000 + 20000 + 5000 + 5000 + 2000);
    expect(r.body).toMatchObject({ mode_remise: 'livraison', adresse_livraison: 'Médina, rue 22', delai_jours: 3, acompte_pourcent: 50, conditions_paiement: 'Solde à la livraison' });
    const offerte = r.body.detail_prix.lignes.find((l: { libelle: string }) => l.libelle === 'Conception graphique offerte');
    expect(offerte.total).toBe(-15000);
    expect(r.body.specs.lignes[0]).toMatchObject({ papier: 'couche_170', pelliculage: { type: 'mat', faces: 'recto' }, conditionnement: ['liasse_100'] });
    expect(r.body.specs.livraison_contact).toBe('M. Diallo, 77 000 00 00');
  });

  it('valide les nouveaux champs', async () => {
    const r = await A.prep.post('/api/devis').send({ ...flyersA5, acompte_pourcent: 150, delai_jours: -1, mode_remise: 'poste' });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.champs)).toEqual(expect.arrayContaining(['acompte_pourcent', 'delai_jours', 'mode_remise']));
  });

  it('modification : retrait sur place efface l’adresse ; le PDF porte les conditions', async () => {
    const p = await A.prep.patch(`/api/devis/${devisId}`).send({ mode_remise: 'retrait', delai_jours: null });
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({ mode_remise: 'retrait', adresse_livraison: null, delai_jours: null, acompte_pourcent: 50 });
    const pdf = await A.prep.get(`/api/devis/${devisId}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    await A.prep.patch(`/api/devis/${devisId}`).send({ mode_remise: 'livraison', adresse_livraison: 'Médina, rue 22' }).expect(200);
  });

  it('conversion : mode de remise, adresse et urgence repris sur le dossier, au montant du devis', async () => {
    await A.prep.post(`/api/devis/${devisId}/statut`).send({ statut: 'envoye' }).expect(200);
    const dv = (await A.prep.get(`/api/devis/${devisId}`)).body;
    const c = await A.prep.post(`/api/devis/${devisId}/convertir`).send({});
    expect(c.status).toBe(201);
    const d = await A.prep.get(`/api/dossiers/${c.body.dossier_id}`);
    expect(d.body).toMatchObject({ mode_remise: 'livraison', adresse_livraison: 'Médina, rue 22', urgent: true, montant: dv.total_ttc, montant_source: 'devis' });
    expect(d.body.specs.lignes[0].type_document).toBe('flyer');
  });

  it('conversion d’un devis « sur place » sans urgence', async () => {
    const r = await A.prep.post('/api/devis').send({ ...flyersA5, specs: { ...flyersA5.specs, forfaits: [] }, mode_remise: 'retrait', adresse_livraison: 'ignorée' });
    expect(r.status).toBe(201);
    expect(r.body.adresse_livraison).toBeNull();
    await A.prep.post(`/api/devis/${r.body.id}/statut`).send({ statut: 'envoye' }).expect(200);
    const c = await A.prep.post(`/api/devis/${r.body.id}/convertir`).send({});
    const d = await A.prep.get(`/api/dossiers/${c.body.dossier_id}`);
    expect(d.body).toMatchObject({ mode_remise: 'retrait', adresse_livraison: null, urgent: false });
  });
});

describe('dossier : œillets calculés et précisions', () => {
  it('bâche à œillets tout autour : le nombre suit les dimensions', async () => {
    await poserPrix({ oeillets: 100 });
    const r = await A.prep.post('/api/dossiers').send({
      machine: 'roland',
      client_nom: 'Garage Sall',
      mode_remise: 'retrait',
      specs: {
        lignes: [{ support: 'bache_m2', largeur: 400, hauteur: 150, unite: 'cm', quantite: 2, finitions: [], options: [], bords: 'oeillets', oeillets: { position: 'tous_cotes', espacement_cm: 50 } }],
        forfaits: [],
      },
    });
    expect(r.status).toBe(201);
    // 2 × 6 m² × 7 000 + 22 œillets × 2 × 100
    expect(r.body.montant).toBe(84000 + 4400);
    expect(r.body.detail_prix.lignes[1]).toMatchObject({ code: 'oeillets', quantite: 44, libelle: 'Œillets (22 par exemplaire)' });
    expect(r.body.resume_specs).toContain('œillets');
  });
});
