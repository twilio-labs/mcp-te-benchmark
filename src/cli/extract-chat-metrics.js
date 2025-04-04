#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const config = require('../utils/config');
const logger = require('../utils/logger');
const ChatProcessor = require('./metrics/chat-processor');
const MetricsCalculator = require('./metrics/metrics-calculator');
const SummaryGenerator = require('./metrics/summary-generator');

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
const CLAUDE_LOGS_DIR = '/Users/nmogil/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/tasks';
const METRICS_DIR = config.metrics.dataPath;

// Parse command line arguments using yargs
const argv = yargs(hideBin(process.argv))
  .option('force', {
    alias: 'f',
    type: 'boolean',
    description: 'Force regeneration of all metrics, even if they already exist',
    default: false,
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Enable verbose logging for debugging',
    default: false,
  })
  .option('model', {
    type: 'string',
    description: 'Specify the model name to use if not found in logs',
  })
  .option('client', {
    type: 'string',
    description: 'Specify the client name (e.g., MCP client) to use',
  })
  .option('server', {
    type: 'string',
    description: 'Specify the MCP server name to use',
  })
  .help()
  .alias('help', 'h')
  .argv;

// Use parsed arguments
const FORCE_REGENERATE = argv.force;
const VERBOSE = argv.verbose;
const MODEL_ARG = argv.model;
const CLIENT_ARG = argv.client;
const SERVER_ARG = argv.server;

// Log argument usage
if (VERBOSE) {
  logger.debug('Verbose mode enabled - will show detailed logging');
}
if (FORCE_REGENERATE) {
  logger.info('Force regeneration mode enabled - will regenerate all metrics');
}
if (MODEL_ARG) {
  logger.info(`Using provided model override: ${MODEL_ARG}`);
}
if (CLIENT_ARG) {
  logger.info(`Using provided client override: ${CLIENT_ARG}`);
}
if (SERVER_ARG) {
  logger.info(`Using provided server override: ${SERVER_ARG}`);
}

/**
 * Main function to extract metrics from Claude chat logs
 */
async function extractChatMetrics() {
  // Ensure metrics directory exists
  try {
    await fs.access(METRICS_DIR);
  } catch (error) {
    logger.error(`Metrics directory ${METRICS_DIR} does not exist. Please create it before running this script.`);
    return ExtractionResult.error(`Metrics directory ${METRICS_DIR} does not exist`);
  }

  try {
    // Get all chat directories
    const chatDirsResult = await getChatDirectories();
    if (!chatDirsResult.success) {
      return chatDirsResult;
    }
    
    const chatDirs = chatDirsResult.directories;
    logger.info(`Found ${chatDirs.length} chat directories`);

    // Process each chat directory in parallel, passing arguments
    const processingResults = await Promise.all(
      chatDirs.map(dir => processDirectory(dir, MODEL_ARG, CLIENT_ARG, SERVER_ARG))
    );

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
    const summaryGenerator = new SummaryGenerator(METRICS_DIR);
    
    // If we have new metrics, write individual metric files
    if (allMetrics.length > 0) {
      const writeResult = await summaryGenerator.writeIndividualMetricFiles(allMetrics);
      if (!writeResult.success) {
        logger.warn(`Some metrics files could not be written: ${writeResult.message}`);
      }
    } else {
      logger.warn('No new task metrics found in chat logs');
    }
    
    // Always generate summary from all available metric files
    // This ensures the summary is updated even if individual files were manually edited
    const summaryResult = await summaryGenerator.generateSummaryFromFiles();
    
    if (!summaryResult.success) {
      logger.warn(`Summary generation had issues: ${summaryResult.message}`);
      return ExtractionResult.error(
        'Completed with some errors',
        allMetrics,
        [...allErrors, summaryResult.message]
      );
    }
    
    return ExtractionResult.success(
      `Successfully processed ${allMetrics.length} metrics`,
      allMetrics
    );
  } catch (error) {
    logger.error('Error extracting metrics:', error);
    return ExtractionResult.error(`Extraction failed: ${error.message}`);
  }
}

