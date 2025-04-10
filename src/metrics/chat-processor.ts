import { promises as fs } from 'fs';
import path from 'path';

import { logger } from '../utils';
import {
  createTimestampBoundaries,
  extractConversationHistoryIndex,
  filterRelevantMessages,
  findTaskBoundaries,
  getLastValidMessageTimestamp,
  getTimestampFromApiEntry,
  identifyTestType,
  validateTaskBoundaries,
} from './metrics-utils';
import { ApiHistoryEntry, TaskSegment, UIMessage } from './types';

type Options = {
  chatDir: string;
  mcpMarker: string;
  controlMarker: string;
};

class ChatProcessor {
  private readonly chatDir: string;

  private apiHistory: ApiHistoryEntry[];

  private uiMessages: UIMessage[];

  private readonly directoryId: string;

  private initialized: boolean;

  private readonly mcpMarker: string;

  private readonly controlMarker: string;

  constructor(options: Options) {
    this.chatDir = options.chatDir;
    this.mcpMarker = options.mcpMarker;
    this.controlMarker = options.controlMarker;
    this.apiHistory = [];
    this.uiMessages = [];
    this.directoryId = path.basename(this.chatDir);
    this.initialized = false;
  }

  /**
   * Process the chat data with centralized error handling
   * @returns {Promise<TaskSegment[]>} Task segments or empty array if processing fails
   */
  async process(): Promise<TaskSegment[]> {
    try {
      const initialized = await this.initialize();
      if (!initialized) {
        logger.error(
          `Failed to initialize chat processor for ${this.directoryId}`,
        );
        return [];
      }

      const testType = this.getTestType();
      if (!testType) {
        logger.warn(
          `Could not identify test type for ${this.directoryId}, skipping processing`,
        );
        return [];
      }

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
  getTestType(): string | undefined {
    if (
      !this.initialized ||
      !this.uiMessages?.length ||
      !this.apiHistory?.length
    ) {
      return undefined;
    }

    return identifyTestType(
      this.uiMessages,
      this.apiHistory,
      this.mcpMarker,
      this.controlMarker,
    );
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

    const taskBoundaries = findTaskBoundaries(
      this.uiMessages,
      this.directoryId,
      testType,
    );

    if (taskBoundaries.length === 0) {
      logger.warn(`No task boundaries found in ${this.directoryId}`);
      return Promise.resolve([]);
    }

    const lastValidMessageTs = getLastValidMessageTimestamp(this.uiMessages);
    const validatedBoundaries = validateTaskBoundaries(
      taskBoundaries,
      lastValidMessageTs,
      this.uiMessages.length,
    );

    return Promise.all(
      validatedBoundaries.map((task) => this.processTaskSegment(task)),
    );
  }

  /**
   * Process a single task segment
   * @param {TaskSegment} task The task task information
   * @returns {Promise<TaskSegment>} The processed task segment
   */
  async processTaskSegment(task: TaskSegment): Promise<TaskSegment> {
    if (!task || !this.initialized) {
      return {
        ...task,
        apiCalls: [],
        userMessages: [],
        apiCallCount: 0,
        messageCount: 0,
      } as TaskSegment;
    }

    // Collect user messages
    const messages = this.uiMessages.slice(
      task.startIndex,
      (task.endIndex ?? this.uiMessages.length - 1) + 1,
    );

    logger.info(
      `Processing ${messages.length} messages for task ${task.taskNumber}`,
    );

    const relevantMessages = filterRelevantMessages(messages);
    const [startBoundary, endBoundary] = createTimestampBoundaries(
      task.startTime,
      task.endTime as number,
    );
    const apiEntries = this.apiHistory.filter((entry) => {
      const timestamp = getTimestampFromApiEntry(entry);
      return (
        timestamp && timestamp >= startBoundary && timestamp <= endBoundary
      );
    });

    for (const msg of relevantMessages) {
      const index = extractConversationHistoryIndex(msg);
      if (index !== undefined) {
        msg.conversationHistoryIndex = index;
      }
    }

    return {
      ...task,
      apiCalls: apiEntries,
      userMessages: relevantMessages,
      taskNumber: task.taskNumber,
      apiCallCount: apiEntries.length,
      messageCount: relevantMessages.length,
    };
  }
}

export default ChatProcessor;
