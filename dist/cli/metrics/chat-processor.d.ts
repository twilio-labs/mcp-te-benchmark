import { TaskSegment } from "./types";
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
declare class ChatProcessor {
    private chatDir;
    private apiHistory;
    private uiMessages;
    private directoryId;
    private initialized;
    constructor(chatDir: string);
    /**
     * Process the chat data with centralized error handling
     * @returns {Promise<TaskSegment[]>} Task segments or empty array if processing fails
     */
    process(): Promise<TaskSegment[]>;
    /**
     * Initialize the chat processor by loading required files
     * @returns {Promise<boolean>} Success status
     */
    initialize(): Promise<boolean>;
    /**
     * Identify the test type (control or mcp) from the chat data
     * @returns {string|undefined} Test type or undefined if not identifiable
     */
    identifyTestType(): string | undefined;
    /**
     * Extract task segments from the chat data
     * @param {string} testType The identified test type
     * @returns {Promise<TaskSegment[]>} Array of processed task segments
     */
    extractTaskSegments(testType: string): Promise<TaskSegment[]>;
    /**
     * Process a single task segment
     * @param {TaskBoundary} boundary The task boundary information
     * @returns {Promise<TaskSegment>} The processed task segment
     */
    processTaskSegment(boundary: TaskBoundary): Promise<TaskSegment>;
    /**
     * Extract timestamp from an API entry
     * @param {ApiHistoryEntry} entry The API entry
     * @returns {number|undefined} Timestamp in milliseconds or undefined if not found
     */
    getTimestampFromApiEntry(entry: ApiHistoryEntry): number | undefined;
}
export default ChatProcessor;
