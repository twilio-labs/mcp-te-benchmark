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

interface Config {
  server: ServerConfig;
  twilio: TwilioConfig;
  logging: LoggingConfig;
}

const dirName = path.dirname(fileURLToPath(import.meta.url));

const config: Config = {
  server: {
    metricsPort: parseInt(process.env.METRICS_PORT || '3000', 10),
    dashboardPort: parseInt(process.env.DASHBOARD_PORT || '3001', 10),
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    workspaceSid: process.env.TWILIO_WORKSPACE_SID,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
