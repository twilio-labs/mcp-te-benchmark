import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const config = {
    server: {
        metricsPort: parseInt(process.env.METRICS_PORT || "3000"),
        dashboardPort: parseInt(process.env.DASHBOARD_PORT || "3001"),
    },
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        workspaceSid: process.env.TWILIO_WORKSPACE_SID,
    },
    logging: {
        level: process.env.LOG_LEVEL || "info",
    },
    metrics: {
        dataPath: process.env.METRICS_DATA_PATH || path.resolve(__dirname, "../../metrics"),
    },
};
export default config;
//# sourceMappingURL=config.js.map