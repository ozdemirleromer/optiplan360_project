from __future__ import annotations

import subprocess
import csv
import os
from pathlib import Path
import sys
import shutil
from uuid import uuid4

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app.services.optiplan_csv_otomasyon as csv_module

LOCAL_TMP_ROOT = BACKEND_DIR.parent / "tmp" / "pytest_local"
LOCAL_TMP_ROOT.mkdir(parents=True, exist_ok=True)
FIXTURE_DIR = BACKEND_DIR / "tests" / "fixtures" / "optiplan"


def _make_workdir() -> Path:
    workdir = LOCAL_TMP_ROOT / f"opti_csv_{uuid4().hex}"
    workdir.mkdir(parents=True, exist_ok=False)
    return workdir


def _sample_parts() -> list[dict[str, object]]:
    return [
        {
            "malzeme": "18MM Me\u015fe",
            "boy": 720,
            "en": 450,
            "adet": 2,
            "suyolu": 1,
            "aciklama": "G\u00f6vde Sol Yan",
            "ust_bant": "1MM",
            "alt_bant": "1MM",
            "sol_bant": "0.4MM",
            "sag_bant": "0.4MM",
            "kod": "PARCA-001",
            "ek_aciklama": "BARKOD-001",
        }
    ]


def test_csv_ascii_and_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    tmp_path = _make_workdir()
    try:
        monkeypatch.setattr(csv_module, "DEFAULT_ANA_DIZIN", tmp_path)

        output = csv_module.optiplan_csv_otomasyon(
            "Siparis_Ozel_001",
            _sample_parts(),
            tetikle_optiplan=False,
            baslik_satirlari=True,
        )
        output_path = Path(output)
        assert output_path.exists()
        assert output_path.parent.name == csv_module.DEFAULT_GELEN_KLASORU

        raw = output_path.read_bytes()
        decoded = raw.decode("ascii")
        assert "Mese" in decoded
        assert "Govde Sol Yan" in decoded
        assert "\u015f" not in decoded
        assert "\u00f6" not in decoded
        assert decoded.splitlines()[0] == csv_module.CSV_DELIMITER.join(csv_module.CSV_ROW1)
        assert decoded.splitlines()[1] == csv_module.CSV_DELIMITER.join(csv_module.CSV_ROW2)
    finally:
        shutil.rmtree(tmp_path, ignore_errors=True)


def test_cli_runs_with_silent_and_archives_processed(monkeypatch: pytest.MonkeyPatch) -> None:
    tmp_path = _make_workdir()
    try:
        monkeypatch.setattr(csv_module, "DEFAULT_ANA_DIZIN", tmp_path)
        fake_exe = tmp_path / "OptiPlanning.exe"
        fake_exe.write_text("", encoding="ascii")
        monkeypatch.setattr(csv_module, "_resolve_optiplan_exe", lambda: fake_exe)

        captured: dict[str, list[str]] = {}

        def _fake_run(
            command: list[str],
            check: bool,
            capture_output: bool,
            text: bool,
        ) -> subprocess.CompletedProcess[str]:
            captured["command"] = command
            return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

        monkeypatch.setattr(csv_module.subprocess, "run", _fake_run)

        result = csv_module.optiplan_csv_otomasyon(
            "ORDER_1001",
            _sample_parts(),
            tetikle_optiplan=True,
            baslik_satirlari=True,
        )

        result_path = Path(result)
        assert result_path.exists()
        assert result_path.parent.name == csv_module.DEFAULT_ISLENEN_KLASORU
        assert "-import" in captured["command"]
        assert "-rule" in captured["command"]
        assert "-optimize" in captured["command"]
        assert "-silent" in captured["command"]
    finally:
        shutil.rmtree(tmp_path, ignore_errors=True)


