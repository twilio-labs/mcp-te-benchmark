// Types and interfaces for metrics processing

export const CONTROL_MARKER = 'control_instructions.md';
export const MCP_MARKER = 'mcp_instructions.md';
export const TASK_START_MARKER = 'Complete Task';

export interface TaskSegment {
  taskNumber: number;
  startIndex: number;
  startTime: number;
  apiCalls: {
    role: 'assistant' | 'user';
    content: {
      type: 'text';
      text: string;
    }[];
  }[];
  userMessages: any[];
  endIndex: number | null;
  endTime: number | null;
  testType: string;
}

export interface TaskMetrics {
  taskId: number;
  mode: string;
  model: string;
  directoryId?: string;
  mcpServer?: string;
  mcpClient?: string;
  startTime: number;
  endTime: number;
  duration: number;
  apiCalls: number;
  interactions: number;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  cacheWrites: number;
  cacheReads: number;
  conversationHistoryIndex: number;
  cost: number;
  success: boolean;
  notes: string;
}

export interface ApiCallData {
  timestamp: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

export interface UserMessage {
  content: string;
  timestamp: number;
}
