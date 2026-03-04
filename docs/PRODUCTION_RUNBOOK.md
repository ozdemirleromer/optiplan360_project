# PRODUCTION RUNBOOK — OptiPlan360

**Versiyon:** 2.0  
**Tarih:** 2026-03-04  
**Hedef Audience:** DevOps, SRE, Production Support  
**Öncül:** BÖLÜM 9-10 testleri ve patch'leri uygulandı

---

## 🚀 DEPLOYMENT PROCEDURE

### Pre-Deployment Checklist

**48 Saat Önce:**
- [ ] Tüm testleri çalıştır: `pytest tests/ -v`
- [ ] Coverage > 80%: `pytest --cov=app --cov-report=term-missing`
- [ ] Migration'ları staging'de test et
- [ ] Database backup plan hazırla
- [ ] Rollback script'i hazırla

**4 Saat Önce:**
- [ ] Production DB backup al: `pg_dump optiplan360_prod > backup_$(date +%s).sql`
- [ ] Application health check: GET /health
- [ ] Monitoring dashboard açık tut
- [ ] On-call engineer'a bildir

**Deployment Sırasında:**
```bash
# 1. Rolling deployment (0 downtime)
# Load balancer'ı update et: instance sayısı 3→5
# → Yeni instance'lar yeni code çalıştırır

# 2. Migration'ları online olarak uygula
cd backend
alembic upgrade head
# → Staging'de test edilmiş

# 3. New version'ı 10% traffic ile test et
# → Monitoring: error rate, latency, CPU check

# 4. 100% traffic'e geç
# → Production tamamen yeni version'da

# 5. Old instance'ları kapat (3 instance)
# → Load balancer'dan remove
```

### Health Check URL'leri

```bash
# Application alive?
curl https://api.optiplan360.com/health
# → {"status": "ok", "timestamp": "2026-03-04T10:00:00Z"}

# Database connection?
curl https://api.optiplan360.com/health/db
# → {"database": "connected", "ping_ms": 2}

# Cache (Redis)?
curl https://api.optiplan360.com/health/cache
# → {"cache": "connected", "type": "redis"}

# External services (OptiPlanning)?
curl https://api.optiplan360.com/health/services
# → {"opti_planning_api": "ok", "mikro_erp": "degraded"}
```

---

## 📊 MONITORING & ALERTING

### Key Metrics (SLA guaranteed)

| Metrik | Target | Alert |
|--------|--------|-------|
| **API Response Time** | < 500ms | > 1000ms |
| **Error Rate** | < 0.1% | > 1% |
| **Database Query Time** | < 100ms | > 200ms |
| **Worker Processing** | < 5min | > 15min |
| **CPU Usage** | < 60% | > 85% |
| **Memory Usage** | < 70% | > 90% |
| **Disk Space** | > 20% free | < 10% |

### Monitoring Dashboard (Prometheus/Grafana)

```
https://monitoring.optiplan360.com/grafana
Dashboard: OptiPlan360 Production
```

**Key Panels:**
1. **Request Rate** — req/sec, by endpoint
2. **Error Rate** — errors/sec, by status code
3. **Latency** — 50th, 95th, 99th percentile
4. **Database** — connection pool, slow queries
5. **Workers** — queue depth, processing time
6. **System** — CPU, memory, disk, network

### Alert Rules (PagerDuty Integration)

```yaml
# Error rate spike
- alert: HighErrorRate
  condition: error_rate > 0.01  # 1%
  duration: 5m
  severity: critical
  notify: on-call-engineer@company.com

# Slow database
- alert: SlowDatabase
  condition: db_query_time_p95 > 200ms
  duration: 10m
  severity: warning

# Worker backlog
- alert: WorkerBacklog
  condition: queue_depth > 1000
  duration: 15m
  severity: warning

# Deployment failed
- alert: DeploymentFailed
  condition: deployment_status == "failed"
  duration: 1m
  severity: critical
  notify: devops-team@company.com
```

---

## 🆘 TROUBLESHOOTING

### Problem 1: API Timeout (HTTP 504)

**Semptom:** All endpoints return 504 Gateway Timeout

