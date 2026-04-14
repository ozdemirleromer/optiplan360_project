"""
OptiPlan 360 - API Documentation (OpenAPI/Swagger)
Tüm servisler için API dokümantasyonu

Bu modül:
- OpenAPI 3.0 şema tanımları
- Endpoint dokümantasyonu
- Request/response örnekleri
- Authentication şemaları
"""

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.openapi.docs import get_swagger_ui_html

# API Metadata
API_TITLE = "OptiPlan 360 API"
API_VERSION = "1.0.0"
API_DESCRIPTION = """
OptiPlan 360 - AI/ML Enhanced ERP Integration Platform

## Features

### Core Services
- **Export Management**: Atomic export transactions with validation
- **Distributed Locking**: Concurrent iş yönetimi
- **Checkpoint Recovery**: Crash recovery ve job management
- **Bant Mapping**: UI-export mapping validation

### AI/ML Services
- **LLM**: Large Language Model inference ve fine-tuning
- **Vision**: Image classification, zero-shot learning, captioning
- **Diffusion**: Text-to-image generation
- **Meta-learning**: Few-shot learning
- **Causal Inference**: Counterfactual analysis
- **Neural Rendering**: 3D scene reconstruction

## Authentication

All API endpoints require Bearer token authentication:
```
Authorization: Bearer <token>
```

## Rate Limiting

- Standard: 100 requests/minute
- AI/ML: 20 requests/minute
- Export: 10 requests/minute

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict (Resource locked) |
| 423 | Locked |
| 429 | Rate Limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

## Status Codes

Export Status:
- `PENDING`: Waiting to start
- `IN_PROGRESS`: Currently processing
- `COMPLETED`: Successfully finished
- `FAILED`: Error occurred
- `RETRYING`: Retry in progress

Contact: support@optiplan360.com
"""

# OpenAPI Tags
TAGS_METADATA = [
    {
        "name": "integration",
        "description": "Service integration and health monitoring",
        "externalDocs": {
            "description": "Integration Guide",
            "url": "https://docs.optiplan360.com/integration"
        }
    },
    {
        "name": "export",
        "description": "Export operations with atomic transactions",
    },
    {
        "name": "locking",
        "description": "Distributed locking for concurrent access",
    },
    {
        "name": "checkpoint",
        "description": "Checkpoint and recovery management",
    },
    {
        "name": "validation",
        "description": "Data validation services",
    },
    {
        "name": "ai-llm",
        "description": "Large Language Model operations",
        "externalDocs": {
            "description": "AI Guide",
            "url": "https://docs.optiplan360.com/ai"
        }
    },
    {
        "name": "ai-vision",
        "description": "Computer Vision and image processing",
    },
    {
        "name": "ai-diffusion",
        "description": "Diffusion model image generation",
    },
    {
        "name": "ai-meta",
        "description": "Meta-learning and few-shot learning",
    },
    {
        "name": "ai-causal",
        "description": "Causal inference and counterfactuals",
    },
]

