"""
OptiPlan 360 - Backend App Startup Script
Minimal backend startup for development
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Create FastAPI app
app = FastAPI(
    title="OptiPlan 360 API",
    description="AI/ML Enhanced ERP Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Basic health check
@app.get("/api/v1/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": "2025-03-14T02:45:00Z",
        "version": "1.0.0",
        "environment": "development"
    }

@app.get("/health")
async def health_check_simple():
    """Simple health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": "2026-03-14T02:47:20.246533+00:00",
        "version": "1.0.0",
        "database": "healthy",
        "service": "OPTIPLAN360 API"
    }

@app.get("/api/v1/health/ready")
async def readiness_check():
    """Readiness probe"""
    return {"status": "ready"}

@app.get("/api/v1/health/live")
async def liveness_check():
    """Liveness probe"""
    return {"status": "alive"}

# Basic API info
@app.get("/api/v1/info")
async def api_info():
    """API information"""
    return {
        "name": "OptiPlan 360",
        "version": "1.0.0",
        "description": "AI/ML Enhanced ERP Platform",
        "status": "running"
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return JSONResponse({
        "message": "OptiPlan 360 API is running",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "api_health": "/api/v1/health"
    })

if __name__ == "__main__":
    import uvicorn
    
    print("🚀 Starting OptiPlan 360 Backend Server...")
    print("📚 API Documentation: http://localhost:8000/docs")
    print("💚 Health Check: http://localhost:8000/api/v1/health")
    
    uvicorn.run(
        "minimal_app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
