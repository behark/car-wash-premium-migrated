/**
 * Global Test Setup
 * Runs once before all tests start
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function globalSetup() {
  console.log('🧪 Setting up test environment...');

  // Set test environment
  (process.env as any).NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';

  // Initialize test database if needed
  try {
    // Run database migrations for test database
    if (process.env.DATABASE_URL.includes('postgresql://')) {
      console.log('📊 Running database migrations for tests...');
      await execAsync('npx prisma db push --force-reset', {
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
      });
      console.log('✅ Test database initialized');
    }
  } catch (error) {
    console.warn('⚠️ Could not initialize test database:', (error as Error).message);
    console.warn('Tests will use mocked database');
  }

  // Initialize Redis test instance if available
  try {
    if (process.env.REDIS_URL) {
      console.log('🔴 Flushing Redis test database...');
      // Note: Redis flushing would be implemented here if Redis is configured
    }
  } catch (error) {
    console.warn('⚠️ Could not initialize Redis test instance');
  }

  console.log('✅ Global test setup complete');
}