# Database Setup Guide

This guide will help you set up PostgreSQL for the Recipe Sharing application.

## Option 1: Local PostgreSQL Installation

### Windows

1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer
3. Set a password for the postgres user (remember this!)
4. Default port is 5432 (keep this)
5. Complete the installation

### macOS

Using Homebrew:
\`\`\`bash
brew install postgresql@15
brew services start postgresql@15
\`\`\`

### Linux (Ubuntu/Debian)

\`\`\`bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
\`\`\`

### Create Database

After installation, create the database:

\`\`\`bash
# Connect to PostgreSQL
psql -U postgres

# In psql shell:
CREATE DATABASE recipe_sharing_db;

# Exit psql
\q
\`\`\`

### Update .env File

\`\`\`env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/recipe_sharing_db?schema=public"
\`\`\`

Replace `your_password` with your actual PostgreSQL password.

## Option 2: Docker (Recommended)

### Quick Start with Docker

1. Make sure Docker is installed and running

2. Create a `docker-compose.yml` file in the project root:

\`\`\`yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: recipe_app_postgres
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: recipe_sharing_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
\`\`\`

3. Start the database:

\`\`\`bash
docker-compose up -d
\`\`\`

4. Your database is now running! The `.env` file is already configured for this setup:

\`\`\`env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recipe_sharing_db?schema=public"
\`\`\`

### Docker Commands

\`\`\`bash
# Start database
docker-compose up -d

# Stop database
docker-compose down

# View logs
docker-compose logs -f postgres

# Stop and remove all data
docker-compose down -v
\`\`\`

## Option 3: Cloud Database (Production)

### Supabase (Free Tier Available)

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy the database connection string
4. Update `.env`:

\`\`\`env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres"
\`\`\`

### Neon (Free Tier Available)

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Update `.env`

### Railway

1. Go to [railway.app](https://railway.app)
2. Create a new PostgreSQL database
3. Copy the connection string
4. Update `.env`

## Initialize the Database

After setting up PostgreSQL, run these commands:

\`\`\`bash
# Generate Prisma Client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push

# Optional: Open Prisma Studio to view data
npm run db:studio
\`\`\`

## Verify Database Connection

Check if the database is accessible:

\`\`\`bash
# Using psql
psql -h localhost -U postgres -d recipe_sharing_db

# In psql shell, list tables:
\dt

# You should see:
# - users
# - posts
# - comments
# - likes
# - follows
# - stories
\`\`\`

## Database Schema

The following tables will be created:

### users
- id (UUID, Primary Key)
- email (Unique)
- username (Unique)
- password (Hashed)
- fullName
- bio
- avatar
- website
- isVerified
- isPrivate
- createdAt
- updatedAt

### posts
- id (UUID, Primary Key)
- caption
- imageUrl
- userId (Foreign Key)
- createdAt
- updatedAt

### comments
- id (UUID, Primary Key)
- text
- postId (Foreign Key)
- userId (Foreign Key)
- createdAt
- updatedAt

### likes
- id (UUID, Primary Key)
- postId (Foreign Key)
- userId (Foreign Key)
- createdAt

### follows
- id (UUID, Primary Key)
- followerId (Foreign Key)
- followingId (Foreign Key)
- createdAt

### stories
- id (UUID, Primary Key)
- imageUrl
- userId (Foreign Key)
- createdAt
- expiresAt

## Troubleshooting

### Connection Refused Error

**Problem**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solutions**:
1. Make sure PostgreSQL is running
2. Check if port 5432 is in use
3. Verify credentials in `.env`

### Authentication Failed Error

**Problem**: `Error: password authentication failed for user "postgres"`

**Solutions**:
1. Verify password in `.env` matches PostgreSQL password
2. Check PostgreSQL user permissions
3. Try resetting PostgreSQL password

### Database Does Not Exist

**Problem**: `Error: database "recipe_sharing_db" does not exist`

**Solution**:
\`\`\`bash
psql -U postgres
CREATE DATABASE recipe_sharing_db;
\q
\`\`\`

### Port Already in Use

**Problem**: `Error: Port 5432 is already in use`

**Solutions**:
1. Stop other PostgreSQL instances
2. Change port in docker-compose.yml (e.g., "5433:5432")
3. Update `DATABASE_URL` port accordingly

## Database Migrations

When you update the schema:

\`\`\`bash
# Option 1: Push changes directly (development)
npm run db:push

# Option 2: Create migration (production)
npx prisma migrate dev --name descriptive_name

# Apply migrations (production)
npx prisma migrate deploy
\`\`\`

## Backup and Restore

### Backup

\`\`\`bash
pg_dump -U postgres -d recipe_sharing_db > backup.sql
\`\`\`

### Restore

\`\`\`bash
psql -U postgres -d recipe_sharing_db < backup.sql
\`\`\`

## Prisma Studio

View and edit your database visually:

\`\`\`bash
npm run db:studio
\`\`\`

Opens at [http://localhost:5555](http://localhost:5555)

## Security Recommendations

1. **Never commit `.env` file** - Already in `.gitignore`
2. **Use strong passwords** - Especially in production
3. **Use environment-specific credentials**
4. **Enable SSL in production**:
   \`\`\`env
   DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
   \`\`\`

## Production Checklist

Before deploying:

- [ ] Use strong, unique DATABASE_URL
- [ ] Enable SSL connections
- [ ] Run migrations with `prisma migrate deploy`
- [ ] Set up automated backups
- [ ] Monitor database performance
- [ ] Implement connection pooling if needed
- [ ] Review and optimize indexes

## Next Steps

After setting up the database:

1. Start the development server: `npm run dev`
2. Open [http://localhost:3001](http://localhost:3001)
3. Register a new user account
4. Test the authentication flow

Your database is now ready to use!
