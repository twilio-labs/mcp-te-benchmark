import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import SummaryGenerator from './metrics/summary-generator';
import { config, logger } from './utils';

type SummaryOptions = {
  verbose: boolean;
  metricsDir?: string;
};

type SummaryResult = {
  success: boolean;
  message: string;
};

class GenerateSummary {
  private metricsDir: string;

  private verbose: boolean;

  /**
   * Create a new GenerateSummary instance
   * @param options Configuration options
   */
  constructor(options: SummaryOptions) {
    this.metricsDir = options.metricsDir || config.metrics.dataPath;
    this.verbose = options.verbose;

    if (this.verbose) {
      logger.debug('Verbose mode enabled - will show detailed logging');
    }
    if (options.metricsDir) {
      logger.info(`Using custom metrics directory: ${this.metricsDir}`);
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
      .option('metricsDir', {
        alias: 'd',
        type: 'string',
        description: 'Specify a custom metrics directory path',
      })
      .help()
      .alias('help', 'h')
      .parseSync();

    // Create options object from parsed arguments
    const options: SummaryOptions = {
      verbose: parsedArgs.verbose,
      metricsDir: parsedArgs.metricsDir,
    };

    // Create an instance with the parsed options and run the summary generation
    const generator = new GenerateSummary(options);
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

      const summaryGenerator = new SummaryGenerator(this.metricsDir);
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
