# OptiPlan360 Production Deployment Runbook

Comprehensive deployment guide for OptiPlan360 production environment.

## 🚀 Pre-Deployment Checklist

### Environment Preparation
- [ ] **Server Resources**: Minimum 8GB RAM, 4 CPU cores, 100GB SSD
- [ ] **Operating System**: Ubuntu 20.04+ or CentOS 8+
- [ ] **Docker**: v20.10+ installed and running
- [ ] **Docker Compose**: v2.0+ installed
- [ ] **SSL Certificates**: Valid certificates ready
- [ ] **Domain**: DNS configured and pointing to server
- [ ] **Firewall**: Ports 80, 443, 8080 open
- [ ] **Backup**: Current production backup available

### Application Configuration
- [ ] **Environment Variables**: All required variables set
- [ ] **Database**: PostgreSQL 14+ configured
- [ ] **Redis**: Cache server configured
- [ ] **Nginx**: Reverse proxy configured
- [ ] **Monitoring**: Prometheus/Grafana ready
- [ ] **Logging**: Log rotation configured

### Security Setup
- [ ] **Secret Key**: 32+ character secure key generated
- [ ] **Database Password**: Strong password set
- [ ] **JWT Settings**: Proper expiration and refresh
- [ ] **Rate Limiting**: Configured for production
- [ ] **HTTPS**: SSL/TLS certificates installed
- [ ] **Firewall Rules**: Only necessary ports open

## 📋 Deployment Steps

### 1. System Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create application directory
sudo mkdir -p /opt/optiplan360
sudo chown $USER:$USER /opt/optiplan360
cd /opt/optiplan360
```

### 2. Application Deployment
```bash
# Clone repository
git clone https://github.com/your-org/optiplan360.git .
git checkout production

# Set up environment
cp .env.example .env
nano .env  # Edit with production values

# Build and start services
docker-compose -f docker-compose.prod.yml up -d --build
```

### 3. Database Setup
```bash
# Wait for database to be ready
docker-compose exec postgres pg_isready -U optiplan360

# Run migrations
docker-compose exec backend alembic upgrade head

# Create admin user
docker-compose exec backend python create_admin_user.py
```

### 4. SSL Certificate Setup
```bash
# Using Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com

# Or upload custom certificates
sudo mkdir -p /etc/nginx/ssl
sudo cp your-cert.pem /etc/nginx/ssl/
sudo cp your-key.pem /etc/nginx/ssl/
```

### 5. Nginx Configuration
```bash
# Configure reverse proxy
sudo cp nginx/nginx.prod.conf /etc/nginx/sites-available/optiplan360
sudo ln -s /etc/nginx/sites-available/optiplan360 /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 🔧 Configuration Files

### Environment Variables (.env)
```bash
# Application
OPTIPLAN_ENV=production
OPTIPLAN_SECRET_KEY=your-32-character-secure-key-here
OPTIPLAN_MASTER_KEY=your-master-encryption-key

# Database
DATABASE_URL=postgresql://optiplan360:secure-password@postgres:5432/optiplan360
REDIS_URL=redis://redis:6379/0

# Frontend
VITE_API_URL=https://yourdomain.com/api/v1
VITE_APP_URL=https://yourdomain.com

# Backend
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8080

# SSL
SSL_CERT_PATH=/etc/nginx/ssl/your-cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/your-key.pem

# Monitoring
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
```

### Docker Compose Production (docker-compose.prod.yml)
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: optiplan360
      POSTGRES_USER: optiplan360
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      - DATABASE_URL=postgresql://optiplan360:${DATABASE_PASSWORD}@postgres:5432/optiplan360
      - REDIS_URL=redis://redis:6379/0
      - OPTIPLAN_SECRET_KEY=${OPTIPLAN_SECRET_KEY}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    volumes:
      - ./exports:/app/exports
      - ./logs:/app/logs

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    environment:
      - VITE_API_URL=https://yourdomain.com/api/v1
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

volumes:
  postgres_data:
