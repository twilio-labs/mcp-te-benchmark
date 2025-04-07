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
declare const config: Config;
export default config;
