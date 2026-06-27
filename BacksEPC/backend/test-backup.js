const fs = require('fs');
const path = require('path');
const db = require('./database');
const backupEngine = require('./backup-engine');

// Setup local test paths
const TEST_ROOT = path.join(__dirname, '..', 'test_environment');
const SRC_DIR = path.join(TEST_ROOT, 'source_folder');
const DEST_DIR = path.join(TEST_ROOT, 'backup_destination');

async function setupTestEnvironment() {
  console.log('=== SETTING UP TEST ENVIRONMENT ===');
  
  // Clean previous tests
  if (fs.existsSync(TEST_ROOT)) {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  }

  fs.mkdirSync(SRC_DIR, { recursive: true });
  fs.mkdirSync(DEST_DIR, { recursive: true });

  // Create subdirectories in source
  fs.mkdirSync(path.join(SRC_DIR, 'documents'), { recursive: true });
  fs.mkdirSync(path.join(SRC_DIR, 'images'), { recursive: true });

  // Create initial dummy files
  fs.writeFileSync(path.join(SRC_DIR, 'documents', 'report.txt'), 'Report Version 1 Content\nLorem Ipsum...', 'utf8');
  fs.writeFileSync(path.join(SRC_DIR, 'images', 'logo.png'), 'DUMMY_IMAGE_DATA_PNG_12345', 'utf8');
  fs.writeFileSync(path.join(SRC_DIR, 'notes.txt'), 'Quick notes on backup setup.', 'utf8');

  console.log('Created source files:');
  console.log('- documents/report.txt (Version 1)');
  console.log('- images/logo.png');
  console.log('- notes.txt');
  console.log('====================================\n');
}

async function verifyFiles(runFolderName, expectedFiles) {
  const runPath = path.join(DEST_DIR, runFolderName);
  console.log(`Verifying contents in backup folder: ${runFolderName}`);
  
  if (!fs.existsSync(runPath)) {
    console.error(`ERROR: Backup folder ${runFolderName} does not exist!`);
    return false;
  }

  let allExist = true;
  expectedFiles.forEach(relPath => {
    const filePath = path.join(runPath, relPath);
    if (fs.existsSync(filePath)) {
      console.log(`  [OK] ${relPath} found`);
    } else {
      console.error(`  [MISSING] ${relPath} is missing in backup!`);
      allExist = false;
    }
  });
  return allExist;
}

