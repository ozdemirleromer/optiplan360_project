"""Lazy exports for the service package.

This package is imported very early during app startup. Eagerly importing every
service module makes optional integrations a hard boot dependency and causes the
whole API to fail before any route is served. The package therefore exposes its
public surface via lazy imports.
"""

from importlib import import_module
from types import ModuleType
from typing import Any

_EXPORTS = {
    "AWSTextractConfig": "app.services.aws_textract_service",
    "AWSTextractResult": "app.services.aws_textract_service",
    "AWSTextractService": "app.services.aws_textract_service",
    "AzureBlobConfig": "app.services.azure_service",
    "AzureBlobUploadResult": "app.services.azure_service",
    "AzureOCRConfig": "app.services.azure_service",
    "AzureOCRResult": "app.services.azure_service",
    "AzureService": "app.services.azure_service",
    "DropOptimizationService": "app.services.drop_optimization",
    "ExportRow": "app.services.optimization",
    "ExportValidator": "app.services.export_validator",
    "FilenameGenerator": "app.services.filename_generator",
    "GoogleVisionConfig": "app.services.google_vision_service",
    "GoogleVisionOCRResult": "app.services.google_vision_service",
    "GoogleVisionService": "app.services.google_vision_service",
    "GrainExportInfo": "app.services.optimization",
    "GrainMatcher": "app.services.grain_matcher",
    "GrainService": "app.services.optimization",
    "GrainSuggestion": "app.services.grain_matcher",
    "MergeService": "app.services.optimization",
    "MergeSuggestionResult": "app.services.optimization",
    "StockMatch": "app.services.stock_matcher",
    "StockMatcher": "app.services.stock_matcher",
    "ValidationResult": "app.services.export_validator",
    "calculate_optimal_drop": "app.services.drop_optimization",
    "create_matcher": "app.services.stock_matcher",
    "generate_filename": "app.services.filename_generator",
    "get_export_rows": "app.services.optimization",
    "get_grain_dropdown_options": "app.services.grain_matcher",
    "quick_search": "app.services.stock_matcher",
    "suggest_grain": "app.services.grain_matcher",
    "validate_filename": "app.services.filename_generator",
    "crm_service": "app.services.crm_service",
    "integration_service": "app.services.integration_service",
    "orchestrator_service": "app.services.orchestrator_service",
    "payment_service": "app.services.payment_service",
    "price_tracking_ai": "app.services.price_tracking_ai",
}

__all__ = sorted(_EXPORTS)


def _load_export(name: str) -> Any:
    module_path = _EXPORTS[name]
    module = import_module(module_path)

    value: Any
    if hasattr(module, name):
        value = getattr(module, name)
    else:
        value = module

    globals()[name] = value
    return value


def __getattr__(name: str) -> Any:
    if name not in _EXPORTS:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    return _load_export(name)


def __dir__() -> list[str]:
    return sorted(set(globals()) | set(__all__))

