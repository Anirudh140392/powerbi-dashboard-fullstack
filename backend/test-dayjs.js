import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
dayjs.extend(customParseFormat);

console.log(dayjs("2026-03-01", ['YYYY-MM-DD', 'DD-MM-YYYY']).format('YYYY-MM-DD'));
