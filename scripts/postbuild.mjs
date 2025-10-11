import { execSync } from 'node:child_process';

const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

try {
  if (isPostgres) {
    console.log('Running Prisma migrate deploy for Postgres...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('Optionally seeding database...');
    execSync('node prisma/seed.mjs', { stdio: 'inherit' });
  } else {
    console.log('Skipping Prisma migrate deploy (non-Postgres DATABASE_URL).');
  }

  // Removed manual _redirects copying; Netlify Next.js runtime handles routing.

} catch (e) {
  console.error('Postbuild step failed:', e.message);
  process.exit(1);
}
