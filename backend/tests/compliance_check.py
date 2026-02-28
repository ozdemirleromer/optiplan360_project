#!/usr/bin/env python3
"""
COMPLIANCE CHECKER — Sprint 1 (AGENT_ONEFILE §G2)
===================================================

AI agent gerektirmez. Tek komutla calistir:

    cd backend
    python tests/compliance_check.py

Cikti: Her kural icin PASS / FAIL + duzeltme talimatı.
Exit code: 0 = tum kontroller gecti, 1 = en az 1 hata var.

Kontrol Listesi:
  [C1] PREPARED state enum'da tanimli mi?
  [C2] State sirasi dogru mu? (NEW < PREPARED < OPTI_IMPORTED)
  [C3] TRIM_BY_THICKNESS duplicate tanimlanmis mi?
  [C4] BACKING_THICKNESSES tipi frozenset/set mi?
  [C5] _transform_parts metodu tanimli mi?
  [C6] _map_edge / _map_grain fonksiyonlari tanimli mi?
  [C7] STATE_PREPARED audit event'i kodda var mi?
  [C8] orchestrator_service.py'de bos satir sismesi var mi?
  [C9] enums.py'de bos satir sismesi var mi?
  [C10] Proje kokunde gereksiz yardimci scriptler var mi?
"""

import os
import re
import sys

# Proje kokunun bir ust klasoru
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)

ENUMS_PATH = os.path.join(BACKEND_DIR, "app", "models", "enums.py")
ORCH_PATH = os.path.join(BACKEND_DIR, "app", "services", "orchestrator_service.py")

results = []


def check(check_id: str, desc: str, ok: bool, fix: str):
    """Sonucu kaydet ve yazdir."""
    status = "PASS" if ok else "FAIL"
    marker = "  " if ok else "X "
    results.append((check_id, ok))
    print(f"[{marker}] {check_id}: {desc}")
    if not ok:
        print(f"       DUZELT: {fix}")


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def main():
    print("=" * 60)
    print("COMPLIANCE CHECKER — Sprint 1 (AGENT_ONEFILE §G2)")
    print("=" * 60)
    print()

    enums_src = read_file(ENUMS_PATH)
    orch_src = read_file(ORCH_PATH)

    # ---- C1: PREPARED state ----
    check(
        "C1",
        "PREPARED state enum'da tanimli",
        'PREPARED = "PREPARED"' in enums_src,
        'enums.py -> OptiJobStateEnum sinifina PREPARED = "PREPARED" ekle',
    )

    # ---- C2: State sirasi ----
    # Enum class icindeki sirayi bul
    enum_block = re.search(r"class OptiJobStateEnum.*?(?=\nclass |\Z)", enums_src, re.DOTALL)
    if enum_block:
        block = enum_block.group()
        vals = re.findall(r'(\w+)\s*=\s*"(\w+)"', block)
        names = [v[0] for v in vals]
        order_ok = (
            "NEW" in names
            and "PREPARED" in names
            and "OPTI_IMPORTED" in names
            and names.index("NEW") < names.index("PREPARED") < names.index("OPTI_IMPORTED")
        )
    else:
        order_ok = False
    check(
        "C2",
        "State sirasi: NEW < PREPARED < OPTI_IMPORTED",
        order_ok,
        "enums.py -> PREPARED, NEW'den sonra OPTI_IMPORTED'dan once olmali",
    )

    # ---- C3: TRIM_BY_THICKNESS duplicate ----
    trim_count = orch_src.count("TRIM_BY_THICKNESS =")
    check(
        "C3",
        "TRIM_BY_THICKNESS yalniz 1 kez tanimli",
        trim_count == 1,
        f"orchestrator_service.py'de TRIM_BY_THICKNESS {trim_count}x tanimli, birini sil",
    )

    # ---- C4: BACKING_THICKNESSES tipi ----
    backing_count = orch_src.count("BACKING_THICKNESSES =")
    check(
        "C4",
        "BACKING_THICKNESSES yalniz 1 kez tanimli",
        backing_count == 1,
        f"orchestrator_service.py'de BACKING_THICKNESSES {backing_count}x tanimli, birini sil",
    )

    # ---- C5: _transform_parts metodu ----
    check(
        "C5",
        "_transform_parts metodu tanimli",
        "def _transform_parts(self" in orch_src,
        "OrchestratorService sinifina _transform_parts metodu ekle",
    )

    # ---- C6: _map_edge / _map_grain ----
    check(
        "C6",
        "_map_edge ve _map_grain fonksiyonlari tanimli",
        "def _map_edge(" in orch_src and "def _map_grain(" in orch_src,
        "orchestrator_service.py'ye _map_edge ve _map_grain fonksiyonlarini ekle",
    )

    # ---- C7: STATE_PREPARED audit ----
    check(
        "C7",
        "STATE_PREPARED audit event'i kodda var",
        '"STATE_PREPARED"' in orch_src,
        'orchestrator_service.py -> _add_audit(..., "STATE_PREPARED", ...) ekle',
    )

    # ---- C8: orchestrator_service.py bos satir sismesi ----
    orch_lines = orch_src.splitlines()
    orch_expected_max = 600  # orijinal ~442 + ~100 ek satir makul
    check(
        "C8",
        f"orchestrator_service.py satir sayisi makul (<{orch_expected_max})",
        len(orch_lines) < orch_expected_max,
        f"orchestrator_service.py {len(orch_lines)} satir — bos satirlar temizlenmeli",
    )

    # ---- C9: enums.py bos satir sismesi ----
    enums_lines = enums_src.splitlines()
    enums_expected_max = 200  # orijinal 165 + PREPARED 1 satir
    check(
        "C9",
        f"enums.py satir sayisi makul (<{enums_expected_max})",
        len(enums_lines) < enums_expected_max,
        f"enums.py {len(enums_lines)} satir — bos satirlar temizlenmeli",
    )

    # ---- C10: Gereksiz scriptler ----
    junk_scripts = ["fix_prepared_state.py", "insert_prepared_state.py", "update_orchestrator.py"]
    found_junk = [s for s in junk_scripts if os.path.exists(os.path.join(PROJECT_ROOT, s))]
    check(
        "C10",
        "Proje kokunde gereksiz yardimci script yok",
        len(found_junk) == 0,
        f"Sil: {', '.join(found_junk)}" if found_junk else "",
    )

    # ---- Ozet ----
    print()
    print("=" * 60)
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    failed = total - passed
    print(f"SONUC: {passed}/{total} PASS, {failed} FAIL")

    if failed > 0:
        print()
        print("BASARISIZ KONTROLLER:")
        for cid, ok in results:
            if not ok:
                print(f"  - {cid}")
        print()
        print("Duzeltmeleri uygulayip tekrar calistir:")
        print("  python tests/compliance_check.py")

    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
