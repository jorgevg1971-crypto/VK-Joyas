const db = require('./database');
const backupEngine = require('./backup-engine');

let timerId = null;

/**
 * Gets midnight date for date comparison.
 */
function getMidnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Checks if a backup is due and runs it if necessary.
 */
async function checkAndTriggerBackup() {
  const status = backupEngine.getStatus();
  if (status.status === 'scanning' || status.status === 'copying' || status.status === 'cleaning') {
    // Already running a backup
    return;
  }

  const config = db.getConfig();
  if (!config.sources || config.sources.length === 0 || !config.destination) {
    // Config not complete
    return;
  }

  const now = new Date();
  const todayMidnight = getMidnight(now);

  // Check if a backup has already run successfully today
  if (config.lastRunTimestamp) {
    const lastRunMidnight = getMidnight(new Date(config.lastRunTimestamp));
    if (todayMidnight.getTime() === lastRunMidnight.getTime()) {
      // Already ran today, skip
      return;
    }
  }

  // Check if current time of day is >= scheduled time
  const scheduledTime = config.schedule.time || '22:00';
  const [schedHour, schedMin] = scheduledTime.split(':').map(Number);
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  const isTimeOrAfter = (currentHour > schedHour) || (currentHour === schedHour && currentMin >= schedMin);
  if (!isTimeOrAfter) {
    return; // Not time yet
  }

  // Check schedule rules
  let shouldRun = false;

  if (config.schedule.type === 'days_of_week') {
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const scheduledDays = config.schedule.daysOfWeek || [];
    if (scheduledDays.includes(currentDay)) {
      shouldRun = true;
    }
  } else if (config.schedule.type === 'interval_days') {
    if (!config.lastRunTimestamp) {
      // Never run, run now
      shouldRun = true;
    } else {
      const lastRunMidnight = getMidnight(new Date(config.lastRunTimestamp));
      const diffTime = Math.abs(todayMidnight.getTime() - lastRunMidnight.getTime());
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      const intervalDays = config.schedule.intervalDays || 1;
      if (diffDays >= intervalDays) {
        shouldRun = true;
      }
    }
  }

  if (shouldRun) {
    console.log(`[Scheduler] Triggering automatic backup. Type: Auto (will determine Full/Inc). Time: ${now.toLocaleTimeString()}`);
    try {
      // Pass null to let engine automatically decide if it should be Full or Incremental
      await backupEngine.runBackup(null);
    } catch (err) {
      console.error('[Scheduler] Error running automatic backup:', err.message);
    }
  }
}

/**
 * Start the scheduler loop.
 */
function start() {
  if (timerId) return;

  console.log('[Scheduler] Starting backup scheduler service...');
  
  // Check immediately on startup
  checkAndTriggerBackup();

  // Then check every 30 seconds
  timerId = setInterval(checkAndTriggerBackup, 30000);
}

/**
 * Stop the scheduler loop.
 */
function stop() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    console.log('[Scheduler] Scheduler service stopped.');
  }
}

module.exports = {
  start,
  stop
};
