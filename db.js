const mysql = require('mysql2');
require('dotenv').config();

// 🔹 SYSTEM DATABASE (Local - XAMPP)
const systemDB = mysql.createPool({
  host: process.env.DB_HOST || "localhost",              
  user: process.env.DB_USER || "root",                  
  password: process.env.DB_PASSWORD || "",                  
  database: process.env.DB_NAME || "detective_query",    
  port: parseInt(process.env.DB_PORT || "3306", 10),                    
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();

// 🔹 PLAYGROUND DATABASE (Local - XAMPP)
const playgroundDB = mysql.createPool({
  host: process.env.DB_HOST || "localhost",                      
  user: process.env.DB_PLAYGROUND_USER || "root",                          
  password: process.env.DB_PLAYGROUND_PASSWORD || "",                          
  database: process.env.DB_PLAYGROUND_NAME || "detective_query_playground",
  port: parseInt(process.env.DB_PORT || "3306", 10),                            
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: false
}).promise();

console.log('🖥️ System DB Connected (XAMPP Environment Config)');
console.log('🖥️ Playground DB Connected (XAMPP Environment Config)');

module.exports = {
  systemDB,
  playgroundDB
};