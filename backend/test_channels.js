import watchTowerService from './src/services/watchTowerService.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const channels = await watchTowerService.getChannels();
        console.log("Channels:", channels);
    } catch (e) {
        console.error(e);
    }
}
run();
