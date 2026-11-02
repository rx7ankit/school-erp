# Slov

Monorepo for the School ERP platform.

```
apps/
  web/        # web frontend
  ios/        # iOS app
  android/    # Android app
  api/        # FastAPI (async) backend
    app/
      api/v1/     # routers
      core/       # config, security
      db/         # async session, base
      models/     # SQLAlchemy models
      schemas/    # Pydantic schemas
      services/   # business logic
      workers/    # background jobs (Redis)
    alembic/      # DB migrations
    tests/
packages/brand/ # logo, favicon, app icons (Slov)
docs/         # product & architecture notes
infra/        # docker-compose (Postgres, Redis)
```

## Stack
- Backend: FastAPI (async), SQLAlchemy async, Alembic, PostgreSQL 18, Redis
- Clients: web, iOS, Android

## Backend
See `apps/api/README.md`. Tests run against real Postgres and Redis.

## Local services
```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
```
