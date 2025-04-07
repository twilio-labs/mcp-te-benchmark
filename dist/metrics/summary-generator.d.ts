import { TaskMetrics } from "./types";
interface SummaryResultData {
    success: boolean;
    message: string;
    data: any[];
    failedFiles: string[];
}
interface MetricAverages {
    duration: number;
    apiCalls: number;
    interactions: number;
    tokens: number;
    cacheWrites: number;
    cacheReads: number;
    convHistoryIndex: number;
    cost: number;
}
/**
 * Result class for consistent error handling
 */
declare class SummaryResult implements SummaryResultData {
    success: boolean;
    message: string;
    data: any[];
    failedFiles: string[];
    /**
     * Create a new SummaryResult
     * @param {boolean} success Whether the operation was successful
     * @param {string} message A message describing the result
     * @param {Array} data The metrics data
     * @param {Array} failedFiles Any files that failed to process
     */
    constructor(success: boolean, message: string, data?: any[], failedFiles?: string[]);
    /**
     * Create a success result
     * @param {string} message Success message
     * @param {Array} data Metrics data
     * @param {Array} failedFiles Any files that failed to process
     * @returns {SummaryResult} A success result
     */
    static success(message: string, data?: any[], failedFiles?: string[]): SummaryResult;
    /**
     * Create an error result
     * @param {string} message Error message
     * @param {Array} data Any partial data that was collected
     * @param {Array} failedFiles Any files that failed to process
     * @returns {SummaryResult} An error result
     */
    static error(message: string, data?: any[], failedFiles?: string[]): SummaryResult;
}
/**
 * Generator for summary metrics from task data
 */
declare class SummaryGenerator {
    private metricsDir;
    /**
     * Create a new SummaryGenerator
     * @param {string} metricsDir Directory containing metrics files
     */
    constructor(metricsDir: string);
    /**
     * Generate a summary from task metrics
     * @param {TaskMetricData[]} taskMetrics Array of task metrics
     * @returns {Promise<SummaryResult>} Result of the operation
     */
    generateSummary(taskMetrics: TaskMetrics[]): Promise<SummaryResult>;
    /**
     * Compare metrics to determine which has more activity
     * @param {TaskMetricData} newMetric New metric
     * @param {TaskMetricData} existingMetric Existing metric
     * @returns {boolean} True if new metric has more activity
     */
    hasMoreActivity(newMetric: TaskMetrics, existingMetric: TaskMetrics): boolean;
    /**
     * Sort metrics by task ID, mode, and model
     * @param {TaskMetricData[]} metrics Array of metrics to sort
     */
    sortMetrics(metrics: TaskMetrics[]): void;
    /**
     * Write individual metric files for each task
     * @param {TaskMetricData[]} taskMetrics Array of task metrics
     * @returns {Promise<SummaryResult>} Result of the operation
     */
    writeIndividualMetricFiles(taskMetrics: TaskMetrics[]): Promise<SummaryResult>;
    /**
     * Generate summary from individual metric files
     * @returns {Promise<SummaryResult>} Result of the operation
     */
    generateSummaryFromFiles(): Promise<SummaryResult>;
    /**
     * Merge new metrics with existing summary
     * @param {TaskMetricData[]} newMetrics New metrics to merge
     * @returns {Promise<SummaryResult>} Result of the operation
     */
    mergeWithExistingSummary(newMetrics: TaskMetrics[]): Promise<SummaryResult>;
    /**
     * Check if a metric file exists
     * @param {string} mode Mode (control or mcp)
     * @param {number} taskId Task ID
     * @param {string} directoryId Directory ID
     * @returns {Promise<boolean>} True if file exists
     */
    metricFileExists(mode: string, taskId: number, directoryId?: string): Promise<boolean>;
    /**
     * Print summary statistics
     * @param {TaskMetricData[]} taskMetrics Array of task metrics
     */
    printSummaryStatistics(taskMetrics: TaskMetrics[]): void;
    printPerformanceComparison(controlTasks: TaskMetrics[], mcpTasks: TaskMetrics[]): void;
    calculateAverages(tasks: TaskMetrics[]): MetricAverages;
    percentageChange(newValue: number, oldValue: number): string;
}
export default SummaryGenerator;
