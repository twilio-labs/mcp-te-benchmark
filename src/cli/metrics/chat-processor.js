import { promises as fs } from 'fs';
import path from 'path';
import logger from '../../utils/logger';
import { CONTROL_MARKER, MCP_MARKER } from './types';

class ChatProcessor {
  constructor(chatDir) {
    this.chatDir = chatDir;
    this.apiHistory = null;
    this.uiMessages = null;
    this.directoryId = path.basename(chatDir);
  }

  async initialize() {
    try {
      const [apiHistoryContent, uiMessagesContent] = await Promise.all([
        fs.readFile(path.join(this.chatDir, 'api_conversation_history.json'), 'utf8'),
        fs.readFile(path.join(this.chatDir, 'ui_messages.json'), 'utf8')
      ]);

      this.apiHistory = JSON.parse(apiHistoryContent);
      this.uiMessages = JSON.parse(uiMessagesContent);
      return true;
    } catch (error) {
      logger.error(`Error initializing chat processor: ${error.message}`);
      return false;
    }
  }

  identifyTestType() {
    try {
      // Check UI messages first
      for (const message of this.uiMessages) {
        if (message.type === 'say' && message.say === 'text' && message.text) {
          if (message.text.includes("'agent-instructions/control_instructions.md'") || 
              message.text.includes('"agent-instructions/control_instructions.md"') ||
              message.text.includes(CONTROL_MARKER)) {
            return 'control';
          }
          
          if (message.text.includes("'agent-instructions/mcp_instructions.md'") || 
              message.text.includes('"agent-instructions/mcp_instructions.md"') ||
              message.text.includes(MCP_MARKER)) {
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
        if (entry.role === 'user' && entry.content && Array.isArray(entry.content)) {
          const content = entry.content.map(c => c.text).join(' ');

          if (content.includes(CONTROL_MARKER) || 
              content.includes("'agent-instructions/control_instructions.md'") || 
              content.includes('"agent-instructions/control_instructions.md"')) {
            return 'control';
          }

          if (content.includes(MCP_MARKER) || 
              content.includes("'agent-instructions/mcp_instructions.md'") || 
              content.includes('"agent-instructions/mcp_instructions.md"')) {
            return 'mcp';
          }
        }
      }

      return null;
    } catch (error) {
      logger.error(`Error identifying test type: ${error.message}`);
      return null;
    }
  }

  extractTaskSegments(testType) {
    try {
      const taskBoundaries = [];
      const taskNumbers = new Set();

      // Find task boundaries in UI messages
      for (let i = 0; i < this.uiMessages.length; i++) {
        const message = this.uiMessages[i];

        if (message.type === 'say' && message.say === 'text' && message.text) {
          let taskNumber = null;
          let messageTestType = testType;

          // Only look for task starts in specific instruction formats
          const taskStartMatch = message.text.match(/Complete Task (\d+) using the (?:commands|tools|functions)/i);
          if (taskStartMatch && taskStartMatch[1]) {
            taskNumber = parseInt(taskStartMatch[1], 10);
            
            // Verify this is actually a task instruction by checking for instruction file references
            if (message.text.includes('control_instructions.md')) {
              messageTestType = 'control';
            } else if (message.text.includes('mcp_instructions.md')) {
              messageTestType = 'mcp';
            } else {
              // Not a real task instruction
              taskNumber = null;
            }
          }

          if (taskNumber !== null && !taskNumbers.has(taskNumber)) {
            taskNumbers.add(taskNumber);
            
            taskBoundaries.push({
              taskNumber,
              directoryId: this.directoryId,
              startIndex: i,
              startTime: message.ts,
              apiCalls: [],
              userMessages: [],
              endIndex: null,
              endTime: null,
              testType: messageTestType
            });
          }
        }
      }

      // Get the last valid message timestamp
      let lastValidMessageTs = null;
      for (let i = this.uiMessages.length - 1; i >= 0; i--) {
        const message = this.uiMessages[i];
        // Skip resume_completed_task messages as they can appear much later
        if (message && message.ts && typeof message.ts === 'number' && 
            !(message.type === 'ask' && message.ask === 'resume_completed_task')) {
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
          taskBoundaries[i].endTime = lastValidMessageTs;
        }

        // Validate endTime is after startTime and within reasonable bounds
        if (!taskBoundaries[i].endTime || 
            taskBoundaries[i].endTime < taskBoundaries[i].startTime ||
            taskBoundaries[i].endTime > lastValidMessageTs) {
          logger.warn(`Invalid endTime detected for task ${taskBoundaries[i].taskNumber}. Using last valid message timestamp.`);
          taskBoundaries[i].endTime = lastValidMessageTs;
        }
      }

      // Process task segments in parallel
      return Promise.all(taskBoundaries.map(boundary => this.processTaskSegment(boundary)));
    } catch (error) {
      logger.error(`Error extracting task segments: ${error.message}`);
      return [];
    }
  }

  async processTaskSegment(boundary) {
    try {
      // Collect user messages
      const messages = this.uiMessages.slice(boundary.startIndex, boundary.endIndex + 1);
      logger.info(`Processing ${messages.length} messages for task ${boundary.taskNumber}`);
      
      const TASK_SEGMENT_TEXTS = [
        'read_file',
        'codebase_search',
        'grep_search',
        'file_search',
        '<function_calls>',
        '<fnr>'
      ];

      // Filter messages to include only relevant ones
      const relevantMessages = messages.filter(msg => {
        // Include API requests and MCP server requests
        if (msg.type === 'say' && (
          msg.say === 'api_req_started' ||
          msg.say === 'mcp_server_request_started'
        )) {
          return true;
        }

        // Include tool usage messages
        if (msg.type === 'say' && msg.say === 'text' && msg.text) {
          return TASK_SEGMENT_TEXTS.some(text => msg.text.includes(text));
        }

        // Include user messages
        if (msg.type === 'say' && msg.say === 'text' && (!msg.from || msg.from === 'user')) {
          return true;
        }

        // Include all other 'say' messages for completeness
        if (msg.type === 'say') {
          return true;
        }

        return false;
      });

      // Find API calls for this task segment
      let apiEntries = [];
      
      // Create a combined boundary timestamp for filtering API entries
      const startBoundary = boundary.startTime - (60 * 1000); // 1 minute before task start to account for any slight clock difference
      const endBoundary = boundary.endTime + (5 * 60 * 1000); // 5 minutes after task end to account for trailing API responses
      
      // Filter API entries that fall within this task's time boundaries
      apiEntries = this.apiHistory.filter(entry => {
        const timestamp = this.getTimestampFromApiEntry(entry);
        
        // Include entries with timestamps within the segment bounds
        if (timestamp && timestamp >= startBoundary && timestamp <= endBoundary) {
          return true;
        }
        
        return false;
      });

      // Extract conversation history index from UI messages if available
      for (let i = 0; i < relevantMessages.length; i++) {
        const msg = relevantMessages[i];
        
        // Try to extract conversation history index if present
        if (msg.type === 'say' && msg.text) {
          try {
            // First try to parse JSON to get index from structured data
            const jsonData = JSON.parse(msg.text);
            if (jsonData.conversationHistoryIndex !== undefined) {
              msg.conversationHistoryIndex = jsonData.conversationHistoryIndex;
            }
          } catch (e) {
            // If JSON parsing fails, try regex
            const indexMatch = msg.text.match(/conversationHistoryIndex["\s:]+(\d+)/i);
            if (indexMatch && indexMatch[1]) {
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
        messageCount: relevantMessages.length
      };
    } catch (error) {
      logger.error(`Error processing task segment: ${error.message}`);
      return boundary;
    }
  }

  getTimestampFromApiEntry(entry) {
    if (entry.content && Array.isArray(entry.content)) {
      for (const content of entry.content) {
        if (content.type === 'text' && content.text &&
            content.text.includes('environment_details') &&
            content.text.includes('Current Time')) {
          const match = content.text.match(/Current Time\s+([^<]+)/);
          if (match && match[1]) {
            const date = new Date(match[1].trim());
            if (!isNaN(date.getTime())) {
              return date.getTime();
            }
          }
        }
      }
    }
    return null;
  }
}

export default ChatProcessor;
