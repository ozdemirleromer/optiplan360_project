#!/usr/bin/env python3
"""
OptiPlanning UI Mapper

Creates a machine-readable map of the running OptiPlanning UI:
- Main window metadata
- Full menu tree (top + submenus)
- Visible windows/dialogs and visible controls

Usage:
  python scripts/optiplan_ui_mapper.py --output docs/optiplanning/generated_ui_map.json
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from pywinauto import Application, Desktop


def _rect_dict(rect):
    return {
        "left": int(rect.left),
        "top": int(rect.top),
        "right": int(rect.right),
        "bottom": int(rect.bottom),
        "width": int(rect.right - rect.left),
        "height": int(rect.bottom - rect.top),
    }


def _find_main_window():
    candidates = []
    for w in Desktop(backend="win32").windows():
        try:
            if not w.is_visible():
                continue
            title = (w.window_text() or "").lower()
            if "optiplanning - [" in title or "professional (hp)" in title:
                candidates.append(w)
        except Exception:
            continue
    if not candidates:
        return None
    return candidates[-1]


def _menu_item_to_dict(item, depth: int = 0, max_depth: int = 4):
    def _safe(callable_fn, default=None):
        if callable_fn is None:
            return default
        try:
            return callable_fn()
        except Exception:
            return default

    item_id_fn = getattr(item, "item_id", None)
    type_fn = getattr(item, "type", None)
    state_fn = getattr(item, "state", None)
    text_fn = getattr(item, "text", None)

    data = {
        "text": _safe(text_fn, ""),
        "id": _safe(item_id_fn, None),
        "type": _safe(type_fn, None),
        "state": _safe(state_fn, None),
    }
    if depth >= max_depth:
        return data
    sub_menu_fn = getattr(item, "sub_menu", None)
    sub = _safe(sub_menu_fn, None)
    if sub:
        children = []
        items = _safe(sub.items, []) or []
        for child in items:
            children.append(_menu_item_to_dict(child, depth + 1, max_depth))
        data["children"] = children
    return data


def _dump_menu_tree(main_window):
    menu_tree = []
    try:
        main_window.set_focus()
    except Exception:
        pass
    menu = main_window.menu()
    items = []
    try:
        items = menu.items()
    except Exception:
        items = []
    for top in items:
        try:
            menu_tree.append(_menu_item_to_dict(top))
        except Exception:
            continue
    return menu_tree


def _safe_text(value):
    if value is None:
        return ""
    return str(value).strip()


def _dump_visible_windows(process_id: int):
    out = []
    for w in Desktop(backend="win32").windows(process=process_id):
        try:
            if not w.is_visible():
                continue
            win = {
                "title": _safe_text(w.window_text()),
                "class_name": _safe_text(w.class_name()),
                "handle": int(w.handle),
                "enabled": bool(w.is_enabled()),
                "rect": _rect_dict(w.rectangle()),
                "controls": [],
            }
            for c in w.descendants():
                try:
                    if not c.is_visible():
                        continue
                    txt = _safe_text(c.window_text())
                    win["controls"].append(
                        {
                            "text": txt,
                            "class_name": _safe_text(c.class_name()),
                            "handle": int(c.handle),
                            "enabled": bool(c.is_enabled()),
                            "rect": _rect_dict(c.rectangle()),
                        }
                    )
                except Exception:
                    continue
            out.append(win)
        except Exception:
            continue
    return out


def parse_args():
    p = argparse.ArgumentParser(description="Dump OptiPlanning UI map to JSON")
    p.add_argument(
        "--output",
        default="docs/optiplanning/generated_ui_map.json",
        help="Output JSON file path",
    )
    return p.parse_args()


def main():
    args = parse_args()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    main_raw = _find_main_window()
    if not main_raw:
        raise SystemExit("HATA: Calisan OptiPlanning penceresi bulunamadi.")

    app = Application(backend="win32").connect(process=main_raw.process_id())
    main = app.window(handle=main_raw.handle)

    data = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "process_id": int(main_raw.process_id()),
        "main_window": {
            "title": _safe_text(main_raw.window_text()),
            "class_name": _safe_text(main_raw.class_name()),
            "handle": int(main_raw.handle),
            "rect": _rect_dict(main_raw.rectangle()),
        },
        "menu_tree": _dump_menu_tree(main),
        "visible_windows": _dump_visible_windows(main_raw.process_id()),
    }

    output.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"TAMAM: UI map yazildi -> {output}")


if __name__ == "__main__":
    main()
