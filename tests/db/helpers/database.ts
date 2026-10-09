import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

export function openTestDatabase(): DatabaseSync {
  const databasePath = process.env.DATABASE_PATH || 'data/orchard.sqlite';
  return new DatabaseSync(resolve(process.cwd(), databasePath));
}
