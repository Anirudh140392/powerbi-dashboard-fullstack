import { initKamAlertCron, stopKamAlertCron } from './src/services/kamAlertCronService.js';

// Just call the underlying job if we can, or wait for the cron to run once.
// But we can't easily do that because runKamAlertsJob is not exported.
// Let's modify the file temporarily to export runKamAlertsJob, then call it.
