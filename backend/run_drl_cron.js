import { initAlertCron } from './src/services/alertCronService.js';
import { initKamAlertCron } from './src/services/kamAlertCronService.js';
initAlertCron();
initKamAlertCron();
setTimeout(() => process.exit(0), 10000);
