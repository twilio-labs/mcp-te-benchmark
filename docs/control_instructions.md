# Twilio API Testing Instructions (Control Group)

This document contains three Twilio implementation tasks to complete using web search and terminal capabilities.

## Environment Setup

- The Cursor coding agent has access to web search and terminal commands
- Use the .env file to access any twilio authentication credentials, like Twilio accound SID

## Metrics Recording

For accurate performance measurement, you must execute these commands:

1. When starting each task:
```bash
curl -X POST http://localhost:3000/test/start -H "Content-Type: application/json" -d '{"mode": "control", "taskNumber": TASK_NUMBER}'
```

2. When completing each task:
```bash
curl -X POST http://localhost:3000/test/complete -H "Content-Type: application/json" -d '{"testId": "TEST_ID", "success": true|false}'
```

Replace TASK_NUMBER with the current task number (1, 2, or 3) and TEST_ID with the ID received from the start command.

## Testing Protocol

For each task:
1. Complete the task as instructed
2. Validate the functionality
3. Document any issues encountered

## Tasks

### Task 1: Purchase a Canadian Phone Number

Goal: Search for and purchase an available Canadian phone number.

Requirements:
- Use area code 416 if available
- If 416 is not available, any Canadian number is acceptable
- Store the purchased number for use in Task 3

Success Criteria:
- A Canadian phone number is successfully purchased
- The phone number is stored and accessible

### Task 2: Create a Task Router Activity

Goal: Create a new Task Router activity named "Bathroom".

Requirements:
- Activity name must be "Bathroom"
- Activity should be available for use
- Store the Activity SID for use in Task 3

Success Criteria:
- Activity is created successfully
- Activity is properly named "Bathroom"
- Activity SID is stored and accessible

### Task 3: Create a Queue and Task Filter

Goal: Create a queue with a task filter that prevents routing tasks to workers in the "Bathroom" activity.

Requirements:
- Create a new queue with an appropriate name
- Configure a task filter that prevents routing to workers with "Bathroom" activity in the new queue
- Use the Activity Name or SID from Task 2

Success Criteria:
- Workflow is created successfully
- Task filter correctly prevents routing to workers in "Bathroom" activity
- Tasks are properly routed to available workers in other activities