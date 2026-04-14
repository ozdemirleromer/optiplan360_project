"""
Klasör yol konfigürasyonu servisi.
Veritabanı yerine hafıza içi key-value store kullanır;
uygulama yeniden başladığında DB'den yeniden yüklenebilir.
"""
from __future__ import annotations

import json
from pathlib import Path


class PathConfigService:
    """Basit key-value store — klasör yollarını tutar."""

    def __init__(self) -> None:
        self._store: dict[str, str] = {}
        self._storage_path = Path(__file__).resolve().parents[2] / "config" / "path_config_store.json"
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        if not self._storage_path.exists():
            return
        try:
            payload = json.loads(self._storage_path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                self._store = {str(key): str(value) for key, value in payload.items()}
        except Exception:
            self._store = {}

    def _save_to_disk(self) -> None:
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._storage_path.write_text(
            json.dumps(self._store, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def get(self, key: str, default: str = "") -> str:
        return self._store.get(key, default)

    def set(self, key: str, value: str) -> None:
        self._store[key] = value
        self._save_to_disk()

    def update_values(self, mapping: dict[str, str]) -> None:
        self._store.update(mapping)
        self._save_to_disk()

    def all(self) -> dict[str, str]:
        return dict(self._store)


# Uygulama genelinde tek örnek
path_config = PathConfigService()
