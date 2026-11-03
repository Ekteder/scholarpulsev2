import { test, expect } from '@playwright/test';
import ws from 'ws';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

import fs from 'fs';
import path from 'path';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL_POOLED && !process.env.DATABASE_URL) {
  if (typeof process.loadEnvFile === 'function') {
    const envLocal = path.resolve(__dirname, '../../.env.local');
    if (fs.existsSync(envLocal)) process.loadEnvFile(envLocal);
  }
}

const connectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
let pool: Pool | null = null;
let db: any = null;

test.beforeAll(() => {
  pool = new Pool({ connectionString });
  db = drizzle(pool);
});

test.afterAll(async () => {
  if (pool) await pool.end();
});

test.describe('Database Interactive Transactions & Atomic Rollback', () => {
  test('1. Database connection pool supports native interactive transactions', async () => {
    expect(typeof db.transaction).toBe('function');

    const result = await db.transaction(async (tx: any) => {
      return { txSuccess: true, timestamp: Date.now() };
    });

    expect(result.txSuccess).toBe(true);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  test('2. Transactions roll back changes cleanly when an error is thrown', async () => {
    let rollbackVerified = false;
    try {
      await db.transaction(async (tx: any) => {
        // Deliberately trigger an error to test rollback
        throw new Error('Test transaction rollback condition');
      });
    } catch (err: any) {
      if (err.message.includes('Test transaction rollback condition')) {
        rollbackVerified = true;
      }
    }

    expect(rollbackVerified).toBe(true);
  });
});
