# 🍽️ Remy's - Recipe Sharing Platform

[![Test Coverage](https://img.shields.io/badge/coverage-97.28%25-brightgreen)](./coverage)
[![Tests](https://img.shields.io/badge/tests-909%20passing-success)](./coverage)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black)](https://nextjs.org/)
[![Production Ready](https://img.shields.io/badge/status-production%20ready-success)](./docs/V1_LAUNCH_COMPLETE.md)

> **A modern recipe sharing platform where users can discover, create, and share amazing recipes with a vibrant community.**

**✅ Production Ready** - v1.0 is fully tested and ready to deploy!

---

## ✨ Key Features

- 🔍 **Smart Recipe Discovery** - Browse, search, and filter recipes
- 🥘 **Pantry Management** - Track ingredients and get personalized recipe matches
- 💬 **Social Interaction** - Follow users, like and comment on recipes
- 📊 **User Profiles** - Personal stats, followers, and recipe collections
- 📱 **Responsive Design** - Beautiful UI that works on any device
- 🌙 **Modern Dark Mode** - Eye-friendly theme with teal accents
- 🔒 **Enterprise Security** - Rate limiting, JWT auth, security headers
- 📈 **97.28% Test Coverage** - All 909 tests passing, production-grade reliability

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Docker (optional)

### Installation (5 minutes)

```bash
# 1. Clone and install
git clone https://github.com/yourusername/remys-recipe-app.git
cd remys-recipe-app
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Start database (Docker)
npm run docker:db:start

# 4. Initialize database
npm run db:push
npm run db:seed    # Optional: Add sample data

# 5. Start app
npm run dev
```

Open **http://localhost:3000** 🎉

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Production Readiness](./docs/PRODUCTION_READINESS.md) | Complete deployment guide |
| [V1 Launch Summary](./docs/V1_LAUNCH_COMPLETE.md) | All implemented features |
| [Database Migrations](./docs/DATABASE_MIGRATIONS.md) | Database management guide |
| [Docker Setup](./DOCKER_SETUP_COMPLETE.md) | Docker configuration |
| [UI Testing](./docs/UI_TESTING_SETUP.md) | Testing guidelines |

---

## 🏗️ Tech Stack

**Frontend:** Next.js 15 • TypeScript • Material-UI • Framer Motion
**Backend:** Next.js API Routes • Prisma • PostgreSQL
**Auth:** JWT • bcrypt • NextAuth
**Testing:** Jest • React Testing Library • Playwright
**DevOps:** Docker • Vercel-ready

---

## 🧪 Testing

```bash
npm test              # All tests with coverage
npm run test:watch    # Watch mode
npm run test:e2e      # End-to-end tests
```

**Coverage:** 97.28% statements | 87.85% branches | 98.16% lines | All 909 tests passing

---

## 📦 Available Scripts

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Production build
npm run start                  # Start production

# Database
npm run db:migrate:deploy      # Deploy migrations (prod)
npm run db:studio              # Database GUI
npm run db:seed                # Seed test data

# Docker
npm run docker:up              # Start all services
npm run docker:prod            # Production mode

# Testing
npm test                       # Run all tests
npm run test:e2e               # E2E tests
```

---

## 🌍 Environment Variables

Required variables (see [`.env.example`](./.env.example) for all):

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="min-32-random-chars"
NEXTAUTH_SECRET="min-32-random-chars"
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
```

---

## 🏛️ Architecture

### Clean Architecture with SOLID Principles

```
src/
├── app/                          # Next.js 15 App Router (Presentation Layer)
│   ├── api/                     # API endpoints (28+ routes)
│   │   ├── auth/               # Authentication endpoints
│   │   ├── recipes/            # Recipe CRUD operations
│   │   ├── users/              # User management
│   │   ├── pantry/             # Pantry management
│   │   └── search/             # Search functionality
│   ├── recipe/[id]/            # Dynamic recipe pages
│   ├── profile/[username]/     # User profiles
│   ├── error.tsx               # Global error boundary
│   ├── loading.tsx             # Loading states
│   └── not-found.tsx           # 404 page
│
├── components/                   # React Components (View Layer)
│   ├── recipe/                 # Recipe-related components
│   │   ├── RecipeCard.tsx     # Reusable recipe cards
│   │   ├── RecipeFeed.tsx     # Recipe feed with infinite scroll
│   │   ├── MatchedRecipes.tsx # Pantry-based recipe matching
│   │   └── CreateRecipeForm.tsx
│   ├── auth/                   # Authentication UI
│   ├── settings/               # Settings components
│   └── Navigation.tsx          # Main navigation system
│
├── contexts/                     # React Context (State Management)
│   ├── AuthContext.tsx         # Authentication state
│   ├── ThemeContext.tsx        # Dark/light mode theme
│   └── ToastContext.tsx        # Global notifications
│
├── domain/                       # Domain Layer (Business Entities)
│   └── types/                  # TypeScript domain models
│       ├── recipe.ts           # Recipe entity definitions
│       ├── user.ts             # User entity definitions
│       └── pantry.ts           # Pantry entity definitions
│
├── infrastructure/               # Infrastructure Layer (External Services)
│   ├── services/               # Business Logic Services
│   │   ├── RecipeService.ts   # Recipe business logic
│   │   ├── UserService.ts     # User management logic
│   │   ├── PantryService.ts   # Pantry operations
│   │   ├── AuthService.ts     # Authentication logic
│   │   ├── NotificationService.ts
│   │   └── TokenService.ts    # JWT token management
│   │
│   └── repositories/           # Data Access Layer (Repository Pattern)
│       ├── RecipeRepository.ts # Recipe data access
│       ├── UserRepository.ts  # User data access
│       ├── PantryRepository.ts
│       └── NotificationRepository.ts
│
├── lib/                          # Shared Utilities
│   ├── validation/             # Input validation schemas
│   ├── utils.ts                # Helper functions
│   └── prisma.ts               # Database client singleton
│
├── middleware.ts                 # Security & Rate Limiting
└── prisma/
    ├── schema.prisma            # Database schema
    └── migrations/              # Database migrations
```

### Design Patterns

- **Repository Pattern**: Separates data access logic from business logic
- **Dependency Injection**: Services receive dependencies through constructors
- **Factory Pattern**: Used for creating service instances
- **Provider Pattern**: React Context for global state management
- **Singleton Pattern**: Database client and service instances

### Key Architectural Decisions

1. **Clean Architecture**: Clear separation between presentation, domain, and infrastructure layers
2. **SOLID Principles**: Single responsibility, dependency inversion, and interface segregation
3. **Type Safety**: Full TypeScript coverage with strict mode enabled
4. **Error Handling**: Centralized error boundaries and validation
5. **Security**: JWT authentication, rate limiting, and security headers at middleware level

---

## 🔐 Security Features

✅ JWT Authentication
✅ Password Hashing (bcrypt)
✅ Rate Limiting (100 req/15min)
✅ CORS Configuration
✅ Security Headers (HSTS, CSP, XSS Protection)
✅ Environment Validation
✅ SQL Injection Protection (Prisma)

---

## 🚀 Deployment

### Vercel (Recommended - 2 minutes)
1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy ✅

### Docker
```bash
docker-compose --profile production up -d
```

### Manual
```bash
npm ci
npm run db:migrate:deploy
npm run build
npm start
```

📖 **Full Guide:** See [Production Readiness](./docs/PRODUCTION_READINESS.md)

---

## 📈 Monitoring

**Health Endpoints:**
- `/api/health` - Application health
- `/api/ready` - Readiness probe

**Built-in:**
- Rate limit tracking
- Error boundaries
- Performance monitoring ready
- Sentry integration ready

---

## 🗺️ Roadmap

### v1.0 - Current ✅
- [x] Recipe CRUD operations
- [x] User authentication & profiles
- [x] Social features (likes, comments, follows)
- [x] Pantry management
- [x] Production-ready security
- [x] Comprehensive testing
- [x] Modern dark mode theme

### v1.1 - Planned
- [ ] Email notifications
- [ ] Password reset flow
- [ ] Recipe collections
- [ ] Advanced search
- [ ] PWA support

### v1.2 - Future
- [ ] Mobile apps
- [ ] Meal planning
- [ ] Shopping lists
- [ ] Video recipes
- [ ] Social authentication

---

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) - React Framework
- [Prisma](https://www.prisma.io/) - Database ORM
- [Material-UI](https://mui.com/) - Component Library
- [Framer Motion](https://www.framer.com/motion/) - Animation Library

---

## 🎉 Status

**✅ PRODUCTION READY**

- 909/909 tests passing (100% pass rate)
- 97.28% statement coverage
- 98.16% line coverage
- Security hardened
- Performance optimized
- Fully documented
- Docker ready
- Vercel ready

**Ready to launch your recipe platform!** 🚀

---

**Built with ❤️ - Share • Discover • Create Amazing Recipes** 🍽️

---

## 📝 Changelog

### v1.0.2 - UX & UI Improvements (Latest)
- ✅ **Modern Dark Mode**: Implemented "Modern Neutral" theme with teal accents (#26A69A)
- ✅ **Theme Consistency**: Fixed navigation bar colors to match across all pages
- ✅ **Hydration Fixes**: Eliminated flash on page reload and hydration errors on mobile
- ✅ **Navigation**: Fixed settings page back button to return to previous page
- ✅ **Search System**: Fixed search bar visibility on desktop/mobile
- ✅ **Recipe Forms**: Improved instruction text fields with auto-expand (4-10 rows)
- ✅ **Recipe Details**: Added Edit/Delete buttons for recipe owners
- ✅ **Pantry**: Replaced browser confirm with Material UI dialog for delete actions
- ✅ **Image Viewer**: Added fullscreen image viewer for recipe and instruction images
- ✅ **Settings**: Simplified settings page - removed placeholders for unimplemented features
- ✅ **Login**: Removed non-functional "Forgot password?" link
- ✅ **Better UX**: Cleaner layouts and improved form usability

### v1.0.1 - Production Ready
- Initial production release with 97.28% test coverage

---

*v1.0.2 - Enhanced User Experience*
