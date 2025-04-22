import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import xss from 'xss';
import crypto from 'crypto';
import { DATA_DIR } from './config';

// Function to safely read file paths
export function getSafePath(basePath: string, fileName: string): string {
  // Normalize and resolve the path to prevent directory traversal attacks
  const normalizedPath = path.normalize(fileName).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(basePath, normalizedPath);
}

// Function to log errors securely
export async function logError(message: string): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    // Remove any potential injection in the log message
    const sanitizedMessage = xss(message);
    
    // Format the error message to be more readable
    const formattedMessage = message.includes('queryMx ENOTFOUND') || message.includes('queryTxt ENOTFOUND')
      ? message.replace(/queryMx ENOTFOUND|queryTxt ENOTFOUND/, 'DNS resolution failed for')
      : message;
    
    const logEntry = `[${timestamp}] ${sanitizedMessage}\n`;

    const logPath = getSafePath(DATA_DIR, 'error.log');
    await fsPromises.appendFile(logPath, logEntry);

    console.error(logEntry.trim());
  } catch (error) {
    // If we can't write to the log file, at least log to console
    console.error('Failed to write to error log:', error);
  }
}

// Generate a random request ID for tracking
export function generateRequestId(): string {
  return crypto.randomBytes(8).toString('hex');
}

// Ensure data directory exists
export async function ensureDataDirExists(): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { mode: 0o750 }); // Secure permissions
    console.log(`Created data directory: ${DATA_DIR}`);
  }
}

// Create default file with content if it doesn't exist
export async function createDefaultFile(fileName: string, defaultContent: string): Promise<void> {
  const filePath = getSafePath(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    await fsPromises.writeFile(filePath, defaultContent, { mode: 0o640 });
    console.log(`Created default file: ${filePath}`);
  }
}