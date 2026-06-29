const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// File paths
const DATA_DIR = path.join(__dirname, 'data');
const RUNS_FILE = path.join(DATA_DIR, 'runs.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const MANIFESTS_DIR = path.join(DATA_DIR, 'manifests');

// Encryption key settings (for simple obfuscation/encryption of NAS credentials in config)
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.scryptSync('epc-backup-encryption-key', 'salt-epc', 32);
const ENCRYPTION_IV = Buffer.alloc(16, 5); // Simple fixed IV for consistency

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(MANIFESTS_DIR)) {
  fs.mkdirSync(MANIFESTS_DIR, { recursive: true });
}

// Initialize default config if not exists
const DEFAULT_CONFIG = {
  sources: [],
  destination: '',
  deviceIdentifier: os.hostname(),
  preferredNetworkIp: '',
  nasUsername: '',
  nasPassword: '', // Saved encrypted
  adminPassword: '', // Saved encrypted
  schedule: {
    enabled: true,
    type: 'interval_days', // 'days_of_week' or 'interval_days'
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    intervalDays: 1,
    time: '22:00' // 10 PM
  },
  retention: 5, // Number of incrementals before a full and delete old cycle
  lastRunTimestamp: null
};

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
}

if (!fs.existsSync(RUNS_FILE)) {
  fs.writeFileSync(RUNS_FILE, JSON.stringify([], null, 2), 'utf8');
}

// Encryption helpers
function encrypt(text) {
  if (!text) return '';
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, ENCRYPTION_IV);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  try {
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, ENCRYPTION_IV);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Error decrypting password:', err.message);
    return ''; // Return empty string if decrypt fails (e.g. key/iv changed)
  }
}

// Database helper functions
const db = {
  // Get entire configuration
  getConfig() {
    try {
      const content = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(content);
      // Decrypt NAS password for runtime use (but don't save back in plain text)
      if (config.nasPassword) {
        config.nasPasswordDecrypted = decrypt(config.nasPassword);
      } else {
        config.nasPasswordDecrypted = '';
      }
      if (config.adminPassword) {
        config.adminPasswordDecrypted = decrypt(config.adminPassword);
      } else {
        config.adminPasswordDecrypted = '';
      }
      return config;
    } catch (err) {
      console.error('Error reading config:', err);
      return DEFAULT_CONFIG;
    }
  },

  // Save configuration
  saveConfig(newConfig) {
    try {
      const currentConfig = this.getConfig();
      const configToSave = { ...currentConfig, ...newConfig };
      
      // If a plain text password was provided in configToSave, encrypt it
      if (configToSave.nasPasswordDecrypted !== undefined) {
        if (configToSave.nasPasswordDecrypted) {
          configToSave.nasPassword = encrypt(configToSave.nasPasswordDecrypted);
        } else {
          configToSave.nasPassword = '';
        }
      }
      
      if (configToSave.adminPasswordDecrypted !== undefined) {
        if (configToSave.adminPasswordDecrypted) {
          configToSave.adminPassword = encrypt(configToSave.adminPasswordDecrypted);
        } else {
          configToSave.adminPassword = '';
        }
      }
      
      // Remove runtime decrypted property before saving
      delete configToSave.nasPasswordDecrypted;
      delete configToSave.adminPasswordDecrypted;

      fs.writeFileSync(CONFIG_FILE, JSON.stringify(configToSave, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('Error saving config:', err);
      return false;
    }
  },

  // Get backup runs list
  getRuns() {
    try {
      const content = fs.readFileSync(RUNS_FILE, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error('Error reading runs:', err);
      return [];
    }
  },

  // Save runs list
  saveRuns(runs) {
    try {
      fs.writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('Error saving runs:', err);
      return false;
    }
  },

  // Add a run record
  addRun(run) {
    const runs = this.getRuns();
    runs.push(run);
    this.saveRuns(runs);
  },

  // Update an existing run
  updateRun(runId, updates) {
    const runs = this.getRuns();
    const index = runs.findIndex(r => r.id === runId);
    if (index !== -1) {
      runs[index] = { ...runs[index], ...updates };
      this.saveRuns(runs);
    }
  },

  // Save file manifest for a specific backup run
  saveManifest(runId, manifest) {
    try {
      const filePath = path.join(MANIFESTS_DIR, `manifest_${runId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error(`Error saving manifest for run ${runId}:`, err);
      return false;
    }
  },

  // Read file manifest for a specific backup run
  getManifest(runId) {
    try {
      const filePath = path.join(MANIFESTS_DIR, `manifest_${runId}.json`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      }
      return null;
    } catch (err) {
      console.error(`Error reading manifest for run ${runId}:`, err);
      return null;
    }
  },

  // Delete file manifest for a backup run
  deleteManifest(runId) {
    try {
      const filePath = path.join(MANIFESTS_DIR, `manifest_${runId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (err) {
      console.error(`Error deleting manifest for run ${runId}:`, err);
      return false;
    }
  }
};

module.exports = db;
