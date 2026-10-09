import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Every `npm test` starts with its own disposable database, so repeated runs are deterministic
// and never mutate the database used by `npm start` at http://127.0.0.1:3000.
process.env.PORT = '3100';
process.env.DATABASE_PATH = resolve(process.env.DATABASE_PATH || 'orchard-test.sqlite');
process.env.QA_MODE = 'true';
const databasePath = process.env.DATABASE_PATH;
mkdirSync(dirname(databasePath), { recursive: true });
for (const file of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
  if (existsSync(file)) rmSync(file, { force: true });
}
await import('../src/server.ts');
