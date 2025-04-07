#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const yargs_1 = __importDefault(require("yargs/yargs"));
const helpers_1 = require("yargs/helpers");
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = __importDefault(require("../utils/logger"));
const chat_processor_1 = __importDefault(require("./metrics/chat-processor"));
const metrics_calculator_1 = __importDefault(require("./metrics/metrics-calculator"));
const summary_generator_1 = __importDefault(require("./metrics/summary-generator"));
/**
 * Result class for consistent error handling
 */
class ExtractionResult {
    /**
     * Create a new ExtractionResult
     * @param {boolean} success Whether the operation was successful
     * @param {string} message A message describing the result
     * @param {Array} metrics The extracted metrics
     * @param {Array} errors Any errors encountered
     */
    constructor(success, message, metrics = [], errors = []) {
        this.success = success;
        this.message = message;
        this.metrics = metrics;
        this.errors = errors;
    }
    /**
     * Create a success result
     * @param {string} message Success message
     * @param {Array} metrics Extracted metrics
     * @returns {ExtractionResult} A success result
     */
    static success(message, metrics = []) {
        return new ExtractionResult(true, message, metrics);
    }
    /**
     * Create an error result
     * @param {string} message Error message
     * @param {Array} metrics Any metrics that were successfully extracted
     * @param {Array} errors Any errors encountered
     * @returns {ExtractionResult} An error result
     */
    static error(message, metrics = [], errors = []) {
        return new ExtractionResult(false, message, metrics, errors);
    }
}
// Constants
const CLAUDE_LOGS_DIR = "/Users/nmogil/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/tasks";
const METRICS_DIR = config_1.default.metrics.dataPath;
// Parse command line arguments using yargs
const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .option("force", {
    alias: "f",
    type: "boolean",
    description: "Force regeneration of all metrics, even if they already exist",
    default: false,
})
    .option("verbose", {
    alias: "v",
    type: "boolean",
    description: "Enable verbose logging for debugging",
    default: false,
})
    .option("model", {
    type: "string",
    description: "Specify the model name to use if not found in logs",
})
    .option("client", {
    type: "string",
    description: "Specify the client name (e.g., MCP client) to use",
})
    .option("server", {
    type: "string",
    description: "Specify the MCP server name to use",
})
    .help()
    .alias("help", "h")
    .parseSync();
// Use parsed arguments
const FORCE_REGENERATE = argv.force;
const VERBOSE = argv.verbose;
const MODEL_ARG = argv.model;
const CLIENT_ARG = argv.client;
const SERVER_ARG = argv.server;
// Log argument usage
if (VERBOSE) {
    logger_1.default.debug("Verbose mode enabled - will show detailed logging");
}
if (FORCE_REGENERATE) {
    logger_1.default.info("Force regeneration mode enabled - will regenerate all metrics");
}
if (MODEL_ARG) {
    logger_1.default.info(`Using provided model override: ${MODEL_ARG}`);
}
if (CLIENT_ARG) {
    logger_1.default.info(`Using provided client override: ${CLIENT_ARG}`);
}
if (SERVER_ARG) {
    logger_1.default.info(`Using provided server override: ${SERVER_ARG}`);
}
/**
 * Main function to extract metrics from Claude chat logs
 */
async function extractChatMetrics() {
    // Ensure metrics directory exists
    try {
        await fs_1.promises.access(METRICS_DIR);
    }
    catch (error) {
        logger_1.default.error(`Metrics directory ${METRICS_DIR} does not exist. Please create it before running this script.`);
        return ExtractionResult.error(`Metrics directory ${METRICS_DIR} does not exist`);
    }
    try {
        // Get all chat directories
        const chatDirsResult = await getChatDirectories();
        if (!chatDirsResult.success) {
            return ExtractionResult.error(chatDirsResult.error || "Failed to get chat directories");
        }
        const chatDirs = chatDirsResult.directories;
        logger_1.default.info(`Found ${chatDirs.length} chat directories`);
        // Process each chat directory in parallel, passing arguments
        const processingResults = await Promise.all(chatDirs.map((dir) => processDirectory(dir, MODEL_ARG, CLIENT_ARG, SERVER_ARG)));
        // Collect all metrics and errors
        const allMetrics = [];
        const allErrors = [];
        for (const result of processingResults) {
            if (result.metrics?.length) {
                allMetrics.push(...result.metrics);
            }
            if (result.error) {
                allErrors.push(result.error);
            }
        }
        // Create a summary generator
        const summaryGenerator = new summary_generator_1.default(METRICS_DIR);
        // If we have new metrics, write individual metric files
        if (allMetrics.length > 0) {
            const writeResult = await summaryGenerator.writeIndividualMetricFiles(allMetrics);
            if (!writeResult.success) {
                logger_1.default.warn(`Some metrics files could not be written: ${writeResult.message}`);
            }
        }
        else {
            logger_1.default.warn("No new task metrics found in chat logs");
        }
        // Always generate summary from all available metric files
        // This ensures the summary is updated even if individual files were manually edited
        const summaryResult = await summaryGenerator.generateSummaryFromFiles();
        if (!summaryResult.success) {
            logger_1.default.warn(`Summary generation had issues: ${summaryResult.message}`);
            return ExtractionResult.error("Completed with some errors", allMetrics, [
                ...allErrors,
                summaryResult.message,
            ]);
        }
        return ExtractionResult.success(`Successfully processed ${allMetrics.length} metrics`, allMetrics);
    }
    catch (error) {
        logger_1.default.error("Error extracting metrics:", error);
        return ExtractionResult.error(`Extraction failed: ${error.message}`);
    }
}
/**
 * Get all chat directories
 * @returns {Promise<DirectoryResult>} Result with directories
 */
