import 'dotenv/config';
import availabilityService from './src/services/availabilityService.js';
import sequelize from './src/config/db.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';

const debugFilters = async () => {
    try {
        console.log("Debugging Assortment Filters...");

        // 1. Baseline (All Data)
        console.log("\n--- Baseline (No Filters) ---");
        const baseline = await availabilityService.getAssortment({ months: 6 });
        console.log(baseline);

        // 2. Filter by Brand (Godrej) - assuming it exists
        console.log("\n--- Filter by Brand: Godrej ---");
        const brandFilter = await availabilityService.getAssortment({ months: 6, brand: 'Godrej' });
        console.log(brandFilter);

        // 3. Filter by Location (Agra) - assuming it exists
        console.log("\n--- Filter by Location: Agra ---");
        const locationFilter = await availabilityService.getAssortment({ months: 6, location: 'Agra' });
        console.log(locationFilter);

        // 5. Check distinct locations for Zepto
        console.log("\n--- Distinct Locations for Zepto ---");
        const zeptoLocations = await RbPdpOlap.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Location')), 'Location']],
            where: { Platform: 'Zepto' },
            raw: true
        });
        console.log(zeptoLocations.map(l => l.Location));

    } catch (error) {
        console.error("Debug Failed:", error);
    } finally {
        await sequelize.close();
    }
};

debugFilters();
