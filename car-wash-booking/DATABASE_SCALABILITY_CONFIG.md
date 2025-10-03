# Database Scalability Configuration Guide

## Production Deployment Architecture

This guide provides configuration settings and implementation steps for scaling the car wash booking system database to handle high-traffic production workloads.

---

## 1. Connection Pooling Configuration

### Supabase Pooler Configuration (Recommended)

```bash
# .env.production
DATABASE_URL="postgresql://postgres.tamqwcfugkbnaqafbybb:[password]@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=100"

# Connection pool settings
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=50
DATABASE_POOL_IDLE_TIMEOUT=30000
DATABASE_POOL_CONNECTION_TIMEOUT=5000
DATABASE_POOL_ACQUIRE_TIMEOUT=30000
```

### PgBouncer Configuration (Self-hosted)

```ini
# pgbouncer.ini
[databases]
carwash = host=db.supabase.co port=5432 dbname=postgres

[pgbouncer]
listen_addr = *
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3
max_db_connections = 100
max_user_connections = 100
server_idle_timeout = 600
server_lifetime = 3600
server_connect_timeout = 15
query_wait_timeout = 120
client_idle_timeout = 0
client_login_timeout = 60
```

### Application-Level Pooling

```typescript
// prisma.config.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const createPrismaClient = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['query', 'info', 'warn', 'error'],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Connection pool management
export const connectionConfig = {
  connectionLimit: parseInt(process.env.DATABASE_POOL_MAX || '50'),
  connectionTimeoutMillis: parseInt(process.env.DATABASE_POOL_CONNECTION_TIMEOUT || '5000'),
  idleTimeoutMillis: parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT || '30000'),
  min: parseInt(process.env.DATABASE_POOL_MIN || '5'),
  max: parseInt(process.env.DATABASE_POOL_MAX || '50'),
};
```

---

## 2. Read Replica Setup

### Supabase Read Replicas

```bash
# Primary database (writes)
DATABASE_URL="postgresql://postgres.tamqwcfugkbnaqafbybb:[password]@aws-1-eu-central-1.pooler.supabase.com:6543/postgres"

# Read replica (reads)
DATABASE_READ_REPLICA_URL="postgresql://postgres.tamqwcfugkbnaqafbybb:[password]@aws-1-eu-central-1-read.pooler.supabase.com:6543/postgres"
```

### Database Router Implementation

```typescript
// database-router.ts
import { PrismaClient } from '@prisma/client';

export class DatabaseRouter {
  private writeDb: PrismaClient;
  private readDb: PrismaClient;
  private readPreference: 'primary' | 'replica' = 'replica';

  constructor() {
    this.writeDb = new PrismaClient({
      datasources: {
        db: { url: process.env.DATABASE_URL }
      }
    });

    this.readDb = new PrismaClient({
      datasources: {
        db: { url: process.env.DATABASE_READ_REPLICA_URL || process.env.DATABASE_URL }
      }
    });
  }

  // Automatically route based on operation
  async auto<T>(operation: () => Promise<T>, isWrite: boolean = false): Promise<T> {
    const db = isWrite ? this.writeDb : this.getReadDb();
    return operation.call(db);
  }

  // Get appropriate read database based on lag
  private getReadDb(): PrismaClient {
    // Check replication lag
    if (this.readPreference === 'primary') {
      return this.writeDb;
    }
    return this.readDb;
  }

  // Monitor replication lag
  async checkReplicationLag(): Promise<number> {
    try {
      const result = await this.readDb.$queryRaw<[{ lag: number }]>`
        SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) as lag
      `;

      const lagSeconds = result[0]?.lag || 0;

      // Switch to primary if lag is too high
      if (lagSeconds > 10) {
        this.readPreference = 'primary';
        setTimeout(() => {
          this.readPreference = 'replica';
        }, 60000); // Try replica again after 1 minute
      }

      return lagSeconds;
    } catch {
      return 0;
    }
  }
}
```

---

## 3. Redis Cache Configuration

### Redis Setup for Caching

```bash
# .env.production
REDIS_URL="redis://default:[password]@redis-cluster.amazonaws.com:6379"
REDIS_CLUSTER_NODES="redis-1.amazonaws.com:6379,redis-2.amazonaws.com:6379,redis-3.amazonaws.com:6379"
REDIS_PASSWORD="your-secure-password"
REDIS_TLS_ENABLED=true
```

