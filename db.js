const mysql = require('mysql2');
require('dotenv').config();

// 🔹 SYSTEM DATABASE (Cloud - Railway)
const systemDB = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
}).promise();

// 🔹 PLAYGROUND DATABASE (Cloud - Railway)
const playgroundDB = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_PLAYGROUND_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: false,
  ssl: {
    rejectUnauthorized: false
  }
}).promise();

console.log('☁️ System DB Connected (Railway)');
console.log('☁️ Playground DB Connected (Railway)');

module.exports = {
  systemDB,
  playgroundDB
};