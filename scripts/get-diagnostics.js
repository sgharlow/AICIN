#!/usr/bin/env node
const https = require('https');

const url = 'https://content-matcher-239116109469.us-west1.run.app/diagnostics';

https.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.error('Failed to parse JSON:', e.message);
      console.error('Raw response:', data);
    }
  });

}).on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});