# Schemas
SCHEMAS = {
    "ExportRequest": {
        "type": "object",
        "properties": {
            "islem_id": {
                "type": "string",
                "description": "Unique transaction ID",
                "example": "export-001"
            },
            "records": {
                "type": "array",
                "description": "Export records",
                "items": {
                    "type": "object",
                    "properties": {
                        "siparis_no": {"type": "string"},
                        "cari_kodu": {"type": "string"},
                        "stok_kodu": {"type": "string"},
                        "miktar": {"type": "number"},
                        "fiyat": {"type": "number"}
                    }
                }
            },
            "target_dir": {
                "type": "string",
                "description": "Target directory for export",
                "example": "./exports"
            },
            "filename": {
                "type": "string",
                "description": "Export filename",
                "example": "export_20240201.xlsx"
            },
            "bant_kalinligi": {
                "type": "string",
                "description": "Band thickness (validated)",
                "example": "0.8mm"
            }
        },
        "required": ["islem_id", "records"]
    },
    
    "ExportResponse": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "enum": ["success", "error"]
            },
            "message": {"type": "string"},
            "transaction_id": {"type": "string"},
            "download_url": {"type": "string"},
            "file_size": {"type": "integer"},
            "checksum": {"type": "string"}
        }
    },
    
    "LockRequest": {
        "type": "object",
        "properties": {
            "resource_id": {
                "type": "string",
                "description": "Resource to lock",
                "example": "islem-001"
            },
            "lock_type": {
                "type": "string",
                "enum": ["EXPORT", "EDIT", "DELETE", "SYSTEM"],
                "example": "EXPORT"
            },
            "timeout": {
                "type": "integer",
                "description": "Lock timeout in seconds",
                "default": 300,
                "example": 300
            }
        },
        "required": ["resource_id", "lock_type"]
    },
    
    "LockResponse": {
        "type": "object",
        "properties": {
            "lock_id": {"type": "string"},
            "acquired": {"type": "boolean"},
            "expires_at": {"type": "string", "format": "date-time"},
            "message": {"type": "string"}
        }
    },
    
    "Checkpoint": {
        "type": "object",
        "properties": {
            "checkpoint_id": {"type": "string"},
            "islem_id": {"type": "string"},
            "phase": {
                "type": "string",
                "enum": ["INIT", "OCR", "ORDER", "EXPORT", "COMPLETE"]
            },
            "status": {
                "type": "string",
                "enum": ["INCOMPLETE", "COMPLETED", "RECOVERED"]
            },
            "created_at": {"type": "string", "format": "date-time"},
            "completed_at": {"type": "string", "format": "date-time"},
            "temp_files": {
                "type": "array",
                "items": {"type": "string"}
            }
        }
    },
    
    "BantValidationRequest": {
        "type": "object",
        "properties": {
            "bant_kalinligi_ui": {
                "type": "string",
                "description": "UI band thickness value",
                "example": "0.8mm"
            },
            "bant_kalinligi_export": {
                "type": "string",
                "description": "Export code",
                "example": "08"
            },
            "u1_ui": {
                "type": "boolean",
                "description": "U1 flag in UI",
                "example": True
            },
            "u1_export": {
                "type": "string",
                "description": "U1 code in export",
                "example": "08U1"
            }
        }
    },
    
    "BantValidationResponse": {
        "type": "object",
        "properties": {
            "valid": {"type": "boolean"},
            "errors": {
                "type": "array",
                "items": {"type": "string"}
            },
            "export_code": {"type": "string"}
        }
    },
    
    "HealthStatus": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "enum": ["healthy", "degraded", "unhealthy"]
            },
            "timestamp": {"type": "string", "format": "date-time"},
            "services": {
                "type": "object",
                "additionalProperties": {
                    "type": "object",
                    "properties": {
                        "status": {"type": "string"},
                        "latency_ms": {"type": "number"},
                        "last_check": {"type": "string"},
                        "details": {"type": "object"}
                    }
                }
            }
        }
    },
    
    "LLMGenerateRequest": {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "Input prompt",
                "example": "Summarize this text: ..."
            },
            "max_tokens": {
                "type": "integer",
                "default": 256,
                "example": 256
            },
            "temperature": {
                "type": "number",
                "default": 0.7,
                "minimum": 0,
                "maximum": 2,
                "example": 0.7
            }
        },
        "required": ["prompt"]
    },
    
    "LLMGenerateResponse": {
        "type": "object",
        "properties": {
            "response": {"type": "string"},
            "tokens_used": {"type": "integer"},
            "model": {"type": "string"}
        }
    },
    
    "ImageClassifyRequest": {
        "type": "object",
        "properties": {
            "image_path": {
                "type": "string",
                "description": "Path to image file",
                "example": "/uploads/image.jpg"
            },
            "top_k": {
                "type": "integer",
                "default": 5,
                "example": 5
            }
        },
        "required": ["image_path"]
    },
    
    "ImageClassifyResponse": {
        "type": "object",
        "properties": {
            "results": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string"},
                        "score": {"type": "number"}
                    }
                }
            }
        }
    },
    
    "ZeroShotClassifyRequest": {
        "type": "object",
        "properties": {
            "image_path": {"type": "string"},
            "labels": {
                "type": "array",
                "items": {"type": "string"},
                "example": ["furniture", "electronics", "clothing"]
            }
        },
        "required": ["image_path", "labels"]
    },
    
    "DiffusionGenerateRequest": {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "Image generation prompt",
                "example": "A modern kitchen interior, professional photography"
            },
            "num_images": {
                "type": "integer",
                "default": 1,
                "maximum": 4
            },
            "negative_prompt": {
                "type": "string",
                "description": "Things to avoid in generation"
            }
        },
        "required": ["prompt"]
    },
    
    "ErrorResponse": {
        "type": "object",
        "properties": {
            "error": {"type": "string"},
            "code": {"type": "string"},
            "details": {"type": "object"},
            "timestamp": {"type": "string", "format": "date-time"}
        }
    }
}

