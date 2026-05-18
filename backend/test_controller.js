import { ContentAnalysisOverview } from './src/controllers/contentAnalysisController.js';

async function run() {
    const req = {
        query: {
            platform: 'blinkit',
            channel: 'quickcomm',
            brand: 'boomer',
            startDate: '2026-05-01',
            endDate: '2026-05-01',
            prevStartDate: '2026-04-01',
            prevEndDate: '2026-04-30'
        }
    };
    const res = {
        json: (data) => console.log("Success:", data),
        status: (code) => ({
            json: (err) => console.error("Failed", code, err)
        })
    };

    await ContentAnalysisOverview(req, res);
}

run();
