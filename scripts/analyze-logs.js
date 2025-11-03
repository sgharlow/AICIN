const fs = require('fs');

// Read the log file
const logs = JSON.parse(fs.readFileSync('fresh_logs.json', 'utf8'));

console.log('=== Searching for agent orchestration logs ===\n');

// Find logs with key orchestration messages
const keywords = [
  'Starting multi-agent',
  'Using local processing',
  'Invoking profile analyzer',
  'Invoking path optimizer',
  'orchestration complete',
  'Profile and content analysis complete'
];

let found = 0;
logs.forEach(log => {
  if (log.textPayload) {
    const matched = keywords.find(k => log.textPayload.includes(k));
    if (matched) {
      console.log(`[${matched}] ${log.textPayload}`);
      found++;
    }
  }
});

console.log(`\n${found} orchestration messages found\n`);

// Now search for correlation ID from the 39s request
console.log('=== Searching for the 39-second request ===\n');

const targetCorrelationId = '1762147779201-xphow2';
const requestLogs = logs.filter(log =>
  log.textPayload && log.textPayload.includes(targetCorrelationId)
).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

console.log(`Found ${requestLogs.length} logs for request ${targetCorrelationId}:\n`);
requestLogs.forEach((log, i) => {
  console.log(`[${i+1}] ${log.textPayload}`);
});
