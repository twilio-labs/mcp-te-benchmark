require('dotenv').config();
const path = require('path');

const config = {
  server: {
    metricsPort: process.env.METRICS_PORT || 3000,
    dashboardPort: process.env.DASHBOARD_PORT || 3001,
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    workspaceSid: process.env.TWILIO_WORKSPACE_SID,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  metrics: {
    dataPath: process.env.METRICS_DATA_PATH || path.resolve(__dirname, '../../src/server/metrics'),
  }
};

module.exports = config; 