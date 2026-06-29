const fs = require('fs');
const path = require('path');
const nasConnector = require('./nas-connector');
const db = require('./database');
const vssManager = require('./vss-manager');
const { execSync } = require('child_process');

let abortRequested = false;

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
    const files = fs.readdirSync(toLongPath(dirPath));
    for (const file of files) {
      const absPath = path.join(dirPath, file);
      let stat;
      try {
        stat = fs.statSync(toLongPath(absPath));
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
  if (!fs.existsSync(toLongPath(destDir))) {
    fs.mkdirSync(toLongPath(destDir), { recursive: true });
  }

  // Double-check if src is actually a directory to prevent EISDIR on virtual/cloud drives
  try {
    const stat = fs.statSync(toLongPath(src));
    if (stat.isDirectory()) {
      console.warn(`[Backup Engine] Skipping directory reported as file: ${src}`);
      return Promise.resolve();
    }
  } catch (e) {
    // If stat fails, let the read stream attempt to run and handle it normally
  }

  return new Promise((resolve, reject) => {
    const rd = fs.createReadStream(toLongPath(src));
    const wr = fs.createWriteStream(toLongPath(dest));

    rd.on('error', reject);
    wr.on('error', reject);
    wr.on('finish', () => {
      // Update bytes copied
      try {
        const stat = fs.statSync(toLongPath(src));
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
  let warnings = [];
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

    const deviceIdentifier = config.deviceIdentifier || require('os').hostname();
    const folderName = `backup_${dateStr}_${backupType}`;
    const destinationFolder = path.join(config.destination, deviceIdentifier, folderName);
    const backupFolderRel = deviceIdentifier + '/' + folderName;

    // Create destination folder
    if (!fs.existsSync(toLongPath(destinationFolder))) {
      fs.mkdirSync(toLongPath(destinationFolder), { recursive: true });
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

    uniqueDrives.forEach(drive => {
      if (!shadowMap[drive]) {
        warnings.push(`VSS falló en ${drive}. Copia directa activa (puede fallar con archivos abiertos).`);
      }
    });

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
        try {
          const destFilePath = path.join(destinationFolder, file.relPath);
          const vssSourcePath = vssManager.mapToVssPath(file.absPath, shadowMap);
          await copyFileWithProgress(vssSourcePath, destFilePath);
          
          manifest[file.relPath] = {
            size: file.size,
            mtime: file.mtime,
            backupFolder: backupFolderRel // points to this backup folder inside device subfolder
          };
          filesCopied++;
          bytesCopied += file.size;
        } catch (copyErr) {
          console.error(`Failed to copy file ${file.absPath}:`, copyErr.message);
          warnings.push(`Error en archivo '${file.relPath}': ${copyErr.message}`);
          
          // If it was an incremental backup, reference the previous version so it's not lost
          if (backupType === 'incremental' && fileInLastManifest) {
            manifest[file.relPath] = {
              size: fileInLastManifest.size,
              mtime: fileInLastManifest.mtime,
              backupFolder: fileInLastManifest.backupFolder
            };
          }
        }
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
      folderName,
      warnings: warnings.length > 0 ? warnings : null
    };
    db.updateRun(runId, finalRunLog);

    currentJobStatus.status = 'success';
    currentJobStatus.progress.currentFile = 'Backup completado correctamente.';

    // Update config with last run timestamp
    db.saveConfig({ lastRunTimestamp: timestamp });

    // 6. Retention cleanup (Only clean after a successful FULL backup)
    // Run in background so the UI immediately transitions to success
    if (backupType === 'full') {
      runRetentionCleanup(config, runId).catch(err => {
        console.error('[Retention Cleanup] Background run failed:', err.message);
      });
    }

  } catch (err) {
    console.error('Backup failed:', err);
    
    const endTime = new Date().getTime();
    const duration = Math.round((endTime - new Date(timestamp).getTime()) / 1000);

    db.updateRun(runId, {
      status: 'failed',
      duration,
      error: err.message,
      warnings: warnings.length > 0 ? warnings : null
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

    const deviceIdentifier = config.deviceIdentifier || require('os').hostname();

    for (const oldRun of runsToDelete) {
      const folderToDelete = path.join(config.destination, deviceIdentifier, oldRun.folderName);
      
      // Delete the physical directory on NAS using async promises to avoid blocking main thread
      const longPathToDelete = toLongPath(folderToDelete);
      if (fs.existsSync(longPathToDelete)) {
        try {
          await fs.promises.rm(longPathToDelete, { recursive: true, force: true });
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

async function consolidateBackup(runId) {
  const config = db.getConfig();
  const runs = db.getRuns();
  const run = runs.find(r => r.id === runId);
  if (!run) {
    throw new Error('No se encontró el registro de la copia de seguridad.');
  }

  const manifest = db.getManifest(runId);
  if (!manifest) {
    throw new Error('No se encontró el manifiesto para esta copia de seguridad.');
  }

  // 1. Connect to NAS if it's a UNC path
  if (config.destination.startsWith('\\\\')) {
    await nasConnector.connect(config.destination, config.nasUsername, config.nasPasswordDecrypted);
  }

  const deviceIdentifier = config.deviceIdentifier || require('os').hostname();
  const tempFolderName = `consolidate_temp_${runId}`;
  const tempFolder = path.join(config.destination, deviceIdentifier, tempFolderName);
  const zipName = `archive_${deviceIdentifier}_${run.folderName || runId}.zip`;
  const zipPath = path.join(config.destination, deviceIdentifier, zipName);

  console.log(`[Consolidation] Starting consolidation for run ${runId} into ${zipName}...`);

  try {
    // 2. Clean up any existing temp folder
    if (fs.existsSync(toLongPath(tempFolder))) {
      fs.rmSync(toLongPath(tempFolder), { recursive: true, force: true });
    }

    // 3. Create temp folder
    fs.mkdirSync(toLongPath(tempFolder), { recursive: true });

    // 4. Copy all files listed in the manifest
    const fileRelPaths = Object.keys(manifest);
    for (const relPath of fileRelPaths) {
      const fileMeta = manifest[relPath];
      const physicalPath = path.join(config.destination, fileMeta.backupFolder, relPath);
      const targetPath = path.join(tempFolder, relPath);

      // Ensure destination directories exist
      fs.mkdirSync(toLongPath(path.dirname(targetPath)), { recursive: true });
      
      // Copy file
      if (fs.existsSync(toLongPath(physicalPath))) {
        fs.copyFileSync(toLongPath(physicalPath), toLongPath(targetPath));
      } else {
        console.warn(`[Consolidation] Warning: Physical file not found at ${physicalPath}`);
      }
    }

    console.log(`[Consolidation] Reconstructed ${fileRelPaths.length} files. Compressing into ZIP...`);

    // 5. Compress using tar.exe
    const absTempFolder = path.resolve(tempFolder);
    const absZipPath = path.resolve(zipPath);
    
    // Command: tar -a -cf "zipPath" -C "tempFolder" .
    const command = `tar.exe -a -cf "${absZipPath}" -C "${absTempFolder}" .`;
    execSync(command, { stdio: 'ignore' });

    console.log(`[Consolidation] ZIP archive created successfully at ${zipPath}`);
    return { success: true, zipName, zipPath };

  } catch (err) {
    console.error(`[Consolidation] Failed to consolidate backup:`, err.message);
    throw err;
  } finally {
    // 6. Always clean up the temp directory
    try {
      if (fs.existsSync(toLongPath(tempFolder))) {
        fs.rmSync(toLongPath(tempFolder), { recursive: true, force: true });
      }
    } catch (cleanErr) {
      console.error(`[Consolidation] Clean up failed for ${tempFolder}:`, cleanErr.message);
    }
  }
}

module.exports = {
  runBackup,
  getStatus,
  cancelBackup,
  consolidateBackup
};
