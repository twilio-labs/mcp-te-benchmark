#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = __importDefault(require("../utils/logger"));
const summary_generator_1 = __importDefault(require("./metrics/summary-generator"));
// Constants
const METRICS_DIR = config_1.default.metrics.dataPath;
/**
 * Main function to regenerate the summary.json file from existing individual metric files
 */
async function regenerateSummary() {
    try {
        logger_1.default.info("Regenerating summary.json from existing individual metric files...");
        // Create a summary generator
        const summaryGenerator = new summary_generator_1.default(METRICS_DIR);
        // Generate summary from all available metric files
        await summaryGenerator.generateSummaryFromFiles();
        logger_1.default.info("Summary regeneration completed successfully.");
    }
    catch (error) {
        logger_1.default.error("Error regenerating summary:", error);
        process.exit(1);
    }
}
// Run the regeneration
regenerateSummary();
//# sourceMappingURL=regenerate-summary.js.map