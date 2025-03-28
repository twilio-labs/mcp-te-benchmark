# Twilio API Testing Instructions (MCP Group)

This document contains three Twilio implementation tasks to complete using the Twilio Model Context Protocol (MCP) functionality.

## Environment Setup

- The Cursor coding agent has access to Twilio MCP functions
- Use the .env file to access any twilio authentication credentials, like Twilio accound SID

## Testing Protocol

For each task:
1. Complete the task as instructed
2. Validate the functionality
3. Document any issues encountered

## Tasks

### Task 1: Purchase a Canadian Phone Number

Goal: Search for and purchase an available Canadian phone number using MCP functions.

Requirements:
- Use area code 416 if available
- If 416 is not available, any Canadian number is acceptable
- Store the purchased number for use in Task 3
- Name it "Test {{timestamp}}"
- Use appropriate MCP functions for number search and purchase

Success Criteria:
- A Canadian phone number is successfully purchased
- The phone number is stored and accessible

### Task 2: Create a Task Router Activity

Goal: Create a new Task Router activity named "Bathroom" using MCP functions.

Requirements:
- Activity name must be "Bathroom"
- Activity should be available for use
- Store the Activity SID for use in Task 3
- Use appropriate MCP functions for activity creation

Success Criteria:
- Activity is created successfully
- Activity is properly named "Bathroom"
- Activity SID is stored and accessible

### Task 3: Create a Queue and Task Filter

Goal: Create a queue with a task filter that prevents routing tasks to workers in the "Bathroom" activity using MCP functions.

Requirements:
- Create a new queue with an appropriate name
- Configure a task filter that prevents routing to workers with "Bathroom" activity in the new queue
- Use the Activity Name or SID from Task 2
- Use appropriate MCP functions for workflow and filter creation

Success Criteria:
- Workflow is created successfully
- Task filter correctly prevents routing to workers in "Bathroom" activity
- Tasks are properly routed to available workers in other activities