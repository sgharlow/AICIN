const fs = require('fs');

const correlationId = '1762149000615-embf3';
const logs = JSON.parse(fs.readFileSync('all_orchestrator_logs.json'));

const targetLogs = logs
  .filter(l => l.textPayload && l.textPayload.includes(correlationId))
  .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

console.log(`=== ALL LOGS FOR REQUEST ${correlationId} ===\n`);
console.log(`Total logs found: ${targetLogs.length}\n`);

targetLogs.forEach((l, i) => {
  console.log(`[${i + 1}] ${l.textPayload}`);
});
