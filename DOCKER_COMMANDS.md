# Docker Commands Reference - MB4 Service

Quick reference for Docker commands using `Dockerfile2` and `docker-compose.2.yml`.

## Quick Start

### Development
```bash
# Start development environment
docker-compose -f docker-compose.2.yml --profile dev up -d

# View logs
docker-compose -f docker-compose.2.yml --profile dev logs -f
```

### Production
```bash
# Start production environment
docker-compose -f docker-compose.2.yml --profile prod up -d

# Verify deployment
curl http://localhost:8083/healthz
```

## Essential Commands

### Start/Stop
```bash
# Start services
docker-compose -f docker-compose.2.yml --profile dev up -d    # development
docker-compose -f docker-compose.2.yml --profile prod up -d   # production

# Stop services
docker-compose -f docker-compose.2.yml down

# Restart services
docker-compose -f docker-compose.2.yml restart
```

### Logs & Monitoring
```bash
# View logs
docker-compose -f docker-compose.2.yml logs -f mb4-service      # dev logs
docker-compose -f docker-compose.2.yml logs -f mb4-service-prod # prod logs

# Check status
docker-compose -f docker-compose.2.yml ps

# Check health
curl http://localhost:8083/healthz
```

### Development Workflow
```bash
# Install packages inside container
docker-compose -f docker-compose.2.yml exec mb4-service npm install <package>

# Access container shell
docker-compose -f docker-compose.2.yml exec mb4-service /bin/bash
docker-compose -f docker-compose.2.yml exec mb4-service-prod /bin/bash

# Run tests
docker-compose -f docker-compose.2.yml exec mb4-service npm test
```

## Build & Deploy

### Build
```bash
# Build with changes
docker-compose -f docker-compose.2.yml --profile prod build

# Force rebuild (no cache)
docker-compose -f docker-compose.2.yml --profile prod build --no-cache
```

### Deploy Production
```bash
# Stop old containers
docker-compose -f docker-compose.2.yml down

# Build and start production
docker-compose -f docker-compose.2.yml --profile prod up -d --build

# Verify
curl http://localhost:8083/healthz
```

## Cleanup

### Basic Cleanup
```bash
# Stop and remove containers
docker-compose -f docker-compose.2.yml down

# Remove containers and volumes
docker-compose -f docker-compose.2.yml down -v
```

### Full Cleanup
```bash
# Remove everything (containers, images, volumes)
docker-compose -f docker-compose.2.yml down -v --rmi all

# Clean up Docker system
docker system prune -a --volumes
```

## Troubleshooting

### Common Issues
```bash
# Check if port is in use
lsof -i :8083

# View container logs
docker logs mb4-service-container-dev
docker logs mb4-service-container-prod

# Inspect network connectivity
docker network inspect shared_network
```

### Reset Everything
```bash
# Complete reset
docker-compose -f docker-compose.2.yml down -v --rmi all
docker system prune -a --volumes

# Start fresh
docker-compose -f docker-compose.2.yml --profile prod up -d --build
```

## Environment Setup

### Prerequisites
```bash
# Create environment file
cp production.env.template .env

# Edit with your values
nano .env
```

### Required Network
```bash
# Create shared network (if needed)
docker network create shared_network
```

## Service URLs

- **Production API:** http://localhost:8083
- **Health Check:** http://localhost:8083/healthz
- **Internal Network:** http://mb4-service-container-prod:8080 (from other containers)

## Container Names

- **Development:** `mb4-service-container-dev`
- **Production:** `mb4-service-container-prod`