# Example Responses
EXAMPLES = {
    "HealthCheck": {
        "summary": "Service health check",
        "value": {
            "status": "healthy",
            "timestamp": "2024-02-01T12:00:00Z",
            "services": {
                "atomic_export": {
                    "status": "healthy",
                    "latency_ms": 45.2,
                    "last_check": "2024-02-01T12:00:00Z",
                    "details": {"active_transactions": 3}
                },
                "lock_service": {
                    "status": "healthy",
                    "latency_ms": 12.1,
                    "last_check": "2024-02-01T12:00:00Z",
                    "details": {"active_locks": 5, "total_locks": 120}
                }
            }
        }
    },
    
    "ExportSuccess": {
        "summary": "Successful export",
        "value": {
            "status": "success",
            "message": "Export başarıyla tamamlandı",
            "transaction_id": "tx-12345",
            "download_url": "/api/v1/download/export_20240201.xlsx",
            "file_size": 12500,
            "checksum": "a3f5c2..."
        }
    },
    
    "ExportBlocked": {
        "summary": "Export with blockers",
        "value": {
            "status": "error",
            "error": "Export blockers found",
            "blockers": [
                {
                    "type": "VALIDATION_ERROR",
                    "field": "bant_kalinligi",
                    "message": "Geçersiz bant kalınlığı",
                    "severity": "critical"
                }
            ]
        }
    },
    
    "LLMResponse": {
        "summary": "LLM generation response",
        "value": {
            "response": "The document describes an ERP system integration...",
            "tokens_used": 150,
            "model": "microsoft/DialoGPT-medium"
        }
    },
    
    "ImageClassification": {
        "summary": "Image classification results",
        "value": {
            "results": [
                {"label": "kitchen cabinet", "score": 0.95},
                {"label": "furniture", "score": 0.89},
                {"label": "interior", "score": 0.76}
            ]
        }
    }
}


def custom_openapi(app: FastAPI):
    """Custom OpenAPI schema generator"""
    
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=API_TITLE,
        version=API_VERSION,
        description=API_DESCRIPTION,
        routes=app.routes,
        tags=TAGS_METADATA,
    )
    
    # Add schemas
    openapi_schema["components"]["schemas"].update(SCHEMAS)
    
    # Add security
    openapi_schema["components"]["securitySchemes"] = {
        "Bearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT token authentication"
        }
    }
    
    # Global security
    openapi_schema["security"] = [{"Bearer": []}]
    
    # Add examples
    for path in openapi_schema["paths"].values():
        for method in path.values():
            if isinstance(method, dict):
                # Add error responses
                if "responses" in method:
                    responses = method["responses"]
                    if "200" not in responses:
                        responses["200"] = {"description": "Success"}
                    
                    # Add standard error responses
                    responses.setdefault("400", {
                        "description": "Bad Request",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorResponse"}
                            }
                        }
                    })
                    responses.setdefault("401", {"description": "Unauthorized"})
                    responses.setdefault("500", {"description": "Internal Server Error"})
    
    app.openapi_schema = openapi_schema
    return openapi_schema


def generate_api_documentation():
    """Generate static API documentation"""
    
    from app.main import app
    
    # Get OpenAPI schema
    schema = custom_openapi(app)
    
    # Save as JSON
    import json
    with open("api_schema.json", "w") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)
    
    # Generate Markdown documentation
    md_content = generate_markdown_docs(schema)
    with open("API_DOCUMENTATION.md", "w") as f:
        f.write(md_content)
    
    return schema


