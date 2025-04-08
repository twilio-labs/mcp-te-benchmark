import { logger } from '../utils';
import {
  ApiHistoryEntry,
  CONTROL_MARKER,
  MCP_MARKER,
  TaskMetrics,
  TaskSegment,
  UIMessage,
} from './types';

// Interfaces for working with metrics
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
 * Extract timestamp from an API entry
 * @param {ApiHistoryEntry} entry The API entry
 * @returns {number|undefined} Timestamp in milliseconds or undefined if not found
 */
export function getTimestampFromApiEntry(
  entry: ApiHistoryEntry,
): number | undefined {
  if (!entry?.content || !Array.isArray(entry.content)) {
    return undefined;
  }

  for (const content of entry.content) {
    if (
      content.type === 'text' &&
      content.text &&
      content.text.includes('environment_details') &&
      content.text.includes('Current Time')
    ) {
      const match = content.text.match(/Current Time\s+([^<]+)/);
      if (match?.[1]) {
        const date = new Date(match[1].trim());
        if (!Number.isNaN(date.getTime())) {
          return date.getTime();
        }
      }
    }
  }

  return undefined;
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
  if (count === 0)
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

  logger.info(`Summary file generated at: ${metricsDir}/summary.json`);
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

/**
 * Identify the test type (control or mcp) from the chat data
 * @param {UIMessage[]} uiMessages UI messages from the chat
 * @param {ApiHistoryEntry[]} apiHistory API history entries from the chat
 * @returns {string|undefined} Test type or undefined if not identifiable
 */
export function identifyTestType(
  uiMessages: UIMessage[],
  apiHistory: ApiHistoryEntry[],
): string | undefined {
  if (!uiMessages?.length || !apiHistory?.length) {
    return undefined;
  }

  // Check UI messages first
  for (const message of uiMessages) {
    if (message.type === 'say' && message.say === 'text' && message.text) {
      if (
        message.text.includes("'agent-instructions/control_instructions.md'") ||
        message.text.includes('"agent-instructions/control_instructions.md"') ||
        message.text.includes(CONTROL_MARKER)
      ) {
        return 'control';
      }

      if (
        message.text.includes("'agent-instructions/mcp_instructions.md'") ||
        message.text.includes('"agent-instructions/mcp_instructions.md"') ||
        message.text.includes(MCP_MARKER)
      ) {
        return 'mcp';
      }
    }

    // Check for MCP usage
    if (message.type === 'say' && message.say === 'use_mcp_server') {
      return 'mcp';
    }
  }

  // Check API history as backup
  for (const entry of apiHistory) {
    if (
      entry.role === 'user' &&
      entry.content &&
      Array.isArray(entry.content)
    ) {
      const content = entry.content.map((c) => c.text ?? '').join(' ');

      if (
        content.includes(CONTROL_MARKER) ||
        content.includes("'agent-instructions/control_instructions.md'") ||
        content.includes('"agent-instructions/control_instructions.md"')
      ) {
        return 'control';
      }

      if (
        content.includes(MCP_MARKER) ||
        content.includes("'agent-instructions/mcp_instructions.md'") ||
        content.includes('"agent-instructions/mcp_instructions.md"')
      ) {
        return 'mcp';
      }
    }
  }

  return undefined;
}

/**
 * Get the last valid message timestamp
 * @param {UIMessage[]} uiMessages Array of UI messages
 * @returns {number|undefined} Last valid timestamp or undefined
 */
export function getLastValidMessageTimestamp(
  uiMessages: UIMessage[],
): number | undefined {
  for (let i = uiMessages.length - 1; i >= 0; i--) {
    const message = uiMessages[i];
    // Skip resume_completed_task messages as they can appear much later
    if (
      message?.ts &&
      typeof message.ts === 'number' &&
      !(message.type === 'ask' && message.ask === 'resume_completed_task')
    ) {
      return message.ts;
    }
  }
  return undefined;
}

/**
 * Extract conversation history index from a UI message
 * @param {UIMessage} message The UI message
 * @returns {number|undefined} The conversation history index or undefined
 */
export function extractConversationHistoryIndex(
  message: UIMessage,
): number | undefined {
  if (message.type !== 'say' || !message.text) {
    return undefined;
  }

  try {
    // First try to parse JSON to get index from structured data
    const jsonData = JSON.parse(message.text);
    if (jsonData.conversationHistoryIndex !== undefined) {
      return jsonData.conversationHistoryIndex;
    }
  } catch (e) {
    // If JSON parsing fails, try regex
    const indexMatch = message.text.match(
      /conversationHistoryIndex["\s:]+(\d+)/i,
    );
    if (indexMatch?.[1]) {
      return parseInt(indexMatch[1], 10);
    }
  }

  return undefined;
}

/**
 * Filter messages to include only relevant ones for task processing
 * @param {UIMessage[]} messages Array of UI messages
 * @returns {UIMessage[]} Filtered array of relevant messages
 */
export function filterRelevantMessages(messages: UIMessage[]): UIMessage[] {
  const TASK_SEGMENT_TEXTS = [
    'read_file',
    'codebase_search',
    'grep_search',
    'file_search',
    '<function_calls>',
    '<fnr>',
  ];

  return messages.filter((msg) => {
    // Include API requests and MCP server requests
    if (
      msg.type === 'say' &&
      (msg.say === 'api_req_started' ||
        msg.say === 'mcp_server_request_started')
    ) {
      return true;
    }

    // Include tool usage messages
    if (msg.type === 'say' && msg.say === 'text' && msg.text) {
      return TASK_SEGMENT_TEXTS.some((text) => msg.text?.includes(text));
    }

    // Include user messages
    if (
      msg.type === 'say' &&
      msg.say === 'text' &&
      (!msg.from || msg.from === 'user')
    ) {
      return true;
    }

    // Include all other 'say' messages for completeness
    if (msg.type === 'say') {
      return true;
    }

    return false;
  });
}

/**
 * Create suitable timestamp boundaries for filtering API entries
 * @param {number} startTime Task start time
 * @param {number} endTime Task end time
 * @returns {[number, number]} Tuple of [startBoundary, endBoundary]
 */
export function createTimestampBoundaries(
  startTime: number,
  endTime: number,
): [number, number] {
  const startBoundary = startTime - 60 * 1000; // 1 minute before task start
  const endBoundary = endTime + 5 * 60 * 1000; // 5 minutes after task end
  return [startBoundary, endBoundary];
}

/**
 * Validate and adjust task boundaries
 * @param {TaskSegment[]} taskBoundaries Array of task boundaries to validate
 * @param {number|undefined} lastValidMessageTs Last valid message timestamp
 * @param {number|undefined} messagesLength Length of the UI messages array
 * @returns {TaskSegment[]} Array of validated task boundaries
 */
export function validateTaskBoundaries(
  taskBoundaries: TaskSegment[],
  lastValidMessageTs?: number,
  messagesLength?: number,
): TaskSegment[] {
  if (!taskBoundaries.length) {
    return [];
  }

  // Set end boundaries with validation
  for (let i = 0; i < taskBoundaries.length; i++) {
    if (i < taskBoundaries.length - 1) {
      // For non-last tasks, end at the start of next task
      taskBoundaries[i].endIndex = taskBoundaries[i + 1].startIndex - 1;
      taskBoundaries[i].endTime = taskBoundaries[i + 1].startTime;
    } else {
      // For the last task, use the last valid message timestamp
      taskBoundaries[i].endIndex =
        messagesLength !== undefined ? messagesLength - 1 : -1;
      taskBoundaries[i].endTime = lastValidMessageTs as number;
    }

    // Validate endTime is after startTime and within reasonable bounds
    if (
      !taskBoundaries[i].endTime ||
      taskBoundaries[i].endTime! < taskBoundaries[i].startTime ||
      (lastValidMessageTs && taskBoundaries[i].endTime! > lastValidMessageTs)
    ) {
      logger.warn(
        `Invalid endTime detected for task ${taskBoundaries[i].taskNumber}. Using last valid message timestamp.`,
      );
      taskBoundaries[i].endTime = lastValidMessageTs as number;
    }
  }

  return taskBoundaries;
}

/**
 * Find task boundaries from UI messages
 * @param {UIMessage[]} uiMessages Array of UI messages
 * @param {string} directoryId Current directory ID
 * @param {string} testType Test type (control or mcp)
 * @returns {TaskSegment[]} Array of identified task boundaries
 */
export function findTaskBoundaries(
  uiMessages: UIMessage[],
  directoryId: string,
  testType: string,
): TaskSegment[] {
  const taskBoundaries: TaskSegment[] = [];
  const taskNumbers = new Set<number>();

  // Find task boundaries in UI messages
  for (let i = 0; i < uiMessages.length; i++) {
    const message = uiMessages[i];

    if (message.type === 'say' && message.say === 'text' && message.text) {
      let taskNumber: number | undefined;
      let messageTestType = testType;

      // Only look for task starts in specific instruction formats
      const taskStartMatch = message.text.match(
        /Complete Task (\d+) using the (?:commands|tools|functions)/i,
      );
      if (taskStartMatch?.[1]) {
        taskNumber = parseInt(taskStartMatch[1], 10);

        // Verify this is actually a task instruction by checking for instruction file references
        if (message.text.includes('control_instructions.md')) {
          messageTestType = 'control';
        } else if (message.text.includes('mcp_instructions.md')) {
          messageTestType = 'mcp';
        } else {
          // Not a real task instruction
          taskNumber = undefined;
        }
      }

      if (taskNumber && !taskNumbers.has(taskNumber)) {
        taskNumbers.add(taskNumber);

        taskBoundaries.push({
          taskNumber,
          directoryId,
          startIndex: i,
          startTime: message.ts as number,
          apiCalls: [],
          userMessages: [],
          endIndex: null,
          endTime: null,
          testType: messageTestType,
        });
      }
    }
  }

  return taskBoundaries;
}
