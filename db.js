const mysql = require('mysql2');
require('dotenv').config();

// Auto-enable SSL if connecting to a remote host (like TiDB Cloud) or if DB_SSL=true
const isRemoteHost = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1';
const sslConfig = (process.env.DB_SSL === 'true' || isRemoteHost) ? { rejectUnauthorized: false } : undefined;

// 🔹 SYSTEM DATABASE
const systemDB = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "detective_query",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  ssl: sslConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();

// 🔹 PLAYGROUND DATABASE
const playgroundDB = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_PLAYGROUND_USER || process.env.DB_USER || "root",
  password: process.env.DB_PLAYGROUND_PASSWORD || process.env.DB_PASSWORD || "",
  database: process.env.DB_PLAYGROUND_NAME || "detective_query_playground",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  ssl: sslConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: false
}).promise();

console.log(`🖥️ System DB Connected (${isRemoteHost ? 'Cloud / Remote' : 'Local / XAMPP'} Config)`);
console.log(`🖥️ Playground DB Connected (${isRemoteHost ? 'Cloud / Remote' : 'Local / XAMPP'} Config)`);

module.exports = {
  systemDB,
  playgroundDB
};