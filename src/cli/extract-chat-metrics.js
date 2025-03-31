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

// Show help message if requested (yargs handles this automatically, but good practice)
// Note: yargs automatically exits after showing help, so this block might not be strictly needed
if (argv.help) {
  // yargs handles printing help, we just need to ensure the script exits cleanly if needed.
  // process.exit(0); // yargs usually handles exit
}

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
  try {
    // Ensure metrics directory exists
    try {
      await fs.access(METRICS_DIR);
    } catch (error) {
      throw new Error(`Metrics directory ${METRICS_DIR} does not exist. Please create it before running this script.`);
    }

    // Get all chat directories
    const chatDirs = await getChatDirectories();
    logger.info(`Found ${chatDirs.length} chat directories`);

    // Process each chat directory in parallel, passing arguments
    const allTaskMetrics = await Promise.all(
      chatDirs.map(dir => processDirectory(dir, MODEL_ARG, CLIENT_ARG, SERVER_ARG))
    );

    // Flatten and filter out null results
    const validMetrics = allTaskMetrics
      .flat()
      .filter(metric => metric !== null);

    // Create a summary generator
    const summaryGenerator = new SummaryGenerator(METRICS_DIR);
    
    // If we have new metrics, write individual metric files
    if (validMetrics.length > 0) {
      await summaryGenerator.writeIndividualMetricFiles(validMetrics);
    } else {
      logger.warn('No new task metrics found in chat logs');
    }
    
    // Always generate summary from all available metric files
    // This ensures the summary is updated even if individual files were manually edited
    await summaryGenerator.generateSummaryFromFiles();
  } catch (error) {
    logger.error('Error extracting metrics:', error);
  }
}

/**
 * Get all chat directories
 */
async function getChatDirectories() {
  try {
    const chatDirs = [];
    
    // Check if the root directory exists
    try {
      await fs.access(CLAUDE_LOGS_DIR);
    } catch (error) {
      throw new Error(`Claude logs directory ${CLAUDE_LOGS_DIR} does not exist. Please ensure the Claude extension is installed and has generated logs.`);
    }
    
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
    
    return chatDirs;
  } catch (error) {
    logger.error('Error getting chat directories:', error);
    return [];
  }
}

/**
 * Process a single chat directory
 * @param {string} dir - The directory path
 * @param {string|undefined} modelArg - The model name provided via CLI argument
 * @param {string|undefined} clientArg - The client name provided via CLI argument
 * @param {string|undefined} serverArg - The server name provided via CLI argument
 */
async function processDirectory(dir, modelArg, clientArg, serverArg) {
  try {
    const chatProcessor = new ChatProcessor(dir);
    const initialized = await chatProcessor.initialize();
    if (!initialized) {
      return [];
    }

    const testType = chatProcessor.identifyTestType();
    if (!testType) {
      logger.debug(`Skipping directory ${dir} - not a test chat`);
      return [];
    }

    logger.info(`Processing ${testType} test in directory: ${path.basename(dir)}`);

    // Extract task segments
    const taskSegments = await chatProcessor.extractTaskSegments(testType);
    logger[VERBOSE ? 'debug' : 'info'](`Found ${taskSegments.length} task segments`);

    // Return early if no task segments found
    if (taskSegments.length === 0) {
      return [];
    }

    // Process only the first task segment found for this directory
    // This ensures we don't create multiple metrics for the same directory
    const taskSegment = taskSegments[0];
      
    // Get the directory ID
    const directoryId = path.basename(dir);
      
    // Check if metrics for this task already exist (unless force regenerate is enabled)
    if (!FORCE_REGENERATE) {
      const summaryGenerator = new SummaryGenerator(METRICS_DIR);
      if (await summaryGenerator.metricFileExists(testType, taskSegment.taskNumber, directoryId)) {
        logger.info(`Skipping task ${taskSegment.taskNumber} (${testType}) - metrics file already exists for directory ${directoryId}`);
        return [];
      }
    }
    // Pass model, client, and server args to the calculator
    const calculator = new MetricsCalculator(taskSegment, testType, directoryId, modelArg, clientArg, serverArg);
    const metrics = await calculator.calculate();
    return metrics ? [metrics] : [];
  } catch (error) {
    logger.error(`Error processing directory ${dir}:`, error);
    return [];
  }
}

// Run the extraction
extractChatMetrics();
