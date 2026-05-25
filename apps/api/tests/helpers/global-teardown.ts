import { disconnectTestPrisma } from './db';

export default async function globalTeardown() {
  await disconnectTestPrisma();
}
