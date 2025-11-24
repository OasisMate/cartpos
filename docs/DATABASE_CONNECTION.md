# Database Connection Configuration Guide

## Problem: Intermittent Connection Issues with Supabase

If you're experiencing random database connection failures that resolve themselves, this is typically caused by:

1. **Connection pool exhaustion** - Too many connections without proper pooling
2. **Connection timeout** - Connections timing out before completing
3. **Network instability** - Temporary network issues
4. **Supabase connection pooler limits** - Hitting connection limits

## Solution: Proper Supabase Connection String Configuration

### 1. Use Supabase Connection Pooler (Recommended)

Supabase provides a connection pooler that handles connection management efficiently. Use the **Session Mode** pooler for Prisma:

```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10
```

**Key parameters:**
- Port: `6543` (Session mode pooler) - **Use this for Prisma**
- `pgbouncer=true` - Enables connection pooling
- `connection_limit=10` - Limits concurrent connections (adjust based on your plan)

### 2. Alternative: Transaction Mode Pooler

For read-heavy operations, you can use transaction mode (port `6543` with `pgbouncer=true`):

```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10
```

### 3. Direct Connection (Not Recommended for Production)

Direct connections bypass the pooler and can exhaust connection limits:

```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Only use direct connection for:**
- Migrations
- One-off scripts
- Development testing

## Environment Variable Setup

### .env file

```env
# Use connection pooler (RECOMMENDED)
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&connect_timeout=10"

# For migrations only (direct connection)
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

### Connection String Parameters

- `pgbouncer=true` - Enables connection pooling
- `connection_limit=10` - Maximum connections per instance (adjust based on Supabase plan)
- `connect_timeout=10` - Connection timeout in seconds
- `pool_timeout=10` - Pool timeout in seconds

## Prisma Schema Configuration

Update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Optional: Add connection pooling hints
  // directUrl = env("DIRECT_URL") // For migrations
}
```

## Connection Limits by Supabase Plan

- **Free Tier**: 60 connections max
- **Pro Tier**: 200 connections max
- **Team/Enterprise**: Custom limits

**Best Practice**: Use `connection_limit=10` per application instance to avoid exhausting the pool.

## Implementation Features

This codebase includes:

1. **Automatic Retry Logic** - Retries failed connections with exponential backoff
2. **Connection Health Checks** - Monitors database connectivity
3. **Graceful Error Handling** - Shows user-friendly error messages
4. **Connection Pooling** - Configured for optimal connection management

## Testing Connection

Use the health check endpoint:

```bash
curl http://localhost:3000/api/health
```

This will show:
- Service status
- Database connection status
- Any connection errors

## Troubleshooting

### Issue: "Can't reach database server"

1. **Check Supabase Dashboard** - Ensure database is active
2. **Verify Connection String** - Check port (6543 for pooler, 5432 for direct)
3. **Check Connection Limits** - Reduce `connection_limit` if hitting limits
4. **Network Issues** - Check firewall/network connectivity

### Issue: Intermittent Connection Failures

1. **Use Connection Pooler** - Switch to port 6543 with `pgbouncer=true`
2. **Reduce Connection Limit** - Lower `connection_limit` parameter
3. **Enable Retry Logic** - Already implemented in this codebase
4. **Check Supabase Status** - Verify Supabase service status

### Issue: Too Many Connections

1. **Reduce `connection_limit`** in connection string
2. **Use Connection Pooler** - More efficient connection management
3. **Check for Connection Leaks** - Ensure connections are properly closed
4. **Upgrade Supabase Plan** - If consistently hitting limits

## Best Practices

1. ✅ **Always use connection pooler** (port 6543) for Prisma
2. ✅ **Set appropriate connection limits** based on your plan
3. ✅ **Use retry logic** for transient failures
4. ✅ **Monitor connection health** regularly
5. ✅ **Use direct connection only for migrations**

## Migration Commands

When running migrations, you may need to use direct connection:

```bash
# Using direct connection for migrations
DATABASE_URL="postgresql://..." npx prisma migrate dev
```

Or set `DIRECT_URL` in schema and use it for migrations only.