def test_cli_failure_moves_file_to_error_folder(monkeypatch: pytest.MonkeyPatch) -> None:
    tmp_path = _make_workdir()
    try:
        monkeypatch.setattr(csv_module, "DEFAULT_ANA_DIZIN", tmp_path)
        fake_exe = tmp_path / "OptiPlanning.exe"
        fake_exe.write_text("", encoding="ascii")
        monkeypatch.setattr(csv_module, "_resolve_optiplan_exe", lambda: fake_exe)
        monkeypatch.setattr(csv_module, "_find_rule_source", lambda: None)

        def _failing_run(
            command: list[str],
            check: bool,
            capture_output: bool,
            text: bool,
        ) -> subprocess.CompletedProcess[str]:
            raise subprocess.CalledProcessError(returncode=1, cmd=command, stderr="batch import failed")

        monkeypatch.setattr(csv_module.subprocess, "run", _failing_run)

        with pytest.raises(RuntimeError):
            csv_module.optiplan_csv_otomasyon(
                "ORDER_1002",
                _sample_parts(),
                tetikle_optiplan=True,
                baslik_satirlari=True,
            )

        failed_files = list((tmp_path / csv_module.DEFAULT_HATALI_KLASORU).glob("*.csv"))
        assert len(failed_files) == 1
    finally:
        shutil.rmtree(tmp_path, ignore_errors=True)


def test_queue_processes_files_in_fifo_order(monkeypatch: pytest.MonkeyPatch) -> None:
    tmp_path = _make_workdir()
    try:
        monkeypatch.setattr(csv_module, "DEFAULT_ANA_DIZIN", tmp_path)
        fake_exe = tmp_path / "OptiPlanning.exe"
        fake_exe.write_text("", encoding="ascii")
        monkeypatch.setattr(csv_module, "_resolve_optiplan_exe", lambda: fake_exe)
        monkeypatch.setattr(csv_module, "_find_rule_source", lambda: None)

        imports: list[str] = []

        def _fake_run(
            command: list[str],
            check: bool,
            capture_output: bool,
            text: bool,
        ) -> subprocess.CompletedProcess[str]:
            csv_arg = command[command.index("-import") + 1]
            imports.append(Path(csv_arg).name)
            return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

        monkeypatch.setattr(csv_module.subprocess, "run", _fake_run)

        first = Path(
            csv_module.optiplan_csv_otomasyon(
                "QUEUE_0002",
                _sample_parts(),
                tetikle_optiplan=False,
                baslik_satirlari=True,
            )
        )
        second = Path(
            csv_module.optiplan_csv_otomasyon(
                "QUEUE_0001",
                _sample_parts(),
                tetikle_optiplan=False,
                baslik_satirlari=True,
            )
        )

        # Dosya islem sirasini mtime ile netlestir
        os.utime(first, (1_700_000_000, 1_700_000_000))
        os.utime(second, (1_700_000_005, 1_700_000_005))

        # mtime sirasinda deterministic olsun diye isim fallback'i da kullanilir
        results = csv_module.optiplan_kuyrugu_isle()

        assert len(results) == 2
        assert imports == ["QUEUE_0002.csv", "QUEUE_0001.csv"]
        assert all(Path(item["output"]).parent.name == csv_module.DEFAULT_ISLENEN_KLASORU for item in results)
    finally:
        shutil.rmtree(tmp_path, ignore_errors=True)


@pytest.mark.parametrize(
    ("fixture_name", "expected_rows"),
    [
        ("orders.csv", 5),
        ("orders_1.csv", 5),
        ("orders_case4_dense.csv", 5),
        ("orders_edge_cases.csv", 5),
        ("orders_large_benchmark.csv", 10),
        ("orders_mixed_materials.csv", 5),
    ],
)
def test_recovered_order_fixtures_have_expected_shape(fixture_name: str, expected_rows: int) -> None:
    fixture_path = FIXTURE_DIR / fixture_name
    assert fixture_path.exists(), fixture_name

    with fixture_path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    assert len(rows) == expected_rows
    assert rows, fixture_name
    assert set(rows[0].keys()) == {
        "id",
        "width",
        "length",
        "quantity",
        "material",
        "thickness",
        "band_left",
        "band_right",
        "band_top",
        "band_bottom",
        "grain",
    }


def test_recovered_order_fixture_values_are_parseable() -> None:
    fixture_path = FIXTURE_DIR / "orders_mixed_materials.csv"

    with fixture_path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    assert rows
    for row in rows:
        assert row["id"]
        assert int(row["width"]) > 0
        assert int(row["length"]) > 0
        assert int(row["quantity"]) > 0
        assert float(row["thickness"]) > 0
        assert row["grain"] in {"true", "false"}
