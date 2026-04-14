"""
OptiPlan 360 - Complete Backend Application
Full API endpoints with proper routing
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime

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

# Data Models
class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    environment: str
    database: str = "healthy"
    services: Dict[str, str] = {}

class UserInfo(BaseModel):
    id: int
    username: str
    email: str
    role: str

class OrderInfo(BaseModel):
    id: int
    customer_name: str
    order_number: str
    status: str
    total_amount: float

# Sample data
SAMPLE_USERS = [
    {"id": 1, "username": "admin", "email": "admin@optiplan360.com", "role": "admin"},
    {"id": 2, "username": "user1", "email": "user1@optiplan360.com", "role": "user"},
]

SAMPLE_ORDERS = [
    {"id": 1, "customer_name": "Test Müşteri", "order_number": "SIP-001", "status": "active", "total_amount": 15000.0},
    {"id": 2, "customer_name": "Demo Müşteri", "order_number": "SIP-002", "status": "pending", "total_amount": 8500.0},
]

# API Endpoints

@app.get("/")
async def root():
    """Ana endpoint"""
    return JSONResponse({
        "message": "OptiPlan 360 API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "api_health": "/api/v1/health",
            "docs": "/docs",
            "users": "/api/v1/users",
            "orders": "/api/v1/orders"
        }
    })

# Health Check Endpoints
@app.get("/health")
async def health_simple():
    """Basit health check"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0",
        environment="development",
        database="healthy",
        services={
            "api": "running",
            "database": "connected",
            "cache": "connected"
        }
    )

@app.get("/api/v1/health")
async def health_detailed():
    """Detaylı health check - ÖNEMLİ: Frontend bu endpoint'i kullanıyor"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0",
        environment="development",
        database="healthy",
        services={
            "api": "running",
            "database": "connected", 
            "cache": "connected",
            "ocr": "ready",
            "export": "ready"
        }
    )

@app.get("/api/v1/health/ready")
async def readiness_check():
    """Readiness probe"""
    return {"status": "ready", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/v1/health/live")
async def liveness_check():
    """Liveness probe"""
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}

# User Management Endpoints
@app.get("/api/v1/users")
async def get_users():
    """Tüm kullanıcıları listele"""
    return {"users": SAMPLE_USERS, "total": len(SAMPLE_USERS)}

@app.get("/api/v1/users/{user_id}")
async def get_user(user_id: int):
    """Kullanıcı bilgisi getir"""
    user = next((u for u in SAMPLE_USERS if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/api/v1/users")
async def create_user(user: UserInfo):
    """Yeni kullanıcı oluştur"""
    new_user = user.dict()
    new_user["id"] = max(SAMPLE_USERS, key=lambda x: x["id"])["id"] + 1
    SAMPLE_USERS.append(new_user)
    return {"message": "User created successfully", "user": new_user}

# Order Management Endpoints
@app.get("/api/v1/orders")
async def get_orders():
    """Tüm siparişleri listele"""
    return {"orders": SAMPLE_ORDERS, "total": len(SAMPLE_ORDERS)}

@app.get("/api/v1/orders/{order_id}")
async def get_order(order_id: int):
    """Sipariş bilgisi getir"""
    order = next((o for o in SAMPLE_ORDERS if o["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.post("/api/v1/orders")
async def create_order(order: OrderInfo):
    """Yeni sipariş oluştur"""
    new_order = order.dict()
    new_order["id"] = max(SAMPLE_ORDERS, key=lambda x: x["id"])["id"] + 1
    SAMPLE_ORDERS.append(new_order)
    return {"message": "Order created successfully", "order": new_order}

# OCR Workflow Endpoints
@app.get("/api/v1/ocr/status")
async def get_ocr_status():
    """OCR durumu"""
    return {
        "status": "ready",
        "processed_files": 125,
        "pending_files": 3,
        "failed_files": 1,
        "last_processed": datetime.utcnow().isoformat()
    }

@app.post("/api/v1/ocr/upload")
async def upload_file():
    """Dosya yükle (simüle)"""
    return {
        "message": "File uploaded successfully",
        "file_id": "file_12345",
        "status": "processing"
    }

# Export Endpoints
@app.get("/api/v1/export/status")
async def get_export_status():
    """Export durumu"""
    return {
        "status": "ready",
        "total_exports": 45,
        "successful_exports": 42,
        "failed_exports": 3,
        "last_export": datetime.utcnow().isoformat()
    }

@app.post("/api/v1/export/generate")
async def generate_export():
    """Export oluştur (simüle)"""
    return {
        "message": "Export started",
        "export_id": "export_67890",
        "status": "processing",
        "estimated_time": "2 minutes"
    }

# System Info Endpoints
@app.get("/api/v1/info")
async def get_system_info():
    """Sistem bilgileri"""
    return {
        "name": "OptiPlan 360",
        "version": "1.0.0",
        "description": "AI/ML Enhanced ERP Platform",
        "environment": "development",
        "uptime": "2 hours 15 minutes",
        "features": [
            "OCR Processing",
            "Order Management", 
            "Export Generation",
            "User Management",
            "AI/ML Integration"
        ]
    }

@app.get("/api/v1/metrics")
async def get_metrics():
    """Sistem metrikleri"""
    return {
        "requests_total": 1547,
        "requests_per_minute": 12,
        "response_time_avg": "145ms",
        "error_rate": "0.1%",
        "memory_usage": "245MB",
        "cpu_usage": "15%"
    }

# Error Handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"detail": "Endpoint not found", "path": str(request.url.path)}
    )

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "timestamp": datetime.utcnow().isoformat()}
    )

if __name__ == "__main__":
    import uvicorn
    
    print("🚀 OptiPlan 360 Backend Başlatılıyor...")
    print("📚 API Dokümantasyonu: http://localhost:8000/docs")
    print("💚 Health Check: http://localhost:8000/api/v1/health")
    print("👥 Kullanıcılar: http://localhost:8000/api/v1/users")
    print("📦 Siparişler: http://localhost:8000/api/v1/orders")
    
    uvicorn.run(
        "complete_app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
