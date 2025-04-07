import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import ChatProcessor from './metrics/chat-processor';
import MetricsCalculator from './metrics/metrics-calculator';
import SummaryGenerator from './metrics/summary-generator';
import { TaskMetrics } from './metrics/types';
import { config, logger } from './utils';

type DirectoryResult = {
  success: boolean;
  directories: string[];
  error?: string;
};

type ProcessingResult = {
  metrics: TaskMetrics[];
  error?: string;
};

type ExtractOptions = {
  forceRegenerate: boolean;
  verbose: boolean;
  modelArg?: string;
  clientArg?: string;
  serverArg?: string;
};

type ExtractionResult = {
  success: boolean;
  message: string;
  metrics: TaskMetrics[];
  errors: string[];
};

class ExtractMetrics {
  private claudeLogsDir: string;

  private metricsDir: string;

  private forceRegenerate: boolean;

  private verbose: boolean;

  private modelArg?: string;

  private clientArg?: string;

  private serverArg?: string;

  /**
   * Create a new ExtractMetrics instance with the specified options
   * @param options Configuration options
   */
  constructor(options: ExtractOptions) {
    this.claudeLogsDir = path.join(
      os.homedir(),
      'Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/tasks',
    );
    this.metricsDir = config.metrics.dataPath;
    this.forceRegenerate = options.forceRegenerate;
    this.verbose = options.verbose;
    this.modelArg = options.modelArg;
    this.clientArg = options.clientArg;
    this.serverArg = options.serverArg;

    // Log argument usage
    if (this.verbose) {
      logger.debug('Verbose mode enabled - will show detailed logging');
    }
    if (this.forceRegenerate) {
      logger.info(
        'Force regeneration mode enabled - will regenerate all metrics',
      );
    }
    if (this.modelArg) {
      logger.info(`Using provided model override: ${this.modelArg}`);
    }
    if (this.clientArg) {
      logger.info(`Using provided client override: ${this.clientArg}`);
    }
    if (this.serverArg) {
      logger.info(`Using provided server override: ${this.serverArg}`);
    }
  }

