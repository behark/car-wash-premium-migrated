# Additional Environment Variables for Netlify

Add these environment variables to fix the Prisma engine issue:

```env
PRISMA_CLI_BINARY_TARGETS=rhel-openssl-3.0.x
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
SKIP_ENV_VALIDATION=true
```

These should be added to your existing environment variables in Netlify Dashboard.

## Complete Updated Environment Variables List:

```env
DATABASE_URL=postgresql://postgres.tamqwcfugkbnaqafbybb:123b123behar123@aws-1-eu-central-1.pooler.supabase.com:6543/postgres
NODE_ENV=production
FRONTEND_URL=https://kiiltoloisto.fi
NEXTAUTH_SECRET=S7S2xkaOyNO7HoumKPAJxwiPHVLku45xpFBoFcc8omQ=
NEXTAUTH_URL=https://kiiltoloisto.fi
DB_MAX_CONNECTIONS=10
DB_POOL_TIMEOUT=10
DB_CONNECT_TIMEOUT=10
ENABLE_DB_MONITORING=true
SLOW_QUERY_THRESHOLD=1000
MAX_QUERY_HISTORY=100
PRISMA_CLI_BINARY_TARGETS=rhel-openssl-3.0.x
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
SKIP_ENV_VALIDATION=true
```