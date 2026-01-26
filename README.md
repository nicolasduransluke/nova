# NOVA - Human Energy Intelligence System

AI-first platform for holistic health coaching.

## Tech Stack

- **Frontend**: Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **Backend**: NestJS (TypeScript, Clean Architecture)
- **Database**: PostgreSQL with Prisma ORM
- **Monorepo**: Turborepo
- **Testing**: Jest + React Testing Library + Supertest

## Project Structure

```
nova/
├── apps/
│   ├── web/           # Next.js frontend (port 3000)
│   └── api/           # NestJS backend (port 3001)
├── packages/
│   ├── ui/            # Shared React components
│   ├── types/         # Shared TypeScript types
│   ├── config/        # Shared configs (eslint, tsconfig)
│   └── utils/         # Shared utilities
├── docker-compose.yml
└── turbo.json
```

## Prerequisites

- Node.js >= 18.0.0
- npm >= 10.0.0
- Docker & Docker Compose

## Quick Start

### 1. Clone and Install

```bash
cd nova
npm install
```

### 2. Environment Setup

```bash
# Copy environment files
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### 3. Start Database

```bash
docker compose up -d
```

### 4. Run Migrations

```bash
npm run db:generate
npm run db:migrate
```

### 5. Start Development

```bash
npm run dev
```

This starts:
- Web app: http://localhost:3000
- API: http://localhost:3001

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in development mode |
| `npm run build` | Build all apps |
| `npm run test` | Run all tests |
| `npm run lint` | Lint all packages |
| `npm run db:migrate` | Run database migrations |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:studio` | Open Prisma Studio |
| `npm run clean` | Clean all build artifacts |

## Clean Architecture (API)

```
src/
├── domain/           # Business logic, entities, value objects
│   ├── entities/
│   ├── value-objects/
│   └── repositories/ # Interfaces only
├── application/      # Use cases, DTOs
│   ├── use-cases/
│   └── dtos/
├── infrastructure/   # External services, database
│   ├── database/
│   └── services/
└── presentation/     # Controllers, API layer
    └── controllers/
```

## Database Schema

- **User**: Core user entity with metadata
- **Profile**: Health metrics (weight, height, age, sex, objective)
- **DailyEntry**: Logs for food, exercise, sleep, mood, energy
- **Agent**: AI coaching agents configuration

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/users` | Create user |
| GET | `/api/users` | List users |
| GET | `/api/users/:id` | Get user by ID |

## Testing

```bash
# Run all tests
npm run test

# Run with coverage
cd apps/api && npm run test:cov

# Run e2e tests
cd apps/api && npm run test:e2e
```

## Docker

```bash
# Start PostgreSQL
docker compose up -d

# Start with pgAdmin (optional)
docker compose --profile tools up -d

# Stop all
docker compose down
```

pgAdmin available at http://localhost:5050 (admin@nova.local / admin)

## License

Private - All rights reserved
