# 🍽️ Remy's - Recipe Sharing Platform

[![Test Coverage](https://img.shields.io/badge/coverage-97.28%25-brightgreen)](./COVERAGE_ACHIEVED.md)
[![Tests](https://img.shields.io/badge/tests-910%20passing-success)](./TEST_SUMMARY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black)](https://nextjs.org/)
[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://remy-s.vercel.app/)
[![Production Ready](https://img.shields.io/badge/status-production%20ready-success)](./docs/V1_LAUNCH_COMPLETE.md)

> **A modern recipe sharing platform where users can discover, create, and share amazing recipes with a vibrant community.**

**🚀 LIVE NOW** - [Try the live demo at remy-s.vercel.app](https://remy-s.vercel.app/)

**✅ v1.0.0 Production Release** - Live in production with 910/910 tests passing!

---

## ✨ Key Features

- 🔍 **Smart Recipe Discovery** - Browse, search, and filter recipes
- 🥘 **Pantry Management** - Track ingredients and get personalized recipe matches
- 💬 **Social Interaction** - Follow users, like and comment on recipes
- 📊 **User Profiles** - Personal stats, followers, and recipe collections
- 📱 **Responsive Design** - Beautiful UI that works on any device
- 🌙 **Modern Dark Mode** - Eye-friendly theme with teal accents
- 🔒 **Enterprise Security** - Rate limiting, JWT auth, security headers
- 📈 **97.28% Test Coverage** - All 910 tests passing, production-grade reliability

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

**Coverage:** 97.28% statements | 87.85% branches | 98.16% lines | All 910 tests passing

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

### v1.0.0 - Live in Production ✅
- [x] Recipe CRUD operations
- [x] User authentication & profiles
- [x] Social features (likes, comments, follows)
- [x] Pantry management
- [x] Production-ready security
- [x] Comprehensive testing (910/910 tests passing)
- [x] Modern dark mode theme
- [x] Google Translate support
- [x] Internationalization compatibility
- [x] Deployed to Vercel

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

**✅ v1.0.0 - LIVE IN PRODUCTION**

**Live URL:** [remy-s.vercel.app](https://remy-s.vercel.app/)

- 910/910 tests passing (100% pass rate)
- 97.28% statement coverage
- 98.16% line coverage
- 0 failing tests
- Security hardened
- Performance optimized
- Fully documented
- Deployed to Vercel
- Production database (Vercel Postgres/Neon)
- Cloudinary CDN for images

**Fully operational and serving users!** 🚀

---

**Built with ❤️ - Share • Discover • Create Amazing Recipes** 🍽️

---

## 📝 Changelog

### v1.0.0 - Production Release (2025-12-05) 🚀

**🌐 Live at:** [remy-s.vercel.app](https://remy-s.vercel.app/)

#### Core Features
- ✅ **Recipe Management**: Full CRUD operations for recipes with images
- ✅ **User System**: Authentication, profiles, followers, and social features
- ✅ **Pantry Management**: Track ingredients and get matched recipe suggestions
- ✅ **Social Features**: Likes, comments, follows, and user interactions
- ✅ **Search & Discovery**: Advanced recipe search and filtering

#### UI/UX Improvements
- ✅ **Modern Dark Mode**: "Modern Neutral" theme with teal accents (#26A69A)
- ✅ **Theme Consistency**: Unified navigation bar colors across all pages
- ✅ **Responsive Design**: Optimized layouts for mobile, tablet, and desktop
- ✅ **Image Viewer**: Fullscreen image viewer for recipe and instruction images
- ✅ **Recipe Cards**: Proper visual hierarchy (Image → Header → Content → Actions)
- ✅ **Form Labels**: Fixed label overlap in number input fields
- ✅ **Hydration Fixes**: Eliminated theme flash on page reload

#### Internationalization & Accessibility
- ✅ **Google Translate Support**: DOM mutation patch prevents crashes during translation
- ✅ **Translation-Safe Components**: Auth toggle buttons remain functional in all languages
- ✅ **Structural Isolation**: Interactive elements protected from translation DOM mutations

#### Testing & Quality
- ✅ **910/910 Tests Passing**: 100% pass rate with 0 failures
- ✅ **97.28% Coverage**: Statements coverage across all layers
- ✅ **98.16% Line Coverage**: Comprehensive line-level testing
- ✅ **0 Flaky Tests**: Deterministic, reliable test suite

#### Production Infrastructure
- ✅ **Vercel Deployment**: Auto-deploy from main branch
- ✅ **Vercel Postgres**: Production database (Neon)
- ✅ **Cloudinary CDN**: Image storage and delivery
- ✅ **Security Hardened**: JWT auth, rate limiting, security headers
- ✅ **Performance Optimized**: Fast page loads and smooth interactions

---

**Status:** Live in Production ✅
