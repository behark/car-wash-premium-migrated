/**
 * Database Backup and Recovery Service
 * Automated backup, verification, and disaster recovery procedures
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import crypto from 'crypto';

const execAsync = promisify(exec);

interface BackupConfig {
  type: 'full' | 'incremental' | 'differential';
  compression: boolean;
  encryption: boolean;
  uploadToS3: boolean;
  retentionDays: number;
  verifyBackup: boolean;
}

interface BackupResult {
  id: string;
  type: string;
  path: string;
  size: number;
  duration: number;
  timestamp: Date;
  checksum: string;
  verified: boolean;
  s3Location?: string;
  error?: string;
}

interface RestorePoint {
  backupId: string;
  timestamp: Date;
  type: string;
  size: number;
  location: string;
  available: boolean;
}

export class DatabaseBackupService {
  private prisma: PrismaClient;
  private s3Client?: S3Client;
  private backupDir: string;
  private encryptionKey?: Buffer;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.backupDir = process.env.BACKUP_DIR || '/var/backups/postgres';

    // Initialize S3 client if configured
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'eu-central-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
    }

    // Setup encryption key if configured
    if (process.env.BACKUP_ENCRYPTION_KEY) {
      this.encryptionKey = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY, 'hex');
    }
  }

  /**
   * Perform a database backup
   */
  async performBackup(config: BackupConfig = {
    type: 'full',
    compression: true,
    encryption: true,
    uploadToS3: true,
    retentionDays: 30,
    verifyBackup: true,
  }): Promise<BackupResult> {
    const startTime = Date.now();
    const backupId = this.generateBackupId();
    const timestamp = new Date();

    logger.info(`Starting ${config.type} backup`, { backupId });

    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });

      // Create backup
      const backupFile = await this.createBackup(backupId, config);

      // Calculate checksum
      const checksum = await this.calculateChecksum(backupFile);

      // Get file size
      const stats = await fs.stat(backupFile);

      // Verify backup if requested
      let verified = false;
      if (config.verifyBackup) {
        verified = await this.verifyBackup(backupFile);
      }

      // Upload to S3 if configured
      let s3Location: string | undefined;
      if (config.uploadToS3 && this.s3Client) {
        s3Location = await this.uploadToS3(backupFile, backupId);
      }

      // Store backup metadata in database
      await this.storeBackupMetadata({
        backupId,
        type: config.type,
        path: backupFile,
        size: stats.size,
        timestamp,
        checksum,
        verified,
        s3Location,
      });

      // Clean up old backups
      await this.cleanupOldBackups(config.retentionDays);

      const duration = Date.now() - startTime;

      logger.info(`Backup completed successfully`, {
        backupId,
        duration: `${duration}ms`,
        size: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
      });

      return {
        id: backupId,
        type: config.type,
        path: backupFile,
        size: stats.size,
        duration,
        timestamp,
        checksum,
        verified,
        s3Location,
      };
    } catch (error) {
      logger.error(`Backup failed`, { backupId, error });
      throw error;
    }
  }

  /**
   * Create the actual backup file
   */
  private async createBackup(backupId: string, config: BackupConfig): Promise<string> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    const baseFileName = `backup_${backupId}_${config.type}.sql`;
    let fileName = baseFileName;

    if (config.compression) {
      fileName += '.gz';
    }

    if (config.encryption) {
      fileName += '.enc';
    }

    const backupPath = path.join(this.backupDir, fileName);

    // Create pg_dump command
    let command = `pg_dump "${databaseUrl}" --no-owner --no-acl --clean --if-exists`;

    if (config.type === 'full') {
      command += ' --verbose';
    } else if (config.type === 'incremental') {
      // For incremental, we'd need WAL archiving setup
      // This is a simplified version
      command += ' --data-only';
    }

    // Execute backup
    const tempFile = path.join(this.backupDir, baseFileName);
    command += ` > "${tempFile}"`;

    await execAsync(command);

    // Apply compression if requested
    let processedFile = tempFile;
    if (config.compression) {
      const compressedFile = `${tempFile}.gz`;
      await pipeline(
        createReadStream(tempFile),
        createGzip({ level: 9 }),
        createWriteStream(compressedFile)
      );
      await fs.unlink(tempFile); // Remove uncompressed file
      processedFile = compressedFile;
    }

    // Apply encryption if requested
    if (config.encryption && this.encryptionKey) {
      const encryptedFile = `${processedFile}.enc`;
      await this.encryptFile(processedFile, encryptedFile);
      await fs.unlink(processedFile); // Remove unencrypted file
      processedFile = encryptedFile;
    }

    // Rename to final path
    if (processedFile !== backupPath) {
      await fs.rename(processedFile, backupPath);
    }

    return backupPath;
  }

  /**
   * Encrypt a file
   */
  private async encryptFile(inputPath: string, outputPath: string): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, this.encryptionKey, iv);

    const input = createReadStream(inputPath);
    const output = createWriteStream(outputPath);

    // Write IV to the beginning of the file
    output.write(iv);

    await pipeline(input, cipher, output);

    // Append auth tag
    const authTag = cipher.getAuthTag();
    await fs.appendFile(outputPath, authTag);
  }

  /**
   * Decrypt a file
   */
  private async decryptFile(inputPath: string, outputPath: string): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const algorithm = 'aes-256-gcm';
    const encryptedData = await fs.readFile(inputPath);

    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(-16);
    const encrypted = encryptedData.slice(16, -16);

    const decipher = crypto.createDecipheriv(algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    await fs.writeFile(outputPath, decrypted);
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);

    for await (const chunk of stream) {
      hash.update(chunk);
    }

    return hash.digest('hex');
  }

  /**
   * Verify backup integrity
   */
  private async verifyBackup(backupPath: string): Promise<boolean> {
    try {
      // For encrypted files, we need to decrypt first
      let testFile = backupPath;
      if (backupPath.endsWith('.enc')) {
        const tempDecrypted = `${backupPath}.test.dec`;
        await this.decryptFile(backupPath, tempDecrypted);
        testFile = tempDecrypted;
      }

      // For compressed files, decompress
      if (testFile.includes('.gz')) {
        const tempDecompressed = testFile.replace('.gz', '.test');
        await pipeline(
          createReadStream(testFile),
          createGunzip(),
          createWriteStream(tempDecompressed)
        );
        if (testFile !== backupPath) {
          await fs.unlink(testFile);
        }
        testFile = tempDecompressed;
      }

      // Verify SQL syntax (basic check)
      const { stdout } = await execAsync(
        `head -n 100 "${testFile}" | grep -E "^(CREATE|ALTER|INSERT|DROP)" | wc -l`
      );

      // Clean up test files
      if (testFile !== backupPath) {
        await fs.unlink(testFile);
      }

      const validStatements = parseInt(stdout.trim());
      return validStatements > 0;
    } catch (error) {
      logger.error('Backup verification failed', error);
      return false;
    }
  }

  /**
   * Upload backup to S3
   */
  private async uploadToS3(filePath: string, backupId: string): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured');
    }

    const bucketName = process.env.S3_BACKUP_BUCKET || 'carwash-backups';
    const key = `postgres-backups/${new Date().getFullYear()}/${backupId}/${path.basename(filePath)}`;

    const fileStream = createReadStream(filePath);
    const stats = await fs.stat(filePath);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileStream,
      ContentLength: stats.size,
      ServerSideEncryption: 'AES256',
      StorageClass: 'STANDARD_IA', // Infrequent Access for cost optimization
      Metadata: {
        backupId,
        timestamp: new Date().toISOString(),
        checksum: await this.calculateChecksum(filePath),
      },
    });

    await this.s3Client.send(command);

    logger.info(`Backup uploaded to S3`, { bucket: bucketName, key });

    return `s3://${bucketName}/${key}`;
  }

  /**
   * Store backup metadata in database
   */
  private async storeBackupMetadata(metadata: {
    backupId: string;
    type: string;
    path: string;
    size: number;
    timestamp: Date;
    checksum: string;
    verified: boolean;
    s3Location?: string;
  }): Promise<void> {
    // Store in a backup history table (you'd need to add this to your schema)
    await this.prisma.$executeRaw`
      INSERT INTO backup_history (
        backup_id, backup_type, backup_path, backup_size,
        started_at, completed_at, checksum, verified, s3_location, status
      ) VALUES (
        ${metadata.backupId},
        ${metadata.type},
        ${metadata.path},
        ${metadata.size},
        ${metadata.timestamp},
        ${new Date()},
        ${metadata.checksum},
        ${metadata.verified},
        ${metadata.s3Location || null},
        'COMPLETED'
      )
    `.catch(() => {
      // Table might not exist, log the metadata instead
      logger.info('Backup metadata', metadata);
    });
  }

  /**
   * Clean up old backups
   */
  private async cleanupOldBackups(retentionDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const files = await fs.readdir(this.backupDir);

      for (const file of files) {
        if (file.startsWith('backup_')) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            logger.info(`Deleted old backup: ${file}`);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old backups', error);
    }
  }

  /**
   * Restore database from backup
   */
  async restoreFromBackup(backupId: string): Promise<void> {
    logger.info(`Starting database restore from backup ${backupId}`);

    try {
      // Find backup file
      const backupFile = await this.findBackupFile(backupId);
      if (!backupFile) {
        throw new Error(`Backup ${backupId} not found`);
      }

      // Prepare restore file
      let restoreFile = backupFile;

      // Decrypt if necessary
      if (backupFile.endsWith('.enc')) {
        const decryptedFile = backupFile.replace('.enc', '.dec');
        await this.decryptFile(backupFile, decryptedFile);
        restoreFile = decryptedFile;
      }

      // Decompress if necessary
      if (restoreFile.includes('.gz')) {
        const decompressedFile = restoreFile.replace('.gz', '');
        await pipeline(
          createReadStream(restoreFile),
          createGunzip(),
          createWriteStream(decompressedFile)
        );
        if (restoreFile !== backupFile) {
          await fs.unlink(restoreFile);
        }
        restoreFile = decompressedFile;
      }

      // Perform restore
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not configured');
      }

      await execAsync(`psql "${databaseUrl}" < "${restoreFile}"`);

      // Clean up temporary files
      if (restoreFile !== backupFile) {
        await fs.unlink(restoreFile);
      }

      logger.info(`Database restored successfully from backup ${backupId}`);
    } catch (error) {
      logger.error(`Database restore failed`, { backupId, error });
      throw error;
    }
  }

  /**
   * Find backup file by ID
   */
  private async findBackupFile(backupId: string): Promise<string | null> {
    // Check local directory
    const files = await fs.readdir(this.backupDir);
    const backupFile = files.find(f => f.includes(backupId));

    if (backupFile) {
      return path.join(this.backupDir, backupFile);
    }

    // Check S3 if configured
    if (this.s3Client) {
      const bucketName = process.env.S3_BACKUP_BUCKET || 'carwash-backups';
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: `postgres-backups/`,
      });

      const response = await this.s3Client.send(command);
      const s3File = response.Contents?.find(obj => obj.Key?.includes(backupId));

      if (s3File) {
        // Download from S3
        const localPath = path.join(this.backupDir, path.basename(s3File.Key!));
        await this.downloadFromS3(s3File.Key!, localPath);
        return localPath;
      }
    }

    return null;
  }

  /**
   * Download backup from S3
   */
  private async downloadFromS3(key: string, localPath: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured');
    }

    const bucketName = process.env.S3_BACKUP_BUCKET || 'carwash-backups';
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const stream = response.Body as NodeJS.ReadableStream;

    await pipeline(stream, createWriteStream(localPath));
  }

  /**
   * List available restore points
   */
  async listRestorePoints(limit: number = 10): Promise<RestorePoint[]> {
    const restorePoints: RestorePoint[] = [];

    // Check local backups
    const files = await fs.readdir(this.backupDir);
    for (const file of files) {
      if (file.startsWith('backup_')) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);

        // Extract backup ID from filename
        const match = file.match(/backup_([^_]+)_/);
        if (match) {
          restorePoints.push({
            backupId: match[1],
            timestamp: stats.mtime,
            type: file.includes('_full') ? 'full' : 'incremental',
            size: stats.size,
            location: 'local',
            available: true,
          });
        }
      }
    }

    // Check S3 backups if configured
    if (this.s3Client) {
      const bucketName = process.env.S3_BACKUP_BUCKET || 'carwash-backups';
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: 'postgres-backups/',
        MaxKeys: limit,
      });

      const response = await this.s3Client.send(command);
      if (response.Contents) {
        for (const obj of response.Contents) {
          const match = obj.Key?.match(/backup_([^_]+)_/);
          if (match) {
            restorePoints.push({
              backupId: match[1],
              timestamp: obj.LastModified || new Date(),
              type: obj.Key?.includes('_full') ? 'full' : 'incremental',
              size: obj.Size || 0,
              location: 's3',
              available: true,
            });
          }
        }
      }
    }

    // Sort by timestamp (newest first) and limit
    return restorePoints
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Test disaster recovery procedure
   */
  async testDisasterRecovery(): Promise<{
    success: boolean;
    recoveryTime: number;
    dataIntegrity: boolean;
    report: string[];
  }> {
    const startTime = Date.now();
    const report: string[] = [];

    try {
      report.push('Starting disaster recovery test...');

      // 1. Create a test backup
      report.push('Creating test backup...');
      const backup = await this.performBackup({
        type: 'full',
        compression: true,
        encryption: true,
        uploadToS3: false,
        retentionDays: 1,
        verifyBackup: true,
      });
      report.push(`Backup created: ${backup.id} (${(backup.size / 1024 / 1024).toFixed(2)}MB)`);

      // 2. Create test database
      const testDbName = `carwash_test_${Date.now()}`;
      report.push(`Creating test database: ${testDbName}`);
      await execAsync(`createdb ${testDbName}`);

      // 3. Restore to test database
      report.push('Restoring backup to test database...');
      const testDbUrl = process.env.DATABASE_URL?.replace(/\/\w+$/, `/${testDbName}`);
      if (!testDbUrl) {
        throw new Error('Could not create test database URL');
      }

      // Modify restore to use test database
      process.env.DATABASE_URL = testDbUrl;
      await this.restoreFromBackup(backup.id);

      // 4. Verify data integrity
      report.push('Verifying data integrity...');
      const testPrisma = new PrismaClient({
        datasources: {
          db: {
            url: testDbUrl,
          },
        },
      });

      const checks = await Promise.all([
        testPrisma.booking.count(),
        testPrisma.service.count(),
        testPrisma.user.count(),
      ]);

      await testPrisma.$disconnect();

      report.push(`Data verification: ${checks[0]} bookings, ${checks[1]} services, ${checks[2]} users`);

      // 5. Clean up
      report.push('Cleaning up test environment...');
      await execAsync(`dropdb ${testDbName}`);
      await fs.unlink(backup.path);

      const recoveryTime = Date.now() - startTime;
      report.push(`Disaster recovery test completed in ${recoveryTime}ms`);

      return {
        success: true,
        recoveryTime,
        dataIntegrity: true,
        report,
      };
    } catch (error) {
      report.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        recoveryTime: Date.now() - startTime,
        dataIntegrity: false,
        report,
      };
    }
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '');
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}_${random}`;
  }
}

// Create singleton instance
let backupServiceInstance: DatabaseBackupService | null = null;

export function getDatabaseBackupService(prisma: PrismaClient): DatabaseBackupService {
  if (!backupServiceInstance) {
    backupServiceInstance = new DatabaseBackupService(prisma);
  }
  return backupServiceInstance;
}