import 'server-only';
import ws from 'ws';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL or DATABASE_URL_POOLED environment variable is not defined.');
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
