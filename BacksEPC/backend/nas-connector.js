const { exec } = require('child_process');
const path = require('path');

/**
 * Utility to manage NAS connections on Windows using 'net use'.
 */
const nasConnector = {
  /**
   * Helper to normalize UNC paths.
   * e.g., converts \\192.168.1.100\Backups\subdir to \\192.168.1.100\Backups
   */
  getSharePath(uncPath) {
    if (!uncPath || !uncPath.startsWith('\\\\')) return null;
    
    // Split UNC path by backslashes
    // \\192.168.1.100\Backups\Folder -> ['', '', '192.168.1.100', 'Backups', 'Folder']
    const parts = uncPath.split('\\').filter(p => p !== '');
    if (parts.length < 2) return null;
    
    // Return \\server\share
    return `\\\\${parts[0]}\\${parts[1]}`;
  },

  /**
   * Connect to the remote share using the net use command.
   */
  connect(uncPath, username, password) {
    return new Promise((resolve, reject) => {
      // If it's not a UNC path, it's a local folder, so no connection needed
      if (!uncPath || !uncPath.startsWith('\\\\')) {
        return resolve({ local: true, message: 'Local path, no connection needed.' });
      }

      const sharePath = this.getSharePath(uncPath);
      if (!sharePath) {
        return reject(new Error('Invalid UNC path structure. Must be like \\\\server\\share'));
      }

      // If username is empty, we try to access it without credentials
      if (!username) {
        return resolve({ local: false, message: 'No credentials provided, attempting public access.' });
      }

      // First, try to disconnect any existing connection to this share path to avoid conflicts
      this.disconnect(sharePath)
        .catch(() => {}) // Ignore errors if there was no connection
        .then(() => {
          // Now connect
          // Command: net use \\server\share password /user:username /persistent:no
          // Escaping double quotes inside command
          const escapedUser = username.replace(/"/g, '\\"');
          const escapedPass = password.replace(/"/g, '\\"');
          const command = `net use "${sharePath}" "${escapedPass}" /user:"${escapedUser}" /persistent:no`;

          exec(command, (error, stdout, stderr) => {
            if (error) {
              console.error(`Failed to connect to ${sharePath}:`, stderr || error.message);
              return reject(new Error(`net use failed: ${stderr || error.message}`));
            }
            resolve({ local: false, message: `Connected to ${sharePath} successfully.` });
          });
        });
    });
  },

  /**
   * Disconnect a UNC share.
   */
  disconnect(uncPath) {
    return new Promise((resolve, reject) => {
      if (!uncPath || !uncPath.startsWith('\\\\')) {
        return resolve();
      }

      const sharePath = this.getSharePath(uncPath);
      if (!sharePath) {
        return resolve();
      }

      const command = `net use "${sharePath}" /delete /yes`;
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // If the network connection could not be found, treat as success
          if (stderr.includes('3521') || error.code === 2) {
            return resolve();
          }
          return reject(new Error(`Failed to disconnect: ${stderr || error.message}`));
        }
        resolve();
      });
    });
  },

  /**
   * Test if a path is currently accessible (reads dir).
   */
  testAccess(targetPath) {
    return new Promise((resolve) => {
      const fs = require('fs');
      try {
        // Just try reading directory to test connection
        fs.readdir(targetPath, (err) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true });
          }
        });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  }
};

module.exports = nasConnector;
