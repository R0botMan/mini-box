const fs = require('fs');
const path = require('path');
const os = require('os');

// Create minibox-debug.log in temp directory
const logFile = path.join(os.tmpdir(), 'minibox-debug.log');

// Ensure file exists
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, '=== MiniBox Debug Log ===\n');
}

function log(category, message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${category}] ${message}\n`;
  
  try {
    // Append to file
    fs.appendFileSync(logFile, logEntry);
    // Also log to console
    console.log(logEntry.trim());
  } catch (err) {
    console.error('Failed to write to log file:', err.message);
  }
}

function getLogFile() {
  return logFile;
}

function clearLog() {
  try {
    fs.writeFileSync(logFile, '=== MiniBox Debug Log (Cleared) ===\n');
  } catch (err) {
    console.error('Failed to clear log file:', err.message);
  }
}

module.exports = {
  log,
  getLogFile,
  clearLog
};
