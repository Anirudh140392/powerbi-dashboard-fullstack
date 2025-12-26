// Simple script to check indexes - Direct connection
import { Sequelize, QueryTypes } from 'sequelize';

const sequelize = new Sequelize('gcpl', 'readonly_user', 'Readonly@123', {
    host: '15.207.197.27',
    dialect: 'mysql',
    port: 3306,
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
});

async function checkIndexes() {
    try {
        console.log('🔍 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Connected successfully!\n');

        const tables = ['rb_pdp_olap', 'rb_kw', 'rb_brand_ms', 'rb_sku_platform', 'rca_sku_dim'];

        for (const table of tables) {
            console.log(`\n${'='.repeat(50)}`);
            console.log(`📊 Table: ${table}`);
            console.log('='.repeat(50));

            const indexes = await sequelize.query(
                `SHOW INDEX FROM ${table}`,
                { type: QueryTypes.SELECT }
            );

            if (indexes.length === 0) {
                console.log('❌ NO INDEXES FOUND!');
            } else {
                const indexMap = new Map();
                indexes.forEach(idx => {
                    if (!indexMap.has(idx.Key_name)) {
                        indexMap.set(idx.Key_name, []);
                    }
                    indexMap.get(idx.Key_name).push(idx);
                });

                console.log(`✅ Found ${indexMap.size} indexes:\n`);
                indexMap.forEach((cols, indexName) => {
                    const columnNames = cols
                        .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
                        .map(c => c.Column_name)
                        .join(', ');

                    const unique = cols[0].Non_unique === 0 ? '[UNIQUE]' : '';
                    const type = cols[0].Index_type;
                    console.log(`  ${indexName} ${unique}: (${columnNames}) [${type}]`);
                });
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('📈 SUMMARY');
        console.log('='.repeat(50) + '\n');

        const summary = await sequelize.query(`
            SELECT 
                TABLE_NAME,
                COUNT(DISTINCT INDEX_NAME) as index_count
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = 'gcpl'
            AND TABLE_NAME IN ('rb_pdp_olap', 'rb_kw', 'rb_brand_ms', 'rb_sku_platform', 'rca_sku_dim')
            GROUP BY TABLE_NAME
            ORDER BY TABLE_NAME
        `, { type: QueryTypes.SELECT });

        summary.forEach(s => {
            console.log(`  ${s.TABLE_NAME}: ${s.index_count} indexes`);
        });

        console.log('\n✅ Check complete!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

checkIndexes();
