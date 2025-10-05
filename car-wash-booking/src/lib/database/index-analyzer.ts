/**
 * Database Index Analyzer
 * Enterprise-grade index optimization and management
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';
import { executeDbRead } from '../prisma';

export interface IndexInfo {
  tableName: string;
  indexName: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  size: number;
  usage: {
    scans: number;
    tuples: number;
    lastUsed?: Date;
  };
}

export interface IndexSuggestion {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'partial';
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: string;
  sqlStatement: string;
  considerations?: string[];
}

export interface IndexAnalysisResult {
  currentIndexes: IndexInfo[];
  suggestions: IndexSuggestion[];
  unusedIndexes: IndexInfo[];
  duplicateIndexes: Array<{
    indexes: IndexInfo[];
    reason: string;
  }>;
  summary: {
    totalIndexes: number;
    totalSize: number;
    unusedCount: number;
    duplicateCount: number;
    suggestionCount: number;
  };
}

/**
 * Database index analyzer for optimization
 */
export class IndexAnalyzer {
  private static instance: IndexAnalyzer;

  static getInstance(): IndexAnalyzer {
    if (!IndexAnalyzer.instance) {
      IndexAnalyzer.instance = new IndexAnalyzer();
    }
    return IndexAnalyzer.instance;
  }

  /**
   * Analyze all database indexes
   */
  async analyzeIndexes(): Promise<IndexAnalysisResult> {
    try {
      const currentIndexes = await this.getCurrentIndexes();
      const suggestions = await this.generateIndexSuggestions();
      const unusedIndexes = await this.findUnusedIndexes(currentIndexes);
      const duplicateIndexes = this.findDuplicateIndexes(currentIndexes);

      const summary = {
        totalIndexes: currentIndexes.length,
        totalSize: currentIndexes.reduce((sum, idx) => sum + idx.size, 0),
        unusedCount: unusedIndexes.length,
        duplicateCount: duplicateIndexes.reduce((sum, dup) => sum + dup.indexes.length, 0),
        suggestionCount: suggestions.length,
      };

      return {
        currentIndexes,
        suggestions,
        unusedIndexes,
        duplicateIndexes,
        summary,
      };
    } catch (error) {
      logger.error('Index analysis failed', error);
      throw error;
    }
  }

