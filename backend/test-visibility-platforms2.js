import visibilityService from './src/services/visibilityService.js';
import { buildCHCondition } from './src/utils/clickhouseUtils.js';

console.log(buildCHCondition(undefined, 'brand', { isBrand: true }));