### Redis Cluster Configuration

```typescript
// redis-cluster.ts
import Redis from 'ioredis';

const clusterNodes = process.env.REDIS_CLUSTER_NODES?.split(',').map(node => {
  const [host, port] = node.split(':');
  return { host, port: parseInt(port) };
}) || [];

export const redisCluster = new Redis.Cluster(clusterNodes, {
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS_ENABLED === 'true' ? {} : undefined,
  },
  clusterRetryStrategy: (times) => {
    const delay = Math.min(100 * 2 ** times, 2000);
    return delay;
  },
  enableOfflineQueue: true,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  retryDelayOnClusterDown: 300,
  slotsRefreshTimeout: 2000,
  slotsRefreshInterval: 5000,
});

// Cache wrapper with circuit breaker
export class CacheService {
  private failures = 0;
  private circuitOpen = false;
  private readonly maxFailures = 5;
  private readonly resetTimeout = 60000;

  async get<T>(key: string): Promise<T | null> {
    if (this.circuitOpen) return null;

    try {
      const data = await redisCluster.get(key);
      this.onSuccess();
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.onFailure();
      return null;
    }
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    if (this.circuitOpen) return;

    try {
      await redisCluster.setex(key, ttl, JSON.stringify(value));
      this.onSuccess();
    } catch (error) {
      this.onFailure();
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.circuitOpen = false;
  }

  private onFailure() {
    this.failures++;
    if (this.failures >= this.maxFailures) {
      this.circuitOpen = true;
      setTimeout(() => {
        this.circuitOpen = false;
        this.failures = 0;
      }, this.resetTimeout);
    }
  }
}
```

---

## 4. Database Partitioning Strategy

### Time-based Partitioning for Bookings

```sql
-- Create parent table
CREATE TABLE bookings_partitioned (
  LIKE "Booking" INCLUDING ALL
) PARTITION BY RANGE (date);

-- Create monthly partitions
CREATE TABLE bookings_2025_01 PARTITION OF bookings_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE bookings_2025_02 PARTITION OF bookings_partitioned
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Automated partition creation
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
  start_date date;
  end_date date;
  partition_name text;
BEGIN
  FOR i IN 0..11 LOOP
    start_date := date_trunc('month', CURRENT_DATE + interval '1 month' * i);
    end_date := start_date + interval '1 month';
    partition_name := 'bookings_' || to_char(start_date, 'YYYY_MM');

    BEGIN
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF bookings_partitioned FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date);
    EXCEPTION
      WHEN duplicate_table THEN NULL;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly execution
SELECT cron.schedule('create-partitions', '0 0 1 * *', 'SELECT create_monthly_partitions()');
```

---

## 5. Load Balancing Configuration

### HAProxy Configuration

```conf
# haproxy.cfg
global
    maxconn 4096
    log stdout local0

defaults
    mode tcp
    timeout connect 5000ms
    timeout client 30000ms
    timeout server 30000ms
    option tcplog

frontend postgres_frontend
    bind *:5432
    default_backend postgres_backend

backend postgres_backend
    balance leastconn
    option pgsql-check user postgres

    # Primary (read-write)
    server primary db-primary.supabase.co:5432 check port 5432

    # Read replicas
    server replica1 db-replica1.supabase.co:5432 check port 5432 backup
    server replica2 db-replica2.supabase.co:5432 check port 5432 backup
```

### Application-Level Load Balancing

```typescript
// load-balancer.ts
export class DatabaseLoadBalancer {
  private connections: PrismaClient[] = [];
  private currentIndex = 0;
  private healthChecks = new Map<number, boolean>();

  constructor(connectionUrls: string[]) {
    this.connections = connectionUrls.map(url =>
      new PrismaClient({
        datasources: { db: { url } }
      })
    );

    // Start health checks
    this.startHealthChecks();
  }

  // Round-robin with health check
  getConnection(): PrismaClient {
    let attempts = 0;
    while (attempts < this.connections.length) {
      const index = this.currentIndex % this.connections.length;
      this.currentIndex++;

      if (this.healthChecks.get(index) !== false) {
        return this.connections[index];
      }

      attempts++;
    }

    // Fallback to first connection
    return this.connections[0];
  }

  private async startHealthChecks() {
    setInterval(async () => {
      for (let i = 0; i < this.connections.length; i++) {
        try {
          await this.connections[i].$queryRaw`SELECT 1`;
          this.healthChecks.set(i, true);
        } catch {
          this.healthChecks.set(i, false);
        }
      }
    }, 10000); // Check every 10 seconds
  }
}
```

