process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { neon, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;

require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

module.exports = sql;