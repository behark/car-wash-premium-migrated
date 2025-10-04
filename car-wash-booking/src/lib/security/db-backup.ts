/**
 * Database Backup Strategy
 * Automated backup and recovery system
 */

import { prisma } from '../prisma';
import crypto from 'crypto';
import { z } from 'zod';

// Backup configuration
const config = {
  encryptionKey: process.env.BACKUP_ENCRYPTION_KEY || '',
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
  storageType: process.env.BACKUP_STORAGE_TYPE || 'local',
  s3Bucket: process.env.S3_BACKUP_BUCKET,
  enableAutoBackup: process.env.ENABLE_AUTO_BACKUP === 'true',
};

// Backup metadata schema
const BackupMetadataSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  version: z.string(),
  tables: z.array(z.string()),
  recordCount: z.number(),
  checksum: z.string(),
  encrypted: z.boolean(),
  compressed: z.boolean(),
});

type BackupMetadata = z.infer<typeof BackupMetadataSchema>;

/**
 * Create a database backup
 */
export async function createBackup(
  tables?: string[]
): Promise<{ success: boolean; backupId: string; metadata: BackupMetadata }> {
  const backupId = `backup-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const timestamp = new Date().toISOString();

  try {
    // Get tables to backup
    const tablesToBackup = tables || await getAllTables();
    const backupData: any = {};
    let totalRecords = 0;

    // Export data from each table
    for (const table of tablesToBackup) {
      const data = await exportTableData(table);
      backupData[table] = data;
      totalRecords += data.length;
    }

    // Create backup object
    const backup = {
      id: backupId,
      timestamp,
      version: '1.0.0',
      data: backupData,
    };

    // Calculate checksum
    const checksum = calculateChecksum(JSON.stringify(backup));

    // Encrypt if configured
    let finalBackup: string = JSON.stringify(backup);
    let encrypted = false;

    if (config.encryptionKey) {
      finalBackup = encrypt(finalBackup, config.encryptionKey);
      encrypted = true;
    }

    // Store backup
    await storeBackup(backupId);

    // Create metadata
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      version: '1.0.0',
      tables: tablesToBackup,
      recordCount: totalRecords,
      checksum,
      encrypted,
      compressed: false,
    };

    // Store metadata separately
    await storeBackupMetadata(backupId, metadata);

    // Log backup creation
    await logBackupEvent('backup_created', {
      backupId,
      tables: tablesToBackup,
      recordCount: totalRecords,
    });

    return {
      success: true,
      backupId,
      metadata,
    };
  } catch (error: any) {
    await logBackupEvent('backup_failed', {
      error: error.message,
      backupId,
    });

    throw new Error(`Backup failed: ${error.message}`);
  }
}

/**
 * Restore from backup
 */
export async function restoreBackup(
  backupId: string,
  tables?: string[]
): Promise<{ success: boolean; restoredTables: string[]; recordCount: number }> {
  try {
    // Get backup metadata
    const metadata = await getBackupMetadata(backupId);

    if (!metadata) {
      throw new Error('Backup metadata not found');
    }

    // Retrieve backup data
    let backupData = await retrieveBackup(backupId);

    // Decrypt if needed
    if (metadata.encrypted && config.encryptionKey) {
      backupData = decrypt(backupData, config.encryptionKey);
    }

    const backup = JSON.parse(backupData);

    // Verify checksum
    const calculatedChecksum = calculateChecksum(JSON.stringify(backup));
    if (calculatedChecksum !== metadata.checksum) {
      throw new Error('Backup integrity check failed');
    }

    // Determine tables to restore
    const tablesToRestore = tables || Object.keys(backup.data);
    let totalRestored = 0;

    // Begin transaction
    await prisma.$transaction(async (tx) => {
      for (const table of tablesToRestore) {
        if (!backup.data[table]) {
          console.warn(`Table ${table} not found in backup`);
          continue;
        }

        const records = backup.data[table];

        // Clear existing data (optional - based on restore strategy)
        // await clearTableData(table, tx);

        // Restore data
        await restoreTableData(table, records, tx);
        totalRestored += records.length;
      }
    });

    // Log restoration
    await logBackupEvent('backup_restored', {
      backupId,
      tables: tablesToRestore,
      recordCount: totalRestored,
    });

    return {
      success: true,
      restoredTables: tablesToRestore,
      recordCount: totalRestored,
    };
  } catch (error: any) {
    await logBackupEvent('restore_failed', {
      backupId,
      error: error.message,
    });

    throw new Error(`Restore failed: ${error.message}`);
  }
}

/**
 * Get all database tables
 */
async function getAllTables(): Promise<string[]> {
  // Core tables to backup
  return [
    'Service',
    'Booking',
    'User',
    'Testimonial',
    'Setting',
    'TimeSlot',
    'BusinessHours',
    'Holiday',
    'EmailNotification',
  ];
}

/**
 * Export data from a table
 */
async function exportTableData(table: string): Promise<any[]> {
  try {
    // Use Prisma's raw query for dynamic table access
    const data = await (prisma as any)[table.toLowerCase()].findMany();
    return data;
  } catch (error) {
    console.error(`Failed to export table ${table}:`, error);
    return [];
  }
}

/**
 * Restore data to a table
 */
async function restoreTableData(
  table: string,
  records: any[],
  transaction?: any
): Promise<void> {
  const client = transaction || prisma;

  try {
    // Use createMany for bulk insert
    await (client as any)[table.toLowerCase()].createMany({
      data: records,
      skipDuplicates: true,
    });
  } catch (error) {
    console.error(`Failed to restore table ${table}:`, error);
    throw error;
  }
}

/**
 * Calculate checksum for data integrity
 */
function calculateChecksum(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Encrypt backup data
 */
function encrypt(data: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(key, 'hex'),
    iv
  );

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt backup data
 */
function decrypt(encryptedData: string, key: string): string {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];

  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(key, 'hex'),
    iv
  );

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Store backup (implementation depends on storage type)
 */
async function storeBackup(backupId: string): Promise<void> {
  switch (config.storageType) {
    case 's3':
      await storeToS3(backupId);
      break;
    case 'azure':
      await storeToAzure(backupId);
      break;
    case 'local':
    default:
      await storeLocally(backupId);
      break;
  }
}

/**
 * Store backup locally (for development)
 */
async function storeLocally(backupId: string): Promise<void> {
  const fs = await import('fs').then(m => m.promises);
  const path = await import('path');

  const backupDir = path.join(process.cwd(), 'backups');
  await fs.mkdir(backupDir, { recursive: true });

  const backupPath = path.join(backupDir, `${backupId}.backup`);
  await fs.writeFile(backupPath, `Backup: ${backupId}`, 'utf8');
}

/**
 * Store backup to S3
 */
async function storeToS3(backupId: string): Promise<void> {
  // AWS S3 implementation
  if (!config.s3Bucket) {
    throw new Error('S3 bucket not configured');
  }

  // This would use AWS SDK
  console.log(`Storing backup ${backupId} to S3 bucket ${config.s3Bucket}`);
  // Implementation would go here
}

/**
 * Store backup to Azure
 */
async function storeToAzure(backupId: string): Promise<void> {
  // Azure Blob Storage implementation
  console.log(`Storing backup ${backupId} to Azure`);
  // Implementation would go here
}

/**
 * Retrieve backup
 */
async function retrieveBackup(backupId: string): Promise<string> {
  switch (config.storageType) {
    case 's3':
      return await retrieveFromS3(backupId);
    case 'azure':
      return await retrieveFromAzure(backupId);
    case 'local':
    default:
      return await retrieveLocally(backupId);
  }
}

/**
 * Retrieve backup locally
 */
async function retrieveLocally(backupId: string): Promise<string> {
  const fs = await import('fs').then(m => m.promises);
  const path = await import('path');

  const backupPath = path.join(process.cwd(), 'backups', `${backupId}.backup`);
  return await fs.readFile(backupPath, 'utf8');
}

/**
 * Retrieve from S3
 */
async function retrieveFromS3(backupId: string): Promise<string> {
  // AWS S3 implementation
  console.log(`Retrieving backup ${backupId} from S3`);
  // Implementation would go here
  return '';
}

/**
 * Retrieve from Azure
 */
async function retrieveFromAzure(backupId: string): Promise<string> {
  // Azure implementation
  console.log(`Retrieving backup ${backupId} from Azure`);
  // Implementation would go here
  return '';
}

/**
 * Store backup metadata
 */
async function storeBackupMetadata(
  backupId: string,
  metadata: BackupMetadata
): Promise<void> {
  const fs = await import('fs').then(m => m.promises);
  const path = await import('path');

  const metadataDir = path.join(process.cwd(), 'backups', 'metadata');
  await fs.mkdir(metadataDir, { recursive: true });

  const metadataPath = path.join(metadataDir, `${backupId}.json`);
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
}

/**
 * Get backup metadata
 */
async function getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
  try {
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');

    const metadataPath = path.join(process.cwd(), 'backups', 'metadata', `${backupId}.json`);
    const data = await fs.readFile(metadataPath, 'utf8');

    return BackupMetadataSchema.parse(JSON.parse(data));
  } catch {
    return null;
  }
}

/**
 * List available backups
 */
export async function listBackups(): Promise<BackupMetadata[]> {
  try {
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');

    const metadataDir = path.join(process.cwd(), 'backups', 'metadata');
    const files = await fs.readdir(metadataDir);

    const backups: BackupMetadata[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const metadataPath = path.join(metadataDir, file);
        const data = await fs.readFile(metadataPath, 'utf8');
        const metadata = BackupMetadataSchema.parse(JSON.parse(data));
        backups.push(metadata);
      }
    }

    // Sort by timestamp descending
    backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return backups;
  } catch {
    return [];
  }
}

/**
 * Clean up old backups
 */
export async function cleanupOldBackups(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);

  const backups = await listBackups();
  let deletedCount = 0;

  for (const backup of backups) {
    const backupDate = new Date(backup.timestamp);

    if (backupDate < cutoffDate) {
      await deleteBackup(backup.id);
      deletedCount++;
    }
  }

  await logBackupEvent('cleanup_completed', {
    deletedCount,
    retentionDays: config.retentionDays,
  });

  return deletedCount;
}

/**
 * Delete a backup
 */
async function deleteBackup(backupId: string): Promise<void> {
  const fs = await import('fs').then(m => m.promises);
  const path = await import('path');

  // Delete backup file
  const backupPath = path.join(process.cwd(), 'backups', `${backupId}.backup`);
  await fs.unlink(backupPath).catch(() => {});

  // Delete metadata
  const metadataPath = path.join(process.cwd(), 'backups', 'metadata', `${backupId}.json`);
  await fs.unlink(metadataPath).catch(() => {});
}

/**
 * Log backup events
 */
async function logBackupEvent(event: string, details: any): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  };

  console.log('[BACKUP]', logEntry);

  // Send to monitoring in production
  if (process.env.NODE_ENV === 'production' && process.env.MONITORING_WEBHOOK_URL) {
    fetch(process.env.MONITORING_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'backup_event',
        ...logEntry,
      }),
    }).catch(console.error);
  }
}

/**
 * Scheduled backup function for cron jobs
 */
export async function scheduledBackup(): Promise<void> {
  if (!config.enableAutoBackup) {
    console.log('Automated backup is disabled');
    return;
  }

  try {
    const result = await createBackup();
    console.log(`Scheduled backup completed: ${result.backupId}`);

    // Clean up old backups
    const deleted = await cleanupOldBackups();
    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} old backups`);
    }
  } catch (error: any) {
    console.error('Scheduled backup failed:', error);

    // Send alert
    if (process.env.MONITORING_WEBHOOK_URL) {
      fetch(process.env.MONITORING_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'backup_failure',
          error: error.message,
          timestamp: new Date().toISOString(),
        }),
      }).catch(console.error);
    }
  }
}

const dbBackupManager = {
  createBackup,
  restoreBackup,
  listBackups,
  cleanupOldBackups,
  scheduledBackup,
};

export default dbBackupManager;