---

## 6. Auto-Scaling Configuration

### Kubernetes HPA Configuration

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: carwash-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: carwash-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: database_connections_active
      target:
        type: AverageValue
        averageValue: "30"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
      - type: Pods
        value: 4
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

### Database Connection Auto-Scaling

```typescript
// auto-scaler.ts
export class ConnectionPoolAutoScaler {
  private minConnections = 5;
  private maxConnections = 100;
  private currentConnections = 10;
  private metrics: number[] = [];

  async adjustPoolSize(activeConnections: number, totalConnections: number) {
    const utilization = activeConnections / totalConnections;
    this.metrics.push(utilization);

    // Keep last 10 measurements
    if (this.metrics.length > 10) {
      this.metrics.shift();
    }

    const avgUtilization = this.metrics.reduce((a, b) => a + b, 0) / this.metrics.length;

    // Scale up if utilization is high
    if (avgUtilization > 0.8 && this.currentConnections < this.maxConnections) {
      this.currentConnections = Math.min(
        this.currentConnections * 1.5,
        this.maxConnections
      );
      await this.updatePoolSize(this.currentConnections);
    }

    // Scale down if utilization is low
    if (avgUtilization < 0.3 && this.currentConnections > this.minConnections) {
      this.currentConnections = Math.max(
        this.currentConnections * 0.7,
        this.minConnections
      );
      await this.updatePoolSize(this.currentConnections);
    }
  }

  private async updatePoolSize(size: number) {
    // Update connection pool size
    process.env.DATABASE_POOL_MAX = String(Math.floor(size));
    console.log(`Adjusted pool size to ${size} connections`);
  }
}
```

---

## 7. Performance Testing Configuration

### K6 Load Testing Script

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Stay at 100
    { duration: '2m', target: 200 },  // Ramp to 200
    { duration: '5m', target: 200 },  // Stay at 200
    { duration: '2m', target: 500 },  // Spike test
    { duration: '5m', target: 500 },  // Sustained load
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
  },
};

