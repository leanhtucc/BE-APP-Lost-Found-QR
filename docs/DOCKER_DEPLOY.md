# 🐳 Docker Deployment Guide

## 📋 Prerequisites

- Docker Desktop installed
- Docker Compose installed

## 🚀 Quick Start (Local with Docker)

### 1. Setup Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
```

### 2. Build and Run

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Check status
docker-compose ps
```

### 3. Run Migrations

```bash
# Migrations run automatically on startup
# Or run manually:
docker-compose exec backend npx prisma migrate deploy
```

### 4. Access API

```
http://localhost:3000
http://localhost:3000/api/auth/register
```

---

## 🛠️ Docker Commands

### Start Services

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose down
```

### Rebuild

```bash
docker-compose up -d --build
```

### View Logs

```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Database only
docker-compose logs -f db
```

### Access Container

```bash
# Backend shell
docker-compose exec backend sh

# Database shell
docker-compose exec db psql -U backend_user -d backend_db
```

### Clean Up

```bash
# Stop and remove containers, networks
docker-compose down

# Remove volumes too (⚠️ deletes database data)
docker-compose down -v
```

---

## 🌐 Deploy to Production

### Option 1: Docker Hub

```bash
# 1. Build image
docker build -t your-username/backend-api:latest .

# 2. Login to Docker Hub
docker login

# 3. Push image
docker push your-username/backend-api:latest

# 4. On server, pull and run
docker pull your-username/backend-api:latest
docker run -d -p 3000:3000 --env-file .env your-username/backend-api:latest
```

### Option 2: Render with Docker

1. Create `render.yaml`:

```yaml
services:
  - type: web
    name: backend-api
    env: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        generateValue: true
```

2. Push to GitHub and connect to Render

### Option 3: Railway

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Add environment variables
railway variables set DATABASE_URL=...

# 5. Deploy
railway up
```

---

## 🔧 Troubleshooting

### Database Connection Error

```bash
# Check if database is ready
docker-compose exec db pg_isready -U backend_user

# Restart database
docker-compose restart db
```

### Port Already in Use

```bash
# Change port in docker-compose.yml
ports:
  - "3001:3000"  # Use port 3001 instead
```

### Permission Errors

```bash
# Run with sudo (Linux/Mac)
sudo docker-compose up -d

# Or fix Docker permissions
sudo usermod -aG docker $USER
```

---

## 📊 Database Backup

```bash
# Backup
docker-compose exec db pg_dump -U backend_user backend_db > backup.sql

# Restore
docker-compose exec -T db psql -U backend_user backend_db < backup.sql
```

---

## 🎯 Production Checklist

- [ ] Update `.env` with production values
- [ ] Change `JWT_SECRET` to strong random string
- [ ] Set `NODE_ENV=production`
- [ ] Update `GOOGLE_CALLBACK_URL` to production URL
- [ ] Use production database (not local PostgreSQL)
- [ ] Setup SMTP with production credentials
- [ ] Enable SSL/HTTPS
- [ ] Setup logging and monitoring
- [ ] Configure CORS properly
- [ ] Setup health checks
- [ ] Enable rate limiting

---

✅ **Done!** Your app is now running in Docker! 🎉
