# Database Backup & Recovery Strategy

## 📦 Overview

This document outlines the comprehensive backup and recovery strategy for the KiiltoLoisto Car Wash Booking System database.

## 🎯 Backup Objectives

- **RTO (Recovery Time Objective)**: 30 minutes
- **RPO (Recovery Point Objective)**: 1 hour
- **Backup Retention**: 30 days default
- **Encryption**: AES-256 for all backups
- **Verification**: Automated integrity checks

## 🏗️ Backup Architecture

### Storage Options
1. **Local** (Development): `./backups/` directory
2. **AWS S3** (Production): Encrypted bucket with versioning
3. **Azure Blob** (Alternative): Hot tier with lifecycle policies

### Backup Types
- **Automated Daily**: Full database backup at 2 AM UTC
- **Manual**: On-demand via admin dashboard or API
- **Pre-deployment**: Before major releases
- **Emergency**: During incident response

## ⚙️ Configuration

### Environment Variables

```bash
# Backup Configuration
BACKUP_ENCRYPTION_KEY=    # 32-byte hex key for AES-256
BACKUP_RETENTION_DAYS=30  # Days to retain backups
BACKUP_STORAGE_TYPE=s3    # local|s3|azure
ENABLE_AUTO_BACKUP=true   # Enable daily automated backups

# S3 Configuration (if using S3)
S3_BACKUP_BUCKET=         # S3 bucket name
AWS_ACCESS_KEY_ID=        # AWS access key
AWS_SECRET_ACCESS_KEY=    # AWS secret key
AWS_REGION=eu-north-1     # AWS region

# Azure Configuration (if using Azure)
AZURE_STORAGE_ACCOUNT=    # Storage account name
AZURE_STORAGE_KEY=        # Storage account key
AZURE_CONTAINER=          # Container name
```

### Generating Encryption Key

```bash
# Generate a secure encryption key
openssl rand -hex 32
```

## 🔄 Backup Process

### Automated Backup (GitHub Actions)

The CI/CD pipeline includes automated backups after successful deployments:

```yaml
- name: Run database backup
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    BACKUP_ENCRYPTION_KEY: ${{ secrets.BACKUP_ENCRYPTION_KEY }}
  run: |
    node -e "
      const { createBackup } = require('./src/lib/security/db-backup');
      createBackup().then(result => {
        console.log('Backup completed:', result.backupId);
      }).catch(console.error);
    "
```

### Manual Backup

#### Via API Endpoint
```bash
curl -X POST https://kiiltoloisto.fi/api/admin/backup \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

#### Via Admin Dashboard
1. Login to `/admin`
2. Navigate to "Database" section
3. Click "Create Backup"
4. Wait for completion notification

#### Via Command Line
```bash
npm run backup:create
```

### Backup Contents

Each backup includes:
- **Service** table (car wash services and pricing)
- **Booking** table (customer bookings and status)
- **User** table (customer and admin accounts)
- **Testimonial** table (customer reviews)
- **Setting** table (application configuration)
- **TimeSlot** table (availability schedule)
- **BusinessHours** table (operating hours)
- **Holiday** table (closed dates)
- **EmailNotification** table (notification history)

### Backup Metadata

Each backup generates metadata:
```json
{
  "id": "backup-1642684800000-a1b2c3d4",
  "timestamp": "2022-01-20T10:00:00.000Z",
  "version": "1.0.0",
  "tables": ["Service", "Booking", "User", ...],
  "recordCount": 1234,
  "checksum": "sha256hash",
  "encrypted": true,
  "compressed": false
}
```

## 🔧 Recovery Procedures

### Full Database Restore

1. **Identify Backup**
   ```bash
   npm run backup:list
   ```

2. **Restore from Backup**
   ```bash
   npm run backup:restore -- --backup-id=backup-id-here
   ```

3. **Verify Integrity**
   ```bash
   npm run backup:verify -- --backup-id=backup-id-here
   ```

### Partial Table Restore

Restore specific tables only:
```bash
npm run backup:restore -- --backup-id=backup-id-here --tables=Booking,User
```

### Emergency Recovery Process

#### 1. Database Corruption
```bash
# Step 1: Stop application
pm2 stop car-wash-booking

# Step 2: Create emergency backup of current state
pg_dump $DATABASE_URL > emergency_backup.sql

# Step 3: Restore from latest good backup
npm run backup:restore -- --backup-id=latest

