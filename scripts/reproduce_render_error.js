const https = require('https');

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: 'detective-query-backend.onrender.com',
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log("1. Logging in to Render as cabahel@gmail.com...");
  const loginRes = await post('/api/login', { email: 'cabahel@gmail.com', password: 'password123' });
  console.log("Login status:", loginRes.status);
  console.log("Login body:", loginRes.body);

  if (!loginRes.body.accessToken) {
    console.error("No access token!");
    return;
  }

  const token = loginRes.body.accessToken;

  console.log("\n2. Calling /api/rank/run-query on Render...");
  const queryRes = await post('/api/rank/run-query', {
    room_id: 7,
    sql_query: 'SELECT name, role FROM persons'
  }, {
    'Authorization': `Bearer ${token}`
  });

  console.log("Query status:", queryRes.status);
  console.log("Query body:", queryRes.body);
}

run().catch(console.error);
