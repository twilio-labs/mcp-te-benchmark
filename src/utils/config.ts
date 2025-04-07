import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

dotenv.config();

interface ServerConfig {
  metricsPort: number;
  dashboardPort: number;
}

interface TwilioConfig {
  accountSid?: string;
  authToken?: string;
  workspaceSid?: string;
}

interface LoggingConfig {
  level: string;
}

interface MetricsConfig {
  dataPath: string;
}

interface Config {
  server: ServerConfig;
  twilio: TwilioConfig;
  logging: LoggingConfig;
  metrics: MetricsConfig;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: Config = {
  server: {
    metricsPort: parseInt(process.env.METRICS_PORT || '3000'),
    dashboardPort: parseInt(process.env.DASHBOARD_PORT || '3001'),
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
    dataPath:
      process.env.METRICS_DATA_PATH || path.resolve(__dirname, '../../metrics'),
  },
};

export default config;
