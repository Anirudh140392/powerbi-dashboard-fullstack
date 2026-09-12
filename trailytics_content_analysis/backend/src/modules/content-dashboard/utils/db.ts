import { createClient, type ClickHouseClient } from '@clickhouse/client';

// ---------------------------------------------------------------------------
// Lazy singleton — the client is created on first use, not at module load
// time. This ensures process.env has been populated by dotenv.config() before
// the connection options are read.
// ---------------------------------------------------------------------------

let _client: ClickHouseClient | null = null;

export function getClickhouseClient(): ClickHouseClient {
  if (!_client) {
    _client = createClient({
      url: process.env.CLICKHOUSE_URL ?? 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USER ?? 'default',
      password: process.env.CLICKHOUSE_PASSWORD ?? '',
      // Do NOT set a default database here — every query uses
      // the fully-qualified `<company>.rb_content_olap` table name.
    });
  }
  return _client;
}

// Convenience re-export so existing code can still do:
//   import { clickhouse } from '../utils/db.js'
// via a getter-based proxy that resolves lazily.
export const clickhouse = new Proxy({} as ClickHouseClient, {
  get(_target, prop) {
    return (getClickhouseClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
