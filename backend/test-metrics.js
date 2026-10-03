import KeyMetrics from './src/models/KeyMetrics.js';
import sequelize from './src/config/db.js';

(async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully');

        // Fetch all metrics
        const metrics = await KeyMetrics.findAll();
        console.log('\n=== All Metrics ===');
        console.log(JSON.stringify(metrics, null, 2));

        // Fetch only keys
        const keys = await KeyMetrics.findAll({
            attributes: ['key'],
            order: [['key', 'ASC']]
        });
        console.log('\n=== Metric Keys ===');
        console.log(keys.map(m => m.key));

        await sequelize.close();
    } catch (error) {
        console.error('Error:', error);
    }
})();
