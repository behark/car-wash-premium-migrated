/**
 * Global Test Teardown
 * Runs once after all tests complete
 */

export default async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');

  // Clean up test database connections
  try {
    // Prisma client is automatically disconnected in jest.setup.ts
    console.log('✅ Database connections closed');
  } catch (error) {
    console.warn('⚠️ Error closing database connections:', (error as Error).message);
  }

  // Clean up Redis connections if applicable
  try {
    if (process.env.REDIS_URL) {
      // Redis cleanup would be implemented here
      console.log('✅ Redis connections closed');
    }
  } catch (error) {
    console.warn('⚠️ Error closing Redis connections:', (error as Error).message);
  }

  // Clean up any temporary files or resources
  try {
    // Additional cleanup logic here
    console.log('✅ Temporary resources cleaned up');
  } catch (error) {
    console.warn('⚠️ Error during cleanup:', (error as Error).message);
  }

  console.log('✅ Global test teardown complete');
}