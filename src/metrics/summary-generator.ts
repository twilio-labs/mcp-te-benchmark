import { promises as fs } from 'fs';
import path from 'path';

import { logger } from '../utils';
import {
  convertFileMetricToTaskMetric,
  convertTaskMetricToFilePayload,
  hasMoreActivity,
  normalizeMetric,
  printSummaryStatistics,
  sortMetrics,
  SummaryResponse,
  validateDuration,
} from './metrics-utils';
import { TaskMetrics } from './types';

/**
 * Generator for summary metrics from task data
 */
class SummaryGenerator {
  private directory: string;

  /**
   * Create a new SummaryGenerator
   * @param {string} directory Directory containing metrics files
   */
  constructor(directory: string) {
    this.directory = directory;
  }

  /**
   * Generate a summary from task metrics
   * @param {TaskMetrics[]} taskMetrics Array of task metrics
   * @returns {Promise<SummaryResponse>} Result of the operation
   */
  async generateSummary(taskMetrics: TaskMetrics[]): Promise<SummaryResponse> {
    if (!taskMetrics?.length) {
      return {
        success: false,
        message: 'No task metrics provided',
        data: [],
        failedFiles: [],
      };
    }

    try {
      // Deduplicate metrics by directoryId - keep the entry with the most activity
      const directoryMap = new Map<string, TaskMetrics>();

      for (const metric of taskMetrics) {
        if (!metric.directoryId) {
          // eslint-disable-next-line no-continue
          continue;
        }

        const existing = directoryMap.get(metric.directoryId);
        if (!existing || hasMoreActivity(metric, existing)) {
          directoryMap.set(metric.directoryId, metric);
        }
      }

      // Convert back to array
      const uniqueMetrics = Array.from(directoryMap.values());

      // Write the summary file
      const summaryPath = path.join(this.directory, 'summary.json');
      await fs.writeFile(summaryPath, JSON.stringify(uniqueMetrics, null, 2));

      printSummaryStatistics(uniqueMetrics, this.directory);

      return {
        success: true,
        message: `Generated summary with ${uniqueMetrics.length} metrics`,
        data: uniqueMetrics,
        failedFiles: [],
      };
    } catch (error) {
      logger.error('Error generating summary:', error);
      return {
        success: false,
        message: `Failed to generate summary: ${(error as Error).message}`,
        data: taskMetrics,
        failedFiles: [],
      };
    }
  }

  /**
   * Write individual metric files for each task
   * @param {TaskMetrics[]} taskMetrics Array of task metrics
   * @returns {Promise<SummaryResponse>} Result of the operation
   */
  async writeIndividualMetricFiles(
    taskMetrics: TaskMetrics[],
  ): Promise<SummaryResponse> {
    if (!taskMetrics?.length) {
      return {
        success: false,
        message: 'No task metrics provided',
        data: [],
        failedFiles: [],
      };
    }

    const successfulWrites: string[] = [];
    const failedWrites: string[] = [];
    const tasksDir = path.join(this.directory, 'tasks');
    try {
      await fs.mkdir(tasksDir, { recursive: true });
    } catch (mkdirError) {
      logger.warn(
        `Could not create tasks directory: ${(mkdirError as Error).message}`,
      );
    }

    await Promise.all(
      taskMetrics.map(async (metric) => {
        try {
          const directoryId =
            metric.directoryId ??
            metric.startTime?.toString() ??
            Date.now().toString();
          const filename = `${metric.mode ?? 'unknown'}_task${metric.taskId ?? 0}_${directoryId}.json`;
          const filePath = path.join(tasksDir, filename);

          logger.info(
            `Writing metric file for task ${metric.taskId} with ${metric.apiCalls ?? 0} API calls`,
          );

          const payload = JSON.stringify(
            convertTaskMetricToFilePayload(metric),
            null,
            2,
          );
          await fs.writeFile(filePath, payload);

          successfulWrites.push(filename);
        } catch (error) {
          logger.error(
            `Error writing metric file for task ${metric.taskId}: ${(error as Error).message}`,
          );
          failedWrites.push(`task${metric.taskId ?? 0}`);
        }
      }),
    );

    if (failedWrites.length > 0) {
      return {
        success: false,
        message: `Failed to write ${failedWrites.length} metric files`,
        data: successfulWrites,
        failedFiles: failedWrites,
      };
    }

    return {
      success: true,
      message: `Successfully wrote ${successfulWrites.length} metric files`,
      data: successfulWrites,
      failedFiles: [],
    };
  }

  /**
   * Generate summary from individual metric files
   * @returns {Promise<SummaryResponse>} Result of the operation
   */
  async generateSummaryFromFiles(): Promise<SummaryResponse> {
    logger.info('Generating summary from individual metric files...');

    // Look for metric files in the 'tasks' subdirectory
    const tasksDir = path.join(this.directory, 'tasks');
    let files: string[];
    try {
      files = await fs.readdir(tasksDir);
    } catch (error) {
      logger.error(
        `Failed to read tasks directory: ${(error as Error).message}`,
      );
      return {
        success: false,
        message: `Failed to read tasks directory: ${(error as Error).message}`,
        data: [],
        failedFiles: [],
      };
    }

    const metricFiles = files.filter((file) =>
      file.match(/^(control|mcp)_task\d+_.*\.json$/),
    );

    if (metricFiles.length === 0) {
      logger.warn('No metric files found');
      return {
        success: false,
        message: 'No metric files found',
        data: [],
        failedFiles: [],
      };
    }

    logger.info(`Found ${metricFiles.length} individual metric files`);

    // Read and parse each file
    const allMetrics: TaskMetrics[] = [];
    const failedFiles: string[] = [];

    const readPromises = metricFiles.map(async (file) => {
      const filePath = path.join(this.directory, 'tasks', file);
      try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const metric = JSON.parse(fileContent);
        return {
          success: true,
          metric: convertFileMetricToTaskMetric(metric),
          file,
        };
      } catch (error) {
        logger.error(
          `Error parsing metric file ${file}: ${(error as Error).message}`,
        );
        return { success: false, file };
      }
    });

