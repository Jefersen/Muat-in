# Muat-In Backend Services

Welcome to the backend repository of **Muat-In**—an intelligent load planning and ODOL (Over Dimension Over Loading) risk detection platform for logistics.

## Monorepo Architecture

This workspace is structured as a monorepo containing both the Android native application, NestJS backend API, and Python FastAPI calculations engine:

```
/
├── app/                  # Android Native App (Kotlin)
├── database/             # Database DDL & Seed Scripts
│   └── schema.sql        # Database initialization script
├── nestjs-backend/       # NestJS (TypeScript) REST API Gateway
│   ├── Dockerfile
│   └── ...
├── python-ai-engine/     # Python FastAPI AI & Packing Engine
│   ├── Dockerfile
│   └── ...
├── docker-compose.yml    # Orchestrates local PostgreSQL + NestJS + FastAPI
├── .env.example          # Environment variables template
└── README.md             # Setup guide
```

---

## Local Setup Instructions

### 1. Configure Environment Variables
Due to security constraints, you must create and maintain your own local `.env` configuration file:
- Copy the provided `.env.example` file to `.env` in the root directory:
  ```bash
  cp .env.example .env
  ```
- Open `.env` and fill in your Supabase connection strings and credentials (if testing against staging/production Supabase):
  - `DATABASE_URL` (defaults to local docker database if left unmodified)
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_JWT_SECRET`

### 2. Run the Stack with Docker Compose
Start the database, API server, and calculation engine together:
```bash
docker compose up --build
```

- **NestJS REST API Gateway**: Accessible at `http://localhost:3000`
- **Python FastAPI AI Engine**: Accessible at `http://localhost:8000`
- **Local PostgreSQL**: Accessible at `localhost:5432` (pre-populated with schema and sample seeds)

---

## Git Workflow for Backend Contributions
All backend changes are isolated inside the `backend-setup` branch:
1. Make changes inside `nestjs-backend/` or `python-ai-engine/`.
2. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: [describe your changes]"
   ```
3. Push changes to the repository:
   ```bash
   git push origin backend-setup
   ```
