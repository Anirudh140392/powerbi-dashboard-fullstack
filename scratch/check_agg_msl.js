import { ClickHouse } from 'clickhouse';

const clickhouse = new ClickHouse({
    url: 'http://localhost',
    port: 8123,
    debug: false,
    basicAuth: null,
    isUseGzip: false,
    trimQuery: false,
    usePost: false,
    format: "json",
});

async function main() {
    try {
        const query1 = "SHOW TABLES FROM trailytics_2025 LIKE '%watchtower_agg_daily%'";
        clickhouse.query(query1).exec((err, rows) => {
            if (err) console.error("Error checking tables:", err);
            else console.log("Tables match watchtower_agg_daily:", rows);
        });

        const query2 = "DESCRIBE TABLE trailytics_2025.watchtower_agg_daily";
        clickhouse.query(query2).exec((err, rows) => {
            if (err) {
                console.error("watchtower_agg_daily describe error (it might not exist):", err.message);
            } else {
                console.log("watchtower_agg_daily columns:");
                rows.forEach(r => {
                    if (r.name.includes('msl')) {
                        console.log("   FOUND MSL IN watchtower_agg_daily:", r);
                    }
                });
            }
        });

        const query3 = "DESCRIBE TABLE trailytics_2025.rb_pdp_olap";
        clickhouse.query(query3).exec((err, rows) => {
            if (err) {
                console.error("rb_pdp_olap describe error:", err.message);
            } else {
                console.log("rb_pdp_olap columns:");
                rows.forEach(r => {
                    if (r.name.includes('msl')) {
                        console.log("   FOUND MSL IN rb_pdp_olap:", r);
                    }
                });
            }
        });
    } catch(e) {
        console.error(e);
    }
}

main();
