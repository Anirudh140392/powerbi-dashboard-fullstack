import http from 'http';

function runQuery(sql) {
    const data = sql;
    
    // Credentials parsed from backend/.env
    const auth = Buffer.from('readonly_user:Readonly@123').toString('base64');
    
    const options = {
        hostname: '13.200.55.131',
        port: 8123,
        path: '/?database=mars',
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
            'Content-Length': Buffer.byteLength(data),
            'Authorization': 'Basic ' + auth
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let resData = '';
            res.on('data', chunk => resData += chunk);
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, data: resData });
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function inspectDb() {
    try {
        const sql = `
            SELECT 
                Brand, 
                Product,
                multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', 
                    LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m'), 
                        if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', 
                        'Chocolates (Gifting)', 
                        'Chocolates (Non Gifting)'), 
                'Others') as computed_category
            FROM rb_pdp_olap
            WHERE lower(Platform) = 'blinkit' AND Comp_flag = 0
            LIMIT 20
            FORMAT JSONEachRow
        `;
        const res = await runQuery(sql);
        console.log("Samples:", res.data);

        const sql2 = `
            SELECT computed_category, count(*)
            FROM (
                SELECT 
                    multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', 
                        LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m', 'm&m\\'s', 'm&ms'), 
                            if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', 
                            'Chocolates (Gifting)', 
                            'Chocolates (Non Gifting)'), 
                    'Others') as computed_category
                FROM rb_pdp_olap
                WHERE lower(Platform) = 'blinkit' AND Comp_flag = 0 
                AND DATE >= subtractDays(now(), 30)
            )
            GROUP BY computed_category
            FORMAT JSONEachRow
        `;
        const res2 = await runQuery(sql2);
        console.log("Counts per category:", res2.data);
    } catch (err) {
        console.error("Error:", err);
    }
}
inspectDb();