    const results = await Promise.all(readPromises);

    results.forEach((result) => {
      if (result.success && result.metric) {
        allMetrics.push(result.metric);
      } else {
        failedFiles.push(result.file);
      }
    });

    if (allMetrics.length === 0) {
      return {
        success: false,
        message: 'Failed to parse any metric files',
        data: [],
        failedFiles,
      };
    }

    // Sort metrics
    sortMetrics(allMetrics);

    try {
      // Write the summary file
      const summaryPath = path.join(this.directory, 'summary.json');
      await fs.writeFile(summaryPath, JSON.stringify(allMetrics, null, 2));

      printSummaryStatistics(allMetrics, this.directory);

      return {
        success: true,
        message: `Generated summary with ${allMetrics.length} metrics`,
        data: allMetrics,
        failedFiles,
      };
    } catch (error) {
      logger.error(`Failed to write summary file: ${(error as Error).message}`);
      return {
        success: false,
        message: `Failed to write summary file: ${(error as Error).message}`,
        data: allMetrics,
        failedFiles,
      };
    }
  }

  /**
   * Merge new metrics with existing summary
   * @param {TaskMetrics[]} newMetrics New metrics to merge
   * @returns {Promise<SummaryResponse>} Result of the operation
   */
  async mergeWithExistingSummary(
    newMetrics: TaskMetrics[],
  ): Promise<SummaryResponse> {
    if (!newMetrics?.length) {
      return {
        success: false,
        message: 'No new metrics provided',
        data: [],
        failedFiles: [],
      };
    }

    let existingMetrics: TaskMetrics[] = [];
    const summaryPath = path.join(this.directory, 'summary.json');

    try {
      const content = await fs.readFile(summaryPath, 'utf8');
      existingMetrics = JSON.parse(content);
    } catch (error) {
      logger.warn(
        `Could not read existing summary: ${(error as Error).message}. Creating new summary.`,
      );
    }

    // Merge and deduplicate metrics
    const allMetrics = [...existingMetrics];
    const updatedMetrics: TaskMetrics[] = [];
    const addedMetrics: TaskMetrics[] = [];

    // Add new metrics, replacing existing ones with same key
    for (const newMetric of newMetrics) {
      // Validate and adjust duration if needed
      const validatedMetric = validateDuration(newMetric);

      // Create a normalized metric with default values
      const normalizedMetric = normalizeMetric(validatedMetric);

      // Find existing metric with same key
      const existingIndex = allMetrics.findIndex(
        (metric) =>
          metric.mode === newMetric.mode &&
          metric.taskId === newMetric.taskId &&
          metric.startTime === newMetric.startTime,
      );

      if (existingIndex >= 0) {
        // Replace existing metric
        allMetrics[existingIndex] = normalizedMetric;
        updatedMetrics.push(normalizedMetric);
      } else {
        // Add new metric
        allMetrics.push(normalizedMetric);
        addedMetrics.push(normalizedMetric);
      }
    }

    // Sort metrics
    sortMetrics(allMetrics);

    try {
      // Write the merged summary
      await fs.writeFile(summaryPath, JSON.stringify(allMetrics, null, 2));

      return {
        success: true,
        message: `Merged summary: updated ${updatedMetrics.length}, added ${addedMetrics.length} metrics`,
        data: allMetrics,
        failedFiles: [],
      };
    } catch (error) {
      logger.error(`Error writing merged summary: ${(error as Error).message}`);
      return {
        success: false,
        message: `Failed to write merged summary: ${(error as Error).message}`,
        data: allMetrics,
        failedFiles: [],
      };
    }
  }

  /**
   * Check if a metric file exists
   * @param {string} mode Mode (control or mcp)
   * @param {number} taskId Task ID
   * @param {string} directoryId Directory ID
   * @returns {Promise<boolean>} True if file exists
   */
  async metricFileExists(
    mode: string,
    taskId: number,
    directoryId?: string,
  ): Promise<boolean> {
    if (!mode || !taskId) {
      return false;
    }

    try {
      const tasksDir = path.join(this.directory, 'tasks');
      const files = await fs.readdir(tasksDir);

      if (directoryId) {
        const specificPattern = new RegExp(
          `^${mode}_task${taskId}_${directoryId}\\.json$`,
        );
        return files.some((file) => specificPattern.test(file));
      }

      // Otherwise, check for any file matching the task and mode
      const pattern = new RegExp(`^${mode}_task${taskId}_.*\\.json$`);
      return files.some((file) => pattern.test(file));
    } catch (error) {
      logger.error(
        `Error checking for existing metric file: ${(error as Error).message}`,
      );
      return false;
    }
  }
}

export default SummaryGenerator;
