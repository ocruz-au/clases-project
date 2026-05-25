import { execSync } from 'child_process';
import * as path from 'path';

export default async function globalSetup() {
  const dbUrl = process.env['DATABASE_URL_TEST'];
  if (!dbUrl) {
    throw new Error('DATABASE_URL_TEST environment variable is required for integration tests');
  }
  process.env['DATABASE_URL'] = dbUrl;

  const dbPackage = path.resolve(__dirname, '../../../../packages/db');
  execSync('npx prisma migrate deploy', {
    cwd: dbPackage,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'pipe',
  });
}