export default function() {
  // Test availability check
  const availabilityRes = http.get(`${__ENV.BASE_URL}/api/bookings/availability?date=2025-10-10&serviceId=1`);
  check(availabilityRes, {
    'availability status is 200': (r) => r.status === 200,
    'availability response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(availabilityRes.status !== 200);

  sleep(1);

  // Test booking creation
  const bookingPayload = JSON.stringify({
    serviceId: 1,
    vehicleType: 'sedan',
    date: '2025-10-10',
    startTime: '10:00',
    customerName: `Test User ${__VU}`,
    customerEmail: `test${__VU}@example.com`,
    customerPhone: '+358401234567',
  });

  const bookingRes = http.post(`${__ENV.BASE_URL}/api/bookings/create`, bookingPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(bookingRes, {
    'booking status is 201': (r) => r.status === 201,
    'booking has confirmation code': (r) => {
      const body = JSON.parse(r.body);
      return body.confirmationCode !== undefined;
    },
  });
  errorRate.add(bookingRes.status !== 201);

  sleep(2);
}
```

### Artillery Configuration

```yaml
# artillery.yml
config:
  target: "https://api.carwash.fi"
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 120
      arrivalRate: 20
      name: "Sustained load"
    - duration: 60
      arrivalRate: 50
      name: "High load"
  processor: "./processor.js"
  variables:
    serviceIds: [1, 2, 3, 4, 5]

scenarios:
  - name: "Booking Flow"
    weight: 70
    flow:
      - get:
          url: "/api/services"
      - think: 2
      - get:
          url: "/api/bookings/availability"
          qs:
            date: "{{ $randomDate() }}"
            serviceId: "{{ $randomItem(serviceIds) }}"
      - think: 3
      - post:
          url: "/api/bookings/create"
          json:
            serviceId: "{{ $randomItem(serviceIds) }}"
            date: "{{ $randomDate() }}"
            startTime: "10:00"
            customerName: "{{ $randomString() }}"
            customerEmail: "{{ $randomEmail() }}"
            customerPhone: "+358401234567"
          capture:
            - json: "$.confirmationCode"
              as: "confirmationCode"
      - think: 1
      - get:
          url: "/api/bookings/{{ confirmationCode }}"

  - name: "Browse Services"
    weight: 30
    flow:
      - get:
          url: "/api/services"
      - think: 2
      - get:
          url: "/api/services/{{ $randomItem(serviceIds) }}"
```

---

## 8. Monitoring Dashboard Configuration

### Grafana Dashboard JSON

```json
{
  "dashboard": {
    "title": "Car Wash Booking Database Performance",
    "panels": [
      {
        "title": "Query Response Time",
        "targets": [
          {
            "expr": "rate(pg_stat_database_blks_hit{datname=\"postgres\"}[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Active Connections",
        "targets": [
          {
            "expr": "pg_stat_activity_count{state=\"active\"}"
          }
        ],
        "type": "gauge"
      },
      {
        "title": "Cache Hit Ratio",
        "targets": [
          {
            "expr": "pg_stat_database_blks_hit / (pg_stat_database_blks_hit + pg_stat_database_blks_read)"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Slow Queries",
        "targets": [
          {
            "expr": "pg_stat_statements_mean_time_seconds{queryid!=\"\"} > 0.1"
          }
        ],
        "type": "table"
      }
    ]
  }
}
```

---

## 9. Deployment Checklist

### Pre-Production Checklist

- [ ] **Database Indexes Created**
  ```sql
  SELECT schemaname, tablename, indexname FROM pg_indexes
  WHERE schemaname = 'public';
  ```

- [ ] **Connection Pooling Configured**
  ```bash
  echo "Max connections: $DATABASE_POOL_MAX"
  ```

- [ ] **Read Replicas Active**
  ```sql
  SELECT client_addr, state, sync_state FROM pg_stat_replication;
  ```

- [ ] **Redis Cache Running**
  ```bash
  redis-cli ping
  ```

- [ ] **Monitoring Active**
  ```bash
  curl http://localhost:9090/metrics
  ```

- [ ] **Backup Schedule Configured**
  ```sql
  SELECT * FROM cron.job;
  ```

- [ ] **Load Testing Completed**
  ```bash
  k6 run --env BASE_URL=https://api.carwash.fi load-test.js
  ```

### Production Deployment

1. **Deploy Database Migrations**
   ```bash
   npx prisma migrate deploy
   ```

2. **Update Connection Strings**
   ```bash
   vercel env pull
   vercel env add DATABASE_URL production
   vercel env add DATABASE_READ_REPLICA_URL production
   ```

3. **Scale Application Instances**
   ```bash
   kubectl scale deployment carwash-api --replicas=5
   ```

4. **Enable Monitoring**
   ```bash
   kubectl apply -f monitoring/
   ```

5. **Verify Health**
   ```bash
   curl https://api.carwash.fi/health
   ```

---

## 10. Emergency Procedures

### Database Failover

```bash
#!/bin/bash
# Promote read replica to primary
pg_ctl promote -D /var/lib/postgresql/data

# Update application connection string
export DATABASE_URL=$DATABASE_READ_REPLICA_URL

# Restart application
pm2 restart all
```

### Emergency Cache Flush

```typescript
// emergency-flush.ts
async function emergencyCacheFlush() {
  try {
    await redis.flushall();
    console.log('Cache flushed successfully');
  } catch (error) {
    console.error('Failed to flush cache:', error);
    // Fallback: restart Redis
    exec('sudo systemctl restart redis');
  }
}
```

### Connection Pool Reset

```typescript
// pool-reset.ts
async function resetConnectionPool() {
  await prisma.$disconnect();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await prisma.$connect();
  console.log('Connection pool reset');
}
```

---

*Configuration Guide Version: 1.0*
*Last Updated: October 2025*
*Target Load: 1000+ concurrent users*