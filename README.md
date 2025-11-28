# 🍽️ Remy's - AI-Powered Recipe Sharing Platform

[![Test Coverage](https://img.shields.io/badge/coverage-98.68%25-brightgreen)](./coverage)
[![Tests](https://img.shields.io/badge/tests-944%20passing-success)](./coverage)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black)](https://nextjs.org/)
[![Production Ready](https://img.shields.io/badge/status-production%20ready-success)](./docs/V1_LAUNCH_COMPLETE.md)

> **A modern, AI-powered recipe sharing platform where users can discover, create, and share amazing recipes with a vibrant community.**

**✅ Production Ready** - v1.0 is fully tested and ready to deploy!

---

## ✨ Key Features

- 🤖 **AI Recipe Generation** - Create custom recipes with smart AI assistance
- 🔍 **Smart Recipe Discovery** - Browse, search, and filter recipes
- 🥘 **Pantry Management** - Track ingredients and get personalized suggestions
- 💬 **Social Interaction** - Follow users, like and comment on recipes
- 📊 **User Profiles** - Personal stats, followers, and recipe collections
- 📱 **Responsive Design** - Beautiful UI that works on any device
- 🔒 **Enterprise Security** - Rate limiting, JWT auth, security headers
- 📈 **98.68% Test Coverage** - 944 tests, production-grade reliability

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
**AI:** Advanced Recipe Generation
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

**Coverage:** 98.68% branches | 99.1% lines | 944 tests passing | 0 React warnings

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

Optional:
```env
AI_API_KEY="your-api-key"  # For AI recipe generation features
```

---

## 🏛️ Architecture

```
src/
├── app/                    # Next.js 15 App Router
│   ├── api/               # API endpoints (28+)
│   ├── error.tsx          # Global error boundary
│   ├── loading.tsx        # Loading states
│   └── not-found.tsx      # 404 page
├── components/            # React components
│   ├── recipe/           # Recipe components
│   └── auth/             # Auth components
├── contexts/             # React Context (Auth, Toast, Theme)
├── infrastructure/       # Services & repositories
│   ├── ai/              # AI recipe providers
│   ├── services/        # Business logic
│   └── repositories/    # Data access
├── lib/                  # Utilities & validation
└── middleware.ts         # Security & rate limiting
```

**Design Patterns:** Repository • Dependency Injection • Factory • Provider

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
- [x] AI recipe generation
- [x] Social features (likes, comments, follows)
- [x] Pantry management
- [x] Production-ready security
- [x] Comprehensive testing

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

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Add tests for new features
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing`)
6. Open Pull Request

---

## 📝 License

MIT License - see [LICENSE](./LICENSE) for details

---

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) - React Framework
- [Prisma](https://www.prisma.io/) - Database ORM
- [Material-UI](https://mui.com/) - Component Library
- Advanced AI Technology - Recipe Generation

---

## 📞 Support

- 📖 **Docs:** [`/docs`](./docs) folder
- 🐛 **Issues:** [GitHub Issues](https://github.com/yourusername/remys/issues)
- 💚 **Health:** `https://yourdomain.com/api/health`

---

## 🎉 Status

**✅ PRODUCTION READY**

- 944 tests passing
- 98.68% branch coverage
- 0 React act() warnings
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
- ✅ **Search System**: Fixed search bar visibility on desktop/mobile
- ✅ **Recipe Forms**: Improved instruction text fields with auto-expand (4-10 rows)
- ✅ **Recipe Details**: Added Edit/Delete buttons for recipe owners
- ✅ **Dark Mode**: Fixed image upload component for dark mode compatibility
- ✅ **Pantry**: Replaced browser confirm with Material UI dialog for delete actions
- ✅ **Image Viewer**: Added fullscreen image viewer for recipe and instruction images
- ✅ **Settings**: Simplified settings page - removed placeholders for language, notifications, and cookie preferences
- ✅ **Better UX**: Cleaner layouts and improved form usability

### v1.0.1 - Production Ready
- Initial production release with 98.68% test coverage

---

*v1.0.2 - Enhanced User Experience*