# Step 4: Verify data integrity
npm run backup:verify

# Step 5: Restart application
pm2 start car-wash-booking
```

#### 2. Data Loss
```bash
# Step 1: Identify the last known good state
npm run backup:list

# Step 2: Restore to point-in-time
npm run backup:restore -- --backup-id=backup-before-incident

# Step 3: Manually recover any recent data from logs
grep "booking_created" /var/log/car-wash.log | tail -100
```

## 📊 Monitoring & Alerting

### Backup Success Monitoring

Automatic notifications are sent to monitoring webhook:
```json
{
  "type": "backup_event",
  "event": "backup_created",
  "backupId": "backup-1642684800000-a1b2c3d4",
  "tables": ["Service", "Booking", "User"],
  "recordCount": 1234,
  "timestamp": "2022-01-20T10:00:00.000Z"
}
```

### Backup Failure Alerts

Failed backups trigger immediate alerts:
```json
{
  "type": "backup_failure",
  "error": "Connection timeout",
  "timestamp": "2022-01-20T10:00:00.000Z"
}
```

### Metrics to Monitor

1. **Backup Success Rate**: Target >99%
2. **Backup Duration**: Baseline <5 minutes
3. **Backup Size Growth**: Monitor for anomalies
4. **Storage Usage**: Alert at 80% capacity
5. **Recovery Time**: Test quarterly

## 🧪 Backup Testing

### Monthly Verification
- Automated integrity checks via checksum validation
- Random backup restore to test environment
- Data consistency verification

### Quarterly DR Drill
1. **Scenario**: Simulate complete data loss
2. **Process**: Full recovery from backup
3. **Validation**: Application functionality test
4. **Documentation**: Update procedures based on findings

### Test Commands
```bash
# Test backup creation
npm run backup:test:create

# Test backup restoration
npm run backup:test:restore

# Test backup integrity
npm run backup:test:verify
```

## 📁 File Locations

### Local Development
```
./backups/
├── backup-{timestamp}-{hash}.backup     # Encrypted backup files
└── metadata/
    └── backup-{timestamp}-{hash}.json   # Backup metadata
```

### Production (S3)
```
s3://car-wash-backups/
├── backups/
│   └── backup-{timestamp}-{hash}.backup
└── metadata/
    └── backup-{timestamp}-{hash}.json
```

## 🔐 Security Considerations

### Encryption
- **Algorithm**: AES-256-CBC
- **Key Management**: Environment variables only
- **IV Generation**: Random 16-byte IV per backup
- **Key Rotation**: Quarterly for production

### Access Control
- **S3 Bucket**: Private with IAM role access only
- **Encryption Keys**: Never logged or exposed
- **Backup Files**: No public access
- **Admin Access**: MFA required for restore operations

## 🚨 Compliance

### Data Protection
- **GDPR**: Backups include personal data handling
- **Retention**: Automatic cleanup after retention period
- **Right to Deletion**: Backup cleanup when user deleted
- **Cross-border**: EU region for EU customers

### Audit Trail
- All backup/restore operations logged
- Timestamp and user identification
- Reason codes for manual operations
- Quarterly audit reports

## 📋 Backup Checklist

### Daily (Automated)
- [ ] Verify backup completion notification
- [ ] Check backup file size consistency
- [ ] Monitor storage usage

### Weekly
- [ ] Review backup logs for errors
- [ ] Verify backup metadata integrity
- [ ] Check retention policy compliance

### Monthly
- [ ] Perform test restore in staging
- [ ] Review backup storage costs
- [ ] Update backup documentation

### Quarterly
- [ ] Full disaster recovery drill
- [ ] Review and update retention policies
- [ ] Audit backup access permissions
- [ ] Update encryption keys

## 📞 Emergency Contacts

### Internal
- **Database Team**: db-admin@kiiltoloisto.fi
- **DevOps Lead**: devops@kiiltoloisto.fi
- **Emergency Hotline**: +358-xxx-xxx-xxxx

### External
- **AWS Support**: Enterprise support case
- **PostgreSQL Expert**: On retainer
- **Security Team**: Incident response team

## 📚 References

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [AWS RDS Backup Guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.BackupRestore.html)
- [Database Backup Best Practices](https://www.postgresql.org/docs/current/backup-dump.html)

---

*Last Updated: January 2025*
*Version: 1.0.0*