async function runTests() {
  try {
    await setupTestEnvironment();

    // 1. Configure the database programmatically for local testing
    console.log('Configuring local test directories...');
    db.saveConfig({
      sources: [SRC_DIR],
      destination: DEST_DIR,
      nasUsername: '',
      nasPasswordDecrypted: '',
      retention: 2 // 2 incrementals before forcing full
    });

    console.log('Saved config. JSON content:', JSON.stringify(db.getConfig(), null, 2));
    console.log('------------------------------------\n');

    // 2. Run FULL backup
    console.log('=== TEST 1: Running FULL Backup ===');
    await backupEngine.runBackup('full');
    
    let runs = db.getRuns().filter(r => r.status === 'success');
    let lastRun = runs[runs.length - 1];
    console.log(`Full Backup Run Completed: ID = ${lastRun.id}, Folder = ${lastRun.folderName}`);
    console.log(`Files Copied: ${lastRun.filesCopied}, Bytes Copied: ${lastRun.bytesCopied}`);
    
    // Verify files copied to full folder
    let ok = await verifyFiles(lastRun.folderName, [
      '0_source_folder/notes.txt',
      '0_source_folder/documents/report.txt',
      '0_source_folder/images/logo.png'
    ]);
    if (!ok) throw new Error('Test 1 Failed');
    console.log('TEST 1 SUCCESSFUL!\n------------------------------------\n');

    // 3. Modify files and run INCREMENTAL backup
    console.log('=== TEST 2: Modifying files for INCREMENTAL Backup ===');
    // Modify one file
    fs.writeFileSync(path.join(SRC_DIR, 'documents', 'report.txt'), 'Report Version 2 - CHANGED!', 'utf8');
    // Add one new file
    fs.writeFileSync(path.join(SRC_DIR, 'new_document.txt'), 'New document added.', 'utf8');
    // notes.txt and logo.png remain unchanged
    
    console.log('Modifying source files:');
    console.log('- Modified: documents/report.txt (Version 2)');
    console.log('- Added: new_document.txt');
    console.log('Running incremental backup...');

    await backupEngine.runBackup('incremental');
    
    runs = db.getRuns().filter(r => r.status === 'success');
    lastRun = runs[runs.length - 1];
    console.log(`Incremental Backup Run Completed: ID = ${lastRun.id}, Folder = ${lastRun.folderName}`);
    console.log(`Files Copied: ${lastRun.filesCopied} (Expected: 2), Bytes Copied: ${lastRun.bytesCopied}`);

    // Verify only modified and new files are physically present in incremental folder
    ok = await verifyFiles(lastRun.folderName, [
      '0_source_folder/documents/report.txt',
      '0_source_folder/new_document.txt'
    ]);
    if (!ok) throw new Error('Test 2 Failed: Files missing in incremental backup folder');

    // Verify unchanged files are NOT in the incremental folder
    const notesInInc = fs.existsSync(path.join(DEST_DIR, lastRun.folderName, '0_source_folder', 'notes.txt'));
    if (notesInInc) {
      throw new Error('Test 2 Failed: notes.txt was copied but it did not change (not incremental!)');
    }
    console.log('  [OK] Unchanged files were not copied.');

    // Verify manifest points to correct backup folders for all files
    const manifest = db.getManifest(lastRun.id);
    console.log('Verifying manifest entries:');
    console.log(`  notes.txt -> stored in: ${manifest['0_source_folder/notes.txt'].backupFolder} (Expected: full folder)`);
    console.log(`  new_document.txt -> stored in: ${manifest['0_source_folder/new_document.txt'].backupFolder} (Expected: incremental folder)`);
    console.log(`  documents/report.txt -> stored in: ${manifest['0_source_folder/documents/report.txt'].backupFolder} (Expected: incremental folder)`);

    if (!manifest['0_source_folder/notes.txt'].backupFolder.includes('full')) {
      throw new Error('Test 2 Failed: Manifest file version link is incorrect');
    }
    console.log('TEST 2 SUCCESSFUL!\n------------------------------------\n');

    // 4. Verify Retention Cleanup after subsequent backups
    console.log('=== TEST 3: Testing Retention Rotation ===');
    console.log('We configured retention to 2. This means after 2 incrementals, the 3rd backup will be forced to FULL.');
    console.log('We currently have: 1 Full (Full 1) + 1 Incremental (Inc 1.1).');
    
    console.log('Adding 2nd incremental...');
    fs.writeFileSync(path.join(SRC_DIR, 'new_document2.txt'), 'Another file for 2nd incremental.', 'utf8');
    await backupEngine.runBackup('incremental'); // Inc 1.2
    
    runs = db.getRuns().filter(r => r.status === 'success');
    console.log(`Runs in history: ${runs.map(r => `${r.type} (${r.status})`).join(', ')}`);

    console.log('Now triggering next backup. It should exceed incremental count (2) and automatically trigger a FULL (Full 2).');
    console.log('And it should clean up the old cycle (Full 1, Inc 1.1, Inc 1.2).');
    
    await backupEngine.runBackup(null); // Auto-decide
    
    runs = db.getRuns().filter(r => r.status === 'success');
    console.log(`After run, remaining runs in history: ${runs.map(r => `${r.type} [${r.folderName}]`).join(', ')}`);
    
    if (runs.length !== 1 || runs[0].type !== 'full') {
      throw new Error('Test 3 Failed: Old backup cycle was not rotated and cleaned up!');
    }
    console.log('  [OK] Only the new Full backup remains in the database.');

    // Verify physical folders in destination
    const foldersInDest = fs.readdirSync(DEST_DIR);
    console.log(`Physical folders in backup destination: ${foldersInDest.join(', ')}`);
    if (foldersInDest.length !== 1 || !foldersInDest[0].includes('full')) {
      throw new Error('Test 3 Failed: Physical backup folders were not cleaned up from disk!');
    }
    console.log('  [OK] Physical directories were deleted from the backup destination.');
    console.log('TEST 3 SUCCESSFUL!\n------------------------------------\n');

    console.log('🎉 ALL BACKUP ENGINE TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (err) {
    console.error('❌ TEST RUN FAILED:', err.message);
    console.error(err.stack);
  }
}

runTests();
