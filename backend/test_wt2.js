import watchTowerService from './src/services/watchTowerService.js';
async function test() {
  try {
    const p = await watchTowerService.getPlatforms('QComm');
    console.log('WT QComm getPlatforms:', p);
  } catch (e) { console.error(e); }
}
test();