  /**
   * Static method to parse args and run extraction
   * @param argv Command line arguments
   * @returns Promise with extraction result
   */
  static async extract(argv: string[]): Promise<ExtractionResult> {
    // Parse command line arguments
    const parsedArgs = yargs(hideBin(argv))
      .option('force', {
        alias: 'f',
        type: 'boolean',
        description:
          'Force regeneration of all metrics, even if they already exist',
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
      .parseSync();

    // Create options object from parsed arguments
    const options: ExtractOptions = {
      forceRegenerate: parsedArgs.force,
      verbose: parsedArgs.verbose,
      modelArg: parsedArgs.model,
      clientArg: parsedArgs.client,
      serverArg: parsedArgs.server,
    };

    // Create an instance with the parsed options and run the extraction
    const extractor = new ExtractMetrics(options);
    return extractor.extractChatMetrics();
  }

  /**
   * Get all chat directories
   * @returns {Promise<DirectoryResult>} Result with directories
   */
  private async getChatDirectories(): Promise<DirectoryResult> {
    // Check if the root directory exists
    try {
      await fs.access(this.claudeLogsDir);
    } catch (error) {
      const errorMsg = `Claude logs directory ${this.claudeLogsDir} does not exist. Please ensure the Claude extension is installed and has generated logs.`;
      logger.error(errorMsg);
      return { success: false, directories: [], error: errorMsg };
    }

    try {
      const chatDirs: string[] = [];

      // Get all subdirectories
      const items = await fs.readdir(this.claudeLogsDir, {
        withFileTypes: true,
      });

      // Process each subdirectory
      for (const item of items) {
        if (!item.isDirectory()) {
          continue;
        }

        const itemPath = path.join(this.claudeLogsDir, item.name);

        // Check if this directory contains the required files
        const [apiExists, uiExists] = await Promise.all([
          fs
            .access(path.join(itemPath, 'api_conversation_history.json'))
            .then(() => true)
            .catch(() => false),
          fs
            .access(path.join(itemPath, 'ui_messages.json'))
            .then(() => true)
            .catch(() => false),
        ]);

        if (apiExists && uiExists) {
          if (this.verbose) {
            logger.debug(`Found chat directory: ${item.name}`);
          }
          chatDirs.push(itemPath);
        }
      }

      return { success: true, directories: chatDirs };
    } catch (error) {
      logger.error('Error getting chat directories:', error);
      return {
        success: false,
        directories: [],
        error: (error as Error).message,
      };
    }
  }

  /**
   * Process a single chat directory
   * @param {string} dir - The directory path
   * @returns {Promise<ProcessingResult>} Processing result
   */
  private async processDirectory(dir: string): Promise<ProcessingResult> {
    try {
      const chatProcessor = new ChatProcessor(dir);

      // Use the new process method that centralizes error handling
      const taskSegments = await chatProcessor.process();

      if (!taskSegments.length) {
        return { metrics: [], error: undefined };
      }

      logger.info(`Processing test in directory: ${path.basename(dir)}`);
      logger[this.verbose ? 'debug' : 'info'](
        `Found ${taskSegments.length} task segments`,
      );

      const taskSegment = taskSegments[0];
      const { testType } = taskSegment;
      const directoryId = path.basename(dir);

      if (!this.forceRegenerate) {
        const summaryGenerator = new SummaryGenerator(this.metricsDir);
        if (
          await summaryGenerator.metricFileExists(
            testType,
            taskSegment.taskNumber,
            directoryId,
          )
        ) {
          logger.info(
            `Skipping task ${taskSegment.taskNumber} (${testType}) - metrics file already exists for directory ${directoryId}`,
          );
          return { metrics: [], error: undefined };
        }
      }

      // Pass model, client, and server args to the calculator
      const calculator = new MetricsCalculator(
        taskSegment,
        testType,
        directoryId,
        this.modelArg,
        this.clientArg,
        this.serverArg,
      );
      const metrics = await calculator.calculate();

      return {
        metrics: metrics ? [metrics] : [],
        error: metrics.success
          ? undefined
          : `Failed to calculate metrics for ${directoryId}`,
      };
    } catch (error) {
      logger.error(`Error processing directory ${dir}:`, error);
      return {
        metrics: [],
        error: `Error processing ${path.basename(dir)}: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Create a success result object
   */
  private static success(
    message: string,
    metrics: TaskMetrics[] = [],
  ): ExtractionResult {
    return {
      success: true,
      message,
      metrics,
      errors: [],
    };
  }

  /**
   * Create an error result object
   */
  private static error(
    message: string,
    metrics: TaskMetrics[] = [],
    errors: string[] = [],
  ): ExtractionResult {
    return {
      success: false,
      message,
      metrics,
      errors,
    };
  }

  /**
   * Main function to extract metrics from Claude chat logs
   */
  private async extractChatMetrics(): Promise<ExtractionResult> {
    // Ensure metrics directory exists
    try {
      await fs.access(this.metricsDir);
    } catch (error) {
      logger.error(
        `Metrics directory ${this.metricsDir} does not exist. Please create it before running this script.`,
      );
      return ExtractMetrics.error(
        `Metrics directory ${this.metricsDir} does not exist`,
      );
    }

    try {
      // Get all chat directories
      const chatDirsResult = await this.getChatDirectories();
      if (!chatDirsResult.success) {
        return ExtractMetrics.error(
          chatDirsResult.error || 'Failed to get chat directories',
        );
      }

      const chatDirs = chatDirsResult.directories;
      logger.info(`Found ${chatDirs.length} chat directories`);

      // Process each chat directory in parallel
      const processingResults = await Promise.all(
        chatDirs.map((dir) => this.processDirectory(dir)),
      );

      // Collect all metrics and errors
      const allMetrics: TaskMetrics[] = [];
      const allErrors: string[] = [];

      for (const result of processingResults) {
        if (result.metrics?.length) {
          allMetrics.push(...result.metrics);
        }
        if (result.error) {
          allErrors.push(result.error);
        }
      }

      // Create a summary generator
      const summaryGenerator = new SummaryGenerator(this.metricsDir);

      // If we have new metrics, write individual metric files
      if (allMetrics.length > 0) {
        const writeResult =
          await summaryGenerator.writeIndividualMetricFiles(allMetrics);
        if (!writeResult.success) {
          logger.warn(
            `Some metrics files could not be written: ${writeResult.message}`,
          );
        }
      } else {
        logger.warn('No new task metrics found in chat logs');
      }

      // Always generate summary from all available metric files
      // This ensures the summary is updated even if individual files were manually edited
      const summaryResult = await summaryGenerator.generateSummaryFromFiles();

      if (!summaryResult.success) {
        logger.warn(`Summary generation had issues: ${summaryResult.message}`);
        return ExtractMetrics.error('Completed with some errors', allMetrics, [
          ...allErrors,
          summaryResult.message,
        ]);
      }

      return ExtractMetrics.success(
        `Successfully processed ${allMetrics.length} metrics`,
        allMetrics,
      );
    } catch (error) {
      logger.error('Error extracting metrics:', error);
      return ExtractMetrics.error(
        `Extraction failed: ${(error as Error).message}`,
      );
    }
  }
}

export default ExtractMetrics;
