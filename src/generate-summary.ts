import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import SummaryGenerator from './metrics/summary-generator';
import { logger } from './utils';

type SummaryOptions = {
  verbose: boolean;
  directory: string;
};

type SummaryResult = {
  success: boolean;
  message: string;
};

class GenerateSummary {
  private directory: string;

  private verbose: boolean;

  /**
   * Create a new GenerateSummary instance
   * @param options Configuration options
   */
  constructor(options: SummaryOptions) {
    this.directory = options.directory;
    this.verbose = options.verbose;

    if (this.verbose) {
      logger.debug('Verbose mode enabled - will show detailed logging');
    }
    if (options.directory) {
      logger.info(`Using custom metrics directory: ${this.directory}`);
    }
  }

  /**
   * Static method to parse args and run summary generation
   * @param argv Command line arguments
   * @returns Promise with result
   */
  static async generate(argv: string[]): Promise<SummaryResult> {
    // Parse command line arguments
    const parsedArgs = yargs(hideBin(argv))
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Enable verbose logging for debugging',
        default: false,
      })
      .option('directory', {
        alias: 'd',
        type: 'string',
        description: 'Specify a custom metrics directory path',
        default: path.join(os.homedir(), '.mcp-te-benchmark'),
      })
      .help()
      .alias('help', 'h')
      .parseSync();

    await fs.mkdir(parsedArgs.directory, { recursive: true });
    await fs.mkdir(path.join(parsedArgs.directory, 'tasks'), {
      recursive: true,
    });

    const generator = new GenerateSummary({
      verbose: parsedArgs.verbose,
      directory: parsedArgs.directory,
    });
    return generator.regenerateSummary();
  }

  /**
   * Main function to regenerate the summary.json file from existing individual metric files
   */
  private async regenerateSummary(): Promise<SummaryResult> {
    try {
      logger.info(
        'Regenerating summary.json from existing individual metric files...',
      );

      const summaryGenerator = new SummaryGenerator(this.directory);
      const result = await summaryGenerator.generateSummaryFromFiles();

      if (result.success) {
        logger.info('Summary regeneration completed successfully.');
        return {
          success: true,
          message: 'Summary regeneration completed successfully',
        };
      }

      logger.warn(`Summary generation had issues: ${result.message}`);
      return {
        success: false,
        message: `Summary generation had issues: ${result.message}`,
      };
    } catch (error) {
      const errorMessage = `Error regenerating summary: ${(error as Error).message}`;
      logger.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }
}

export default GenerateSummary;
