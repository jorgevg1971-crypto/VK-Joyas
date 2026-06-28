const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VSS_DATA_DIR = path.join(__dirname, 'data', 'vss');

// Ensure VSS mount directory exists
if (!fs.existsSync(VSS_DATA_DIR)) {
  fs.mkdirSync(VSS_DATA_DIR, { recursive: true });
}

const vssManager = {
  activeShadows: [], // Array of { id, symlinkPath, drive }

  /**
   * Identifies all unique drive letters from a list of source paths.
   * e.g., ["C:\\Users\\Jorge\\Docs", "D:\\Data"] -> ["C:\\", "D:\\"]
   */
  getUniqueDrives(sources) {
    const drives = new Set();
    sources.forEach(src => {
      // Normalize path and extract drive letter
      const normalized = path.normalize(src);
      if (/^[A-Z]:/i.test(normalized)) {
        const driveLetter = normalized.substring(0, 2).toUpperCase() + '\\';
        drives.add(driveLetter);
      }
    });
    return Array.from(drives);
  },

  /**
   * Creates a VSS shadow copy for a list of drive letters and mounts them.
   * Returns a map: { "C:\\": "c:\\path\\to\\vss\\C" }
   */
  createShadowCopies(drives) {
    const shadowMap = {};
    this.activeShadows = [];

    drives.forEach(drive => {
      const driveLetterOnly = drive.substring(0, 1).toUpperCase(); // e.g. "C"
      const symlinkPath = path.join(VSS_DATA_DIR, `vss_${driveLetterOnly}`);

      console.log(`[VSS] Attempting to create shadow copy for drive ${drive}...`);

      try {
        // Clean up any existing symbolic link first
        if (fs.existsSync(symlinkPath)) {
          try {
            fs.rmdirSync(symlinkPath);
          } catch (e) {
            execSync(`cmd.exe /c rmdir "${symlinkPath}"`, { stdio: 'ignore' });
          }
        }

        // PowerShell script to create WMI shadow copy
        const psCommand = `
          $ErrorActionPreference = 'Stop'
          try {
            $shadow = (Get-WmiObject -List Win32_ShadowCopy).Create("${drive}", "ClientAccessible")
            if ($shadow.ReturnValue -ne 0) { throw "ReturnValue: " + $shadow.ReturnValue }
            $id = $shadow.ShadowID
            $dev = (Get-WmiObject Win32_ShadowCopy | Where-Object { $_.ID -eq $id }).DeviceObject
            Write-Output "SUCCESS|$id|$dev"
          } catch {
            Write-Output "ERROR|$($_.Exception.Message)"
          }
        `.replace(/\n/g, ' ').trim();

        const result = execSync(`powershell.exe -Command "${psCommand}"`, { encoding: 'utf8' }).trim();
        const parts = result.split('|');

        if (parts[0] !== 'SUCCESS') {
          throw new Error(parts[1] || 'Unknown VSS error');
        }

        const shadowId = parts[1];
        const deviceObject = parts[2]; // e.g. \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1

        console.log(`[VSS] Shadow copy created. ID: ${shadowId}, Device: ${deviceObject}`);

        // Create symbolic link to the shadow copy device object
        // We must append a backslash to the device path for the symlink to resolve directory files correctly
        const command = `cmd.exe /c mklink /d "${symlinkPath}" "${deviceObject}\\"`;
        execSync(command, { stdio: 'ignore' });

        if (!fs.existsSync(symlinkPath)) {
          throw new Error('Failed to verify symbolic link creation.');
        }

        shadowMap[drive] = symlinkPath;
        this.activeShadows.push({
          id: shadowId,
          symlinkPath,
          drive
        });

        console.log(`[VSS] Mounted drive ${drive} to ${symlinkPath}`);

      } catch (err) {
        console.error(`[VSS] Failed to set up VSS for drive ${drive}:`, err.message);
        // If VSS fails, we do NOT crash, we just fallback to the normal path (return no mapping for this drive)
      }
    });

    return shadowMap;
  },

  /**
   * Cleans up all active shadow copies and deletes symbolic links.
   */
  cleanupShadowCopies() {
    console.log(`[VSS] Cleaning up ${this.activeShadows.length} shadow copies...`);
    
    this.activeShadows.forEach(shadow => {
      // 1. Delete symbolic link
      if (fs.existsSync(shadow.symlinkPath)) {
        try {
          // Try standard Node deletion
          fs.rmdirSync(shadow.symlinkPath);
        } catch (e) {
          try {
            // Fallback to cmd rmdir
            execSync(`cmd.exe /c rmdir "${shadow.symlinkPath}"`, { stdio: 'ignore' });
          } catch (cmdErr) {
            console.error(`[VSS] Failed to remove symlink ${shadow.symlinkPath}:`, cmdErr.message);
          }
        }
      }

      // 2. Delete Windows VSS Shadow Copy
      try {
        const psDelete = `(Get-WmiObject Win32_ShadowCopy | Where-Object { $_.ID -eq '${shadow.id}' }).Delete()`;
        execSync(`powershell.exe -Command "${psDelete}"`, { stdio: 'ignore' });
        console.log(`[VSS] Deleted VSS shadow copy ${shadow.id}`);
      } catch (err) {
        console.error(`[VSS] Failed to delete Windows shadow copy ${shadow.id}:`, err.message);
      }
    });

    this.activeShadows = [];
  },

  /**
   * Maps a normal source file path to the corresponding VSS mount path.
   * e.g. path: "C:\\Users\\Jorge\\file.txt", shadowMap: { "C:\\": "c:\\vss_C" }
   * returns: "c:\\vss_C\\Users\\Jorge\\file.txt"
   */
  mapToVssPath(filePath, shadowMap) {
    const normalized = path.normalize(filePath);
    
    // Find matching drive prefix
    for (const drive in shadowMap) {
      if (normalized.toUpperCase().startsWith(drive.toUpperCase())) {
        const vssMountPath = shadowMap[drive];
        // Strip the drive prefix (e.g. "C:\\") from the original path
        const relativePart = normalized.substring(drive.length);
        return path.join(vssMountPath, relativePart);
      }
    }
    
    return filePath; // Fallback to original path if no VSS mapping exists
  }
};

module.exports = vssManager;
