const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const backupEngine = require('./backup-engine');
const scheduler = require('./scheduler');
const nasConnector = require('./nas-connector');
const os = require('os');

// Convert path to Windows long path format (supports up to 32,767 characters)
function toLongPath(p) {
  if (!p) return p;
  const normalized = path.resolve(p);
  if (normalized.startsWith('\\\\?\\')) return normalized;
  if (normalized.startsWith('\\\\')) {
    return '\\\\?\\UNC\\' + normalized.substring(2);
  }
  return '\\\\?\\' + normalized;
}

// Auto-register local IP address and port to shared NAS list
async function registerSelfToSharedNetworkList() {
  const config = db.getConfig();
  if (!config.destination) return;

  let localIp = '';
  const interfaces = os.networkInterfaces();

  if (config.preferredNetworkIp) {
    // Check if the preferred IP is currently active on any network card
    for (const name in interfaces) {
      for (const net of interfaces[name]) {
        if (net.family === 'IPv4' && net.address === config.preferredNetworkIp) {
          localIp = config.preferredNetworkIp;
          break;
        }
      }
      if (localIp) break;
    }
  }

  // Fallback to auto-detect if preferred IP is not configured or not active
  if (!localIp) {
    for (const name in interfaces) {
      for (const net of interfaces[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          localIp = net.address;
          break;
        }
      }
      if (localIp) break;
    }
  }

  if (!localIp) {
    localIp = '127.0.0.1';
  }
  
  const port = process.env.PORT || 8282;
  const selfAddress = `${localIp}:${port}`;

  if (config.destination.startsWith('\\\\')) {
    try {
      await nasConnector.connect(config.destination, config.nasUsername, config.nasPasswordDecrypted);
    } catch (e) {
      console.error('[Auto-Register] Failed to connect to NAS:', e.message);
      return;
    }
  }

  const sharedFilePath = path.join(config.destination, 'network_clients.json');
  const longPath = toLongPath(sharedFilePath);

  try {
    let clients = [];
    if (fs.existsSync(longPath)) {
      const content = fs.readFileSync(longPath, 'utf8');
      try {
        clients = JSON.parse(content);
      } catch (e) {}
    }

    if (!Array.isArray(clients)) {
      clients = [];
    }

    if (!clients.includes(selfAddress)) {
      clients.push(selfAddress);
      fs.writeFileSync(longPath, JSON.stringify(clients, null, 2), 'utf8');
      console.log(`[Auto-Register] Registered self address ${selfAddress} in shared list.`);
    }
  } catch (err) {
    console.error('[Auto-Register] Failed to write shared clients file:', err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 8282;

app.use(express.json());

// Serve static frontend build files (if compiled)
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
}

// Helper to reconstruct the original local path from relative path in manifest
function getOriginalPath(relPath, config) {
  // relPath looks like "0_Data/documents/report.pdf"
  const firstSlashIdx = relPath.indexOf('/');
  if (firstSlashIdx === -1) return null;

  const prefix = relPath.substring(0, firstSlashIdx); // "0_Data"
  const remaining = relPath.substring(firstSlashIdx + 1); // "documents/report.pdf"

  const underscoreIdx = prefix.indexOf('_');
  if (underscoreIdx === -1) return null;

  const index = parseInt(prefix.substring(0, underscoreIdx), 10);
  if (isNaN(index) || index < 0 || !config.sources || index >= config.sources.length) {
    return null;
  }

  const sourceDir = config.sources[index];
  return path.join(sourceDir, remaining);
}

// --- API ROUTES ---

// 1. Get current status & statistics
app.get('/api/status', (req, res) => {
  const currentJob = backupEngine.getStatus();
  const config = db.getConfig();
  const runs = db.getRuns().filter(r => r.status === 'success');
  const lastRun = runs.length > 0 ? runs[runs.length - 1] : null;
  
  let totalSpaceUsed = 0;
  // Calculate approximate space used on NAS from all successful runs
  // Note: Since incremental backups only copy changed files, the physical size is the sum of filesCopied
  runs.forEach(r => {
    totalSpaceUsed += (r.bytesCopied || 0);
  });

  res.json({
    currentJob,
    deviceIdentifier: config.deviceIdentifier || os.hostname(),
    lastRunTimestamp: config.lastRunTimestamp,
    lastRunType: lastRun ? lastRun.type : null,
    lastRunId: lastRun ? lastRun.id : null,
    lastRunHasVssWarning: lastRun ? !!(lastRun.warnings && lastRun.warnings.length > 0) : false,
    scheduleEnabled: config.schedule?.enabled !== false,
    totalSuccessfulBackups: runs.length,
    totalSpaceUsed,
    hasConfiguredSources: config.sources.length > 0,
    hasConfiguredDestination: !!config.destination
  });
});

// 2. Get configuration (password hidden)
app.get('/api/config', (req, res) => {
  const config = db.getConfig();
  res.json({
    sources: config.sources,
    destination: config.destination,
    deviceIdentifier: config.deviceIdentifier || os.hostname(),
    preferredNetworkIp: config.preferredNetworkIp || '',
    nasUsername: config.nasUsername,
    hasPassword: !!config.nasPassword,
    schedule: config.schedule,
    retention: config.retention
  });
});

// 3. Save configuration
app.post('/api/config', (req, res) => {
  const { sources, destination, deviceIdentifier, preferredNetworkIp, nasUsername, nasPasswordDecrypted, schedule, retention } = req.body;

  const updates = {};
  if (sources !== undefined) updates.sources = sources;
  if (destination !== undefined) updates.destination = destination;
  if (deviceIdentifier !== undefined) updates.deviceIdentifier = deviceIdentifier;
  if (preferredNetworkIp !== undefined) updates.preferredNetworkIp = preferredNetworkIp;
  if (nasUsername !== undefined) updates.nasUsername = nasUsername;
  if (schedule !== undefined) updates.schedule = schedule;
  if (retention !== undefined) updates.retention = parseInt(retention, 10) || 5;
  
  // Only update password if a new one is provided
  if (nasPasswordDecrypted !== undefined && nasPasswordDecrypted !== '') {
    updates.nasPasswordDecrypted = nasPasswordDecrypted;
  }

  const success = db.saveConfig(updates);
  if (success) {
    registerSelfToSharedNetworkList().catch(e => console.error('[Auto-Register]', e.message));
    res.json({ success: true, message: 'Configuration saved successfully.' });
  } else {
    res.status(500).json({ success: false, message: 'Failed to save configuration.' });
  }
});

// 3c. Toggle scheduler remotely or locally
app.post('/api/config/schedule/toggle', (req, res) => {
  const { enabled } = req.body;
  if (enabled === undefined) {
    return res.status(400).json({ success: false, message: 'enabled es requerido.' });
  }
  const config = db.getConfig();
  const schedule = { ...config.schedule, enabled: !!enabled };
  const success = db.saveConfig({ schedule });
  if (success) {
    res.json({ success: true, message: `Programación automática ${enabled ? 'activada' : 'desactivada'} correctamente.` });
  } else {
    res.status(500).json({ success: false, message: 'No se pudo actualizar la configuración.' });
  }
});

// 3b. Test NAS/Destination connection
app.post('/api/config/test-connection', async (req, res) => {
  const { destination, nasUsername, nasPasswordDecrypted } = req.body;

  if (!destination) {
    return res.status(400).json({ success: false, message: 'Ruta de destino requerida.' });
  }

  // Determine what password to use
  let passwordToUse = nasPasswordDecrypted;
  if (passwordToUse === undefined || passwordToUse === '') {
    // Read from saved config
    const currentConfig = db.getConfig();
    // Only use saved password if the username matches the saved username
    if (nasUsername === currentConfig.nasUsername) {
      passwordToUse = currentConfig.nasPasswordDecrypted;
    }
  }

  try {
    if (destination.startsWith('\\\\')) {
      if (nasUsername) {
        await nasConnector.connect(destination, nasUsername, passwordToUse);
      }
    }

    const accessTest = await nasConnector.testAccess(destination);
    if (accessTest.success) {
      registerSelfToSharedNetworkList().catch(e => console.error('[Auto-Register]', e.message));
      res.json({ success: true, message: '¡Conexión exitosa! La carpeta de destino es accesible.' });
    } else {
      res.json({ success: false, message: `No se pudo acceder a la carpeta: ${accessTest.error}` });
    }
  } catch (err) {
    res.json({ success: false, message: `Fallo de conexión: ${err.message}` });
  }
});

// 4. Trigger manual backup
app.post('/api/backup', async (req, res) => {
  const { type } = req.body; // 'full' or 'incremental'
  
  if (type && type !== 'full' && type !== 'incremental') {
    return res.status(400).json({ success: false, message: 'Invalid backup type. Must be full or incremental.' });
  }

  try {
    // Run backup in background
    backupEngine.runBackup(type).catch(err => {
      console.error('Background backup error:', err.message);
    });
    
    res.json({ success: true, message: `Backup of type ${type || 'Auto'} started in the background.` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 4b. Cancel running backup
app.post('/api/backup/cancel', (req, res) => {
  const success = backupEngine.cancelBackup();
  if (success) {
    res.json({ success: true, message: 'Se ha solicitado la cancelación del backup.' });
  } else {
    res.status(400).json({ success: false, message: 'No hay ninguna copia de seguridad activa para cancelar.' });
  }
});

// 5. Get backup run history
app.get('/api/history', (req, res) => {
  const runs = db.getRuns().slice().reverse(); // Show newest first
  res.json(runs);
});

// 6. Browse files for a specific backup run
app.get('/api/browse', (req, res) => {
  const { runId } = req.query;
  if (!runId) {
    return res.status(400).json({ success: false, message: 'runId is required.' });
  }

  const manifest = db.getManifest(runId);
  if (!manifest) {
    return res.status(404).json({ success: false, message: 'Backup run manifest not found.' });
  }

  // Convert flat manifest map to a hierarchical structure if requested, 
  // or just send the flat object. The flat object is actually very easy to filter on the frontend.
  // We'll send the flat list of files.
  res.json({
    runId,
    files: Object.keys(manifest).map(relPath => ({
      relPath,
      size: manifest[relPath].size,
      mtime: manifest[relPath].mtime,
      backupFolder: manifest[relPath].backupFolder
    }))
  });
});

// 7. Get history/versions of a specific file
app.get('/api/file-versions', (req, res) => {
  const { filePath } = req.query; // e.g. "0_Data/documents/report.pdf"
  if (!filePath) {
    return res.status(400).json({ success: false, message: 'filePath is required.' });
  }

  const runs = db.getRuns().filter(r => r.status === 'success');
  const versions = [];

  runs.forEach(run => {
    const manifest = db.getManifest(run.id);
    if (manifest && manifest[filePath]) {
      const fileMeta = manifest[filePath];
      // Only add to versions if it doesn't already exist or has different mtime/size
      // (sometimes in incremental runs a file points to the old backup folder, which is the same version)
      const isDuplicate = versions.some(v => v.mtime === fileMeta.mtime && v.size === fileMeta.size);
      if (!isDuplicate) {
        versions.push({
          runId: run.id,
          runTimestamp: run.timestamp,
          runFolderName: run.folderName,
          backupFolder: fileMeta.backupFolder,
          size: fileMeta.size,
          mtime: fileMeta.mtime
        });
      }
    }
  });

  // Sort newest first
  versions.sort((a, b) => new Date(b.runTimestamp) - new Date(a.runTimestamp));
  res.json(versions);
});

// 8. Restore files
app.post('/api/restore', async (req, res) => {
  const { runId, items, restoreAll, restoreToOriginal, customPath } = req.body;
  // items: array of objects { relPath: "...", isDirectory: boolean }
  
  if (!runId) {
    return res.status(400).json({ success: false, message: 'runId is required.' });
  }
  if (!restoreAll && (!items || !Array.isArray(items) || items.length === 0)) {
    return res.status(400).json({ success: false, message: 'items array or restoreAll is required.' });
  }

  const config = db.getConfig();
  const manifest = db.getManifest(runId);
  if (!manifest) {
    return res.status(404).json({ success: false, message: 'Manifest for this backup run not found.' });
  }

  try {
    // 1. Authenticate with NAS if UNC
    if (config.destination.startsWith('\\\\')) {
      await nasConnector.connect(config.destination, config.nasUsername, config.nasPasswordDecrypted);
    }

    // Check custom path validity if not restoring to original
    if (!restoreToOriginal && (!customPath || !fs.existsSync(toLongPath(customPath)))) {
      return res.status(400).json({ success: false, message: 'Valid custom restoration directory path is required.' });
    }

    const restoredItems = [];
    let itemsToRestore = items;

    if (restoreAll) {
      // Reconstruct the full list of files to restore from manifest keys
      itemsToRestore = Object.keys(manifest).map(f => ({
        relPath: f,
        isDirectory: false
      }));
    }

    for (const item of itemsToRestore) {
      if (item.isDirectory) {
        // Find all files in the manifest that are inside this directory
        const dirPrefix = item.relPath.endsWith('/') ? item.relPath : item.relPath + '/';
        const filesInDir = Object.keys(manifest).filter(f => f.startsWith(dirPrefix));

        for (const fileRelPath of filesInDir) {
          const fileMeta = manifest[fileRelPath];
          const physicalPath = path.join(config.destination, fileMeta.backupFolder, fileRelPath);
          
          let targetPath;
          if (restoreToOriginal) {
            targetPath = getOriginalPath(fileRelPath, config);
          } else {
            // Restore to custom path: CustomPath\0_Data\dir\file.txt
            targetPath = path.join(customPath, fileRelPath);
          }

          if (targetPath) {
            // Ensure target directory exists
            fs.mkdirSync(toLongPath(path.dirname(targetPath)), { recursive: true });
            fs.copyFileSync(toLongPath(physicalPath), toLongPath(targetPath));
            restoredItems.push(fileRelPath);
          }
        }
      } else {
        // Single file
        const fileRelPath = item.relPath;
        const fileMeta = manifest[fileRelPath];
        if (!fileMeta) continue;

        const physicalPath = path.join(config.destination, fileMeta.backupFolder, fileRelPath);
        
        let targetPath;
        if (restoreToOriginal) {
          targetPath = getOriginalPath(fileRelPath, config);
        } else {
          targetPath = path.join(customPath, fileRelPath);
        }

        if (targetPath) {
          fs.mkdirSync(toLongPath(path.dirname(targetPath)), { recursive: true });
          fs.copyFileSync(toLongPath(physicalPath), toLongPath(targetPath));
          restoredItems.push(fileRelPath);
        }
      }
    }

    res.json({
      success: true,
      message: `Successfully restored ${restoredItems.length} files.`,
      restoredFiles: restoredItems
    });

  } catch (err) {
    console.error('Restoration failed:', err);
    res.status(500).json({ success: false, message: `Restoration failed: ${err.message}` });
  }
});

const NETWORK_MACHINES_FILE = path.join(__dirname, 'data', 'network-machines.json');

function getNetworkMachines() {
  try {
    if (!fs.existsSync(NETWORK_MACHINES_FILE)) {
      fs.writeFileSync(NETWORK_MACHINES_FILE, JSON.stringify([]), 'utf8');
    }
    const content = fs.readFileSync(NETWORK_MACHINES_FILE, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('Error reading network machines:', e);
    return [];
  }
}

function saveNetworkMachines(machines) {
  try {
    fs.writeFileSync(NETWORK_MACHINES_FILE, JSON.stringify(machines, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving network machines:', e);
    return false;
  }
}

// 9. Consolidate and zip backup run
app.post('/api/backup/consolidate', async (req, res) => {
  const { runId } = req.body;
  if (!runId) {
    return res.status(400).json({ success: false, message: 'runId es requerido.' });
  }

  try {
    backupEngine.consolidateBackup(runId)
      .then(result => {
        console.log(`[Consolidation API] Successfully consolidated run ${runId}: ${result.zipName}`);
      })
      .catch(err => {
        console.error(`[Consolidation API] Background consolidation failed for run ${runId}:`, err.message);
      });

    res.json({ success: true, message: 'La consolidación y compresión ha iniciado en segundo plano. El archivo ZIP se creará en la carpeta de este equipo en el NAS.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9b. Fallback consolidation (Admin console PC A executes consolidation of offline PC B)
app.post('/api/network/consolidate-fallback', async (req, res) => {
  let { runId, deviceIdentifier, folderName } = req.body;
  if (!runId || !deviceIdentifier) {
    return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos: runId, deviceIdentifier.' });
  }

  const config = db.getConfig();

  try {
    // If runId is 'latest', look it up in the NAS runs.json file!
    if (runId === 'latest') {
      const nasRunsPath = path.join(config.destination, deviceIdentifier, 'runs.json');
      const longRunsPath = toLongPath(nasRunsPath);
      if (!fs.existsSync(longRunsPath)) {
        return res.status(404).json({ success: false, message: `No se encontró el registro de copias de seguridad en el NAS para '${deviceIdentifier}'. La máquina debe haber completado al menos un backup exitoso versión 1.1.` });
      }
      const runs = JSON.parse(fs.readFileSync(longRunsPath, 'utf8'));
      const successRuns = runs.filter(r => r.status === 'success');
      if (successRuns.length === 0) {
        return res.status(404).json({ success: false, message: `No se encontró ningún backup exitoso para '${deviceIdentifier}' en el NAS.` });
      }
      const lastRun = successRuns[successRuns.length - 1];
      runId = lastRun.id;
      folderName = lastRun.folderName || lastRun.id;
    }

    backupEngine.consolidateBackup(runId, deviceIdentifier, folderName)
      .then(result => {
        console.log(`[Consolidation Fallback] Successfully consolidated remote run ${runId} for ${deviceIdentifier}: ${result.zipName}`);
      })
      .catch(err => {
        console.error(`[Consolidation Fallback] Background fallback consolidation failed for remote run ${runId}:`, err.message);
      });

    res.json({ success: true, message: `La consolidación alternativa ha iniciado en segundo plano. Esta computadora (Administradora) está reconstruyendo y comprimiendo el backup de '${deviceIdentifier}' directamente en el NAS.` });
  } catch (err) {
    res.status(500).json({ success: false, message: `No se pudo iniciar la consolidación alternativa: ${err.message}` });
  }
});

// --- ADMIN AUTHENTICATION MIDDLEWARE ---
function checkAdminAuth(req, res, next) {
  const config = db.getConfig();
  if (!config.adminPassword) {
    return next(); // If no password is set yet, allow access to configure it
  }
  const clientPassword = req.headers['x-admin-password'];
  if (clientPassword === config.adminPasswordDecrypted) {
    return next();
  }
  res.status(401).json({ success: false, message: 'Contraseña de administrador inválida.' });
}

// 13. Check if administrator password is set
app.get('/api/network/auth/check', (req, res) => {
  const config = db.getConfig();
  res.json({ hasPassword: !!config.adminPassword });
});

// 12b. Get list of active local network interfaces (IPs)
app.get('/api/network/interfaces', (req, res) => {
  const list = [];
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        list.push({
          interface: name,
          ip: net.address
        });
      }
    }
  }
  res.json(list);
});

// 14. Set administrator password
app.post('/api/network/auth/set', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Se requiere una contraseña.' });
  }
  const success = db.saveConfig({ adminPasswordDecrypted: password });
  if (success) {
    res.json({ success: true, message: 'Contraseña de administrador establecida.' });
  } else {
    res.status(500).json({ success: false, message: 'No se pudo guardar la contraseña.' });
  }
});

// 15. Validate administrator password (login)
app.post('/api/network/auth/login', (req, res) => {
  const { password } = req.body;
  const config = db.getConfig();
  if (password === config.adminPasswordDecrypted) {
    res.json({ success: true, message: 'Autenticación exitosa.' });
  } else {
    res.status(401).json({ success: false, message: 'Contraseña incorrecta.' });
  }
});

// 10. Get list of monitored network machines (merges local manual list and shared NAS auto list)
app.get('/api/network/machines', checkAdminAuth, async (req, res) => {
  const localMachines = getNetworkMachines();
  const config = db.getConfig();
  let sharedMachines = [];

  if (config.destination) {
    if (config.destination.startsWith('\\\\')) {
      try {
        await nasConnector.connect(config.destination, config.nasUsername, config.nasPasswordDecrypted);
      } catch (e) {
        console.error('[Get-Network] Failed to connect to NAS:', e.message);
      }
    }

    const sharedFilePath = path.join(config.destination, 'network_clients.json');
    const longPath = toLongPath(sharedFilePath);

    try {
      if (fs.existsSync(longPath)) {
        const content = fs.readFileSync(longPath, 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          sharedMachines = parsed;
        }
      }
    } catch (e) {
      console.error('[Get-Network] Failed to read shared clients list:', e.message);
    }
  }

  const merged = Array.from(new Set([...localMachines, ...sharedMachines]));
  res.json(merged);
});

// 11. Save list of monitored network machines
app.post('/api/network/machines', checkAdminAuth, (req, res) => {
  const { machines } = req.body;
  if (!machines || !Array.isArray(machines)) {
    return res.status(400).json({ success: false, message: 'Se requiere una lista de máquinas (IPs).' });
  }
  const success = saveNetworkMachines(machines);
  if (success) {
    res.json({ success: true, message: 'Lista de máquinas de red actualizada.' });
  } else {
    res.status(500).json({ success: false, message: 'No se pudo guardar la lista.' });
  }
});

// 11b. Remove machine from both local list and shared list on NAS
app.post('/api/network/machines/remove', checkAdminAuth, async (req, res) => {
  const { ip } = req.body;
  if (!ip) {
    return res.status(400).json({ success: false, message: 'ip es requerido.' });
  }

  const localMachines = getNetworkMachines();
  const newLocal = localMachines.filter(item => item !== ip);
  saveNetworkMachines(newLocal);

  const config = db.getConfig();
  if (config.destination) {
    if (config.destination.startsWith('\\\\')) {
      try {
        await nasConnector.connect(config.destination, config.nasUsername, config.nasPasswordDecrypted);
      } catch (e) {
        console.error('[Remove-Remote] Failed to connect to NAS:', e.message);
      }
    }

    const sharedFilePath = path.join(config.destination, 'network_clients.json');
    const longPath = toLongPath(sharedFilePath);

    try {
      if (fs.existsSync(longPath)) {
        const content = fs.readFileSync(longPath, 'utf8');
        let clients = JSON.parse(content);
        if (Array.isArray(clients)) {
          const newClients = clients.filter(item => item !== ip);
          fs.writeFileSync(longPath, JSON.stringify(newClients, null, 2), 'utf8');
          console.log(`[Remove-Remote] Removed ${ip} from shared clients list.`);
        }
      }
    } catch (err) {
      console.error('[Remove-Remote] Failed to update shared clients file:', err.message);
    }
  }

  res.json({ success: true, message: 'Máquina removida con éxito.' });
});

// 12. Proxy requests to remote machines (bypasses CORS restrictions)
app.post('/api/network/proxy', checkAdminAuth, async (req, res) => {
  const { ip, endpoint, method, payload } = req.body;
  if (!ip || !endpoint) {
    return res.status(400).json({ success: false, message: 'ip y endpoint son requeridos.' });
  }

  let remoteUrl = ip.startsWith('http') ? ip : `http://${ip}`;
  if (!/:[0-9]+/.test(remoteUrl.replace('http://', '').replace('https://', ''))) {
    remoteUrl += ':8282';
  }
  remoteUrl += endpoint;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6-second connection timeout (more forgiving for Wi-Fi latency)

  try {
    const options = {
      method: method || 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Connection': 'close' // Prevents socket keep-alive reuse issue in undici/fetch client
      },
      signal: controller.signal
    };
    if (payload && (options.method === 'POST' || options.method === 'PUT')) {
      options.body = JSON.stringify(payload);
    }

    const remoteRes = await fetch(remoteUrl, options);
    clearTimeout(timeoutId);
    const text = await remoteRes.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { rawText: text };
    }

    res.status(remoteRes.status).json(data);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return res.status(504).json({ success: false, message: 'La máquina remota no respondió (Timeout de 6s).' });
    }
    const isFetchFailed = err.message && err.message.includes('fetch failed');
    const displayMsg = isFetchFailed 
      ? 'La máquina remota está apagada o fuera de la red local.' 
      : err.message;
    res.status(502).json({ success: false, message: `Sin conexión: ${displayMsg}` });
  }
});

// Helper to get active Windows drives
function getLogicalDrives() {
  const drives = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < letters.length; i++) {
    const drive = letters[i] + ':\\';
    try {
      if (fs.existsSync(drive)) {
        drives.push(drive);
      }
    } catch (e) {}
  }
  return drives.length > 0 ? drives : ['C:\\'];
}

// Endpoint to list local drives and directories for the folder browser
app.get('/api/local-dir', (req, res) => {
  const targetPath = req.query.path;
  const drives = getLogicalDrives();
  
  if (!targetPath) {
    return res.json({
      drives,
      current: '',
      parent: null,
      subdirs: drives.map(d => ({ name: d, path: d }))
    });
  }

  try {
    let normalizedPath = path.normalize(targetPath);
    // Ensure Windows drive path formats correctly, e.g. "C:" -> "C:\"
    if (/^[A-Z]:$/i.test(normalizedPath)) {
      normalizedPath += '\\';
    }

    const items = fs.readdirSync(normalizedPath, { withFileTypes: true });
    const subdirs = items
      .filter(item => item.isDirectory())
      .map(item => ({
        name: item.name,
        path: path.join(normalizedPath, item.name)
      }));

    // Calculate parent directory
    const isRoot = /^[A-Z]:\\$/i.test(normalizedPath);
    const parent = isRoot ? null : path.dirname(normalizedPath);

    res.json({
      drives,
      current: normalizedPath,
      parent,
      subdirs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to React app index.html for client-side routing
if (fs.existsSync(frontendBuildPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// Start Server and Scheduler
app.listen(PORT, () => {
  console.log(`[Backup Service] API and UI server running on port ${PORT}`);
  scheduler.start();
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Shutting down gracefully.');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received. Shutting down gracefully.');
  scheduler.stop();
  process.exit(0);
});
