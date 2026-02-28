#!/usr/bin/env python3
"""
OptiPlanning stage-3 automation: trigger optimization.

Flow:
1) Find active OptiPlanning main window.
2) Trigger: Yurut -> Optimize Et / Devam et (fallback F5).
3) Fail fast if immediate warning/error dialog appears.
"""

from __future__ import annotations

import argparse
import subprocess
import time
import unicodedata
from pathlib import Path
from typing import Iterable

from pywinauto import Application, Desktop
from pywinauto.keyboard import send_keys

REG_KEY = r"HKCU\Software\Selco S.p.A.\OptiPlanning\1.0"
DEFAULT_SAW_DIR = Path(r"C:\Biesse\OptiPlanning\Saw")


def _normalize_text(value: str) -> str:
    s = (value or "").strip().lower()
    # Handle proper Turkish dotless-i and common mojibake form.
    s = s.replace("\u0131", "i").replace("\u00e4\u00b1", "i")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.replace("\u0131", "i")
    return s


def _find_main_win32():
    candidates = []
    for w in Desktop(backend="win32").windows():
        try:
            if not w.is_visible():
                continue
            title = _normalize_text(w.window_text() or "")
            cls = (w.class_name() or "").strip()
            if "commandline" in title and "excel" in title:
                continue
            if title.startswith("optiplanning - ["):
                candidates.append(w)
                continue
            if "professional (hp)" in title and cls.startswith("WWindow"):
                candidates.append(w)
        except Exception:
            continue
    return candidates[-1] if candidates else None


