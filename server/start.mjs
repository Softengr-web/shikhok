import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { existsSync } from 'node:fs';
import { Console } from 'node:console';
import dotenv from 'dotenv';

const logger = new Console({ stdout: process.stdout, stderr: process.stderr });
const storageEnvFile = process.env.MCQ_STORAGE_ENV_FILE || '/etc/secrets/mcq-storage.env';
if (existsSync(storageEnvFile)) dotenv.config({ path: storageEnvFile, override: false });

if (process.env.DATABASE_URL) {
  const migrate = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit', env: process.env });
  if (migrate.error) throw migrate.error;
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);
} else if (process.env.NODE_ENV === 'production') {
  logger.warn('DATABASE_URL is not configured; MCQ question-bank routes will return 503 until Postgres is connected.');
}

await import('../dist/server/index.js');
