import visibilityService from './src/services/visibilityService.js';

async function testService() {
    try {
        console.log("Calling getVisibilityFilterOptions({ filterType: 'brands', ownBrandsOnly: true })");
        const res = await visibilityService.getVisibilityFilterOptions({ filterType: 'brands', ownBrandsOnly: true });
        console.log("Service response:", res);
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

testService();
