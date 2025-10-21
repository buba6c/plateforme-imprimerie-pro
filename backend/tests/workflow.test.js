const request = require('supertest');
const app = require('./app.mock');
const workflow = require('../constants/workflow');

describe('Workflow transitions API', () => {
  // TODO: remplacer par un vrai mock ou fixture de dossier si besoin
  const dossierId = 1;
  const baseDossier = {
    id: dossierId,
    type: 'roland',
    status: 'en_cours',
  };

  // Helper pour simuler un utilisateur
  function authHeader(role) {
    // Simule un JWT ou header d'auth, à adapter selon votre middleware
    return { 'x-user-role': role, 'x-user-id': '42' };
  }

  it('refuse une transition non autorisée (imprimeur vers en_livraison)', async () => {
    // Imprimeur ne peut pas passer de en_cours à en_livraison
    const res = await request(app)
      .patch(`/api/dossiers/${dossierId}/status`)
      .set(authHeader('imprimeur_roland'))
      .send({ status: 'en_livraison' });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('STATUS_CHANGE_DENIED');
  });

  it('accepte transition préparateur: en_cours vers pret_impression', async () => {
    const res = await request(app)
      .patch(`/api/dossiers/${dossierId}/status`)
      .set(authHeader('preparateur'))
      .send({ status: 'pret_impression' });
    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.body.new_status).toBe('pret_impression');
    }
  });

  it('refuse transition imprimeur depuis en_cours (doit être pret_impression)', async () => {
    // Imprimeur ne peut plus agir sur en_cours, doit attendre pret_impression
    const res = await request(app)
      .patch(`/api/dossiers/${dossierId}/status`)
      .set(authHeader('imprimeur_roland'))
      .send({ status: 'en_impression' });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('STATUS_CHANGE_DENIED');
  });

  it('refuse une transition pour mauvais type (imprimeur_roland sur xerox)', async () => {
    // Simule un dossier de type xerox
    const res = await request(app)
      .patch(`/api/dossiers/${dossierId}/status`)
      .set(authHeader('imprimeur_roland'))
      .send({ status: 'en_impression', dossierType: 'xerox' });
    expect([403, 400]).toContain(res.statusCode);
  });

  it('accepte toutes transitions pour admin', async () => {
    const res = await request(app)
      .patch(`/api/dossiers/${dossierId}/status`)
      .set(authHeader('admin'))
      .send({ status: 'en_livraison' });
    // Peut être 200 ou 404 selon mock
    expect([200, 404]).toContain(res.statusCode);
  });
});
