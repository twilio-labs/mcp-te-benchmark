#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import ExtractMetrics from './extract-metrics';
import GenerateSummary from './generate-summary';
import { logger } from './utils';

// Define the main CLI command structure
yargs(hideBin(process.argv))
  .scriptName('mcp-benchmark')
  .usage('$0 <cmd> [args]')
  .command(
    'extract-metrics',
    'Extract metrics from Claude chat logs',
    () => {},
    async () => {
      try {
        const subArgs = process.argv.slice(0, 2).concat(process.argv.slice(3));
        const result = await ExtractMetrics.extract(subArgs);

        if (result.success) {
          logger.info(`Extraction completed successfully: ${result.message}`);
        } else {
          logger.error(`Extraction completed with errors: ${result.message}`);
          if (result.errors.length > 0) {
            logger.error(
              `Encountered ${result.errors.length} errors during extraction`,
            );
          }
          process.exit(1);
        }
      } catch (error) {
        logger.error('Unexpected error during extraction:', error);
        process.exit(1);
      }
    },
  )
  .command(
    'generate-summary',
    'Generate summary.json from existing metric files',
    () => {},
    async () => {
      try {
        const subArgs = process.argv.slice(0, 2).concat(process.argv.slice(3));
        const result = await GenerateSummary.generate(subArgs);

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        logger.error('Unexpected error during summary generation:', error);
        process.exit(1);
      }
    },
  )
  .demandCommand(1, 'You must specify a command to run')
  .help()
  .alias('help', 'h')
  .epilog(
    'For more information, visit https://github.com/anthropic/mcp-te-benchmark',
  )
  .parse();
