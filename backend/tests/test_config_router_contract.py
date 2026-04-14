from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.features.config.transport.http import router as config_router


def _build_client() -> TestClient:
    app = FastAPI()
    app.include_router(config_router.router)
    return TestClient(app)


def test_paths_config_round_trip(monkeypatch, tmp_path) -> None:
    source_paths = json.loads((PROJECT_ROOT / "config" / "paths.json").read_text(encoding="utf-8"))
    paths_file = tmp_path / "paths.json"
    paths_file.write_text(json.dumps(source_paths, ensure_ascii=False, indent=2), encoding="utf-8")
    monkeypatch.setattr(config_router, "PATHS_CONFIG_FILE", paths_file)

    client = _build_client()

    get_response = client.get("/api/v1/config/paths")
    assert get_response.status_code == 200
    assert get_response.json() == source_paths

    updated_paths = {**source_paths, "tempFolder": "C:/OptiPlanning/tmp-new"}
    post_response = client.post("/api/v1/config/paths", json=updated_paths)
    assert post_response.status_code == 200
    assert post_response.json() == updated_paths
    assert json.loads(paths_file.read_text(encoding="utf-8")) == updated_paths


def test_rules_config_preserves_extra_keys(monkeypatch, tmp_path) -> None:
    source_rules = json.loads((PROJECT_ROOT / "config" / "rules.json").read_text(encoding="utf-8"))
    rules_file = tmp_path / "rules.json"
    rules_file.write_text(json.dumps(source_rules, ensure_ascii=False, indent=2), encoding="utf-8")
    monkeypatch.setattr(config_router, "RULES_CONFIG_FILE", rules_file)

    client = _build_client()

    get_response = client.get("/api/v1/config/rules")
    assert get_response.status_code == 200
    payload = get_response.json()
    assert payload["cm_to_mm_multiplier"] == source_rules["cm_to_mm_multiplier"]
    assert payload["retry_count_max"] == source_rules["retry_count_max"]
    assert payload["opti_mode_default"] == source_rules["optiModeDefault"]
    assert payload["trimByThickness"] == source_rules["trimByThickness"]

    post_payload = {
        "cm_to_mm_multiplier": 12,
        "retry_count_max": 7,
        "opti_mode_default": "A",
    }
    post_response = client.post("/api/v1/config/rules", json=post_payload)
    assert post_response.status_code == 200
    post_body = post_response.json()
    assert post_body["opti_mode_default"] == "A"

    saved_rules = json.loads(rules_file.read_text(encoding="utf-8"))
    assert saved_rules["cm_to_mm_multiplier"] == 12
    assert saved_rules["retry_count_max"] == 7
    assert saved_rules["optiModeDefault"] == "A"
    assert saved_rules["trimByThickness"] == source_rules["trimByThickness"]
    assert saved_rules["backingThicknesses"] == source_rules["backingThicknesses"]
