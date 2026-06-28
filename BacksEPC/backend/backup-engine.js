const fs = require('fs');
const path = require('path');
const nasConnector = require('./nas-connector');
const db = require('./database');
const vssManager = require('./vss-manager');

let abortRequested = false;

// In-memory status tracker for the UI
let currentJobStatus = {
  status: 'idle', // 'idle', 'scanning', 'copying', 'cleaning', 'failed', 'success'
  type: null, // 'full' or 'incremental'
  progress: {
    totalFiles: 0,
    processedFiles: 0,
    currentFile: '',
    bytesCopied: 0,
    totalBytes: 0
  },
  startedAt: null,
  error: null
};

/**
 * Scans a folder recursively and returns metadata of all files.
 */
function scanDirectory(dirPath, rootPrefix, fileList = []) {
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const absPath = path.join(dirPath, file);
      let stat;
      try {
        stat = fs.statSync(absPath);
      } catch (e) {
        // Skip files that can't be read/accessed (e.g. system locked files)
        continue;
      }

      if (stat.isDirectory()) {
        scanDirectory(absPath, path.join(rootPrefix, file), fileList);
      } else if (stat.isFile()) {
        fileList.push({
          absPath,
          relPath: path.join(rootPrefix, file).replace(/\\/g, '/'), // Use forward slashes for cross-platform DB consistency
          size: stat.size,
          mtime: stat.mtime.toISOString()
        });
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${dirPath}:`, err.message);
  }
  return fileList;
}

/**
 * Helper to copy file and update progress.
 */
function copyFileWithProgress(src, dest) {
  // Ensure destination folder exists
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const rd = fs.createReadStream(src);
    const wr = fs.createWriteStream(dest);

    rd.on('error', reject);
    wr.on('error', reject);
    wr.on('finish', () => {
      // Update bytes copied
      try {
        const stat = fs.statSync(src);
        currentJobStatus.progress.bytesCopied += stat.size;
      } catch (e) {}
      resolve();
    });
    rd.pipe(wr);
  });
}

/**
 * Execute the backup run.
 */
async function runBackup(requestedType = null) {
  if (currentJobStatus.status === 'scanning' || currentJobStatus.status === 'copying') {
    throw new Error('A backup job is already running.');
  }

  const config = db.getConfig();
  if (!config.sources || config.sources.length === 0) {
    throw new Error('No source folders configured.');
  }
  if (!config.destination) {
    throw new Error('No destination backup path configured.');
  }

  const runId = new Date().getTime().toString();
  const timestamp = new Date().toISOString();
  
  // Format directory name: backup_YYYYMMDD_HHMMSS_[type]
  const dateStr = new Date().toISOString().replace(/[-T:]/g, '').split('.')[0]; // YYYYMMDDHHMMSS
  
  currentJobStatus = {
    id: runId,
    status: 'scanning',
    type: requestedType,
    progress: {
      totalFiles: 0,
      processedFiles: 0,
      currentFile: 'Iniciando conexión...',
      bytesCopied: 0,
      totalBytes: 0
    },
    startedAt: timestamp,
    error: null
  };

  let connectedToNas = false;
  let backupType = requestedType; // will be 'full' or 'incremental'

  abortRequested = false;
  
  // Log in database as running
  const runLog = {
    id: runId,
    timestamp,
    type: 'unknown',
    status: 'running',
    filesCount: 0,
    filesCopied: 0,
    totalSize: 0,
    bytesCopied: 0,
    duration: 0,
    folderName: '',
    error: null
  };
  db.addRun(runLog);

  try {
    // 1. Connect to NAS if it's a UNC path
    if (config.destination.startsWith('\\\\')) {
      currentJobStatus.progress.currentFile = 'Conectando al NAS...';
      await nasConnector.connect(config.destination, config.nasUsername, config.nasPasswordDecrypted);
      connectedToNas = true;
    }

    // Check if destination is accessible
    const accessTest = await nasConnector.testAccess(config.destination);
    if (!accessTest.success) {
      throw new Error(`Destination directory not accessible: ${accessTest.error}`);
    }

    // 2. Decide Backup Type (Full or Incremental)
    const runs = db.getRuns().filter(r => r.status === 'success');
    const lastSuccessfulRun = runs.length > 0 ? runs[runs.length - 1] : null;

    if (!lastSuccessfulRun) {
      // Force Full if there are no prior successful backups
      backupType = 'full';
    } else if (!backupType) {
      // If type not specified, count incrementals since last full backup
      let incCount = 0;
      for (let i = runs.length - 1; i >= 0; i--) {
        if (runs[i].type === 'full') break;
        if (runs[i].type === 'incremental') incCount++;
      }

      if (incCount >= config.retention) {
        backupType = 'full'; // Exceeded retention limit of incrementals, force Full
      } else {
        backupType = 'incremental';
      }
    }

    currentJobStatus.type = backupType;
    db.updateRun(runId, { type: backupType });

    const folderName = `backup_${dateStr}_${backupType}`;
    const destinationFolder = path.join(config.destination, folderName);

    // Create destination folder
    if (!fs.existsSync(destinationFolder)) {
      fs.mkdirSync(destinationFolder, { recursive: true });
    }

    // 3. Scan Source Files
    currentJobStatus.progress.currentFile = 'Escaneando archivos de origen...';
    let allSourceFiles = [];
    for (let i = 0; i < config.sources.length; i++) {
      const src = config.sources[i];
      if (fs.existsSync(src)) {
        const folderName = path.basename(src);
        // Prefix with index to ensure uniqueness e.g. "0_Data"
        const prefix = `${i}_${folderName}`;
        scanDirectory(src, prefix, allSourceFiles);
      }
    }

    currentJobStatus.progress.totalFiles = allSourceFiles.length;
    currentJobStatus.progress.totalBytes = allSourceFiles.reduce((acc, f) => acc + f.size, 0);
    
    // Create VSS shadow copies of unique source drives
    currentJobStatus.progress.currentFile = 'Creando instantánea de volumen (VSS)...';
    const uniqueDrives = vssManager.getUniqueDrives(config.sources);
    const shadowMap = vssManager.createShadowCopies(uniqueDrives);

    currentJobStatus.status = 'copying';

    // 4. Compare files and copy
    let manifest = {};
    let filesCopied = 0;
    let bytesCopied = 0;
    let lastManifest = {};

    if (backupType === 'incremental' && lastSuccessfulRun) {
      lastManifest = db.getManifest(lastSuccessfulRun.id) || {};
    }

    for (const file of allSourceFiles) {
      if (abortRequested) {
        throw new Error('Copia de seguridad cancelada por el usuario.');
      }
      currentJobStatus.progress.currentFile = file.relPath;
      
      let shouldCopy = false;
      const fileInLastManifest = lastManifest[file.relPath];

      if (backupType === 'full') {
        shouldCopy = true;
      } else {
        // Incremental: check if new or modified
        if (!fileInLastManifest) {
          shouldCopy = true; // New file
        } else if (fileInLastManifest.size !== file.size || fileInLastManifest.mtime !== file.mtime) {
          shouldCopy = true; // Modified file
        }
      }

      if (shouldCopy) {
        const destFilePath = path.join(destinationFolder, file.relPath);
        const vssSourcePath = vssManager.mapToVssPath(file.absPath, shadowMap);
        await copyFileWithProgress(vssSourcePath, destFilePath);
        
        manifest[file.relPath] = {
          size: file.size,
          mtime: file.mtime,
          backupFolder: folderName // points to this backup folder
        };
        filesCopied++;
        bytesCopied += file.size;
      } else {
        // Not changed: point to the folder of the previous backup that contains it
        manifest[file.relPath] = {
          size: fileInLastManifest.size,
          mtime: fileInLastManifest.mtime,
          backupFolder: fileInLastManifest.backupFolder
        };
        // Update bytes progress even if not copied (makes progress bar move smoothly for processed size)
        currentJobStatus.progress.bytesCopied += file.size;
      }

      currentJobStatus.progress.processedFiles++;
    }

    // Save manifest file
    db.saveManifest(runId, manifest);

    // 5. Update Run Log to Success
    const endTime = new Date().getTime();
    const duration = Math.round((endTime - new Date(timestamp).getTime()) / 1000); // in seconds
    
    const finalRunLog = {
      status: 'success',
      filesCount: allSourceFiles.length,
      filesCopied,
      totalSize: currentJobStatus.progress.totalBytes,
      bytesCopied,
      duration,
      folderName
    };
    db.updateRun(runId, finalRunLog);

    currentJobStatus.status = 'success';
    currentJobStatus.progress.currentFile = 'Backup completado correctamente.';

    // Update config with last run timestamp
    db.saveConfig({ lastRunTimestamp: timestamp });

    // 6. Retention cleanup (Only clean after a successful FULL backup)
    if (backupType === 'full') {
      currentJobStatus.status = 'cleaning';
      currentJobStatus.progress.currentFile = 'Ejecutando política de retención...';
      await runRetentionCleanup(config, runId);
      currentJobStatus.status = 'success';
    }

  } catch (err) {
    console.error('Backup failed:', err);
    
    const endTime = new Date().getTime();
    const duration = Math.round((endTime - new Date(timestamp).getTime()) / 1000);

    db.updateRun(runId, {
      status: 'failed',
      duration,
      error: err.message
    });

    currentJobStatus.status = 'failed';
    currentJobStatus.error = err.message;
    currentJobStatus.progress.currentFile = `Error: ${err.message}`;
  } finally {
    // Clean up VSS shadow copies and delete symbolic links
    vssManager.cleanupShadowCopies();
  }
}

/**
 * Handles deleting previous backup chains after a new Full backup is successful.
 */
async function runRetentionCleanup(config, currentFullRunId) {
  try {
    const runs = db.getRuns();
    // Filter successful runs
    const successRuns = runs.filter(r => r.status === 'success');
    
    // Find all full backup indices
    const fullBackupIndices = [];
    for (let i = 0; i < successRuns.length; i++) {
      if (successRuns[i].type === 'full') {
        fullBackupIndices.push(i);
      }
    }

    // We only clean up if we have more than one full backup in history
    // (the one we just made, and at least one previous cycle)
    if (fullBackupIndices.length <= 1) {
      console.log('Retention: Only one full backup chain exists. Skipping cleanup.');
      return;
    }

    // The index of the second-to-last full backup
    // Everything before this full backup and its subsequent incrementals (up to the next full backup)
    // can be deleted.
    // To be safe, we keep the immediately preceding cycle OR we just keep the CURRENT cycle and delete all older cycles.
    // The user requirement: "que se pueda programar que despues de cierto numero de copias incrementales se haga un copia full y borre el contenido anterior".
    // "borre el contenido anterior" means delete the previous cycle (the previous full backup and its incrementals).
    // So we delete all runs and folders belonging to cycles older than the current one (which starts at fullBackupIndices[fullBackupIndices.length - 1]).
    
    const currentCycleStartIdx = fullBackupIndices[fullBackupIndices.length - 1];
    const runsToDelete = successRuns.slice(0, currentCycleStartIdx);
    
    console.log(`Retention: Deleting ${runsToDelete.length} old backup runs.`);

    for (const oldRun of runsToDelete) {
      const folderToDelete = path.join(config.destination, oldRun.folderName);
      
      // Delete the physical directory on NAS
      if (fs.existsSync(folderToDelete)) {
        try {
          fs.rmSync(folderToDelete, { recursive: true, force: true });
          console.log(`Retention: Deleted folder ${folderToDelete}`);
        } catch (e) {
          console.error(`Retention: Failed to delete physical folder ${folderToDelete}:`, e.message);
        }
      }

      // Delete local manifest
      db.deleteManifest(oldRun.id);
    }

    // Filter out deleted runs from db
    const remainingRuns = runs.filter(r => {
      // Keep running, failed, and non-deleted success runs
      return r.status !== 'success' || !runsToDelete.some(old => old.id === r.id);
    });
    db.saveRuns(remainingRuns);

  } catch (err) {
    console.error('Error during retention cleanup:', err.message);
  }
}

/**
 * Returns current progress status.
 */
function getStatus() {
  return currentJobStatus;
}

function cancelBackup() {
  if (currentJobStatus.status === 'scanning' || currentJobStatus.status === 'copying' || currentJobStatus.status === 'cleaning') {
    abortRequested = true;
    return true;
  }
  return false;
}

module.exports = {
  runBackup,
  getStatus,
  cancelBackup
};
