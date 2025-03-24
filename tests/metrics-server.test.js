const request = require('supertest');
const { expect } = require('chai');
const metricsServer = require('../src/server/metrics-server');

describe('Metrics Server', () => {
  let server;

  before(() => {
    server = metricsServer.listen(3000);
  });

  after(() => {
    server.close();
  });

  describe('POST /metrics', () => {
    it('should store metrics data', async () => {
      const testData = {
        timestamp: new Date().toISOString(),
        type: 'test',
        value: 100
      };

      const response = await request(server)
        .post('/metrics')
        .send(testData);

      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
    });
  });

  describe('GET /metrics', () => {
    it('should retrieve metrics data', async () => {
      const response = await request(server)
        .get('/metrics')
        .query({ type: 'test' });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
    });
  });
}); 