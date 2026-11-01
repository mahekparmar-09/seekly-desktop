const { shell } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * Safely open a file or application using Windows default handler
 * @param {string} filePath
 */
async function openFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, error: 'Invalid file path' };
  }

  const normalized = path.normalize(filePath);
  if (!fs.existsSync(normalized)) {
    return { success: false, error: 'File does not exist or has been moved' };
  }

  try {
    const errorMsg = await shell.openPath(normalized);
    if (errorMsg) {
      return { success: false, error: errorMsg };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Reveal item in Windows Explorer
 * @param {string} filePath
 */
async function openFileLocation(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, error: 'Invalid file path' };
  }

  const normalized = path.normalize(filePath);
  if (!fs.existsSync(normalized)) {
    return { success: false, error: 'Target path does not exist or has been moved' };
  }

  try {
    shell.showItemInFolder(normalized);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  openFile,
  openFileLocation
};
