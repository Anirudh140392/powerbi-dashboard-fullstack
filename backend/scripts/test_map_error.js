import { config } from 'dotenv';
config({ path: '/home/asus/Music/powerbi-dashboard-fullstack/backend/.env' });
import mapIntellectService from '../src/services/mapIntellectService.js';

async function run() {
    try {
        const filters = {
            platform: 'Blinkit',
            months: 1
        };
        const data = await mapIntellectService.getMapIntellectData(filters);
        console.log("Returned cities:", data.cities.length);
        console.log("Sample city:", data.cities[0]);
    } catch (e) {
        console.error("Error fetching map intellect data:", e);
    }
    process.exit(0);
}
run();
