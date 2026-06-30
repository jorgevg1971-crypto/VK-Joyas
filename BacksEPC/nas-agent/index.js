const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 8283;
const BACKUP_ROOT = process.env.BACKUP_ROOT_PATH || '/backups';

app.use(express.json());

// 1. Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: os.platform(),
    hostname: os.hostname(),
    backupRoot: BACKUP_ROOT,
    uptime: Math.round(process.uptime()),
    freeMem: Math.round(os.freemem() / (1024 * 1024)) + 'MB'
  });
});

// 2. Consolidate backup endpoint (natively on NAS)
app.post('/api/consolidate', (req, res) => {
  const { deviceIdentifier, folderName, runId } = req.body;

  if (!deviceIdentifier || !folderName || !runId) {
    return res.status(400).json({
      success: false,
      message: 'Faltan parámetros requeridos: deviceIdentifier, folderName, runId'
    });
  }

  const deviceDir = path.join(BACKUP_ROOT, deviceIdentifier);
  const targetBackupDir = path.join(deviceDir, folderName);
  const manifestPath = path.join(targetBackupDir, 'manifest.json');

  console.log(`[NAS Agent] Solicitud de consolidación recibida para ${deviceIdentifier}/${folderName} (Run ID: ${runId})`);

  // Check if target backup directory and manifest exist
  if (!fs.existsSync(targetBackupDir)) {
    return res.status(404).json({
      success: false,
      message: `No se encontró la carpeta de backup en el NAS: ${targetBackupDir}`
    });
  }

  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({
      success: false,
      message: `No se encontró el manifiesto 'manifest.json' en la carpeta de backup del NAS.`
    });
  }

  const tempFolderName = `consolidate_temp_${runId}`;
  const tempFolder = path.join(deviceDir, tempFolderName);
  const zipName = `archive_${deviceIdentifier}_${folderName}.zip`;
  const zipPath = path.join(deviceDir, zipName);

  try {
    // Read manifest
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Clean up any existing temp folder
    if (fs.existsSync(tempFolder)) {
      fs.rmSync(tempFolder, { recursive: true, force: true });
    }

    // Create temp folder
    fs.mkdirSync(tempFolder, { recursive: true });

    // Copy all files listed in the manifest (locally on the NAS)
    const fileRelPaths = Object.keys(manifest);
    console.log(`[NAS Agent] Reconstruyendo estructura para ${fileRelPaths.length} archivos...`);

    for (const relPath of fileRelPaths) {
      const fileMeta = manifest[relPath];
      
      // The physical file on the NAS is located at path.join(BACKUP_ROOT, fileMeta.backupFolder, relPath)
      const physicalPath = path.join(BACKUP_ROOT, fileMeta.backupFolder, relPath);
      const targetPath = path.join(tempFolder, relPath);

      // Ensure subdirectory structure exists in temp
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });

      if (fs.existsSync(physicalPath)) {
        fs.copyFileSync(physicalPath, targetPath);
      } else {
        console.warn(`[NAS Agent] Advertencia: Archivo físico no encontrado en: ${physicalPath}`);
      }
    }

    console.log(`[NAS Agent] Estructura reconstruida con éxito. Comprimiendo en ZIP...`);

    // Compress using native 'zip' command
    const absTempFolder = path.resolve(tempFolder);
    const absZipPath = path.resolve(zipPath);

    // Command: zip -r "/path/to/archive.zip" .
    const command = `zip -q -r "${absZipPath}" .`;
    execSync(command, { cwd: absTempFolder, stdio: 'ignore' });

    console.log(`[NAS Agent] Consolidación completada correctamente. ZIP creado en: ${zipPath}`);
    res.json({
      success: true,
      message: 'Consolidación realizada con éxito directamente en el NAS.',
      zipName,
      zipPath
    });

  } catch (err) {
    console.error(`[NAS Agent] Error al consolidar backup:`, err.message);
    res.status(500).json({
      success: false,
      message: `Fallo durante el proceso de consolidación en el NAS: ${err.message}`
    });
  } finally {
    // Clean up temp directory
    try {
      if (fs.existsSync(tempFolder)) {
        fs.rmSync(tempFolder, { recursive: true, force: true });
        console.log(`[NAS Agent] Carpeta temporal eliminada.`);
      }
    } catch (cleanErr) {
      console.error(`[NAS Agent] Error al eliminar carpeta temporal:`, cleanErr.message);
    }
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Agente de Backups ePC para QNAP iniciado en puerto ${PORT}`);
  console.log(` Directorio raíz de backups: ${BACKUP_ROOT}`);
  console.log(`====================================================`);
});