**Diagnosis:**
```bash
# 1. Server alive?
ssh prod-app-1.example.com
systemctl status optiplan360
# → Active (running) ✅ veya Inactive ❌

# 2. Application logs
tail -f /var/log/optiplan360/app.log
# → ERROR, CRITICAL messages ara

# 3. Database connection
psql -U optiplan360 -h db.example.com -c "SELECT 1"
# → Error: connection refused?

# 4. Network connectivity
ping db.example.com
telnet db.example.com 5432
# → timeout → firewall/network issue
```

**Quick Fix:**
```bash
# Restart application (last resort)
systemctl restart optiplan360
# → Health check: curl https://api.optiplan360.com/health

# Check logs for startup errors
journalctl -u optiplan360 -n 50 --follow
```

**Root Cause Examples:**
- Database connection pool exhausted
- External API (OptiPlanning) down
- Out of memory
- Network issue

---

### Problem 2: High Error Rate (5xx errors spike)

**Semptom:** Error rate > 1%, users report failures

**Diagnosis:**
```bash
# 1. Error distribution
curl https://monitoring.optiplan360.com/api/errors?window=5m
# → Top errors by endpoint

# 2. Application logs (last 100 errors)
tail -100 /var/log/optiplan360/error.log

# 3. Specific error analysis
grep "ExportValidator" /var/log/optiplan360/error.log | head -20
# → Pattern recognition

# 4. Database issue check
SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active';
# → Stuck queries?

# 5. Recent deployments
git log --oneline -5
# → Related changes?
```

**Quick Fix:**
```bash
# Option 1: Rollback (fastest)
systemctl stop optiplan360
git checkout previous-version
pip install -r requirements.txt
alembic downgrade -1  # Undo migration if needed
systemctl start optiplan360

# Option 2: Restart with clean state
systemctl restart optiplan360
# → Clear caches, reset connections

# Option 3: Scale up (if load-related)
# Load balancer instance sayısını 5→8 yap
```

---

### Problem 3: Slow Queries / Database Performance

**Semptom:** DB query time > 200ms, p95 latency spike

**Diagnosis:**
```bash
# 1. PostgreSQL logs
tail -100 /var/log/postgresql/postgresql.log | grep "duration"
# → Query time > log_min_duration_statement (500ms)

# 2. Slow query log
SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
# → Top 10 slowest queries

# 3. Index analysis
EXPLAIN ANALYZE
SELECT * FROM orders WHERE status = 'PENDING' AND created_at > NOW() - INTERVAL 7 days;
# → "Seq Scan" (bad) vs "Index Scan" (good)

# 4. Missing index check
SELECT schemaname, tablename FROM pg_tables 
WHERE schemaname='public' 
AND tablename IN ('orders', 'opti_jobs', 'invoices');
# → Check against SECTION_7_8_FINAL_REPORT.md index list
```

**Quick Fix:**
```bash
# Missing index oluştur (non-blocking)
CREATE INDEX CONCURRENTLY ix_orders_status_created 
ON orders(status, created_at DESC);

# Stale statistics update
ANALYZE orders;

# Connection pool reset (careful!)
systemctl restart pgbouncer  # If using connection pooler

# Query optimization
# EXPLAIN ANALYZE output'u review et
# OR → Index var mı? VACUUM ANALYZE yap
```

---

### Problem 4: Memory Leak / OOM (Out of Memory)

**Semptom:** Memory usage %85+ and climbing, processes killed

**Diagnosis:**
```bash
# 1. Memory usage per process
ps aux | grep python | sort -k4 -nr
# → Memory (%MEM) column

# 2. Memory trend (last 24h)
curl https://monitoring.optiplan360.com/api/memory?period=24h
# → Increasing trend?

# 3. Object count (memory profiling)
# Application'da enable et: tracemalloc
python -m trace --trace app/main.py 2>&1 | grep "memory"

# 4. Cache size
redis-cli
> INFO memory
> DBSIZE  # How many keys?
```

**Quick Fix:**
```bash
# Graceful restart (drain connections first)
systemctl reload optiplan360  # SIGHUP → graceful shutdown

# Clear Redis cache
redis-cli FLUSHDB

# Reduce worker concurrency (temp)
# workers=4 → workers=2 in supervisor config

# Identify leak (Python)
pip install memory-profiler
apt install graphviz
python -m memory_profiler app/services/orchestrator_service.py
```

