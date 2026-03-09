// Check existing database indexes
import dotenv from 'dotenv';
import sequelize from './src/config/db.js';
import { QueryTypes } from 'sequelize';

dotenv.config();

async function checkIndexes() {
    try {
        console.log('🔍 Checking existing database indexes...\n');

        const tables = [
            'rb_pdp_olap',
            'rb_kw',
            'rb_brand_ms',
            'rb_sku_platform',
            'rca_sku_dim'
        ];

        for (const table of tables) {
            console.log(`\n========================================`);
            console.log(`📊 Table: ${table}`);
            console.log(`========================================`);

            try {
                // Show indexes
                const indexes = await sequelize.query(
                    `SHOW INDEX FROM ${table}`,
                    { type: QueryTypes.SELECT }
                );

                if (indexes.length === 0) {
                    console.log('❌ No indexes found');
                } else {
                    console.log(`✅ Found ${indexes.length} index entries:\n`);

                    // Group by index name
                    const indexMap = new Map();
                    indexes.forEach(idx => {
                        if (!indexMap.has(idx.Key_name)) {
                            indexMap.set(idx.Key_name, []);
                        }
                        indexMap.get(idx.Key_name).push(idx);
                    });

                    indexMap.forEach((cols, indexName) => {
                        const columnNames = cols
                            .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
                            .map(c => c.Column_name)
                            .join(', ');

                        const indexType = cols[0].Index_type;
                        const unique = cols[0].Non_unique === 0 ? 'UNIQUE' : '';

                        console.log(`  ${unique} ${indexType}: ${indexName} (${columnNames})`);
                    });
                }
            } catch (err) {
                console.log(`❌ Error checking ${table}:`, err.message);
            }
        }

        console.log('\n========================================');
        console.log('📈 Summary');
        console.log('========================================\n');

        // Get detailed index info from information_schema
        const allIndexes = await sequelize.query(`
            SELECT 
                TABLE_NAME,
                INDEX_NAME,
                GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns,
                NON_UNIQUE,
                INDEX_TYPE
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME IN ('rb_pdp_olap', 'rb_kw', 'rb_brand_ms', 'rb_sku_platform', 'rca_sku_dim')
            GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE, INDEX_TYPE
            ORDER BY TABLE_NAME, INDEX_NAME
        `, { type: QueryTypes.SELECT });

        console.log('Total indexes across all tables:', allIndexes.length);
        console.log('\nIndex breakdown:');

        const byTable = {};
        allIndexes.forEach(idx => {
            if (!byTable[idx.TABLE_NAME]) {
                byTable[idx.TABLE_NAME] = 0;
            }
            byTable[idx.TABLE_NAME]++;
        });

        Object.entries(byTable).forEach(([table, count]) => {
            console.log(`  ${table}: ${count} indexes`);
        });

        console.log('\n✅ Index check complete!\n');

    } catch (error) {
        console.error('❌ Error checking indexes:', error);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

checkIndexes();
