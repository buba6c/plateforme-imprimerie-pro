import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type supertest from 'supertest';
import { dossierCreateSchema } from '@evocom/shared';
import { getPool } from '../src/db/pool';
import { invalidateParametres } from '../src/lib/params';
import { invalidateTarifs } from '../src/lib/tarifs';
import { chiffrer, CleIllisible, dechiffrer } from '../src/modules/ia/chiffrement';
import { viderLimitesIA } from '../src/modules/ia/routes';
import { agent, app, comptes } from './helpers';

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep' | 'roland' | 'xerox' | 'livreur', Agent>;

const CLE = 'sk-test-0123456789ABCDEFGHIJklmnWXYZ';
const ILLISIBLE = 'La clé enregistrée ne peut plus être lue : saisissez-la de nouveau';

/** Réponse simulée d'OpenAI (chat completions). */
function reponseOpenAI(contenu: unknown, usage = { prompt_tokens: 1200, completion_tokens: 300 }) {
  return new Response(
    JSON.stringify({
      id: 'chatcmpl-test',
      model: 'gpt-4o-mini-2024-07-18',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(contenu), refusal: null } }],
      usage,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function erreurOpenAI(status: number, code: string | null, message = 'erreur simulée') {
  return new Response(JSON.stringify({ error: { message, type: 'test', code } }), { status, headers: { 'content-type': 'application/json' } });
}

/** Remplace fetch pour toute la durée du test ; renvoie l'espion. */
function simulerFetch(impl: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const espion = vi.fn(async (url: string | URL | Request, init?: RequestInit) => impl(String(url), init ?? {}));
  vi.stubGlobal('fetch', espion);
  return espion;
}

async function reinitialiserIA() {
  const pool = getPool();
  await pool.query(`UPDATE ia_config SET actif = false, modele = 'gpt-4o-mini', cle_chiffree = NULL, cle_fin = NULL, updated_by = NULL WHERE id = 1`);
  await pool.query(`TRUNCATE ia_usage RESTART IDENTITY`);
  viderLimitesIA();
}

async function activer() {
  const r = await A.admin.put('/api/ia/config').send({ cle: CLE, actif: true });
  expect(r.status).toBe(200);
  return r;
}

beforeAll(async () => {
  await app();
  invalidateTarifs();
  invalidateParametres();
  await reinitialiserIA();
  for (const k of ['admin', 'prep', 'roland', 'xerox', 'livreur'] as const) A[k] = await agent(comptes[k]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.IA_CLE_CHIFFREMENT;
});

afterAll(async () => {
  await reinitialiserIA();
});

describe('assistant IA : configuration et clé', () => {
  it('chiffre la clé (AES-256-GCM) et la relit ; une valeur altérée ou un autre secret la rendent illisible', () => {
    const c = chiffrer(CLE);
    expect(c.startsWith('v1:')).toBe(true);
    expect(c).not.toContain(CLE);
    expect(chiffrer(CLE)).not.toBe(c); // vecteur d'initialisation aléatoire
    expect(dechiffrer(c)).toBe(CLE);

    const [v, iv, tag, chiffre] = c.split(':');
    const altere = Buffer.from(chiffre!, 'base64');
    altere[0] = altere[0]! ^ 1;
    expect(() => dechiffrer([v, iv, tag, altere.toString('base64')].join(':'))).toThrow(CleIllisible);
    expect(() => dechiffrer('nimporte quoi')).toThrow(CleIllisible);

    process.env.IA_CLE_CHIFFREMENT = 'un-autre-secret-de-chiffrement-tres-long';
    expect(() => dechiffrer(c)).toThrow(ILLISIBLE);
    const c2 = chiffrer(CLE);
    expect(dechiffrer(c2)).toBe(CLE);
    delete process.env.IA_CLE_CHIFFREMENT;
    expect(() => dechiffrer(c2)).toThrow(CleIllisible);
  });

  it('réserve la configuration à l’administrateur et ne renvoie jamais la clé', async () => {
    for (const k of ['prep', 'roland', 'xerox', 'livreur'] as const) {
      expect((await A[k].get('/api/ia/config')).status).toBe(403);
      expect((await A[k].put('/api/ia/config').send({ actif: false })).status).toBe(403);
      expect((await A[k].post('/api/ia/test').send({})).status).toBe(403);
      expect((await A[k].get('/api/ia/usages')).status).toBe(403);
    }

    const vide = await A.admin.get('/api/ia/config');
    expect(vide.status).toBe(200);
    expect(vide.body).toMatchObject({ actif: false, modele: 'gpt-4o-mini', cle_configuree: false, cle_fin: null });

    // Pas d'activation sans clé, clé mal formée refusée.
    expect((await A.admin.put('/api/ia/config').send({ actif: true })).status).toBe(409);
    const mauvaise = await A.admin.put('/api/ia/config').send({ cle: 'pas une clé' });
    expect(mauvaise.status).toBe(400);
    expect(mauvaise.body.champs.cle).toBeTruthy();
    expect((await A.admin.put('/api/ia/config').send({ modele: 'gpt-5-imaginaire' })).status).toBe(400);

    const r = await A.admin.put('/api/ia/config').send({ cle: `  ${CLE}  `, actif: true, modele: 'gpt-4o' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ actif: true, modele: 'gpt-4o', cle_configuree: true, cle_fin: 'WXYZ', cle_lisible: true });
    expect(JSON.stringify(r.body)).not.toContain(CLE);

    const lu = await A.admin.get('/api/ia/config');
    expect(JSON.stringify(lu.body)).not.toContain(CLE);
    expect(lu.body.cle_fin).toBe('WXYZ');

    // En base : chiffrée, hors de la table parametres.
    const ligne = (await getPool().query(`SELECT cle_chiffree FROM ia_config WHERE id = 1`)).rows[0];
    expect(ligne.cle_chiffree).not.toContain(CLE);
    expect(dechiffrer(ligne.cle_chiffree)).toBe(CLE);
    const params = (await getPool().query(`SELECT valeur::text AS v FROM parametres`)).rows.map((x) => x.v).join(' ');
    expect(params).not.toContain(CLE);

    // Ni la route des paramètres ni le journal ne la laissent passer.
    for (const k of ['admin', 'prep', 'livreur'] as const) {
      const p = await A[k].get('/api/parametres');
      expect(p.status).toBe(200);
      expect(JSON.stringify(p.body)).not.toContain(CLE);
      expect(JSON.stringify(p.body)).not.toContain('WXYZ');
    }
    const j = await A.admin.get('/api/journal?action=ia_config_modifiee');
    expect(j.status).toBe(200);
    expect(JSON.stringify(j.body)).not.toContain(CLE);
    expect(j.body.items[0].data).toMatchObject({ cle: 'enregistree', actif: { avant: false, apres: true }, modele: { avant: 'gpt-4o-mini', apres: 'gpt-4o' } });

    // Statut visible par l'administrateur et le préparateur seulement.
    expect((await A.prep.get('/api/ia/statut')).body).toEqual({ actif: true });
    expect((await A.admin.get('/api/ia/statut')).body).toEqual({ actif: true });
    expect((await A.roland.get('/api/ia/statut')).status).toBe(403);
    expect((await A.livreur.get('/api/ia/statut')).status).toBe(403);

    // Effacer la clé désactive l'assistant.
    const efface = await A.admin.put('/api/ia/config').send({ cle: null });
    expect(efface.body).toMatchObject({ actif: false, cle_configuree: false, cle_fin: null });
    expect((await A.prep.get('/api/ia/statut')).body).toEqual({ actif: false });
    const j2 = await A.admin.get('/api/journal?action=ia_config_modifiee');
    expect(j2.body.items[0].data).toMatchObject({ cle: 'effacee' });
  });

  it('signale clairement une clé devenue illisible (secret de chiffrement changé)', async () => {
    await activer();
    process.env.IA_CLE_CHIFFREMENT = 'secret-change-depuis-l-enregistrement-0123';
    const espion = simulerFetch(() => reponseOpenAI({}));
    const conf = await A.admin.get('/api/ia/config');
    expect(conf.body).toMatchObject({ cle_configuree: true, cle_lisible: false });
    const s = await A.prep.post('/api/ia/suggestion').send({ description: '2 bâches 3 × 1 m' });
    expect(s.status).toBe(409);
    expect(s.body.error).toContain(ILLISIBLE);
    const t = await A.admin.post('/api/ia/test').send({});
    expect(t.status).toBe(409);
    expect(t.body.error).toContain(ILLISIBLE);
    expect(espion).not.toHaveBeenCalled();
  });

  it('teste la connexion avec un appel minimal et traduit les erreurs', async () => {
    await activer();
    const espion = simulerFetch(() => reponseOpenAI('OK', { prompt_tokens: 9, completion_tokens: 1 }));
    const ok = await A.admin.post('/api/ia/test').send({});
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
    expect(espion).toHaveBeenCalledTimes(1);
    const [url, init] = espion.mock.calls[0]!;
    expect(String(url)).toBe('https://api.openai.com/v1/chat/completions');
    expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${CLE}`);

    // Clé à essayer avant de l'enregistrer.
    simulerFetch(() => erreurOpenAI(401, 'invalid_api_key', `Incorrect API key provided: ${CLE}`));
    const refus = await A.admin.post('/api/ia/test').send({ cle: CLE });
    expect(refus.status).toBe(502);
    expect(refus.body.error).toContain('OpenAI a refusé la clé');
    expect(JSON.stringify(refus.body)).not.toContain(CLE);

    const usages = await A.admin.get('/api/ia/usages');
    expect(usages.status).toBe(200);
    expect(usages.body.items.slice(0, 2).map((u: any) => [u.type, u.statut])).toEqual([
      ['test', 'cle_refusee'],
      ['test', 'ok'],
    ]);
  });
});

describe('assistant IA : propositions', () => {
  it('refuse les imprimeurs et le livreur, et répond 409 si l’assistant est inactif', async () => {
    await reinitialiserIA();
    const espion = simulerFetch(() => reponseOpenAI({}));
    for (const k of ['roland', 'xerox', 'livreur'] as const) {
      expect((await A[k].post('/api/ia/suggestion').send({ description: 'Flyers' })).status).toBe(403);
    }
    const inactif = await A.prep.post('/api/ia/suggestion').send({ description: '500 flyers A5' });
    expect(inactif.status).toBe(409);
    expect(inactif.body.error).toBe("L'assistant n'est pas activé.");

    // Clé enregistrée mais assistant désactivé : toujours 409.
    await A.admin.put('/api/ia/config').send({ cle: CLE, actif: false });
    expect((await A.prep.post('/api/ia/suggestion').send({ description: '500 flyers A5' })).status).toBe(409);
    expect(espion).not.toHaveBeenCalled();

    await activer();
    expect((await A.prep.post('/api/ia/suggestion').send({ description: '' })).status).toBe(400);
    expect((await A.prep.post('/api/ia/suggestion').send({ description: 'x'.repeat(2001) })).status).toBe(400);
    expect((await A.prep.post('/api/ia/suggestion').send({ description: 'Bâche', machine: 'hp' })).status).toBe(400);
    expect(espion).not.toHaveBeenCalled();
  });

  it('retire les codes inventés ou sans prix et recalcule le prix côté serveur', async () => {
    await activer();
    const description = `Boutique Keur Yaye : 2 bâches 300 × 100 cm avec pelliculage et œillets dorés, livraison, et la conception du visuel. ${'Détail. '.repeat(30)}`;
    const espion = simulerFetch(() =>
      reponseOpenAI({
        machine: 'roland',
        prix_total: 1,
        total: 1,
        lignes: [
          {
            support: 'bache_m2',
            largeur: 300,
            hauteur: 100,
            unite: 'cm',
            pages: null,
            recto_verso: null,
            quantite: 2,
            prix: 5,
            finitions: [
              { code: 'pelliculage', quantite: null },
              { code: 'oeillets_dores', quantite: 8 },
              { code: 'oeillets', quantite: 8 },
            ],
            options: ['livraison', 'conception_graphique'],
            description: 'Façade',
          },
          { support: 'bache_geante_inventee', largeur: 100, hauteur: 100, unite: 'cm', pages: null, recto_verso: null, quantite: 1, finitions: [], options: [], description: null },
          { support: 'vinyle_transparent_m2', largeur: 100, hauteur: 50, unite: 'cm', pages: null, recto_verso: null, quantite: 1, finitions: [], options: [], description: null },
          { support: 'vinyle_m2', largeur: null, hauteur: null, unite: 'cm', pages: null, recto_verso: null, quantite: 1, finitions: [], options: [], description: null },
        ],
        forfaits: [{ code: 'code_invente', quantite: null }],
        remarques: 'Couleur des œillets à confirmer.',
      }),
    );

    const r = await A.prep.post('/api/ia/suggestion').send({ description });
    expect(r.status).toBe(200);
    expect(r.body.machine).toBe('roland');
    expect(r.body.specs.lignes).toHaveLength(1);
    const l = r.body.specs.lignes[0];
    expect(l).toMatchObject({ support: 'bache_m2', largeur: 300, hauteur: 100, unite: 'cm', quantite: 2, options: ['livraison'], description: 'Façade' });
    expect(l.finitions).toEqual([{ code: 'pelliculage' }]);
    expect(l.prix).toBeUndefined();
    expect(r.body.specs.forfaits).toEqual([{ code: 'conception_graphique' }]);
    expect(r.body.remarques).toBe('Couleur des œillets à confirmer.');

    const av = r.body.avertissements.join('\n');
    expect(av).toContain('oeillets_dores');
    expect(av).toContain('« Œillets » n\'a pas encore de prix');
    expect(av).toContain('bache_geante_inventee');
    expect(av).toContain('« Vinyle transparent » n\'a pas encore de prix');
    expect(av).toContain('« Vinyle adhésif » : dimensions non précisées');
    expect(av).toContain('code_invente');

    // 6 m² × 7 000 + 6 m² × 1 500 + livraison 5 000 + conception 15 000, jamais le montant de l'IA.
    expect(r.body.prix.total).toBe(71_000);
    expect(r.body.prix.total_ttc).toBe(71_000);
    expect(r.body.prix.lignes.map((x: any) => x.code)).toEqual(['bache_m2', 'pelliculage', 'livraison', 'conception_graphique']);
    expect(r.body.erreur_prix).toBeUndefined();

    // Les spécifications proposées sont acceptées telles quelles par les schémas de création et par l'estimation.
    expect(dossierCreateSchema.safeParse({ machine: r.body.machine, client_nom: 'Boutique Keur Yaye', specs: r.body.specs }).success).toBe(true);
    const estime = await A.prep.post('/api/tarifs/estimer').send({ machine: r.body.machine, specs: r.body.specs });
    expect(estime.status).toBe(200);
    expect(estime.body.total_ttc).toBe(71_000);

    // Ce qui part chez OpenAI : modèle, schéma strict, grille sans les prix, description.
    const corps = JSON.parse(String(espion.mock.calls[0]![1]!.body));
    expect(corps.model).toBe('gpt-4o-mini');
    expect(corps.response_format.type).toBe('json_schema');
    expect(corps.response_format.json_schema.strict).toBe(true);
    const systeme = corps.messages[0].content as string;
    expect(systeme).toContain('bache_m2 ; Bâche standard');
    expect(systeme).not.toMatch(/7\s?000|15\s?000/);
    expect(corps.messages[1].content).toContain('Boutique Keur Yaye');

    // Journal d'usage : longueur et extrait de 120 caractères, pas la demande complète.
    const u = (await getPool().query(`SELECT * FROM ia_usage WHERE type = 'suggestion' ORDER BY id DESC LIMIT 1`)).rows[0];
    expect(u).toMatchObject({ statut: 'ok', jetons_entree: 1200, jetons_sortie: 300, longueur_demande: description.trim().length });
    expect(u.extrait.length).toBeLessThanOrEqual(120);
    expect(description.length).toBeGreaterThan(200);
  });

  it('respecte la machine imposée et renvoie une erreur de prix lisible quand aucune ligne ne reste', async () => {
    await activer();
    const espion = simulerFetch(() =>
      reponseOpenAI({
        machine: 'xerox',
        lignes: [{ support: 'papier_a4_couleur', largeur: null, hauteur: null, unite: null, pages: 2, recto_verso: true, quantite: 500, finitions: [], options: [], description: '170 g' }],
        forfaits: [],
        remarques: null,
      }),
    );
    const x = await A.prep.post('/api/ia/suggestion').send({ description: '500 flyers A4 recto-verso', machine: 'xerox' });
    expect(x.status).toBe(200);
    expect(x.body.machine).toBe('xerox');
    expect(x.body.specs.lignes[0]).toMatchObject({ support: 'papier_a4_couleur', pages: 2, recto_verso: true, quantite: 500 });
    // 1 000 faces × 100 + recto-verso 1 000 × 20
    expect(x.body.prix.total).toBe(110_000);
    expect(x.body.remarques).toBeUndefined();
    const corps = JSON.parse(String(espion.mock.calls[0]![1]!.body));
    expect(corps.response_format.json_schema.schema.properties.machine.enum).toEqual(['xerox']);
    expect(corps.messages[0].content).not.toContain('bache_m2');

    simulerFetch(() =>
      reponseOpenAI({
        machine: 'roland',
        lignes: [{ support: 'carte_inventee', largeur: null, hauteur: null, unite: null, pages: 1, recto_verso: false, quantite: 100, finitions: [], options: [], description: null }],
        forfaits: [],
        remarques: null,
      }),
    );
    const vide = await A.prep.post('/api/ia/suggestion').send({ description: '100 cartes', machine: 'xerox' });
    expect(vide.status).toBe(200);
    expect(vide.body.machine).toBe('xerox');
    expect(vide.body.specs.lignes).toEqual([]);
    expect(vide.body.prix).toBeNull();
    expect(vide.body.erreur_prix).toContain('Ajoutez au moins une ligne');
    expect(vide.body.avertissements.join(' ')).toContain('machine Roland');
  });

  it('traduit les erreurs d’OpenAI (clé refusée, quota, délai, service injoignable, réponse illisible)', async () => {
    await activer();
    const cas: { simu: () => Promise<Response> | Response; status: number; message: string; statut: string }[] = [
      { simu: () => erreurOpenAI(401, 'invalid_api_key'), status: 502, message: 'OpenAI a refusé la clé', statut: 'cle_refusee' },
      { simu: () => erreurOpenAI(429, 'insufficient_quota'), status: 503, message: 'crédit du compte OpenAI est épuisé', statut: 'quota' },
      { simu: () => erreurOpenAI(429, 'rate_limit_exceeded'), status: 503, message: 'réessayez dans une minute', statut: 'limite' },
      { simu: () => erreurOpenAI(500, null), status: 502, message: 'Le service OpenAI rencontre un problème', statut: 'injoignable' },
      {
        simu: () => Promise.reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError')),
        status: 504,
        message: "n'a pas répondu dans les 25 secondes",
        statut: 'delai',
      },
      { simu: () => Promise.reject(new TypeError('fetch failed')), status: 502, message: 'injoignable', statut: 'injoignable' },
      {
        simu: () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'pas du JSON' } }] }), { status: 200 }),
        status: 502,
        message: 'illisible',
        statut: 'reponse_invalide',
      },
    ];
    for (const c of cas) {
      simulerFetch(c.simu);
      const r = await A.prep.post('/api/ia/suggestion').send({ description: '2 bâches 3 × 1 m' });
      expect(r.status, c.statut).toBe(c.status);
      expect(r.body.error).toContain(c.message);
      expect(JSON.stringify(r.body)).not.toContain(CLE);
      const u = (await getPool().query(`SELECT statut FROM ia_usage ORDER BY id DESC LIMIT 1`)).rows[0];
      expect(u.statut).toBe(c.statut);
    }
  });

  it('limite à 30 propositions par utilisateur et par heure', async () => {
    await activer();
    viderLimitesIA();
    simulerFetch(() => reponseOpenAI({ machine: 'xerox', lignes: [], forfaits: [], remarques: null }));
    for (let i = 0; i < 30; i++) {
      expect((await A.prep.post('/api/ia/suggestion').send({ description: `Demande ${i}` })).status).toBe(200);
    }
    const trop = await A.prep.post('/api/ia/suggestion').send({ description: 'Une de trop' });
    expect(trop.status).toBe(429);
    expect(trop.body.error).toContain('30 propositions en une heure');
    // Les autres utilisateurs ne sont pas touchés.
    expect((await A.admin.post('/api/ia/suggestion').send({ description: 'Demande admin' })).status).toBe(200);
    viderLimitesIA();
  });
});
