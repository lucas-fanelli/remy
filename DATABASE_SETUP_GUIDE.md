# 🗄️ Database Setup Guide

## Quick Setup (5 minutes)

### Option 1: Using Docker (Recommended - Easiest)

This will automatically set up PostgreSQL in a container.

#### Step 1: Start PostgreSQL Database
```bash
npm run docker:db:start
```

This starts a PostgreSQL 16 database in Docker with:
- **Username:** postgres
- **Password:** postgres
- **Database:** recipe_sharing_db
- **Port:** 5432

#### Step 2: Wait for Database to be Ready (about 10 seconds)
Check if the database is running:
```bash
npm run docker:ps
```

You should see `recipe_app_postgres` with status "Up" and "(healthy)"

#### Step 3: Run Database Migrations
This creates all the tables (users, posts, comments, etc.):
```bash
npm run db:migrate:dev
```

When prompted for a migration name, type: `initial_setup`

#### Step 4: (Optional) Add Sample Data
```bash
npm run db:seed
```

#### Step 5: Verify Setup
```bash
npm run db:test
```

If you see "✅ Database connection successful", you're all set!

---

### Option 2: Using Local PostgreSQL (If you have it installed)

If you already have PostgreSQL installed on your computer:

#### Step 1: Create Database
Open PostgreSQL terminal (psql) and run:
```sql
CREATE DATABASE recipe_sharing_db;
```

#### Step 2: Update .env File
Make sure your `.env` file has:
```env
DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/recipe_sharing_db?schema=public"
```

Replace `YOUR_USERNAME` and `YOUR_PASSWORD` with your PostgreSQL credentials.

#### Step 3: Run Migrations
```bash
npm run db:migrate:dev
```

#### Step 4: (Optional) Add Sample Data
```bash
npm run db:seed
```

---

## Useful Database Commands

### View Database in Browser
```bash
npm run db:studio
```
Opens Prisma Studio at http://localhost:5555 - a visual database editor

### Check Migration Status
```bash
npm run db:migrate:status
```

### Stop Database (Docker)
```bash
npm run docker:db:stop
```

### Restart Database (Docker)
```bash
npm run docker:db:stop
npm run docker:db:start
```

### Reset Database (Delete all data)
```bash
npm run docker:clean
npm run docker:db:start
npm run db:migrate:dev
```

---

## Troubleshooting

### "Port 5432 is already in use"
Another PostgreSQL instance is running. Either:
1. Stop your local PostgreSQL: `sudo service postgresql stop` (Linux/Mac)
2. Or change the port in `docker-compose.yml` from `5432:5432` to `5433:5432`
   Then update `.env` to use port 5433

### "Database connection failed"
1. Make sure Docker is running
2. Check database is healthy: `npm run docker:ps`
3. Wait 10-15 seconds after starting for database to initialize
4. Check your `.env` file has correct DATABASE_URL

### "Migration failed"
1. Make sure database is running: `npm run docker:ps`
2. Reset and try again:
   ```bash
   npm run docker:clean
   npm run docker:db:start
   # Wait 15 seconds
   npm run db:migrate:dev
   ```

### Can't connect from app
Verify your `.env` file has:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recipe_sharing_db?schema=public"
```

---

## What Was Created?

The migration creates these tables:
- **users** - User accounts (email, username, password, profile)
- **posts** - Recipes with ingredients, instructions, photos
- **comments** - Recipe comments and ratings
- **likes** - Recipe likes
- **follows** - User follow relationships
- **saved_recipes** - Bookmarked recipes
- **pantry** - User's ingredient inventory
- **shopping_lists** - Shopping list items
- **ai_usage_logs** - AI feature usage tracking
- **ratings** - Recipe star ratings
- **recipe_collections** - Organized recipe collections

---

## Next Steps

Once your database is set up:

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Access the app at:** http://localhost:3000

3. **Register a new account** to start using the app!

4. **View your database data:**
   ```bash
   npm run db:studio
   ```

---

## Database Schema

The complete database schema is in: `prisma/schema.prisma`

To visualize it, run `npm run db:studio` and explore the tables in your browser.
