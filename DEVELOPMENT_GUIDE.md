# 🚀 M-IMS Development Setup - Next Steps

## ✅ Completed So Far

1. ✅ Updated all dependencies to latest versions (Nov 2025)
2. ✅ Created complete Prisma schema (20+ entities)
3. ✅ Generated Prisma Client
4. ✅ Created Database Module and Prisma Service
5. ✅ Set up environment configuration
6. ✅ Created Docker Compose for local development

---

## 📋 Next Steps - In Order

### **Step 1: Start Local Development Environment** (5 minutes)

Start PostgreSQL, Redis, and MinIO using Docker:

```bash
# From project root
cd /Users/macbook/Hospital-Medicine-IMS
docker-compose up -d

# Verify all services are running
docker-compose ps

# You should see:
# - mims-postgres (PostgreSQL on port 5432)
# - mims-redis (Redis on port 6379)
# - mims-minio (MinIO on ports 9000, 9001)
# - mims-adminer (Database UI on port 8080)
# - mims-redis-commander (Redis UI on port 8081)
```

**Access Management UIs:**
- **Adminer (Database)**: http://localhost:8080
- **Redis Commander**: http://localhost:8081
- **MinIO Console**: http://localhost:9001 (user: minioadmin, pass: minioadmin)

---

### **Step 2: Run Database Migration** (2 minutes)

Create and apply the initial database schema:

```bash
cd mims/backend

# Create the first migration
npm run prisma:migrate

# When prompted, name it: "initial_schema"

# This will:
# 1. Create migration files
# 2. Apply migration to database
# 3. Generate Prisma Client
```

---

### **Step 3: Seed Initial Data** (Optional - 3 minutes)

Create seed data for development:

```bash
# First, create the seed file (I'll create it next)
npm run prisma:seed
```

---

### **Step 4: Test Backend Server** (2 minutes)

Start the NestJS backend:

```bash
cd mims/backend

# Start in development mode
npm run start:dev

# Backend should start on http://localhost:3001
# Swagger docs at http://localhost:3001/api/docs
```

---

### **Step 5: Setup Frontend shadcn-ui** (5 minutes)

Initialize shadcn-ui components:

```bash
cd mims/frontend

# Initialize shadcn-ui
npx shadcn-ui@latest init

# When prompted, select:
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes
# - Import alias: @/components

# Add essential components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add card
npx shadcn-ui@latest add table
npx shadcn-ui@latest add form
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add toast
```

---

### **Step 6: Test Frontend** (2 minutes)

```bash
cd mims/frontend

# Start Next.js dev server
npm run dev

# Frontend should start on http://localhost:3000
```

---

## 🛠️ Development Workflow

### Daily Development Routine:

1. **Start Services:**
   ```bash
   docker-compose up -d
   ```

2. **Start Backend:**
   ```bash
   cd mims/backend
   npm run start:dev
   ```

3. **Start Frontend:**
   ```bash
   cd mims/frontend
   npm run dev
   ```

4. **View Logs:**
   ```bash
   # Backend logs (in separate terminal)
   cd mims/backend
   npm run start:dev

   # Docker logs
   docker-compose logs -f postgres
   docker-compose logs -f redis
   ```

---

## 📊 Database Management

### View Database:
```bash
# Using Prisma Studio
cd mims/backend
npm run prisma:studio
# Opens at http://localhost:5555
```

### Create New Migration:
```bash
cd mims/backend

# After changing schema.prisma
npm run prisma:migrate

# Name your migration descriptively
# Example: "add_user_preferences"
```

### Reset Database (Development Only):
```bash
cd mims/backend
npx prisma migrate reset
# This will drop all tables and re-run migrations
```

---

## 🎯 Implementation Priority

### Week 1: Core Backend Modules

1. **Authentication Module**
   - JWT strategy implementation
   - User login/logout
   - Password hashing with Argon2
   - Hospital context middleware
   - Role guards

2. **Common Module**
   - Decorators (@CurrentUser, @HospitalId, @Roles)
   - Guards (JwtAuthGuard, RolesGuard)
   - Interceptors (Logging, Response Transform)
   - Pipes (Validation)

3. **Patient Module**
   - R-Number generator
   - Patient registration
   - Patient search
   - CNIC encryption utility

### Week 2: Inventory & Medicine

4. **Medicine Module**
   - Medicine CRUD
   - Alternative medicines
   - Medicine search

5. **Inventory Module**
   - FIFO allocator service
   - Stock batch management
   - Low stock detection

6. **Prescription Module**
   - E-prescription CRUD
   - Prescription queue

### Week 3: Issuance & Transfers

7. **Issuance Module**
   - Medicine issuance with FIFO
   - Receipt generation
   - Alternative medicine suggestion

8. **Transfer Module**
   - Transfer request workflow
   - Approval process
   - Batch mapping

### Week 4: Reports & Frontend

9. **Reports Module**
   - Daily consumption report
   - Batch expiry report
   - PDF/Excel generation

10. **Frontend Pages**
    - Login page
    - Dashboard
    - Patient registration
    - Medicine issuance
    - Inventory management

---

## 🔍 Useful Commands

### Backend:
```bash
# Lint code
npm run lint

# Format code
npm run format

# Run tests
npm test
npm run test:watch
npm run test:cov

# Build for production
npm run build
npm run start:prod
```

### Frontend:
```bash
# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build
npm run start
```

### Docker:
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v

# View logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]
```

---

## 📚 Resources

- **Prisma Docs**: https://www.prisma.io/docs
- **NestJS Docs**: https://docs.nestjs.com
- **Next.js Docs**: https://nextjs.org/docs
- **shadcn-ui**: https://ui.shadcn.com
- **TanStack Query**: https://tanstack.com/query/latest

---

## ⚠️ Important Notes

1. **Never commit `.env` files** - Always use `.env.example` as template
2. **Database Migrations** - Always create migrations, don't skip them
3. **TypeScript Strict Mode** - Keep it enabled for better code quality
4. **Hospital Context** - Always filter by hospital_id in queries
5. **Testing** - Write tests as you develop, not after

---

## 🐛 Troubleshooting

### Database Connection Error:
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Prisma Client Issues:
```bash
# Regenerate Prisma Client
npm run prisma:generate

# Reset if needed
npx prisma migrate reset
```

### Port Already in Use:
```bash
# Check what's using the port
lsof -i :3001  # Backend
lsof -i :3000  # Frontend
lsof -i :5432  # PostgreSQL

# Kill process
kill -9 [PID]
```

---

## 🎉 You're Ready to Start!

Your development environment is now set up. Follow the next steps in order, and you'll have a working application soon!

**Current Status:**
- ✅ Dependencies installed
- ✅ Prisma schema created
- ✅ Database infrastructure ready
- ✅ Docker Compose configured
- ⏳ Ready for database migration
- ⏳ Ready for first module implementation

**Next Command:**
```bash
docker-compose up -d
cd mims/backend
npm run prisma:migrate
```

Good luck with your development! 🚀
