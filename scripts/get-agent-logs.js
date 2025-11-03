const fs = require('fs');

const correlationId = '1762149000615-embf3';
const logs = JSON.parse(fs.readFileSync('agent_logs.json'));

const targetLogs = logs
  .filter(l => l.textPayload && l.textPayload.includes(correlationId))
  .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

console.log(`=== AGENT LOGS FOR REQUEST ${correlationId} ===\n`);
console.log(`Total agent logs found: ${targetLogs.length}\n`);

targetLogs.forEach((l, i) => {
  const service = l.resource?.labels?.service_name || 'unknown';
  const timestamp = new Date(l.timestamp).toISOString().substring(11, 23);
  console.log(`[${timestamp}] [${service}] ${l.textPayload}`);
});