---

### Problem 5: Migration Failed / Rollback Needed

**Semptom:** Deployment başarız, database corrupt, application down

**Diagnosis:**
```bash
# 1. Migration status
alembic current
# → 2a1b3c4d (new) vs 1a2b3c4d (old)?

# 2. Database state
psql -U optiplan360 -h db.example.com -c "\d orders"
# → Schema doğru mu? Columns expected mi?

# 3. Application errors
tail /var/log/optiplan360/app.log | grep -i "migration\|table\|column"
```

**Rollback Procedure:**
```bash
# HIZLI ROLLBACK (< 2 dakika):

# 1. Application stop
systemctl stop optiplan360

# 2. Database downgrade
alembic downgrade -1
# → Previous migration'a geri dön

# 3. Code rollback
git checkout previous-stable-commit
pip install -r requirements.txt

# 4. Restart
systemctl start optiplan360

# 5. Health check
curl https://api.optiplan360.com/health
# → {"status": "ok"}

# 6. Monitor error rate
# Error rate < 0.1% ✅ → Success
# Error rate > 1% ❌ → Check logs again
```

**Detailed Rollback (if quick doesn't work):**
```sql
-- Manual database recovery (PostgreSQL)
BEGIN;

-- Check current state
SELECT version FROM alembic_version;

-- Manually undo problematic changes
-- (Migration file'ı kapat, down() fonksiyonunu incele)

-- Example: Undo column addition (migration fail ed)
ALTER TABLE orders DROP COLUMN IF EXISTS new_column;

COMMIT;
```

---

## 🚨 INCIDENT RESPONSE

### Severity Levels

| Level | Response | Example |
|-------|----------|---------|
| **Critical** | 15 min SLA | Database down, API 100% failure |
| **High** | 30 min SLA | API 50% failure, data loss risk |
| **Medium** | 2 hour SLA | Performance issue, single feature broken |
| **Low** | 4 hour SLA | Minor bug, cosmetic issue |

### Incident Playbook

#### **Adım 1: Assess (1 min)**
```bash
# 1. Problem nedir?
# 2. Kaç user etkileniyor?
# 3. Severity level?

# Quick diagnostic
curl https://api.optiplan360.com/health -v
tail -50 /var/log/optiplan360/error.log
curl https://monitoring.optiplan360.com/api/errors?window=5m
```

#### **Adım 2: Mitigate (2-5 min)**
```bash
# Immediate action (kötü hâli durdur):
- Problematic feature'ı disable et (feature flag)
- Load balancer: instance remove et
- Cache clear et (if cache-related)
- Database connection pool reset et
```

#### **Adım 3: Communicate (1 min)**
```bash
# Slack/PagerDuty'de:
"🚨 Incident: Orders Export timing out (Critical)"
"Affected: export.optiplan360.com users"
"Impact: 237 users"
"Status: Investigating"
"ETA: 15 minutes"
"Incident Lead: @engineer-name"
```

#### **Adım 4: Diagnose (5-15 min)**
```bash
# Root cause analysis
# - Logs review
# - Monitoring data
# - Database queries
# - Recent deployments
# → Document findings
```

#### **Adım 5: Implement Fix (5-30 min)**
```bash
# Option A: Quick fix
- Rollback recent change
- Restart application
- Scale up resources

# Option B: Patch
- Fix code locally
- Test on staging
- Deploy to production

# Option C: Workaround
- Feature flag disable
- Redirect traffic
- Use backup system
```

#### **Adım 6: Validate (2-5 min)**
```bash
# Verify fix
curl https://api.optiplan360.com/health
# → {"status": "ok"}

# Error rate metric
# → < 0.1% (normal) ✅

# User reports
# → No more complaints
```

#### **Adım 7: Communicate Resolution**
```bash
# Slack/PagerDuty:
"✅ Incident Resolved"
"Duration: 18 minutes"
"Root cause: Query performance (missing index)"
"Fix: Added ix_orders_status_created index"
"Post-mortem: Tomorrow 2pm"
```

#### **Adım 8: Post-Mortem (24 hours)**
```
Post-Mortem Meeting
- Timeline (what happened when)
- Root cause (why)
- Impact (how many users, how long)
- Fix (what we did)
- Prevention (how to prevent next time)
- Action items (with owners)
```

---

## 📋 MAINTENANCE TASKS

### Daily (Automated)

```bash
# Database backup (3:00 AM)
pg_dump -U optiplan360 -h db.example.com optiplan360_prod > /backups/optiplan360_prod_$(date +%Y%m%d).sql

# Log rotation (managed by logrotate)
/etc/logrotate.d/optiplan360

# Health check (every 5 min)
curl --silent https://api.optiplan360.com/health || alert_ops

# Metrics collection (every 60s)
prometheus scrape
```

### Weekly

```bash
# Performance report
- Error rate trend
- Latency trend
- Database growth
- Cache hit ratio

# Security scan
- Dependency vulnerabilities (pip-audit)
- Code scan (if integrated)
- Access logs review

# Capacity planning
- Disk usage trend
- CPU/memory trend
- Database size growth
```

### Monthly

```bash
# Database maintenance
VACUUM ANALYZE;  # PostgreSQL

# Log archival
# gzip older logs, move to S3

# Performance tuning review
- Slow queries
- Missing indexes
- Inefficient code paths

# Compliance check
- Backups verified (restore test)
- Access control reviewed
- Security policies updated
```

---

## 🔑 IMPORTANT CONTACTS

```
On-Call Engineer: @current-on-call in Slack
DevOps Team: devops@company.com
Database Admin: dba@company.com
Security Team: security@company.com

Escalation:
- P1 (Critical): CTO → VP Engineering → CEO
- P2 (High): Engineering Manager → CTO
- P3 (Medium): Team Lead → Engineering Manager
```

---

## 📊 SLA & METRICS

### Service Level Agreement (SLA)

```
Availability: 99.9% (43 minutes downtime/month allowed)
Response Time: 95th percentile < 500ms
Error Rate: < 0.1%
Backup: Daily, tested monthly
Disaster Recovery RTO: < 4 hours
Disaster Recovery RPO: < 1 hour
```

### Current Metrics (Last 30 days)

```bash
curl https://monitoring.optiplan360.com/api/sla/current
→ {
  "availability": 99.95,
  "error_rate": 0.08,
  "avg_response_time": 320,
  "p95_response_time": 420,
  "slo_violations": 0
}
```

---

## 🚀 EMERGENCY PROCEDURES

### Database Disaster Recovery

**Scenario:** Main database corrupted/lost

```bash
# 1. Detect (from backup monitor)
# → Latest backup: 6 hours old

# 2. Prepare standby server
ssh standby-db.example.com

# 3. Restore from backup
pg_restore -U optiplan360 /backups/optiplan360_prod_latest.sql
# → ~2 minutes restore time

# 4. Point application to standby
# app/config.py: DATABASE_URL = "postgresql://standby-db.example.com/..."
# systemctl restart optiplan360

# 5. Verify data integrity
SELECT COUNT(*) FROM orders;  # Should match pre-incident count

# 6. Failover complete
# Data loss: up to 6 hours (between backups)
```

### Complete Application Failure

**Scenario:** All servers down, load balancer dead

```bash
# 1. Switch to disaster recovery datacenter
# Load balancer: DNS update → DR datacenter

# 2. Restore application
cd /opt/optiplan360
git checkout stable-tag
pip install -r requirements.txt
python main.py

# 3. Restore database
pg_restore /backups/latest.sql

# 4. Test critical functionality
curl https://api-dr.optiplan360.com/health
# → Should work in < 30 min

# 5. Notify customers
# Email: "We experienced an outage. Services restored."
```

---

## 📞 ESCALATION TREE

```
Problem → On-Call Engineer
    ↓ (If P1 or unresolved in 30 min)
    → Engineering Manager
    ↓ (If still unresolved in 1 hour)
    → CTO / VP Engineering
    ↓ (If customer impact)
    → CEO / Customer Success
```

---

**Last Updated:** 2026-03-04  
**Next Review:** 2026-04-04  
**Maintained By:** DevOps Team
