const { expect } = require('chai');
const sinon = require('sinon');
const metricsClient = require('../src/client/metrics-client');

describe('Metrics Client', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('sendMetrics', () => {
    it('should send metrics data to the server', async () => {
      const testData = {
        type: 'test',
        value: 100
      };

      const fetchStub = sandbox.stub(global, 'fetch').resolves({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await metricsClient.sendMetrics(testData);
      
      expect(result.success).to.be.true;
      expect(fetchStub.calledOnce).to.be.true;
      
      const [url, options] = fetchStub.firstCall.args;
      expect(url).to.include('/metrics');
      expect(options.method).to.equal('POST');
      expect(JSON.parse(options.body)).to.deep.include(testData);
    });

    it('should handle server errors', async () => {
      sandbox.stub(global, 'fetch').rejects(new Error('Network error'));

      try {
        await metricsClient.sendMetrics({ type: 'test', value: 100 });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Network error');
      }
    });
  });
}); 