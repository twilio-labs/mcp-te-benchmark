import path from 'path';

import { logger } from '../utils';
import { TaskMetrics } from './types';

export interface MetricAverages {
  duration: number;
  apiCalls: number;
  interactions: number;
  tokens: number;
  cacheWrites: number;
  cacheReads: number;
  convHistoryIndex: number;
  cost: number;
}

export interface SummaryResponse {
  success: boolean;
  message: string;
  data: any[];
  failedFiles: string[];
}

/**
 * Compare metrics to determine which has more activity
 * @param {TaskMetrics} newMetric New metric
 * @param {TaskMetrics} existingMetric Existing metric
 * @returns {boolean} True if new metric has more activity
 */
export function hasMoreActivity(
  newMetric: TaskMetrics,
  existingMetric: TaskMetrics,
): boolean {
  if (!newMetric || !existingMetric) {
    return !!newMetric;
  }

  // Compare metrics to determine which one represents more actual activity
  const newScore =
    (newMetric.apiCalls ?? 0) +
    (newMetric.interactions ?? 0) +
    (newMetric.tokensIn ?? 0) +
    (newMetric.tokensOut ?? 0);

  const existingScore =
    (existingMetric.apiCalls ?? 0) +
    (existingMetric.interactions ?? 0) +
    (existingMetric.tokensIn ?? 0) +
    (existingMetric.tokensOut ?? 0);

  return newScore > existingScore;
}

/**
 * Sort metrics by task ID, mode, and model
 * @param {TaskMetrics[]} metrics Array of metrics to sort
 */
export function sortMetrics(metrics: TaskMetrics[]): void {
  if (!metrics?.length) return;

  metrics.sort((a, b) => {
    if (a.taskId === b.taskId) {
      if (a.mode === b.mode) {
        return (a.model ?? '').localeCompare(b.model ?? '');
      }
      return (a.mode ?? '').localeCompare(b.mode ?? '');
    }
    return (a.taskId ?? 0) - (b.taskId ?? 0);
  });
}

/**
 * Calculate averages for a set of task metrics
 * @param tasks Array of task metrics
 * @returns Object with average values
 */
export function calculateAverages(tasks: TaskMetrics[]): MetricAverages {
  const count = tasks.length;
  if (count === 0) {
    return {
      duration: 0,
      apiCalls: 0,
      interactions: 0,
      tokens: 0,
      cacheWrites: 0,
      cacheReads: 0,
      convHistoryIndex: 0,
      cost: 0,
    };
  }

  return {
    duration:
      tasks.reduce((sum, t) => sum + (t.duration || 0), 0) / 1000 / count, // Convert to seconds
    apiCalls: tasks.reduce((sum, t) => sum + (t.apiCalls || 0), 0) / count,
    interactions:
      tasks.reduce((sum, t) => sum + (t.interactions || 0), 0) / count,
    tokens: tasks.reduce((sum, t) => sum + (t.totalTokens || 0), 0) / count,
    cacheWrites:
      tasks.reduce((sum, t) => sum + (t.cacheWrites || 0), 0) / count,
    cacheReads: tasks.reduce((sum, t) => sum + (t.cacheReads || 0), 0) / count,
    convHistoryIndex:
      tasks.reduce((sum, t) => sum + (t.conversationHistoryIndex || 0), 0) /
      count,
    cost: tasks.reduce((sum, t) => sum + (t.cost || 0), 0) / count,
  };
}

/**
 * Calculate percentage change between old and new values
 * @param newValue New value
 * @param oldValue Old value
 * @returns Formatted percentage change string
 */
export function percentageChange(newValue: number, oldValue: number): string {
  if (oldValue === 0) {
    return 'N/A';
  }

  return (((newValue - oldValue) / oldValue) * 100).toFixed(1);
}

/**
 * Print performance comparison between control and MCP tasks
 * @param controlTasks Control task metrics
 * @param mcpTasks MCP task metrics
 */
export function printPerformanceComparison(
  controlTasks: TaskMetrics[],
  mcpTasks: TaskMetrics[],
): void {
  const controlAvg = calculateAverages(controlTasks);
  const mcpAvg = calculateAverages(mcpTasks);

  logger.info('\nPerformance Comparison:');
  logger.info(
    `Duration (s): Control=${controlAvg.duration.toFixed(1)}, MCP=${mcpAvg.duration.toFixed(1)} (${percentageChange(
      mcpAvg.duration,
      controlAvg.duration,
    )}% change)`,
  );
  logger.info(
    `API Calls: Control=${controlAvg.apiCalls.toFixed(1)}, MCP=${mcpAvg.apiCalls.toFixed(1)} (${percentageChange(
      mcpAvg.apiCalls,
      controlAvg.apiCalls,
    )}% change)`,
  );
  logger.info(
    `Interactions: Control=${controlAvg.interactions.toFixed(1)}, MCP=${mcpAvg.interactions.toFixed(1)} (${percentageChange(
      mcpAvg.interactions,
      controlAvg.interactions,
    )}% change)`,
  );
  logger.info(
    `Tokens: Control=${controlAvg.tokens.toFixed(0)}, MCP=${mcpAvg.tokens.toFixed(0)} (${percentageChange(
      mcpAvg.tokens,
      controlAvg.tokens,
    )}% change)`,
  );
  logger.info(
    `Cache Writes: Control=${controlAvg.cacheWrites.toFixed(0)}, MCP=${mcpAvg.cacheWrites.toFixed(0)} (${percentageChange(
      mcpAvg.cacheWrites,
      controlAvg.cacheWrites,
    )}% change)`,
  );
  logger.info(
    `Cache Reads: Control=${controlAvg.cacheReads.toFixed(0)}, MCP=${mcpAvg.cacheReads.toFixed(0)} (${percentageChange(
      mcpAvg.cacheReads,
      controlAvg.cacheReads,
    )}% change)`,
  );
  logger.info(
    `Conversation History: Control=${controlAvg.convHistoryIndex.toFixed(1)}, MCP=${mcpAvg.convHistoryIndex.toFixed(1)} (${percentageChange(
      mcpAvg.convHistoryIndex,
      controlAvg.convHistoryIndex,
    )}% change)`,
  );
  logger.info(
    `Cost ($): Control=${controlAvg.cost.toFixed(4)}, MCP=${mcpAvg.cost.toFixed(4)} (${percentageChange(
      mcpAvg.cost,
      controlAvg.cost,
    )}% change)`,
  );
}

