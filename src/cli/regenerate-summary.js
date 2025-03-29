#!/usr/bin/env node
const path = require('path');
const config = require('../utils/config');
const logger = require('../utils/logger');
const SummaryGenerator = require('./metrics/summary-generator');

// Constants
const METRICS_DIR = config.metrics.dataPath;

/**
 * Main function to regenerate the summary.json file from existing individual metric files
 */
async function regenerateSummary() {
  try {
    logger.info('Regenerating summary.json from existing individual metric files...');
    
    // Create a summary generator
    const summaryGenerator = new SummaryGenerator(METRICS_DIR);
    
    // Generate summary from all available metric files
    await summaryGenerator.generateSummaryFromFiles();
    
    logger.info('Summary regeneration completed successfully.');
  } catch (error) {
    logger.error('Error regenerating summary:', error);
    process.exit(1);
  }
}

// Run the regeneration
regenerateSummary();