/**
 * Get all chat directories
 * @returns {Promise<{success: boolean, directories: Array, error: string}>} Result with directories
 */
async function getChatDirectories() {
  // Check if the root directory exists
  try {
    await fs.access(CLAUDE_LOGS_DIR);
  } catch (error) {
    const errorMsg = `Claude logs directory ${CLAUDE_LOGS_DIR} does not exist. Please ensure the Claude extension is installed and has generated logs.`;
    logger.error(errorMsg);
    return { success: false, directories: [], error: errorMsg };
  }
  
  try {
    const chatDirs = [];
    
    // Get all subdirectories
    const items = await fs.readdir(CLAUDE_LOGS_DIR, { withFileTypes: true });
    
    // Process each subdirectory
    for (const item of items) {
      if (!item.isDirectory()) {
        continue;
      }
      
      const itemPath = path.join(CLAUDE_LOGS_DIR, item.name);
      
      // Check if this directory contains the required files
      const [apiExists, uiExists] = await Promise.all([
        fs.access(path.join(itemPath, 'api_conversation_history.json'))
          .then(() => true)
          .catch(() => false),
        fs.access(path.join(itemPath, 'ui_messages.json'))
          .then(() => true)
          .catch(() => false)
      ]);
      
      if (apiExists && uiExists) {
        if (VERBOSE) {
          logger.debug(`Found chat directory: ${item.name}`);
        }
        chatDirs.push(itemPath);
      }
    }
    
    return { success: true, directories: chatDirs };
  } catch (error) {
    logger.error('Error getting chat directories:', error);
    return { success: false, directories: [], error: error.message };
  }
}

/**
 * Process a single chat directory
 * @param {string} dir - The directory path
 * @param {string|undefined} modelArg - The model name provided via CLI argument
 * @param {string|undefined} clientArg - The client name provided via CLI argument
 * @param {string|undefined} serverArg - The server name provided via CLI argument
 * @returns {Promise<{metrics: Array, error: string|undefined}>} Processing result
 */
async function processDirectory(dir, modelArg, clientArg, serverArg) {
  try {
    const chatProcessor = new ChatProcessor(dir);
    
    // Use the new process method that centralizes error handling
    const taskSegments = await chatProcessor.process();
    
    if (!taskSegments.length) {
      return { metrics: [], error: undefined };
    }

    logger.info(`Processing test in directory: ${path.basename(dir)}`);
    logger[VERBOSE ? 'debug' : 'info'](`Found ${taskSegments.length} task segments`);

    // Process only the first task segment found for this directory
    // This ensures we don't create multiple metrics for the same directory
    const taskSegment = taskSegments[0];
    const testType = taskSegment.testType;
    const directoryId = path.basename(dir);
      
    // Check if metrics for this task already exist (unless force regenerate is enabled)
    if (!FORCE_REGENERATE) {
      const summaryGenerator = new SummaryGenerator(METRICS_DIR);
      if (await summaryGenerator.metricFileExists(testType, taskSegment.taskNumber, directoryId)) {
        logger.info(`Skipping task ${taskSegment.taskNumber} (${testType}) - metrics file already exists for directory ${directoryId}`);
        return { metrics: [], error: undefined };
      }
    }
    
    // Pass model, client, and server args to the calculator
    const calculator = new MetricsCalculator(taskSegment, testType, directoryId, modelArg, clientArg, serverArg);
    const metrics = await calculator.calculate();
    
    return { 
      metrics: metrics ? [metrics] : [],
      error: metrics ? undefined : `Failed to calculate metrics for ${directoryId}`
    };
  } catch (error) {
    logger.error(`Error processing directory ${dir}:`, error);
    return { metrics: [], error: `Error processing ${path.basename(dir)}: ${error.message}` };
  }
}

// Run the extraction
extractChatMetrics().then(result => {
  if (result.success) {
    logger.info(`Extraction completed successfully: ${result.message}`);
  } else {
    logger.error(`Extraction completed with errors: ${result.message}`);
    if (result.errors.length > 0) {
      logger.error(`Encountered ${result.errors.length} errors during extraction`);
    }
  }
});
