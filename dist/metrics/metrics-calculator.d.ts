import { TaskSegment, TaskMetrics } from "./types";
interface TokenMetrics {
    tokensIn: number;
    tokensOut: number;
    totalCost: number;
    cacheWrites: number;
    cacheReads: number;
    conversationHistoryIndex: number;
}
/**
 * Calculator for processing and extracting metrics from task segments
 */
declare class MetricsCalculator {
    private segment;
    private testType;
    private directoryId;
    private modelArg?;
    private clientArg?;
    private serverArg?;
    /**
     * Create a default metrics result object
     * @param {TaskSegment | null} segment The task segment (or null)
     * @param {string} directoryId The directory ID
     * @returns {TaskMetrics} A default metrics object with zero values
     */
    static createDefaultResult(segment: TaskSegment | null, directoryId?: string): TaskMetrics;
    /**
     * Constructor for MetricsCalculator
     * @param {TaskSegment} segment The task segment
     * @param {string} testType The test type (control or mcp)
     * @param {string} directoryId The directory ID
     * @param {string} modelArg The model argument from command line
     * @param {string} clientArg The client argument from command line
     * @param {string} serverArg The server argument from command line
     */
    constructor(segment: TaskSegment, testType: string, directoryId: string, modelArg?: string, clientArg?: string, serverArg?: string);
    /**
     * Calculate metrics for the task segment
     * @returns {Promise<TaskMetrics>} The calculated metrics
     */
    calculate(): Promise<TaskMetrics>;
    /**
     * Check if the task segment contains MCP usage
     * @returns {boolean} True if MCP was used
     */
    checkForMcpUsage(): boolean;
    /**
     * Calculate the number of API calls in the task segment
     * @returns {Promise<number>} The number of API calls
     */
    calculateApiCalls(): Promise<number>;
    /**
     * Calculate the number of user messages in the task segment
     * @returns {Promise<number>} The number of user messages
     */
    calculateUserMessages(): Promise<number>;
    /**
     * Calculate token metrics for the task segment
     * @returns {Promise<TokenMetrics>} Token metrics
     */
    calculateTokenMetrics(): Promise<TokenMetrics>;
    /**
     * Determine the model used for the task
     * @returns {Promise<string>} The model name
     */
    determineModel(): Promise<string>;
}
export default MetricsCalculator;
