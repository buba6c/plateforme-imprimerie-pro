// Garde contre la boucle de plantages du traitement automatique (incident du 13/11/2026 : l'API, tuée en
// plein traitement d'un gros PDF, le reprenait à chaque redémarrage et remplissait /tmp).
import { beforeAll, describe, expect, it } from 'vitest';
import { getPool } from '../src/db/pool';
import { loadConfig } from '../src/config';
import { configurerTraitement, TENTATIVES_MAX, traiterFichier } from '../src/modules/traitement/file';
import { agent, comptes, envoyerFichier } from './helpers';

let fichierId = 0;

describe('traitement : garde contre les reprises en boucle', () => {
  beforeAll(async () => {
    const admin = await agent(comptes.admin);
    configurerTraitement({ storageDir: loadConfig().storageDir });
    const d = await admin.post('/api/dossiers').send({ machine: 'xerox', client_nom: 'Garde traitement', mode_remise: 'retrait', specs: { lignes: [], forfaits: [] } });
    expect(d.status, JSON.stringify(d.body)).toBe(201);
    const up = await envoyerFichier(admin, d.body.id, 'lourd.pdf', Buffer.from('%PDF-1.4\n%%EOF\n'));
    expect(up.status).toBe(204);
    fichierId = up.fichierId!;
  });

  it(`un fichier déjà interrompu ${TENTATIVES_MAX} fois n'est plus retraité : l'original reste servi`, async () => {
    await getPool().query(`UPDATE fichiers SET traitement = $2, chemin_traite = NULL WHERE id = $1`, [fichierId, JSON.stringify({ statut: 'en_cours', tentatives: TENTATIVES_MAX })]);
    expect(await traiterFichier(fichierId)).toBeNull();
    const r = await getPool().query(`SELECT traitement, chemin_traite FROM fichiers WHERE id = $1`, [fichierId]);
    expect(r.rows[0].traitement.statut).toBe('erreur');
    expect(r.rows[0].traitement.avertissements[0]).toMatch(/interrompu/);
    expect(r.rows[0].chemin_traite).toBeNull();
  });

  it('un fichier déjà traité n’est pas retraité', async () => {
    const avant = (await getPool().query(`SELECT traitement FROM fichiers WHERE id = $1`, [fichierId])).rows[0].traitement;
    expect(await traiterFichier(fichierId)).toBeNull();
    const apres = (await getPool().query(`SELECT traitement FROM fichiers WHERE id = $1`, [fichierId])).rows[0].traitement;
    expect(apres).toEqual(avant);
  });
});
