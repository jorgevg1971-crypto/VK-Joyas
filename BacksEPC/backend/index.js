const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const backupEngine = require('./backup-engine');
const scheduler = require('./scheduler');
const nasConnector = require('./nas-connector');

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
  
  let totalSpaceUsed = 0;
  // Calculate approximate space used on NAS from all successful runs
  // Note: Since incremental backups only copy changed files, the physical size is the sum of filesCopied
  runs.forEach(r => {
    totalSpaceUsed += (r.bytesCopied || 0);
  });

  res.json({
    currentJob,
    lastRunTimestamp: config.lastRunTimestamp,
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
    nasUsername: config.nasUsername,
    hasPassword: !!config.nasPassword,
    schedule: config.schedule,
    retention: config.retention
  });
});

// 3. Save configuration
app.post('/api/config', (req, res) => {
  const { sources, destination, nasUsername, nasPasswordDecrypted, schedule, retention } = req.body;

  const updates = {};
  if (sources !== undefined) updates.sources = sources;
  if (destination !== undefined) updates.destination = destination;
  if (nasUsername !== undefined) updates.nasUsername = nasUsername;
  if (schedule !== undefined) updates.schedule = schedule;
  if (retention !== undefined) updates.retention = parseInt(retention, 10) || 5;
  
  // Only update password if a new one is provided
  if (nasPasswordDecrypted !== undefined && nasPasswordDecrypted !== '') {
    updates.nasPasswordDecrypted = nasPasswordDecrypted;
  }

  const success = db.saveConfig(updates);
  if (success) {
    res.json({ success: true, message: 'Configuration saved successfully.' });
  } else {
    res.status(500).json({ success: false, message: 'Failed to save configuration.' });
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
    if (!restoreToOriginal && (!customPath || !fs.existsSync(customPath))) {
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
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.copyFileSync(physicalPath, targetPath);
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
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.copyFileSync(physicalPath, targetPath);
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
