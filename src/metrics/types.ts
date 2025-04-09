export const CONTROL_MARKER = 'control_instructions.md';
export const MCP_MARKER = 'mcp_instructions.md';

export type ApiHistoryEntry = {
  role: string;
  content: Array<{
    type: string;
    text?: string;
  }>;
};

export type UIMessage = {
  type: string;
  say?: string;
  ask?: string;
  from?: string;
  text?: string;
  ts?: number;
  conversationHistoryIndex?: number;
};

export type TaskSegment = {
  taskNumber: number;
  directoryId: string;
  startIndex: number;
  startTime: number;
  apiCalls: ApiHistoryEntry[];
  userMessages: UIMessage[];
  endIndex: number | null;
  endTime: number | null;
  testType: string;
  apiCallCount?: number;
  messageCount?: number;
};

export type TaskMetrics = {
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
};

export type ApiCallData = {
  timestamp: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
};

export type UserMessage = {
  content: string;
  timestamp: number;
};
