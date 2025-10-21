const request = require('supertest');
const app = require('./app.mock');

describe('Monitoring', (req, res) => {
  it('GET /api/health returns status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status');
  });
});