```

### Nginx Production Config (nginx/nginx.prod.conf)
```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8080;
    }

    upstream frontend {
        server frontend:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/s;

    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/your-cert.pem;
        ssl_certificate_key /etc/nginx/ssl/your-key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Login with stricter rate limiting
        location /api/v1/auth/login {
            limit_req zone=login burst=5 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## 🔍 Post-Deployment Verification

### Health Checks
```bash
# Check service status
docker-compose ps

# Check application health
curl -f https://yourdomain.com/api/v1/health

# Check SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Test database connection
docker-compose exec backend python -c "from app.database import SessionLocal; print('DB OK')"
```

### Functionality Tests
```bash
# Test authentication
curl -X POST https://yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# Test API endpoints
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://yourdomain.com/api/v1/orders

# Test frontend
curl -I https://yourdomain.com
```

### Performance Verification
```bash
# Load test
k6 run --vus 10 --duration 30s load-test.js

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/api/v1/health
```

## 📊 Monitoring Setup

### Prometheus Configuration
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'optiplan360'
    static_configs:
      - targets: ['backend:8080']
    metrics_path: '/metrics'
```

### Grafana Dashboard
- System metrics (CPU, memory, disk)
- Application metrics (response time, error rate)
- Database metrics (connections, query time)
- Business metrics (orders per hour, users active)

## 🔄 Maintenance Procedures

### Database Backup
```bash
# Automated daily backup
0 2 * * * docker-compose exec postgres pg_dump -U optiplan360 optiplan360 > /backups/daily_$(date +\%Y\%m\%d).sql

# Manual backup
docker-compose exec postgres pg_dump -U optiplan360 optiplan360 > backup.sql
```

### Log Rotation
```bash
# Configure logrotate
sudo nano /etc/logrotate.d/optiplan360

# Content:
/opt/optiplan360/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker-compose restart backend
    endscript
}
```

### SSL Certificate Renewal
```bash
# Auto-renewal
0 3 * * * /usr/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"

# Manual renewal
sudo certbot renew
```

## 🚨 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# Check port conflicts
sudo netstat -tulpn | grep :8080
```

#### Database Connection Issues
```bash
# Check database status
docker-compose exec postgres pg_isready -U optiplan360

# Check connection string
docker-compose exec backend python -c "import os; print(os.environ.get('DATABASE_URL'))"
```

#### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in /etc/nginx/ssl/your-cert.pem -text -noout

# Test SSL configuration
sudo nginx -t
```

#### Performance Issues
```bash
# Check system resources
htop
df -h
free -h

# Check application metrics
curl http://localhost:8080/metrics
```

### Emergency Procedures

#### Rollback Deployment
```bash
# Stop current services
docker-compose down

# Switch to previous version
git checkout previous-tag
docker-compose up -d --build

# Verify rollback
curl -f https://yourdomain.com/api/v1/health
```

#### Database Recovery
```bash
# Restore from backup
docker-compose exec postgres psql -U optiplan360 -d optiplan360 < backup.sql

# Check data integrity
docker-compose exec backend alembic current
```

## 📈 Performance Optimization

### Database Optimization
```sql
-- Create indexes
CREATE INDEX CONCURRENTLY idx_orders_status ON orders(status);
CREATE INDEX CONCURRENTLY idx_orders_created_at ON orders(created_at);

-- Analyze tables
ANALYZE orders;
ANALYZE customers;
```

### Application Optimization
```bash
# Optimize Docker images
docker system prune -f

# Configure connection pooling
# In backend/database.py
engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True
)
```

### Caching Strategy
```python
# Redis caching for frequently accessed data
import redis
r = redis.Redis(host='redis', port=6379, db=0)

# Cache API responses
def cache_key(endpoint, params):
    return f"{endpoint}:{hash(str(params))}"

def get_cached_response(key):
    return r.get(key)

def set_cached_response(key, data, ttl=300):
    r.setex(key, ttl, data)
```

## 🛡️ Security Hardening

### Firewall Configuration
```bash
# UFW setup
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 8080/tcp  # Backend only accessible via nginx
```

### Application Security
```python
# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response
```

### Monitoring Security
```bash
# Fail2ban for SSH
sudo apt install fail2ban
sudo systemctl enable fail2ban

# Monitor suspicious activities
# Log patterns to watch:
# - Multiple failed logins
# - Unusual API usage patterns
# - SQL injection attempts
```

## 📞 Contact and Support

### Emergency Contacts
- **DevOps Team**: devops@optiplan360.com
- **Database Admin**: dba@optiplan360.com
- **Security Team**: security@optiplan360.com

### Monitoring Dashboards
- **Grafana**: https://grafana.yourdomain.com
- **Prometheus**: https://prometheus.yourdomain.com
- **Application Logs**: https://logs.yourdomain.com

### Documentation
- **API Documentation**: https://docs.yourdomain.com
- **Runbook**: https://runbook.yourdomain.com
- **Architecture**: https://architecture.yourdomain.com

---

## ✅ Deployment Success Criteria

- [ ] All services running healthy
- [ ] SSL certificate valid and working
- [ ] Database migrations applied successfully
- [ ] API endpoints responding correctly
- [ ] Frontend loading without errors
- [ ] Monitoring dashboards operational
- [ ] Backup procedures tested
- [ ] Performance benchmarks met
- [ ] Security scans passed

## 📝 Post-Deployment Tasks

1. **Update Documentation**: Document any configuration changes
2. **Team Notification**: Inform all stakeholders of deployment
3. **Monitor Closely**: Watch for any issues for first 24 hours
4. **Performance Baseline**: Establish new performance baselines
5. **Backup Verification**: Ensure backup systems working
6. **Security Review**: Conduct post-deployment security assessment

---

**Version**: 1.0.0  
**Last Updated**: 2026-03-14  
**Next Review**: 2026-04-14