def _reg_value(name: str) -> str | None:
    try:
        proc = subprocess.run(
            ["reg", "query", REG_KEY, "/v", name],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            return None
        for ln in proc.stdout.splitlines():
            if name not in ln:
                continue
            parts = ln.split(None, 2)
            if len(parts) < 3:
                continue
            val = parts[2].strip()
            if val:
                return val
    except Exception:
        return None
    return None


def _resolve_saw_dir() -> Path:
    raw = _reg_value("SawDir")
    if not raw:
        return DEFAULT_SAW_DIR
    return Path(raw.rstrip("\\/"))


def _latest_saw_mtime(saw_dir: Path) -> float | None:
    if not saw_dir.exists():
        return None
    latest: float | None = None
    for p in saw_dir.rglob("*.saw"):
        try:
            m = p.stat().st_mtime
            if latest is None or m > latest:
                latest = m
        except Exception:
            continue
    return latest


def _find_warning_dialog(pid: int):
    for w in Desktop(backend="win32").windows(process=pid, class_name="#32770"):
        try:
            if not w.is_visible():
                continue
            t = _normalize_text(w.window_text() or "")
            if "uyar" in t or "error" in t or "warning" in t or "hata" in t:
                return w
        except Exception:
            continue
    return None


def _read_dialog_lines(dialog_window) -> list[str]:
    lines: list[str] = []
    for c in dialog_window.children():
        try:
            txt = (c.window_text() or "").strip()
            if not txt:
                continue
            if c.class_name() in ("Static", "ListBox") and txt not in lines:
                lines.append(txt)
        except Exception:
            continue
    return lines


def _dialog_buttons(dialog_window):
    out = []
    for c in dialog_window.children():
        try:
            if c.class_name() == "Button" and c.is_visible():
                out.append(c)
        except Exception:
            continue
    return out


def _click_button_by_text(dialog_window, candidates: Iterable[str]) -> bool:
    wanted = {_normalize_text(x) for x in candidates}
    for b in _dialog_buttons(dialog_window):
        try:
            txt = _normalize_text(b.window_text() or "")
            if txt not in wanted:
                continue
            try:
                b.click_input()
            except Exception:
                b.click()
            return True
        except Exception:
            continue
    return False


def _handle_optimize_dialog(dialog_window) -> tuple[bool, str | None]:
    # User rule: if the confirmation dialog appears, choose Yes and continue.
    if _click_button_by_text(dialog_window, ["Evet", "Yes", "&Evet", "&Yes"]):
        return (True, None)

    # Informational popups can be acknowledged and flow can continue.
    if _click_button_by_text(dialog_window, ["Tamam", "OK", "&Tamam", "&OK"]):
        return (True, None)

    lines = _read_dialog_lines(dialog_window)
    title = (dialog_window.window_text() or "").strip()
    if lines:
        return (False, " / ".join(lines))
    if title:
        return (False, title)
    return (False, "Optimize adiminda beklenmeyen diyalog")


def _trigger_menu(win) -> bool:
    candidates = [
        "Y\u00fcr\u00fct->Optimize Et / Devam et\tF5",
        "Yurut->Optimize Et / Devam et\tF5",
        "Y\u00fcr\u00fct->Optimize Et / Devam et",
        "Yurut->Optimize Et / Devam et",
        "Run->Optimize / Continue\tF5",
        "Run->Optimize / Continue",
    ]
    for path in candidates:
        try:
            win.set_focus()
            win.menu_select(path)
            return True
        except Exception:
            continue
    return False


def _trigger_toolbar_uia(pid: int) -> bool:
    mains = [w for w in Desktop(backend="uia").windows() if w.is_visible() and w.process_id() == pid]
    if not mains:
        return False
    main = mains[-1]

    for b in main.descendants(control_type="Button"):
        try:
            if not b.is_visible() or not b.is_enabled():
                continue
            txt = _normalize_text(b.window_text() or "")
            if "optimize et / devam et" in txt or "optimize" in txt:
                b.click_input()
                return True
        except Exception:
            continue
    return False


def _trigger_f5(win) -> bool:
    try:
        win.set_focus()
    except Exception:
        pass
    send_keys("{F5}")
    return True


def _menu_select_first(win, paths: Iterable[str]) -> bool:
    for p in paths:
        try:
            win.set_focus()
            win.menu_select(p)
            return True
        except Exception:
            continue
    return False


def _handle_visible_dialogs(pid: int) -> tuple[int, str | None]:
    handled = 0
    for d in Desktop(backend="win32").windows(process=pid, class_name="#32770"):
        try:
            if not d.is_visible():
                continue
            ok, err = _handle_optimize_dialog(d)
            if ok:
                handled += 1
                continue
            return (handled, err or "Optimize adiminda hata")
        except Exception as exc:
            return (handled, str(exc))
    return (handled, None)


def _clear_existing_solutions(win, pid: int) -> None:
    clicked = _menu_select_first(
        win,
        [
            "D\u00fczenle->\u00c7\u00f6z\u00fcmleri sil",
            "Edit->Delete solutions",
        ],
    )
    if not clicked:
        return
    deadline = time.time() + 4.0
    while time.time() < deadline:
        handled, err = _handle_visible_dialogs(pid)
        if err:
            raise RuntimeError(err)
        if handled == 0:
            break
        time.sleep(0.2)


def _wait_optimize_effect(pid: int, timeout_sec: float, saw_dir: Path, saw_before: float | None) -> tuple[bool, int]:
    handled_total = 0
    end = time.time() + max(1.0, timeout_sec)
    while time.time() < end:
        handled, err = _handle_visible_dialogs(pid)
        handled_total += handled
        if err:
            raise RuntimeError(err)

        saw_now = _latest_saw_mtime(saw_dir)
        if saw_before is None:
            if saw_now is not None:
                return (True, handled_total)
        else:
            if saw_now is not None and saw_now > saw_before:
                return (True, handled_total)
        time.sleep(0.2)
    return (False, handled_total)


def run_optimize(timeout_sec: float = 8.0, trigger: str = "button") -> None:
    raw_main = _find_main_win32()
    if raw_main is None:
        raise RuntimeError("OptiPlanning ana pencere bulunamadi")

    app = Application(backend="win32").connect(process=raw_main.process_id())
    win = app.window(handle=raw_main.handle)
    pid = raw_main.process_id()
    saw_dir = _resolve_saw_dir()

    trigger = (trigger or "button").strip().lower()
    if trigger not in {"button", "menu", "f5", "auto"}:
        raise ValueError(f"Gecersiz trigger modu: {trigger}")

    def _trigger_once() -> bool:
        if trigger == "button":
            return _trigger_toolbar_uia(pid)
        if trigger == "menu":
            return _trigger_menu(win)
        if trigger == "f5":
            return _trigger_f5(win)
        # auto
        return _trigger_toolbar_uia(pid) or _trigger_menu(win) or _trigger_f5(win)

    saw_before = _latest_saw_mtime(saw_dir)
    triggered = _trigger_once()
    if not triggered:
        if trigger == "button":
            raise RuntimeError("Optimize toolbar butonu bulunamadi veya tiklanamadi")
        raise RuntimeError("Optimize komutu tetiklenemedi")

    changed, handled = _wait_optimize_effect(
        pid=pid,
        timeout_sec=timeout_sec,
        saw_dir=saw_dir,
        saw_before=saw_before,
    )
    if changed:
        return

    # Recovery: clear previous solutions and retry once.
    _clear_existing_solutions(win, pid)
    saw_before_retry = _latest_saw_mtime(saw_dir)
    triggered_retry = _trigger_once()
    if not triggered_retry:
        raise RuntimeError("Optimize yeniden deneme tetiklenemedi")

    changed_retry, handled_retry = _wait_optimize_effect(
        pid=pid,
        timeout_sec=timeout_sec,
        saw_dir=saw_dir,
        saw_before=saw_before_retry,
    )
    if changed_retry:
        return

    if handled + handled_retry > 0:
        raise RuntimeError("Optimize diyaloglari islenmesine ragmen cikti dosyasi guncellenmedi")
    raise RuntimeError("Optimize butonu calisti ancak optimize etkisi gorulmedi (*.saw degismedi)")


def parse_args():
    p = argparse.ArgumentParser(description="OptiPlanning stage-3: Optimize Et / Devam et")
    p.add_argument("--timeout", type=float, default=8.0, help="Optimize tetikleme sonrasi izleme suresi (sn)")
    p.add_argument(
        "--trigger",
        choices=["button", "menu", "f5", "auto"],
        default="button",
        help="Optimize tetikleme yontemi (varsayilan: button)",
    )
    return p.parse_args()


def main():
    args = parse_args()
    try:
        run_optimize(timeout_sec=args.timeout, trigger=args.trigger)
        print("TAMAM: Optimize Et / Devam et tetiklendi.")
        return 0
    except Exception as exc:
        print(f"HATA: Stage-3 optimize basarisiz: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
