import watchTowerService from './src/services/watchTowerService.js';
async function test() {
  try {
    const p = await watchTowerService.getPlatformChannels({ channel: 'QComm' });
    console.log('WT QComm:', p);
  } catch (e) { console.error(e); }
}
test();
