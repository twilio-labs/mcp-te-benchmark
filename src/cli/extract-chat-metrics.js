#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');
const config = require('../utils/config');
const logger = require('../utils/logger');
const ChatProcessor = require('./metrics/chat-processor');
const MetricsCalculator = require('./metrics/metrics-calculator');
const SummaryGenerator = require('./metrics/summary-generator');

// Constants
const CLAUDE_LOGS_DIR = '/Users/nmogil/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/tasks';
const METRICS_DIR = config.metrics.dataPath;

// Parse command line arguments
const args = process.argv.slice(2);
const SHOW_HELP = args.includes('--help') || args.includes('-h');
const FORCE_REGENERATE = args.includes('--force') || args.includes('-f');
const VERBOSE = args.includes('--verbose') || args.includes('-v');

// Show help message if requested
if (SHOW_HELP) {
  console.log(`
Usage: node extract-chat-metrics.js [options]

Options:
  -f, --force    Force regeneration of all metrics, even if they already exist
  -v, --verbose  Enable verbose logging for debugging
  -h, --help     Show this help message

Description:
  Extracts metrics from Claude chat logs and generates summary.json file.
  By default, it will skip tasks that already have metrics in the summary.
  Use --force to regenerate all metrics.
  `);
  process.exit(0);
}

if (VERBOSE) {
  console.log('Verbose mode enabled - will show detailed logging');
}

if (FORCE_REGENERATE) {
  console.log('Force regeneration mode enabled - will regenerate all metrics');
}

/**
 * Main function to extract metrics from Claude chat logs
 */
async function extractChatMetrics() {
  try {
    // Ensure metrics directory exists
    await fs.mkdir(METRICS_DIR, { recursive: true });

    // Get all chat directories
    const chatDirs = await getChatDirectories();
    logger.info(`Found ${chatDirs.length} chat directories`);

    // Process each chat directory in parallel
    const allTaskMetrics = await Promise.all(
      chatDirs.map(dir => processDirectory(dir))
    );

    // Flatten and filter out null results
    const validMetrics = allTaskMetrics
      .flat()
      .filter(metric => metric !== null);

    if (validMetrics.length > 0) {
      // Generate summary
      const summaryGenerator = new SummaryGenerator(METRICS_DIR);
      await summaryGenerator.generateSummary(validMetrics);
    } else {
      logger.warn('No task metrics found in chat logs');
    }
  } catch (error) {
    logger.error('Error extracting metrics:', error);
  }
}

/**
 * Get all chat directories
 */
async function getChatDirectories() {
  try {
    const rootDir = CLAUDE_LOGS_DIR;
    const chatDirs = [];
    
    // Check if the root directory exists
    try {
      await fs.access(rootDir);
    } catch (error) {
      logger.error(`Error accessing directory ${rootDir}:`, error);
      return [];
    }
    
    // Get all subdirectories
    const items = await fs.readdir(rootDir, { withFileTypes: true });
    
    // Process each subdirectory
    for (const item of items) {
      if (item.isDirectory()) {
        const itemPath = path.join(rootDir, item.name);
        
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
            console.log(`Found chat directory: ${item.name}`);
          }
          chatDirs.push(itemPath);
        }
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
 */
async function processDirectory(dir) {
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
    if (VERBOSE) {
      console.log(`Found ${taskSegments.length} task segments`);
    } else {
      logger.info(`Found ${taskSegments.length} task segments`);
    }

    // Only process the first task segment found for this directory
    // This ensures we don't create multiple metrics for the same directory
    if (taskSegments.length > 0) {
      const calculator = new MetricsCalculator(taskSegments[0], testType);
      const metrics = await calculator.calculate();
      return metrics ? [metrics] : [];
    }

    return [];
  } catch (error) {
    logger.error(`Error processing directory ${dir}:`, error);
    return [];
  }
}

// Run the extraction
extractChatMetrics();
