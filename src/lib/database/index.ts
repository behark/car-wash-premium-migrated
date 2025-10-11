/**
 * Database Module Exports
 * Enterprise database functionality access
 */

// Connection pool
export {
  DatabaseConnectionPool,
  getConnectionPool,
  executeWithPool,
  executeTransaction,
  executeReadOnly,
  type ConnectionPoolConfig,
  type PoolMetrics,
} from './connection-pool';

// Transaction management
export {
  TransactionManager,
  transactionManager,
  createBookingSaga,
  type TransactionStep,
  type SagaDefinition,
  type TransactionResult,
  type TransactionContext,
} from './transaction-manager';

// Query monitoring
export {
  QueryMonitor,
  queryMonitor,
  createMonitoredPrismaClient,
  type QueryMetrics,
  type QueryAnalysis,
  type SlowQueryAlert,
} from './query-monitor';

// Index analysis
export {
  IndexAnalyzer,
  indexAnalyzer,
  type IndexInfo,
  type IndexSuggestion,
  type IndexAnalysisResult,
} from './index-analyzer';

// Enhanced database operations
export {
  executeDbOperation,
  executeDbTransaction,
  executeDbRead,
  getDbMetrics,
  isDbHealthy,
  getDbConnectionPool,
} from '../prisma';