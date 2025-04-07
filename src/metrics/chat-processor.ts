import { promises as fs } from 'fs';
import path from 'path';

import { logger } from '../utils';
import { CONTROL_MARKER, MCP_MARKER, TaskSegment } from './types';

interface ApiHistoryEntry {
  role: string;
  content: Array<{
    type: string;
    text?: string;
  }>;
}

interface UiMessage {
  type: string;
  say?: string;
  ask?: string;
  from?: string;
  text?: string;
  ts?: number;
  conversationHistoryIndex?: number;
}

interface TaskBoundary {
  taskNumber: number;
  directoryId: string;
  startIndex: number;
  startTime: number;
  apiCalls: ApiHistoryEntry[];
  userMessages: UiMessage[];
  endIndex: number | null;
  endTime: number | null;
  testType: string;
  apiCallCount?: number;
  messageCount?: number;
}

class ChatProcessor {
  private chatDir: string;

  private apiHistory: ApiHistoryEntry[];

  private uiMessages: UiMessage[];

  private directoryId: string;

  private initialized: boolean;

  constructor(chatDir: string) {
    this.chatDir = chatDir;
    this.apiHistory = [];
    this.uiMessages = [];
    this.directoryId = path.basename(chatDir);
    this.initialized = false;
  }

  /**
   * Process the chat data with centralized error handling
   * @returns {Promise<TaskSegment[]>} Task segments or empty array if processing fails
   */
  async process(): Promise<TaskSegment[]> {
    try {
      // Initialize and validate in a single step
      const initialized = await this.initialize();
      if (!initialized) {
        logger.error(
          `Failed to initialize chat processor for ${this.directoryId}`,
        );
        return [];
      }

      // Identify test type with validation
      const testType = this.identifyTestType();
      if (!testType) {
        logger.warn(
          `Could not identify test type for ${this.directoryId}, skipping processing`,
        );
        return [];
      }

      // Extract and process task segments
      return await this.extractTaskSegments(testType);
    } catch (error) {
      logger.error(
        `Error processing chat ${this.directoryId}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Initialize the chat processor by loading required files
   * @returns {Promise<boolean>} Success status
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      const [apiHistoryContent, uiMessagesContent] = await Promise.all([
        fs.readFile(
          path.join(this.chatDir, 'api_conversation_history.json'),
          'utf8',
        ),
        fs.readFile(path.join(this.chatDir, 'ui_messages.json'), 'utf8'),
      ]);

      this.apiHistory = JSON.parse(apiHistoryContent);
      this.uiMessages = JSON.parse(uiMessagesContent);
      this.initialized = true;
      return true;
    } catch (error) {
      logger.error(
        `Error initializing chat processor: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Identify the test type (control or mcp) from the chat data
   * @returns {string|undefined} Test type or undefined if not identifiable
   */
  identifyTestType(): string | undefined {
    if (
      !this.initialized ||
      !this.uiMessages?.length ||
      !this.apiHistory?.length
    ) {
      return undefined;
    }

    // Check UI messages first
    for (const message of this.uiMessages) {
      if (message.type === 'say' && message.say === 'text' && message.text) {
        if (
          message.text.includes(
            "'agent-instructions/control_instructions.md'",
          ) ||
          message.text.includes(
            '"agent-instructions/control_instructions.md"',
          ) ||
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
    for (const entry of this.apiHistory) {
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
   * Extract task segments from the chat data
   * @param {string} testType The identified test type
   * @returns {Promise<TaskSegment[]>} Array of processed task segments
   */
  extractTaskSegments(testType: string): Promise<TaskSegment[]> {
    if (!this.initialized || !this.uiMessages?.length) {
      logger.warn('Cannot extract task segments: chat data not initialized');
      return Promise.resolve([]);
    }

    const taskBoundaries: TaskBoundary[] = [];
    const taskNumbers = new Set<number>();

    // Find task boundaries in UI messages
    for (let i = 0; i < this.uiMessages.length; i++) {
      const message = this.uiMessages[i];

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
            directoryId: this.directoryId,
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

    // If no task boundaries found, return empty array
    if (taskBoundaries.length === 0) {
      logger.warn(`No task boundaries found in ${this.directoryId}`);
      return Promise.resolve([]);
    }

    // Get the last valid message timestamp
    let lastValidMessageTs: number | undefined;
    for (let i = this.uiMessages.length - 1; i >= 0; i--) {
      const message = this.uiMessages[i];
      // Skip resume_completed_task messages as they can appear much later
      if (
        message?.ts &&
        typeof message.ts === 'number' &&
        !(message.type === 'ask' && message.ask === 'resume_completed_task')
      ) {
        lastValidMessageTs = message.ts;
        break;
      }
    }

    // Set end boundaries with validation
    for (let i = 0; i < taskBoundaries.length; i++) {
      if (i < taskBoundaries.length - 1) {
        // For non-last tasks, end at the start of next task
        taskBoundaries[i].endIndex = taskBoundaries[i + 1].startIndex - 1;
        taskBoundaries[i].endTime = taskBoundaries[i + 1].startTime;
      } else {
        // For the last task, use the last valid message timestamp
        taskBoundaries[i].endIndex = this.uiMessages.length - 1;
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

    // Process task segments in parallel
    return Promise.all(
      taskBoundaries.map((boundary) => this.processTaskSegment(boundary)),
    );
  }

  /**
   * Process a single task segment
   * @param {TaskBoundary} boundary The task boundary information
   * @returns {Promise<TaskSegment>} The processed task segment
   */
  async processTaskSegment(boundary: TaskBoundary): Promise<TaskSegment> {
    if (!boundary || !this.initialized) {
      return {
        ...boundary,
        apiCalls: [],
        userMessages: [],
        apiCallCount: 0,
        messageCount: 0,
      } as TaskSegment;
    }

    // Collect user messages
    const messages = this.uiMessages.slice(
      boundary.startIndex,
      (boundary.endIndex ?? this.uiMessages.length - 1) + 1,
    );

    logger.info(
      `Processing ${messages.length} messages for task ${boundary.taskNumber}`,
    );

    const TASK_SEGMENT_TEXTS = [
      'read_file',
      'codebase_search',
      'grep_search',
      'file_search',
      '<function_calls>',
      '<fnr>',
    ];

    // Filter messages to include only relevant ones
    const relevantMessages = messages.filter((msg) => {
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

    // Create a combined boundary timestamp for filtering API entries
    const startBoundary = boundary.startTime - 60 * 1000; // 1 minute before task start
    const endBoundary = (boundary.endTime as number) + 5 * 60 * 1000; // 5 minutes after task end

    // Filter API entries that fall within this task's time boundaries
    const apiEntries = this.apiHistory.filter((entry) => {
      const timestamp = this.getTimestampFromApiEntry(entry);
      return (
        timestamp && timestamp >= startBoundary && timestamp <= endBoundary
      );
    });

    // Extract conversation history index from UI messages if available
    for (const msg of relevantMessages) {
      if (msg.type === 'say' && msg.text) {
        try {
          // First try to parse JSON to get index from structured data
          const jsonData = JSON.parse(msg.text);
          if (jsonData.conversationHistoryIndex !== undefined) {
            msg.conversationHistoryIndex = jsonData.conversationHistoryIndex;
          }
        } catch (e) {
          // If JSON parsing fails, try regex
          const indexMatch = msg.text.match(
            /conversationHistoryIndex["\s:]+(\d+)/i,
          );
          if (indexMatch?.[1]) {
            msg.conversationHistoryIndex = parseInt(indexMatch[1], 10);
          }
        }
      }
    }

    // Return the processed task segment
    return {
      ...boundary,
      apiCalls: apiEntries,
      userMessages: relevantMessages,
      taskNumber: boundary.taskNumber,
      apiCallCount: apiEntries.length,
      messageCount: relevantMessages.length,
    } as TaskSegment;
  }

  /**
   * Extract timestamp from an API entry
   * @param {ApiHistoryEntry} entry The API entry
   * @returns {number|undefined} Timestamp in milliseconds or undefined if not found
   */
  getTimestampFromApiEntry(entry: ApiHistoryEntry): number | undefined {
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
}

export default ChatProcessor;
