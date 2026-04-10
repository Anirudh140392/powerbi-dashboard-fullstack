import './backend/src/config/clickhouse.js';
import { queryClickHouse, asyncStorageMiddleware } from './backend/src/config/clickhouse.js';
import { AsyncLocalStorage } from 'node:async_hooks';

const dbStorage = new AsyncLocalStorage();

dbStorage.run({ dbName: 'boat' }, async () => {
    try {
        const res = await queryClickHouse("DESCRIBE TABLE rb_sku_platform");
        console.log(res.map(r => r.name));
    } catch (e) {
        console.error(e);
    }
});
