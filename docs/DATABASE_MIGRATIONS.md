# Database Migrations Guide

This document explains how to manage database migrations for Remy's Recipe Sharing App.

## Overview

We use **Prisma** as our ORM and migration tool. Prisma provides a robust migration system that tracks schema changes and applies them safely to your database.

---

## Development Workflow

### 1. Making Schema Changes

Edit the Prisma schema file:
```bash
# File location
prisma/schema.prisma
```

### 2. Generate Migration

After making changes to your schema, create a migration:

```bash
npm run db:generate
```

This generates the Prisma Client with your new schema changes.

### 3. Apply Migration (Development)

For development, you can use `db push` which applies changes directly without creating migration files:

```bash
npm run db:push
```

**Note:** `db push` is great for rapid development but should NOT be used in production.

---

## Production Workflow

### 1. Create Named Migration

In production, always create proper migration files:

```bash
npx prisma migrate dev --name descriptive_migration_name
```

Example:
```bash
npx prisma migrate dev --name add_recipe_tags
npx prisma migrate dev --name add_user_profile_fields
```

This creates a migration file in `prisma/migrations/`

### 2. Review Migration

Always review the generated SQL before deploying:

```bash
# Migration files are located at:
prisma/migrations/[timestamp]_[name]/migration.sql
```

### 3. Deploy to Production

Deploy migrations to production database:

```bash
npm run db:migrate:deploy
```

Or directly with Prisma:

```bash
npx prisma migrate deploy
```

**Important:** This command should be run as part of your CI/CD pipeline.

---

## Migration Commands Reference

### Core Commands

| Command | Description | When to Use |
|---------|-------------|-------------|
| `npm run db:generate` | Generate Prisma Client | After schema changes |
| `npm run db:push` | Push schema changes to DB | Development only |
| `npx prisma migrate dev` | Create and apply migration | Development |
| `npx prisma migrate deploy` | Deploy pending migrations | Production |
| `npx prisma migrate status` | Check migration status | Any time |
| `npx prisma migrate resolve` | Mark migration as applied/rolled back | Fixing issues |

### Utility Commands

```bash
# View database in browser
npm run db:studio

# Test database connection
npm run db:test

# Seed database with test data
npm run db:seed

# Reset database (DANGER: Deletes all data)
npx prisma migrate reset
```

---

## Production Deployment Checklist

### Before Deployment

- [ ] All migrations tested locally
- [ ] Migration SQL reviewed
- [ ] Backward compatibility verified
- [ ] Database backup created
- [ ] Downtime window planned (if needed)

### Deployment Process

1. **Backup Production Database**
   ```bash
   # PostgreSQL backup
   pg_dump -h HOST -U USER -d DATABASE > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Run Migration**
   ```bash
   # In your deployment script
   npx prisma migrate deploy
   ```

3. **Verify Migration**
   ```bash
   npx prisma migrate status
   ```

4. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

5. **Restart Application**

---

## Database Backup Strategy

### Automated Backups

#### Using PostgreSQL

```bash
# Daily backup (add to cron)
0 2 * * * pg_dump -h HOST -U USER DATABASE | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz
```

#### Using Docker

```bash
# Backup from Docker container
docker exec postgres pg_dump -U postgres recipe_sharing_db > backup.sql
```

#### Using Cloud Services

- **AWS RDS**: Enable automated backups (retention: 7-35 days)
- **Supabase**: Automatic daily backups included
- **DigitalOcean**: Enable automated backups in dashboard

### Backup Retention Policy

Recommended retention:
- **Daily backups**: Keep for 7 days
- **Weekly backups**: Keep for 4 weeks
- **Monthly backups**: Keep for 12 months

---

## Handling Migration Issues

### Migration Failed

If a migration fails mid-way:

```bash
# Check current status
npx prisma migrate status

# Mark migration as rolled back
npx prisma migrate resolve --rolled-back [migration_name]

# Fix the issue and retry
npx prisma migrate deploy
```

### Migration Out of Sync

If your migration history is out of sync:

```bash
# Mark specific migration as applied
npx prisma migrate resolve --applied [migration_name]
```

### Reset Database (Development Only)

```bash
# ⚠️ WARNING: This deletes ALL data
npx prisma migrate reset
```

---

## Common Migration Scenarios

### Adding a New Table

```prisma
model NewTable {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
}
```

```bash
npx prisma migrate dev --name add_new_table
```

### Adding a Column

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  bio       String?  // New field
}
```

```bash
npx prisma migrate dev --name add_user_bio
```

### Making Column Required

⚠️ **Requires careful handling if data exists!**

```prisma
model Recipe {
  title String  // Changed from String?
}
```

**Steps:**
1. Add column as optional with default
2. Populate existing rows
3. Make required in new migration

### Renaming Fields

Use `@map` to avoid data loss:

```prisma
model User {
  firstName String @map("first_name")
}
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Generate Prisma Client
        run: npx prisma generate
```

---

## Emergency Rollback

If you need to rollback a migration:

### Option 1: Restore from Backup

```bash
# Restore PostgreSQL backup
psql -h HOST -U USER -d DATABASE < backup.sql
```

### Option 2: Manual Rollback

1. Identify the migration to rollback
2. Write SQL to reverse changes
3. Apply manually
4. Mark migration as rolled back

```bash
npx prisma migrate resolve --rolled-back [migration_name]
```

---

## Best Practices

### DO ✅

- Always create named migrations for production
- Review generated SQL before deploying
- Backup database before migrations
- Test migrations on staging first
- Use `prisma migrate deploy` in production
- Keep migrations small and focused
- Document complex migrations

### DON'T ❌

- Don't use `db push` in production
- Don't edit existing migration files
- Don't skip migrations
- Don't rollback in production without backups
- Don't deploy untested migrations
- Don't make breaking changes without plan

---

## Monitoring

### Check Migration Status

```bash
npx prisma migrate status
```

### View Migration History

```bash
# List all migrations
ls -la prisma/migrations/
```

### Database Size Monitoring

```sql
-- PostgreSQL: Check database size
SELECT pg_size_pretty(pg_database_size('recipe_sharing_db'));

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Troubleshooting

### Issue: "Migration is already applied"

```bash
# Skip this migration
npx prisma migrate resolve --applied [migration_name]
```

### Issue: "Cannot connect to database"

Check:
1. Database is running
2. DATABASE_URL is correct
3. Network connectivity
4. Firewall rules

### Issue: "Schema drift detected"

Your database schema doesn't match your Prisma schema:

```bash
# Reset to match schema (development only)
npx prisma migrate reset

# Or create migration to fix drift
npx prisma migrate dev
```

---

## Connection Pooling

For production, configure connection pooling:

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public&connection_limit=10&pool_timeout=20"
```

Or use Prisma Accelerate for managed connection pooling.

---

## Support

For more information:
- [Prisma Migration Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Backup Guide](https://www.postgresql.org/docs/current/backup.html)

---

**Remember:** Always test migrations thoroughly before deploying to production!
