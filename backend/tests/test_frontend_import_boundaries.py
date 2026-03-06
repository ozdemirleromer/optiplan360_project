import re
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
FRONTEND_SRC = REPO_ROOT / "frontend" / "src"
FEATURES_ROOT = FRONTEND_SRC / "features"
COMPONENTS_ROOT = FRONTEND_SRC / "components"

# Static and dynamic import matchers:
# import x from "..."
# export x from "..."
# import("...")
IMPORT_PATTERNS = [
    re.compile(r"""(?:import|export)\s+[^'"]*?\s+from\s+["']([^"']+)["']"""),
    re.compile(r"""import\(\s*["']([^"']+)["']\s*\)"""),
]
WRAPPER_EXPORT_PATTERNS = [
    re.compile(r"""^\s*export\s+\*\s+from\s+["'][^"']+["'];?\s*$"""),
    re.compile(r"""^\s*export\s+\{[^}]+\}\s+from\s+["'][^"']+["'];?\s*$"""),
]

# Feature files can only consume shared horizontal primitives from components.
ALLOWED_COMPONENT_PREFIXES = {"Shared", "Layout"}

# Transitional allowlist for known cross-feature composition dependencies.
# Any new pair added by accident should fail the test and be reviewed explicitly.
ALLOWED_CROSS_FEATURE_IMPORTS = set()

ORDER_OPTIMIZATION_FEATURE_WRAPPERS = {
    FEATURES_ROOT / "UI" / "OrderOptimizationPanel.tsx",
    FEATURES_ROOT / "Grid" / "OrderOptimizationGrid.tsx",
    FEATURES_ROOT / "Ribbon" / "OrderOptimizationRibbon.tsx",
    FEATURES_ROOT / "UI" / "orderOptimizationConstants.ts",
    FEATURES_ROOT / "UI" / "orderOptimizationStyles.ts",
    FEATURES_ROOT / "UI" / "OrderOptimizationMetaStrip.tsx",
    FEATURES_ROOT / "Optimization" / "OptiPlanStrictOrderEntry.tsx",
}


def _iter_feature_source_files():
    for ext in ("*.ts", "*.tsx"):
        for path in FEATURES_ROOT.rglob(ext):
            # Keep boundary checks focused on production source.
            if path.name.endswith(".test.ts") or path.name.endswith(".test.tsx"):
                continue
            yield path


def _collect_imports(source: str):
    imports = []
    for pattern in IMPORT_PATTERNS:
        imports.extend(pattern.findall(source))
    return imports


def _resolve_relative_import(file_path: Path, specifier: str) -> Path:
    return (file_path.parent / Path(specifier)).resolve()


def _is_compat_wrapper(source: str) -> bool:
    lines = []
    for raw in source.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("//"):
            continue
        lines.append(line)

    if not lines:
        return False

    return all(any(pattern.match(line) for pattern in WRAPPER_EXPORT_PATTERNS) for line in lines)


def test_feature_imports_only_shared_or_layout_from_components():
    violations = []

    for file_path in _iter_feature_source_files():
        source = file_path.read_text(encoding="utf-8")
        for specifier in _collect_imports(source):
            if not specifier.startswith("."):
                continue

            resolved = _resolve_relative_import(file_path, specifier)
            if COMPONENTS_ROOT not in resolved.parents:
                continue

            relative_to_components = resolved.relative_to(COMPONENTS_ROOT)
            top_level = relative_to_components.parts[0] if relative_to_components.parts else ""
            if top_level not in ALLOWED_COMPONENT_PREFIXES:
                rel_file = file_path.relative_to(REPO_ROOT).as_posix()
                violations.append(f"{rel_file} -> {specifier}")

    assert not violations, (
        "Feature katmani yalnizca components/Shared veya components/Layout tuketebilir.\n"
        + "\n".join(violations)
    )


def test_cross_feature_imports_are_explicitly_allowlisted():
    violations = []
    seen_pairs = set()

    for file_path in _iter_feature_source_files():
        source = file_path.read_text(encoding="utf-8")
        if _is_compat_wrapper(source):
            # Compatibility wrappers intentionally bridge old entry-points.
            continue

        source_feature = file_path.relative_to(FEATURES_ROOT).parts[0]

        for specifier in _collect_imports(source):
            if not specifier.startswith("."):
                continue

            resolved = _resolve_relative_import(file_path, specifier)
            if FEATURES_ROOT not in resolved.parents:
                continue

            relative_to_features = resolved.relative_to(FEATURES_ROOT)
            target_feature = relative_to_features.parts[0] if relative_to_features.parts else ""
            if not target_feature or target_feature == source_feature:
                continue

            pair = (source_feature, target_feature)
            seen_pairs.add(pair)
            if pair not in ALLOWED_CROSS_FEATURE_IMPORTS:
                rel_file = file_path.relative_to(REPO_ROOT).as_posix()
                violations.append(f"{rel_file} -> {specifier} ({source_feature} -> {target_feature})")

    unexpected_allowlist = sorted(ALLOWED_CROSS_FEATURE_IMPORTS - seen_pairs)
    assert not unexpected_allowlist, (
        "Asagidaki allowlist ciftleri artik kullanilmiyor, sadeleştirilmeli:\n"
        + "\n".join(f"{src} -> {dst}" for src, dst in unexpected_allowlist)
    )

    assert not violations, (
        "Yeni cross-feature bagimlilik tespit edildi. Ya tasiyin ya da allowlist'i bilincli guncelleyin:\n"
        + "\n".join(sorted(set(violations)))
    )


def test_order_optimization_feature_wrappers_remain_wrapper_only():
    violations = []

    for wrapper_path in ORDER_OPTIMIZATION_FEATURE_WRAPPERS:
        source = wrapper_path.read_text(encoding="utf-8")
        if not _is_compat_wrapper(source):
            rel_path = wrapper_path.relative_to(REPO_ROOT).as_posix()
            violations.append(rel_path)

    assert not violations, (
        "Asagidaki legacy Order Optimization feature dosyalari artik wrapper-only degil:\n"
        + "\n".join(sorted(violations))
    )



