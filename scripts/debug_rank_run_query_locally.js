const express = require('express');
const { systemDB, playgroundDB } = require('../db');
const submissionRoutes = require('../routes/submissionRoutes');

async function main() {
  const req = {
    user: { user_id: 7, role_id: 1 },
    body: {
      room_id: 7,
      sql_query: "SELECT name, role FROM persons"
    }
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      console.log("RESPONSE status:", this.statusCode, "data:", JSON.stringify(data, null, 2));
      return this;
    }
  };

  // Find the /rank/run-query layer in submissionRoutes
  const layer = submissionRoutes.stack.find(
    s => s.route && s.route.path === '/rank/run-query' && s.route.methods.post
  );

  if (!layer) {
    console.error("Route /rank/run-query not found in submissionRoutes!");
    process.exit(1);
  }

  // Layer handlers: index 0 is authenticateToken (which we bypass), index 1 is the route handler
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  console.log("Calling route handler directly...");
  try {
    await handler(req, res);
  } catch (err) {
    console.error("UNCAUGHT HANDLER ERROR:", err);
  } finally {
    process.exit(0);
  }
}

main();
