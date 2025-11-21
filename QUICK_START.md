# Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Docker Desktop installed and running

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Start PostgreSQL with Docker

```bash
docker-compose up -d
```

This will:
- Download PostgreSQL image (first time only)
- Create and start the database container
- Database will be available at `localhost:5432`

## Step 3: Create Database Tables

```bash
npm run db:push
```

This will:
- Create all tables (users, posts, comments, likes, follows, stories)
- Generate Prisma Client

## Step 4: Start the Application

```bash
npm run dev
```

The app will be available at: **http://localhost:3001**

## Step 5: Create Your First Account

1. Open http://localhost:3001
2. You'll be redirected to `/auth`
3. Click "Sign up"
4. Fill in the form:
   - Email: your@email.com
   - Full Name: Your Name
   - Username: yourname (letters, numbers, underscore only)
   - Password: Must have uppercase, lowercase, and number (min 8 chars)
5. Click "Sign Up"
6. You'll be logged in automatically and redirected to the home feed!

## Step 6: Test Features

**Try these actions:**

1. **View your profile**
   - Click your avatar in the top-right
   - See your username displayed

2. **Logout**
   - Click your avatar
   - Click "Logout"

3. **Login again**
   - Enter your email/username and password
   - Click "Log In"

## Verify Everything Works

### Check Database Connection

```bash
# View all tables
docker exec remys_postgres psql -U postgres -d remys_db -c "\dt"

# View your user
docker exec remys_postgres psql -U postgres -d remys_db -c "SELECT username, email FROM users;"
```

### Open Prisma Studio (Database GUI)

```bash
npm run db:studio
```

Opens at http://localhost:5555 - you can view and edit data visually!

## Common Docker Commands

```bash
# View running containers
docker-compose ps

# View database logs
docker-compose logs -f postgres

# Stop database
docker-compose down

# Restart database
docker-compose restart

# Stop and remove all data (⚠️ deletes everything!)
docker-compose down -v
```

## Environment Variables

The `.env` file is already configured for local development:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/remys_db?schema=public"
JWT_SECRET="dev-secret-key-please-change-in-production-12345"
JWT_EXPIRES_IN="7d"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="dev-nextauth-secret-please-change-in-production-67890"
```

⚠️ **Never commit your `.env` file in production!**

## API Testing with curl

### Register a User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "Test1234",
    "fullName": "Test User"
  }'
```

### Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrUsername": "testuser",
    "password": "Test1234"
  }'
```

### Get Current User (with token)

```bash
# Replace YOUR_TOKEN with the token from login response
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Port 5432 already in use

```bash
# Stop other PostgreSQL instances or change port in docker-compose.yml
ports:
  - "5433:5432"  # Use 5433 instead

# Then update .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/remys_db"
```

### Database connection failed

```bash
# Check if Docker is running
docker ps

# Check database health
docker-compose ps

# View database logs
docker-compose logs postgres
```

### App won't start

```bash
# Kill the process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or the app will automatically use port 3001
```

### Clear all data and start fresh

```bash
# Stop containers and remove volumes
docker-compose down -v

# Start again
docker-compose up -d
npm run db:push
npm run dev
```

## Project Structure Overview

```
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/                   # Next.js pages and API routes
│   │   ├── api/auth/         # Authentication endpoints
│   │   ├── api/users/        # User management endpoints
│   │   └── auth/             # Login/Register pages
│   ├── components/           # React components
│   ├── contexts/             # React contexts
│   ├── domain/               # Interfaces (SOLID - DIP)
│   ├── infrastructure/       # Implementations (SOLID)
│   └── lib/                  # Utilities
├── .env                      # Environment variables
├── docker-compose.yml        # Docker configuration
└── package.json             # Dependencies
```

## Next Steps

Now that everything is running:

1. **Explore the code** - See how SOLID principles are implemented
2. **Read [ARCHITECTURE.md](ARCHITECTURE.md)** - Understand the design patterns
3. **Add features** - Posts, comments, likes, follows
4. **Customize the UI** - Material-UI theme, colors, layouts

## Need Help?

- Check [DATABASE_SETUP.md](DATABASE_SETUP.md) for detailed database setup
- Read [ARCHITECTURE.md](ARCHITECTURE.md) for architecture details
- See [README.md](README.md) for full documentation

---

**You're all set! 🎉**

Your recipe sharing platform with authentication is running at http://localhost:3001