/**
 * Print summary statistics
 * @param {TaskMetrics[]} taskMetrics Array of task metrics
 * @param {string} metricsDir Directory where metrics are stored
 */
export function printSummaryStatistics(
  taskMetrics: TaskMetrics[],
  metricsDir: string,
): void {
  if (!taskMetrics?.length) {
    logger.info('No metrics to display');
    return;
  }

  const controlTasks = taskMetrics.filter((t) => t.mode === 'control');
  const mcpTasks = taskMetrics.filter((t) => t.mode === 'mcp');

  logger.info('\nExtracted Metrics Summary:');
  logger.info('-------------------------');
  logger.info(`Total tasks processed: ${taskMetrics.length}`);
  logger.info(`Control tasks: ${controlTasks.length}`);
  logger.info(`MCP tasks: ${mcpTasks.length}`);

  logger.info('\nTask Details:');
  taskMetrics.forEach((task) => {
    logger.info(
      `Task ${task.taskId ?? 'unknown'} (${task.mode ?? 'unknown'}): duration=${(
        (task.duration ?? 0) / 1000
      ).toFixed(
        1,
      )}s, interactions=${task.interactions ?? 0}, apiCalls=${task.apiCalls ?? 0}, tokens=${task.tokensIn ?? 0}`,
    );
  });

  if (controlTasks.length > 0 && mcpTasks.length > 0) {
    printPerformanceComparison(controlTasks, mcpTasks);
  }

  logger.info(
    `Summary file generated at: ${path.join(metricsDir, 'summary.json')}`,
  );
}

/**
 * Normalize a metric by ensuring all optional fields have default values
 * @param metric The metric to normalize
 * @returns Normalized metric
 */
export function normalizeMetric(metric: TaskMetrics): TaskMetrics {
  return {
    ...metric,
    apiCalls: metric.apiCalls ?? 0,
    interactions: metric.interactions ?? 0,
    cacheWrites: metric.cacheWrites ?? 0,
    cacheReads: metric.cacheReads ?? 0,
    conversationHistoryIndex: metric.conversationHistoryIndex ?? 0,
  };
}

/**
 * Convert a file metric format to the summary format
 * @param metric The file metric data
 * @returns TaskMetrics object
 */
export function convertFileMetricToTaskMetric(metric: any): TaskMetrics {
  return {
    taskId: metric.taskNumber,
    directoryId: metric.directoryId ?? '',
    mode: metric.mode,
    model: metric.model,
    mcpServer: metric.mcpServer ?? 'Twilio',
    mcpClient: metric.mcpClient ?? 'Cline',
    startTime: metric.startTime,
    endTime: metric.endTime,
    duration: metric.duration,
    apiCalls: metric.apiCalls ?? 0,
    interactions: metric.interactions ?? 0,
    tokensIn: metric.tokensIn ?? 0,
    tokensOut: metric.tokensOut ?? 0,
    totalTokens: metric.totalTokens ?? 0,
    cacheWrites: metric.cacheWrites ?? 0,
    cacheReads: metric.cacheReads ?? 0,
    conversationHistoryIndex: metric.conversationHistoryIndex ?? 0,
    cost: metric.cost ?? 0,
    success: metric.success !== false,
    notes: metric.notes ?? '',
  };
}

/**
 * Convert a task metric to a file payload format
 * @param metric The task metric
 * @returns File payload object
 */
export function convertTaskMetricToFilePayload(metric: TaskMetrics): any {
  return {
    mode: metric.mode,
    taskNumber: metric.taskId,
    directoryId: metric.directoryId ?? '',
    model: metric.model,
    startTime: metric.startTime,
    completed: true,
    apiCalls: metric.apiCalls ?? 0,
    interactions: metric.interactions ?? 0,
    tokensIn: metric.tokensIn ?? 0,
    tokensOut: metric.tokensOut ?? 0,
    totalTokens: metric.totalTokens ?? 0,
    cacheWrites: metric.cacheWrites ?? 0,
    cacheReads: metric.cacheReads ?? 0,
    conversationHistoryIndex: metric.conversationHistoryIndex ?? 0,
    cost: metric.cost ?? 0,
    success: metric.success ?? false,
    endTime: metric.endTime,
    duration: metric.duration,
  };
}

/**
 * Validate and adjust the duration of a metric if needed
 * @param metric The metric to validate
 * @returns The metric with validated duration
 */
export function validateDuration(metric: TaskMetrics): TaskMetrics {
  const MAX_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  let { duration } = metric;

  if (duration < 0 || duration > MAX_DURATION) {
    logger.warn(
      `Invalid duration detected in metric for task ${metric.taskId}: ${duration}ms. Adjusting...`,
    );
    duration = Math.max(0, Math.min(duration, MAX_DURATION));
    return {
      ...metric,
      duration,
      endTime: metric.startTime + duration,
    };
  }

  return metric;
}
