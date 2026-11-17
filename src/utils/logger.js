const fs = require('node:fs');
const path = require('node:path');

const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const configured = levels[String(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? levels.info;
let stream;
if (process.env.LOG_FILE) { try { fs.mkdirSync(path.dirname(process.env.LOG_FILE), { recursive: true }); stream = fs.createWriteStream(process.env.LOG_FILE, { flags: 'a' }); } catch (_) { /* stdout remains available */ } }
function write(level, message, metadata) { if (levels[level] < configured) return; const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...(metadata ? { metadata } : {}) }); process.stdout.write(`${entry}\n`); if (stream) stream.write(`${entry}\n`); }
module.exports = { debug: (m, d) => write('debug', m, d), info: (m, d) => write('info', m, d), warn: (m, d) => write('warn', m, d), error: (m, d) => write('error', m, d) };
