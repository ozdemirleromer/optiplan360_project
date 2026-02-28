#!/bin/bash

# OptiPlan 360 Security Audit Script
# This script performs comprehensive security checks on the application

set -e

echo "🔒 OptiPlan 360 Security Audit Started"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if required tools are installed
check_tools() {
    echo "Checking required security tools..."
    
    command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed."; exit 1; }
    command -v python3 >/dev/null 2>&1 || { echo "Python3 is required but not installed."; exit 1; }
    
    print_status 0 "Required tools are installed"
}

# Backend Security Checks
backend_security() {
    echo "🔍 Running Backend Security Checks..."
    
    cd backend
    
    # Check for hardcoded secrets
    echo "  - Checking for hardcoded secrets..."
    if grep -r "password\|secret\|key" --include="*.py" --exclude-dir=__pycache__ . | grep -v "password_hash\|SECRET_KEY\|test" > /tmp/secrets_check.txt; then
        print_warning "Potential hardcoded secrets found:"
        cat /tmp/secrets_check.txt
    else
        print_status 0 "No hardcoded secrets found"
    fi
    
    # Run Bandit security linter
    echo "  - Running Bandit security linter..."
    if command -v bandit >/dev/null 2>&1; then
        bandit -r app/ -f json -o /tmp/bandit_report.json
        if [ $? -eq 0 ]; then
            print_status 0 "Bandit scan completed"
        else
            print_warning "Bandit found security issues"
        fi
    else
        print_warning "Bandit not installed, skipping..."
    fi
    
    # Check dependencies for vulnerabilities
    echo "  - Checking Python dependencies for vulnerabilities..."
    if command -v safety >/dev/null 2>&1; then
        safety check --json --output /tmp/safety_report.json
        print_status 0 "Safety dependency check completed"
    else
        print_warning "Safety not installed, skipping..."
    fi
    
    cd ..
}

# Frontend Security Checks
frontend_security() {
    echo "🔍 Running Frontend Security Checks..."
    
    cd frontend
    
    # Check for hardcoded secrets
    echo "  - Checking for hardcoded secrets..."
    if grep -r "password\|secret\|key\|token" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" src/ | grep -v "passwordValidation\|SECURITY_CONFIG\|tokenStorage" > /tmp/frontend_secrets.txt; then
        print_warning "Potential hardcoded secrets found in frontend:"
        cat /tmp/frontend_secrets.txt
    else
        print_status 0 "No hardcoded secrets found in frontend"
    fi
    
    # Run npm audit
    echo "  - Running npm audit..."
    npm audit --audit-level=moderate --json > /tmp/npm_audit.json
    if [ $? -eq 0 ]; then
        print_status 0 "npm audit completed"
    else
        print_warning "npm audit found vulnerabilities"
    fi
    
    # Check for XSS vulnerabilities
    echo "  - Checking for potential XSS vulnerabilities..."
    if grep -r "dangerouslySetInnerHTML\|innerHTML\|document.write" src/ > /tmp/xss_check.txt; then
        print_warning "Potential XSS vulnerabilities found:"
        cat /tmp/xss_check.txt
    else
        print_status 0 "No obvious XSS vulnerabilities found"
    fi
    
    cd ..
}

# Infrastructure Security Checks
infrastructure_security() {
    echo "🔍 Running Infrastructure Security Checks..."
    
    # Check Docker images for vulnerabilities
    echo "  - Scanning Docker images with Trivy..."
    if command -v trivy >/dev/null 2>&1; then
        trivy image --format json --output /tmp/trivy_backend.json optiplan360-backend:latest || true
        trivy image --format json --output /tmp/trivy_frontend.json optiplan360-frontend:latest || true
        print_status 0 "Docker image security scan completed"
    else
        print_warning "Trivy not installed, skipping Docker image scan..."
    fi
    
    # Check for exposed ports in docker-compose
    echo "  - Checking Docker Compose configuration..."
    if grep -r "8080:8080\|3000:3000" docker-compose.yml > /dev/null; then
        print_warning "Ports exposed to all interfaces in docker-compose.yml"
    else
        print_status 0 "Docker Compose ports properly configured"
    fi
    
    # Check for environment variables in docker-compose
    echo "  - Checking for sensitive environment variables..."
    if grep -r "SECRET_KEY\|PASSWORD\|TOKEN" docker-compose.yml > /tmp/docker_secrets.txt; then
        print_warning "Potential sensitive data in docker-compose.yml:"
        cat /tmp/docker_secrets.txt
    else
        print_status 0 "No sensitive data found in docker-compose.yml"
    fi
}

# Generate Security Report
generate_report() {
    echo "📊 Generating Security Report..."
    
    cat > security_audit_report.md << EOF
# OptiPlan 360 Security Audit Report

**Date:** $(date)
**Environment:** Development

## Executive Summary

This report contains the results of a comprehensive security audit of the OptiPlan 360 application.

## Backend Security

### Code Analysis
- Bandit Security Linter: [$(test -f /tmp/bandit_report.json && echo "Completed" || echo "Skipped")]
- Dependency Scan: [$(test -f /tmp/safety_report.json && echo "Completed" || echo "Skipped")]
- Secret Detection: [$(test -s /tmp/secrets_check.txt && echo "Issues Found" || echo "Clean")]

### Recommendations
- Implement proper secret management (e.g., HashiCorp Vault)
- Add rate limiting to API endpoints
- Implement proper logging and monitoring

## Frontend Security

### Code Analysis
- npm Audit: [$(test -f /tmp/npm_audit.json && echo "Completed" || echo "Skipped")]
- XSS Detection: [$(test -s /tmp/xss_check.txt && echo "Issues Found" || echo "Clean")]
- Secret Detection: [$(test -s /tmp/frontend_secrets.txt && echo "Issues Found" || echo "Clean")]

### Recommendations
- Implement Content Security Policy headers
- Add input validation and sanitization
- Use secure cookie settings

## Infrastructure Security

### Container Security
- Docker Image Scan: [$(test -f /tmp/trivy_backend.json && echo "Completed" || echo "Skipped")]
- Configuration Review: [$(test -s /tmp/docker_secrets.txt && echo "Issues Found" || echo "Clean")]

### Recommendations
- Use environment-specific configurations
- Implement proper network segmentation
- Add monitoring and alerting

## Next Steps

1. Address identified vulnerabilities
2. Implement automated security scanning in CI/CD
3. Regular security audits and penetration testing
4. Security training for development team

EOF

    print_status 0 "Security report generated: security_audit_report.md"
}

# Cleanup
cleanup() {
    echo "🧹 Cleaning up temporary files..."
    rm -f /tmp/secrets_check.txt /tmp/frontend_secrets.txt /tmp/xss_check.txt /tmp/docker_secrets.txt
    print_status 0 "Cleanup completed"
}

# Main execution
main() {
    check_tools
    backend_security
    frontend_security
    infrastructure_security
    generate_report
    cleanup
    
    echo ""
    echo "🎉 Security audit completed!"
    echo "📄 Report available at: security_audit_report.md"
}

# Run the audit
main "$@"