def generate_markdown_docs(schema: dict) -> str:
    """Generate Markdown API documentation"""
    
    lines = [
        f"# {schema['info']['title']} - API Documentation",
        "",
        f"**Version:** {schema['info']['version']}",
        "",
        schema['info'].get('description', ''),
        "",
        "## Table of Contents",
        "",
        "- [Authentication](#authentication)",
        "- [Endpoints](#endpoints)",
        "- [Schemas](#schemas)",
        "- [Error Handling](#error-handling)",
        "",
        "## Authentication",
        "",
        "All API endpoints require Bearer token authentication:",
        "",
        "```",
        "Authorization: Bearer <your_token>",
        "```",
        "",
        "## Endpoints",
        "",
    ]
    
    # Group endpoints by tag
    endpoints_by_tag = {}
    for path, methods in schema.get('paths', {}).items():
        for method, details in methods.items():
            if isinstance(details, dict):
                tags = details.get('tags', ['General'])
                for tag in tags:
                    if tag not in endpoints_by_tag:
                        endpoints_by_tag[tag] = []
                    endpoints_by_tag[tag].append({
                        'path': path,
                        'method': method.upper(),
                        'details': details
                    })
    
    # Write endpoints
    for tag, endpoints in endpoints_by_tag.items():
        lines.append(f"### {tag}")
        lines.append("")
        
        for endpoint in endpoints:
            method = endpoint['method']
            path = endpoint['path']
            details = endpoint['details']
            
            summary = details.get('summary', 'No summary')
            
            lines.append(f"#### {method} {path}")
            lines.append("")
            lines.append(f"{summary}")
            lines.append("")
            
            # Parameters
            if 'parameters' in details:
                lines.append("**Parameters:**")
                lines.append("")
                for param in details['parameters']:
                    name = param.get('name', '')
                    param_type = param.get('schema', {}).get('type', 'string')
                    required = "(required)" if param.get('required') else "(optional)"
                    lines.append(f"- `{name}` ({param_type}) {required}")
                lines.append("")
            
            # Request body
            if 'requestBody' in details:
                lines.append("**Request Body:**")
                lines.append("")
                lines.append("```json")
                content = details['requestBody'].get('content', {})
                if 'application/json' in content:
                    schema_ref = content['application/json'].get('schema', {})
                    if '$ref' in schema_ref:
                        lines.append(f"// See {schema_ref['$ref']}")
                lines.append("```")
                lines.append("")
            
            # Responses
            if 'responses' in details:
                lines.append("**Responses:**")
                lines.append("")
                for code, response in details['responses'].items():
                    desc = response.get('description', '')
                    lines.append(f"- `{code}`: {desc}")
                lines.append("")
    
    # Schemas section
    lines.append("## Schemas")
    lines.append("")
    
    for schema_name, schema_def in schema.get('components', {}).get('schemas', {}).items():
        lines.append(f"### {schema_name}")
        lines.append("")
        
        if 'properties' in schema_def:
            lines.append("| Property | Type | Description |")
            lines.append("|----------|------|-------------|")
            for prop_name, prop_def in schema_def['properties'].items():
                prop_type = prop_def.get('type', 'object')
                desc = prop_def.get('description', '')
                lines.append(f"| `{prop_name}` | {prop_type} | {desc} |")
            lines.append("")
    
    # Error handling
    lines.extend([
        "## Error Handling",
        "",
        "The API uses standard HTTP status codes:",
        "",
        "| Code | Description |",
        "|------|-------------|",
        "| 200 | Success |",
        "| 400 | Bad Request |",
        "| 401 | Unauthorized |",
        "| 403 | Forbidden |",
        "| 404 | Not Found |",
        "| 409 | Conflict |",
        "| 423 | Locked |",
        "| 429 | Rate Limited |",
        "| 500 | Internal Server Error |",
        "| 503 | Service Unavailable |",
        "",
        "Error responses include details:",
        "",
        "```json",
        '{"error": "Description", "code": "ERROR_CODE", "details": {}}',
        "```",
        "",
    ])
    
    return "\n".join(lines)


# Generate documentation if run directly
if __name__ == "__main__":
    try:
        schema = generate_api_documentation()
        print("API documentation generated successfully!")
        print("- api_schema.json")
        print("- API_DOCUMENTATION.md")
    except Exception as e:
        print(f"Error generating documentation: {e}")
