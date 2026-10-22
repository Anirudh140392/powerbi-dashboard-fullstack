import 'dotenv/config';
import visibilityService from './src/services/visibilityService.js';

(async () => {
    try {
        const formats = await visibilityService.getVisibilityFilterOptions({ filterType: 'formats' });
        console.log('FORMATS:', formats.options.length, formats.options.slice(0, 3));

        const brands = await visibilityService.getVisibilityFilterOptions({ filterType: 'brands' });
        console.log('BRANDS:', brands.options.length, brands.options.slice(0, 3));

        const skus = await visibilityService.getVisibilityFilterOptions({ filterType: 'skus' });
        console.log('SKUS:', skus.options.length, skus.options.slice(0, 3));

    } catch (e) {
        console.error(e);
    }
})();
