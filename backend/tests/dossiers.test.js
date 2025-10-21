const request = require('supertest');
const app = require('./app.mock');

describe('Dossiers API', (req, res) => {
  it('GET /api/dossiers should return 200 and array', async () => {
    const res = await request(app).get('/api/dossiers');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.dossiers)).toBe(true);
  });
});