  /**
   * Generate index creation suggestions based on query patterns
   */
  async generateIndexSuggestions(): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];

    // Analyze Prisma schema for missing indexes
    const schemaSuggestions = await this.analyzeSchemaIndexes();
    suggestions.push(...schemaSuggestions);

    // Analyze query patterns for dynamic suggestions
    const queryPatternSuggestions = await this.analyzeQueryPatterns();
    suggestions.push(...queryPatternSuggestions);

    return suggestions.sort((a, b) => {
      const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });
  }

  /**
   * Check if specific index exists
   */
  async indexExists(tableName: string, columns: string[]): Promise<boolean> {
    try {
      const indexes = await this.getCurrentIndexes();
      return indexes.some(
        idx => idx.tableName === tableName &&
               this.arraysEqual(idx.columns, columns)
      );
    } catch (error) {
      logger.error('Failed to check index existence', { error, tableName, columns });
      return false;
    }
  }

  /**
   * Get index usage statistics
   */
  async getIndexUsageStats(): Promise<Array<{
    table: string;
    index: string;
    scans: number;
    tuples: number;
    efficiency: number;
  }>> {
    return executeDbRead(
      async (client) => {
        try {
          // PostgreSQL-specific query for index usage stats
          const stats = await client.$queryRaw<Array<{
            schemaname: string;
            tablename: string;
            indexname: string;
            idx_scan: number;
            idx_tup_read: number;
            idx_tup_fetch: number;
          }>>`
            SELECT
              schemaname,
              tablename,
              indexname,
              idx_scan,
              idx_tup_read,
              idx_tup_fetch
            FROM pg_stat_user_indexes
            ORDER BY idx_scan DESC
          `;

          return stats.map(stat => ({
            table: stat.tablename,
            index: stat.indexname,
            scans: Number(stat.idx_scan),
            tuples: Number(stat.idx_tup_read),
            efficiency: Number(stat.idx_tup_read) > 0 ?
              Number(stat.idx_tup_fetch) / Number(stat.idx_tup_read) : 0,
          }));
        } catch (error) {
          logger.warn('Could not fetch index usage stats', { error });
          return [];
        }
      },
      'get_index_usage_stats'
    );
  }

  /**
   * Generate SQL statements for creating suggested indexes
   */
  generateIndexCreationSQL(suggestions: IndexSuggestion[]): string[] {
    return suggestions.map(suggestion => {
      const columnList = suggestion.columns.join(', ');
      const indexName = `idx_${suggestion.table}_${suggestion.columns.join('_')}`;

      let sql = `CREATE INDEX CONCURRENTLY ${indexName} ON "${suggestion.table}"`;

      if (suggestion.type === 'partial') {
        sql += ` (${columnList}) WHERE ${this.getPartialIndexCondition(suggestion.table)}`;
      } else {
        sql += ` (${columnList})`;
      }

      if (suggestion.type !== 'btree' && suggestion.type !== 'partial') {
        sql += ` USING ${suggestion.type.toUpperCase()}`;
      }

      sql += ';';

      return sql;
    });
  }

  /**
   * Validate proposed index before creation
   */
  async validateIndex(
    table: string,
    columns: string[],
    type: string = 'btree'
  ): Promise<{
    valid: boolean;
    issues: string[];
    estimatedSize: number;
    estimatedCreationTime: number;
  }> {
    const issues: string[] = [];
    let estimatedSize = 0;
    let estimatedCreationTime = 0;

    try {
      // Check if table exists
      const tableExists = await this.tableExists(table);
      if (!tableExists) {
        issues.push(`Table '${table}' does not exist`);
      }

      // Check if columns exist
      if (tableExists) {
        const existingColumns = await this.getTableColumns(table);
        const missingColumns = columns.filter(col => !existingColumns.includes(col));
        if (missingColumns.length > 0) {
          issues.push(`Columns do not exist: ${missingColumns.join(', ')}`);
        }
      }

      // Check for existing similar indexes
      const existingIndexes = await this.getCurrentIndexes();
      const similarIndex = existingIndexes.find(
        idx => idx.tableName === table &&
               this.hasOverlappingColumns(idx.columns, columns)
      );

      if (similarIndex) {
        issues.push(`Similar index already exists: ${similarIndex.indexName}`);
      }

      // Estimate index size and creation time
      if (issues.length === 0) {
        const tableStats = await this.getTableStats(table);
        estimatedSize = this.estimateIndexSize(tableStats.rowCount, columns.length);
        estimatedCreationTime = this.estimateCreationTime(tableStats.rowCount, columns.length);
      }

      return {
        valid: issues.length === 0,
        issues,
        estimatedSize,
        estimatedCreationTime,
      };
    } catch (error) {
      logger.error('Index validation failed', { error, table, columns });
      return {
        valid: false,
        issues: ['Validation failed due to database error'],
        estimatedSize: 0,
        estimatedCreationTime: 0,
      };
    }
  }

  // Private helper methods

  private async getCurrentIndexes(): Promise<IndexInfo[]> {
    return executeDbRead(
      async (client) => {
        try {
          // PostgreSQL-specific query to get index information
          const indexes = await client.$queryRaw<Array<{
            tablename: string;
            indexname: string;
            indexdef: string;
            indisunique: boolean;
            indisprimary: boolean;
          }>>`
            SELECT DISTINCT
              t.relname as tablename,
              i.relname as indexname,
              pg_get_indexdef(i.oid) as indexdef,
              ix.indisunique,
              ix.indisprimary
            FROM
              pg_class t,
              pg_class i,
              pg_index ix,
              pg_attribute a
            WHERE
              t.oid = ix.indrelid
              AND i.oid = ix.indexrelid
              AND a.attrelid = t.oid
              AND a.attnum = ANY(ix.indkey)
              AND t.relkind = 'r'
              AND t.relname NOT LIKE 'pg_%'
            ORDER BY t.relname, i.relname
          `;

          return indexes.map(idx => ({
            tableName: idx.tablename,
            indexName: idx.indexname,
            columns: this.extractColumnsFromIndexDef(idx.indexdef),
            isUnique: idx.indisunique,
            isPrimary: idx.indisprimary,
            size: 0, // Would need additional query to get actual size
            usage: {
              scans: 0,
              tuples: 0,
            },
          }));
        } catch (error) {
          logger.warn('Could not fetch current indexes', { error });
          return [];
        }
      },
      'get_current_indexes'
    );
  }

  private async analyzeSchemaIndexes(): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];

    // High-priority indexes for booking system
    const criticalIndexes = [
      {
        table: 'Booking',
        columns: ['date', 'startTime'],
        reason: 'Critical for availability checking and scheduling',
        priority: 'critical' as const,
      },
      {
        table: 'Booking',
        columns: ['customerEmail'],
        reason: 'Essential for customer lookup and booking history',
        priority: 'high' as const,
      },
      {
        table: 'Booking',
        columns: ['confirmationCode'],
        reason: 'Required for booking confirmation lookups',
        priority: 'critical' as const,
      },
      {
        table: 'Booking',
        columns: ['status'],
        reason: 'Important for filtering bookings by status',
        priority: 'high' as const,
      },
      {
        table: 'Service',
        columns: ['isActive'],
        reason: 'Required for filtering active services',
        priority: 'medium' as const,
      },
      {
        table: 'TimeSlot',
        columns: ['date', 'isAvailable'],
        reason: 'Essential for availability queries',
        priority: 'high' as const,
      },
    ];

    for (const indexConfig of criticalIndexes) {
      const exists = await this.indexExists(indexConfig.table, indexConfig.columns);

      if (!exists) {
        suggestions.push({
          ...indexConfig,
          type: 'btree',
          estimatedImpact: this.estimateSchemaIndexImpact(indexConfig.table, indexConfig.columns),
          sqlStatement: this.generateIndexSQL(indexConfig.table, indexConfig.columns),
        });
      }
    }

    return suggestions;
  }

  private async analyzeQueryPatterns(): Promise<IndexSuggestion[]> {
    // This would analyze actual query patterns from the query monitor
    // For now, return common optimization patterns

    return [
      {
        table: 'Booking',
        columns: ['serviceId', 'date'],
        type: 'btree',
        reason: 'Common pattern: filtering bookings by service and date',
        priority: 'medium',
        estimatedImpact: 'Could improve availability check performance by 60%',
        sqlStatement: this.generateIndexSQL('Booking', ['serviceId', 'date']),
      },
      {
        table: 'BookingStatusHistory',
        columns: ['bookingId', 'createdAt'],
        type: 'btree',
        reason: 'Optimize status history queries',
        priority: 'medium',
        estimatedImpact: 'Faster booking history retrieval',
        sqlStatement: this.generateIndexSQL('BookingStatusHistory', ['bookingId', 'createdAt']),
      },
    ];
  }

  private async findUnusedIndexes(currentIndexes: IndexInfo[]): Promise<IndexInfo[]> {
    const usageStats = await this.getIndexUsageStats();
    const usageMap = new Map(usageStats.map(stat => [`${stat.table}_${stat.index}`, stat]));

    return currentIndexes.filter(idx => {
      // Don't mark primary keys or unique constraints as unused
      if (idx.isPrimary || idx.isUnique) return false;

      const key = `${idx.tableName}_${idx.indexName}`;
      const usage = usageMap.get(key);

      // Consider unused if very few scans
      return !usage || usage.scans < 10;
    });
  }

  private findDuplicateIndexes(currentIndexes: IndexInfo[]): Array<{
    indexes: IndexInfo[];
    reason: string;
  }> {
    const duplicates: Array<{
      indexes: IndexInfo[];
      reason: string;
    }> = [];

    // Group indexes by table
    const indexesByTable = new Map<string, IndexInfo[]>();
    currentIndexes.forEach(idx => {
      if (!indexesByTable.has(idx.tableName)) {
        indexesByTable.set(idx.tableName, []);
      }
      indexesByTable.get(idx.tableName)!.push(idx);
    });

    // Find duplicates within each table
    for (const [table, indexes] of indexesByTable) {
      for (let i = 0; i < indexes.length; i++) {
        for (let j = i + 1; j < indexes.length; j++) {
          const idx1 = indexes[i];
          const idx2 = indexes[j];

          // Check for exact duplicates
          if (this.arraysEqual(idx1.columns, idx2.columns)) {
            duplicates.push({
              indexes: [idx1, idx2],
              reason: 'Exact duplicate - same columns in same order',
            });
          }

          // Check for redundant indexes (one is subset of another)
          if (this.isSubsetIndex(idx1.columns, idx2.columns)) {
            duplicates.push({
              indexes: [idx1, idx2],
              reason: `Index ${idx1.indexName} is redundant - covered by ${idx2.indexName}`,
            });
          }
        }
      }
    }

    return duplicates;
  }

  private async getIndexUsageStats(): Promise<Array<{
    table: string;
    index: string;
    scans: number;
    tuples: number;
  }>> {
    return executeDbRead(
      async (client) => {
        try {
          const stats = await client.$queryRaw<Array<{
            tablename: string;
            indexname: string;
            idx_scan: number;
            idx_tup_read: number;
          }>>`
            SELECT
              tablename,
              indexname,
              idx_scan,
              idx_tup_read
            FROM pg_stat_user_indexes
            ORDER BY tablename, indexname
          `;

          return stats.map(stat => ({
            table: stat.tablename,
            index: stat.indexname,
            scans: Number(stat.idx_scan),
            tuples: Number(stat.idx_tup_read),
          }));
        } catch (error) {
          logger.warn('Could not fetch index usage statistics', { error });
          return [];
        }
      },
      'get_index_usage_stats'
    );
  }

  private async tableExists(tableName: string): Promise<boolean> {
    return executeDbRead(
      async (client) => {
        try {
          const result = await client.$queryRaw<Array<{ exists: boolean }>>`
            SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_schema = 'public'
              AND table_name = ${tableName}
            ) as exists
          `;

          return result[0]?.exists || false;
        } catch (error) {
          logger.error('Failed to check table existence', { error, tableName });
          return false;
        }
      },
      'check_table_exists'
    );
  }

  private async getTableColumns(tableName: string): Promise<string[]> {
    return executeDbRead(
      async (client) => {
        try {
          const columns = await client.$queryRaw<Array<{ column_name: string }>>`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = ${tableName}
            ORDER BY ordinal_position
          `;

          return columns.map(col => col.column_name);
        } catch (error) {
          logger.error('Failed to get table columns', { error, tableName });
          return [];
        }
      },
      'get_table_columns'
    );
  }

  private async getTableStats(tableName: string): Promise<{
    rowCount: number;
    totalSize: number;
  }> {
    return executeDbRead(
      async (client) => {
        try {
          const stats = await client.$queryRaw<Array<{
            n_tup_ins: number;
            n_tup_upd: number;
            n_tup_del: number;
            n_live_tup: number;
          }>>`
            SELECT
              n_tup_ins,
              n_tup_upd,
              n_tup_del,
              n_live_tup
            FROM pg_stat_user_tables
            WHERE relname = ${tableName}
          `;

          const tableSize = await client.$queryRaw<Array<{ size: number }>>`
            SELECT pg_total_relation_size(${tableName}::regclass) as size
          `;

          return {
            rowCount: Number(stats[0]?.n_live_tup || 0),
            totalSize: Number(tableSize[0]?.size || 0),
          };
        } catch (error) {
          logger.error('Failed to get table stats', { error, tableName });
          return { rowCount: 0, totalSize: 0 };
        }
      },
      'get_table_stats'
    );
  }

  private extractColumnsFromIndexDef(indexDef: string): string[] {
    // Extract column names from PostgreSQL index definition
    const match = indexDef.match(/\(([^)]+)\)/);
    if (!match) return [];

    return match[1]
      .split(',')
      .map(col => col.trim().replace(/"/g, ''))
      .filter(col => col.length > 0);
  }

  private generateIndexSQL(table: string, columns: string[]): string {
    const indexName = `idx_${table.toLowerCase()}_${columns.join('_').toLowerCase()}`;
    const columnList = columns.map(col => `"${col}"`).join(', ');

    return `CREATE INDEX CONCURRENTLY "${indexName}" ON "${table}" (${columnList});`;
  }

  private getPartialIndexCondition(table: string): string {
    switch (table) {
      case 'Booking':
        return "status != 'CANCELLED' AND status != 'NO_SHOW'";
      case 'Service':
        return "isActive = true";
      case 'TimeSlot':
        return "isAvailable = true";
      default:
        return '';
    }
  }

  private estimateSchemaIndexImpact(table: string, columns: string[]): string {
    if (table === 'Booking' && columns.includes('date')) {
      return 'Critical impact - availability queries will be 10x faster';
    }
    if (table === 'Booking' && columns.includes('customerEmail')) {
      return 'High impact - customer lookups will be 5x faster';
    }
    if (columns.includes('status') || columns.includes('isActive')) {
      return 'Medium impact - filtered queries will be 3x faster';
    }

    return 'Low to medium impact - general query optimization';
  }

  private estimateIndexSize(rowCount: number, columnCount: number): number {
    // Rough estimation: 8 bytes per column + row overhead
    const bytesPerRow = (columnCount * 8) + 24; // 24 bytes overhead
    return rowCount * bytesPerRow;
  }

  private estimateCreationTime(rowCount: number, columnCount: number): number {
    // Rough estimation based on table size and complexity
    const baseTime = 1000; // 1 second base
    const rowFactor = Math.log(rowCount + 1) * 100;
    const columnFactor = columnCount * 200;

    return Math.round(baseTime + rowFactor + columnFactor);
  }

  private arraysEqual(arr1: string[], arr2: string[]): boolean {
    return arr1.length === arr2.length &&
           arr1.every((val, idx) => val === arr2[idx]);
  }

  private hasOverlappingColumns(existing: string[], proposed: string[]): boolean {
    // Check if proposed index is a subset or superset of existing
    return this.isSubsetIndex(proposed, existing) || this.isSubsetIndex(existing, proposed);
  }

  private isSubsetIndex(subset: string[], superset: string[]): boolean {
    if (subset.length >= superset.length) return false;

    // Check if subset appears at the beginning of superset
    return subset.every((col, idx) => superset[idx] === col);
  }
}

// Export singleton instance
export const indexAnalyzer = IndexAnalyzer.getInstance();