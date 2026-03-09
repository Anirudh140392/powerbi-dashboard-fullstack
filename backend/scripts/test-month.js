import watchTowerService from '../src/services/watchTowerService.js';
const filters = {
    startDate: '2026-02-01', endDate: '2026-03-07', compareStartDate: '2025-12-28', compareEndDate: '2026-01-31', channel: 'QuickComm', filterLogic: 'OR'
};
(async () => {
    try {
        await watchTowerService.getMonthOverview(filters);
        console.log("Success");
    } catch (e) {
        console.error("FAILED:", e.message);
    }
    process.exit();
})();
