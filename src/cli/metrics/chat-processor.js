const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const { CONTROL_MARKER, MCP_MARKER } = require('./types');

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

      // Set end boundaries
      for (let i = 0; i < taskBoundaries.length; i++) {
        if (i < taskBoundaries.length - 1) {
          taskBoundaries[i].endIndex = taskBoundaries[i + 1].startIndex - 1;
          taskBoundaries[i].endTime = taskBoundaries[i + 1].startTime;
        } else {
          taskBoundaries[i].endIndex = this.uiMessages.length - 1;
          taskBoundaries[i].endTime = this.uiMessages[this.uiMessages.length - 1].ts;
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
          if (msg.text.includes('read_file') || 
              msg.text.includes('codebase_search') || 
              msg.text.includes('grep_search') ||
              msg.text.includes('file_search') ||
              msg.text.includes('<function_calls>') ||
              msg.text.includes('<function_results>')) {
            return true;
          }
        }

        // Include user messages
        if (msg.type === 'say' && msg.say === 'text' && (!msg.from || msg.from === 'user')) {
          return true;
        }

        return false;
      });
      
      boundary.userMessages = relevantMessages;

      // Match API calls to task segment
      const apiCalls = this.apiHistory.filter(entry => {
        // First check timestamp
        const timestamp = this.getTimestampFromApiEntry(entry);
        if (!timestamp || 
            timestamp < boundary.startTime || 
            (boundary.endTime !== null && timestamp > boundary.endTime)) {
          return false;
        }

        // Include assistant messages with tool calls
        if (entry.role === 'assistant' && entry.content) {
          return entry.content.some(content => 
            content.type === 'text' && 
            content.text && (
              content.text.includes('<function_calls>') ||
              content.text.includes('<function_results>')
            )
          );
        }

        // Include user messages with queries
        if (entry.role === 'user' && entry.content) {
          return entry.content.some(content =>
            content.type === 'text' && 
            content.text && 
            content.text.includes('<user_query>')
          );
        }

        return false;
      });
      
      logger.info(`Found ${apiCalls.length} API calls for task ${boundary.taskNumber}`);
      apiCalls.forEach(call => {
        if (call.usage) {
          logger.info(`API Call with usage info: ${JSON.stringify(call.usage, null, 2)}`);
        }
      });
      
      boundary.apiCalls = apiCalls;

      return boundary;
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

module.exports = ChatProcessor;
