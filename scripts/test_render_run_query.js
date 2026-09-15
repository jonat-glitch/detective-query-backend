const https = require('https');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ user_id: 7, role_id: 1 }, 'your_secret_key', { expiresIn: '1h' });

const postData = JSON.stringify({
  room_id: 7,
  sql_query: 'SELECT name, role FROM persons'
});

const req = https.request({
  hostname: 'detective-query-backend.onrender.com',
  port: 443,
  path: '/api/rank/run-query',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Authorization': `Bearer ${token}`
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Response body:', data);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
  process.exit(1);
});

req.write(postData);
req.end();