async function getChatDirectories() {
    // Check if the root directory exists
    try {
        await fs_1.promises.access(CLAUDE_LOGS_DIR);
    }
    catch (error) {
        const errorMsg = `Claude logs directory ${CLAUDE_LOGS_DIR} does not exist. Please ensure the Claude extension is installed and has generated logs.`;
        logger_1.default.error(errorMsg);
        return { success: false, directories: [], error: errorMsg };
    }
    try {
        const chatDirs = [];
        // Get all subdirectories
        const items = await fs_1.promises.readdir(CLAUDE_LOGS_DIR, { withFileTypes: true });
        // Process each subdirectory
        for (const item of items) {
            if (!item.isDirectory()) {
                continue;
            }
            const itemPath = path_1.default.join(CLAUDE_LOGS_DIR, item.name);
            // Check if this directory contains the required files
            const [apiExists, uiExists] = await Promise.all([
                fs_1.promises
                    .access(path_1.default.join(itemPath, "api_conversation_history.json"))
                    .then(() => true)
                    .catch(() => false),
                fs_1.promises
                    .access(path_1.default.join(itemPath, "ui_messages.json"))
                    .then(() => true)
                    .catch(() => false),
            ]);
            if (apiExists && uiExists) {
                if (VERBOSE) {
                    logger_1.default.debug(`Found chat directory: ${item.name}`);
                }
                chatDirs.push(itemPath);
            }
        }
        return { success: true, directories: chatDirs };
    }
    catch (error) {
        logger_1.default.error("Error getting chat directories:", error);
        return { success: false, directories: [], error: error.message };
    }
}
/**
 * Process a single chat directory
 * @param {string} dir - The directory path
 * @param {string|undefined} modelArg - The model name provided via CLI argument
 * @param {string|undefined} clientArg - The client name provided via CLI argument
 * @param {string|undefined} serverArg - The server name provided via CLI argument
 * @returns {Promise<ProcessingResult>} Processing result
 */
async function processDirectory(dir, modelArg, clientArg, serverArg) {
    try {
        const chatProcessor = new chat_processor_1.default(dir);
        // Use the new process method that centralizes error handling
        const taskSegments = await chatProcessor.process();
        if (!taskSegments.length) {
            return { metrics: [], error: undefined };
        }
        logger_1.default.info(`Processing test in directory: ${path_1.default.basename(dir)}`);
        logger_1.default[VERBOSE ? "debug" : "info"](`Found ${taskSegments.length} task segments`);
        // Process only the first task segment found for this directory
        // This ensures we don't create multiple metrics for the same directory
        const taskSegment = taskSegments[0];
        const testType = taskSegment.testType;
        const directoryId = path_1.default.basename(dir);
        // Check if metrics for this task already exist (unless force regenerate is enabled)
        if (!FORCE_REGENERATE) {
            const summaryGenerator = new summary_generator_1.default(METRICS_DIR);
            if (await summaryGenerator.metricFileExists(testType, taskSegment.taskNumber, directoryId)) {
                logger_1.default.info(`Skipping task ${taskSegment.taskNumber} (${testType}) - metrics file already exists for directory ${directoryId}`);
                return { metrics: [], error: undefined };
            }
        }
        // Pass model, client, and server args to the calculator
        const calculator = new metrics_calculator_1.default(taskSegment, testType, directoryId, modelArg, clientArg, serverArg);
        const metrics = await calculator.calculate();
        return {
            metrics: metrics ? [metrics] : [],
            error: metrics.success
                ? undefined
                : `Failed to calculate metrics for ${directoryId}`,
        };
    }
    catch (error) {
        logger_1.default.error(`Error processing directory ${dir}:`, error);
        return {
            metrics: [],
            error: `Error processing ${path_1.default.basename(dir)}: ${error.message}`,
        };
    }
}
// Run the extraction
extractChatMetrics().then((result) => {
    if (result.success) {
        logger_1.default.info(`Extraction completed successfully: ${result.message}`);
    }
    else {
        logger_1.default.error(`Extraction completed with errors: ${result.message}`);
        if (result.errors.length > 0) {
            logger_1.default.error(`Encountered ${result.errors.length} errors during extraction`);
        }
    }
});
//# sourceMappingURL=extract-chat-metrics.js.map