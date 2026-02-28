#!/usr/bin/env python3
"""
OptiPlanning stage-1 UI automation.

Automates the exact first-stage flow:
1) File -> New
2) Save dialog: set order/job name, click Save
3) Edit -> New Worklist/Job (+)
4) Worklist dialog: set same name, click New

Notes:
- This script must run on the same Windows desktop session where OptiPlan.exe is visible.
- It uses pywinauto (win32 backend), so run with a regular desktop user (not a headless service).
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

from pywinauto import Application, Desktop


DEFAULT_EXE = r"C:\Biesse\OptiPlanning\System\OptiPlanning.exe"


@dataclass
class UiConfig:
    list_name: str
    exe_path: str
    start_if_closed: bool = True
    timeout_sec: float = 25.0
    settle_sec: float = 0.5


def _normalize_name(value: str) -> str:
    return re.sub(r"\s+", "", (value or "")).strip().lower()


def _normalize_ui_text(value: str) -> str:
    s = (value or "").strip().lower().replace("ı", "i")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return s


def _validate_list_name(list_name: str) -> str:
    cleaned = (list_name or "").strip()
    if not cleaned:
        raise ValueError("list_name bos olamaz")
    if any(ch in cleaned for ch in r'<>:"/\|?*'):
        raise ValueError("list_name gecersiz karakter iceriyor (<>:\"/\\|?*)")
    return cleaned


def _derive_name_from_xlsx(xlsx_path: str) -> str:
    stem = Path(xlsx_path).stem.strip()
    if not stem:
        raise ValueError("xlsx dosya adindan liste ismi cikartilamadi")
    # Dosya adindaki noktalar OptiPlanning'de sorun yaratir (uzanti olarak yorumlanabilir)
    # Ornek: "AHMET_20260226_081337_18.0mmBEYAZ_GOVDE" -> "AHMET_20260226_081337_18_0mmBEYAZ_GOVDE"
    stem = stem.replace(".", "_")
    return stem


def _wait_for(
    predicate,
    timeout_sec: float,
    step_sec: float = 0.2,
    description: str = "condition",
):
    deadline = time.time() + timeout_sec
    last_err: Optional[Exception] = None
    while time.time() < deadline:
        try:
            result = predicate()
            if result:
                return result
        except Exception as exc:  # pragma: no cover - runtime integration guard
            last_err = exc
        time.sleep(step_sec)
    if last_err:
        raise TimeoutError(f"Timeout waiting for {description}: {last_err}")
    raise TimeoutError(f"Timeout waiting for {description}")


def _first_visible_window_for_pid(pid: int):
    wins = Desktop(backend="win32").windows(process=pid)
    for w in wins:
        try:
            if w.is_visible() and w.window_text():
                return w
        except Exception:
            continue
    return None


def _find_main_optiplan_window():
    candidates = []
    for w in Desktop(backend="win32").windows():
        try:
            if not w.is_visible():
                continue
            title = w.window_text() or ""
            title_norm = _normalize_ui_text(title)
            class_name = (w.class_name() or "").strip()

            # Ignore Excel helper window (OptiPlanningCommandLine - Excel).
            if "commandline" in title_norm and "excel" in title_norm:
                continue

            # Primary deterministic match for real OptiPlanning top-level window.
            if title_norm.startswith("optiplanning - ["):
                candidates.append(w)
                continue

            # Fallback for some builds/locales that expose only Professional title.
            if "professional (hp)" in title_norm and class_name.startswith("WWindow"):
                candidates.append(w)
        except Exception:
            continue
    if not candidates:
        return None
    # Last one is usually the foreground/latest.
    return candidates[-1]


def _start_or_attach(exe_path: str, start_if_closed: bool, timeout_sec: float):
    main = _find_main_optiplan_window()
    if main:
        pid = main.process_id()
        app = Application(backend="win32").connect(process=pid)
        return app, main

    if not start_if_closed:
        raise RuntimeError("OptiPlanning acik degil ve --no-start verildi")
    if not os.path.exists(exe_path):
        raise FileNotFoundError(f"OptiPlan.exe bulunamadi: {exe_path}")

    proc = subprocess.Popen([exe_path])
    main = _wait_for(
        lambda: _first_visible_window_for_pid(proc.pid),
        timeout_sec=timeout_sec,
        description="OptiPlanning main window",
    )
    app = Application(backend="win32").connect(process=proc.pid)
    return app, main


def _menu_select_first(main_window, paths: Iterable[str]):
    last_exc: Optional[Exception] = None
    for path in paths:
        try:
            main_window.set_focus()
            main_window.menu_select(path)
            return
        except Exception as exc:
            last_exc = exc
    raise RuntimeError(f"Menu secimi basarisiz: {list(paths)}; son hata: {last_exc}")


def _invoke_menu_or_keys(main_window, paths: Iterable[str], fallback_keys: Optional[str] = None):
    try:
        _menu_select_first(main_window, paths)
        return
    except Exception:
        if not fallback_keys:
            raise
    main_window.set_focus()
    main_window.type_keys(fallback_keys, set_foreground=True)


def _wait_visible_dialog(pid: int, title_contains: str, timeout_sec: float):
    def _find():
        return _find_visible_dialog(pid, title_contains=title_contains)

    return _wait_for(_find, timeout_sec=timeout_sec, description=f"dialog ({title_contains})")


def _find_visible_dialog(pid: int, title_contains: str):
    wanted = _normalize_ui_text(title_contains)
    for w in Desktop(backend="win32").windows(process=pid, class_name="#32770"):
        try:
            if not w.is_visible():
                continue
            title = _normalize_ui_text(w.window_text() or "")
            if wanted in title:
                return w
        except Exception:
            continue
    return None


def _find_warning_dialog(pid: int):
    for w in Desktop(backend="win32").windows(process=pid, class_name="#32770"):
        try:
            if not w.is_visible():
                continue
            title = (w.window_text() or "").lower()
            if "uyar" in title or "error" in title or "warning" in title:
                return w
        except Exception:
            continue
    return None


def _find_overwrite_dialog(pid: int):
    for w in Desktop(backend="win32").windows(process=pid, class_name="#32770"):
        try:
            if not w.is_visible():
                continue
            title = (w.window_text() or "").lower()
            if "farkl" in title and "kaydet" in title:
                return w
            if "already exists" in title or "replace" in title:
                return w
            lines = " ".join(_read_listbox_lines(w)).lower()
            if "dosya mevcut" in lines or "already exists" in lines:
                return w
        except Exception:
            continue
    return None


def _find_save_confirmation_dialog(pid: int):
    for w in Desktop(backend="win32").windows(process=pid, class_name="#32770"):
        try:
            if not w.is_visible():
                continue
            buttons = [c for c in w.children() if c.class_name() == "Button" and c.is_visible()]
            btn_txt = [_normalize_ui_text(b.window_text() or "") for b in buttons]
            has_yes = any(x in ("evet", "yes", "&evet", "&yes") for x in btn_txt)
            has_no = any(x in ("hayir", "no", "&hayir", "&no") for x in btn_txt)
            if has_yes and has_no:
                return w
        except Exception:
            continue
    return None


def _read_listbox_lines(dialog_window) -> list[str]:
    lines: list[str] = []
    for c in dialog_window.children():
        try:
            if c.class_name() == "ListBox":
                for item in c.item_texts():
                    txt = (item or "").strip()
                    if txt:
                        lines.append(txt)
        except Exception:
            continue
    return lines


def _read_dialog_message_lines(dialog_window) -> list[str]:
    lines = _read_listbox_lines(dialog_window)
    for c in dialog_window.children():
        try:
            if c.class_name() != "Static":
                continue
            txt = (c.window_text() or "").strip()
            if txt and txt not in lines:
                lines.append(txt)
        except Exception:
            continue
    return lines


def _close_dialog(dialog_window):
    try:
        dialog_window.close()
        return
    except Exception:
        pass
    try:
        dialog_window.set_focus()
        dialog_window.type_keys("{ESC}")
    except Exception:
        pass


def _close_visible_dialogs(pid: int, max_rounds: int = 3) -> int:
    closed = 0
    for _ in range(max_rounds):
        found = False
        for d in Desktop(backend="win32").windows(process=pid, class_name="#32770"):
            try:
                if not d.is_visible():
                    continue
                found = True
                buttons = [c for c in d.children() if c.class_name() == "Button" and c.is_visible()]
                clicked = False
                for b in buttons:
                    txt = _normalize_ui_text(b.window_text() or "")
                    if txt in ("&hayir", "hayir", "&no", "no"):
                        try:
                            b.click_input()
                        except Exception:
                            b.click()
                        clicked = True
                        break
                if not clicked:
                    for b in buttons:
                        txt = _normalize_ui_text(b.window_text() or "")
                        if txt in ("iptal", "cancel", "&iptal", "&cancel"):
                            try:
                                b.click_input()
                            except Exception:
                                b.click()
                            clicked = True
                            break
                if not clicked:
                    try:
                        d.type_keys("{ESC}")
                    except Exception:
                        d.close()
                closed += 1
            except Exception:
                continue
        if not found:
            break
        time.sleep(0.2)
    return closed


def _set_first_edit_text(dialog_window, text: str):
    edits = [c for c in dialog_window.children() if c.class_name() == "Edit" and c.is_visible()]
    if not edits:
        raise RuntimeError(f"Edit kontrolu bulunamadi (dialog: {dialog_window.window_text()})")
    edits[0].set_focus()
    edits[0].set_text(text)


def _has_main_with_list_name(pid: int, list_name: str) -> bool:
    # Tam eslesme: [AHMET_20260226_081337_18mmBEYAZ_GOVDE]
    wanted_full = f"[{_normalize_ui_text(list_name)}]"
    # Kisaltilmis eslesme: sadece prefix kullan (OptiPlanning ismi kisaltabilir)
    # Ornek: "AHMET_20260226_081337" yeterli
    wanted_prefix = _normalize_ui_text(list_name).split("mm")[0] if "mm" in list_name.lower() else _normalize_ui_text(list_name)[:20]
    for w in Desktop(backend="win32").windows(process=pid):
        try:
            if not w.is_visible():
                continue
            title = _normalize_ui_text(w.window_text() or "")
            # Tam esleme
            if wanted_full in title:
                return True
            # Optiplanning penceresi + prefix esleme
            if "optiplanning" in title and "[" in title:
                bracket_content = title.split("[", 1)[1].split("]")[0] if "[" in title else ""
                if bracket_content and wanted_prefix and wanted_prefix in bracket_content:
                    return True
        except Exception:
            continue
    return False


def _click_first_visible_button_with_title(
    dialog_window,
    title_candidates: Iterable[str],
):
    wanted = {_normalize_ui_text(t) for t in title_candidates}
    buttons = [c for c in dialog_window.children() if c.class_name() == "Button" and c.is_visible()]
    for b in buttons:
        try:
            txt = _normalize_ui_text(b.window_text() or "")
        except Exception:
            continue
        if txt in wanted:
            try:
                b.click_input()
            except Exception:
                b.click()
            return
    raise RuntimeError(
        f"Button bulunamadi. Beklenen: {list(title_candidates)} / Dialog: {dialog_window.window_text()}"
    )


def run_stage1(config: UiConfig) -> None:
    app, raw_main = _start_or_attach(
        exe_path=config.exe_path,
        start_if_closed=config.start_if_closed,
        timeout_sec=config.timeout_sec,
    )
    pid = raw_main.process_id()
    main = app.window(handle=raw_main.handle)

    # If a save dialog is already open from a previous run, continue from that point.
    save_dialog_raw = _find_visible_dialog(pid, ".opjx")

    if save_dialog_raw is None:
        _close_visible_dialogs(pid)
        save_dialog_raw = _find_visible_dialog(pid, ".opjx")

    if save_dialog_raw is None:
        # Ensure we are in a neutral state: close active job/list, do not save drafts.
        try:
            _invoke_menu_or_keys(
                main,
                paths=[
                    "Dosya->Kapat\tCtrl+K",
                    "File->Close\tCtrl+K",
                ],
                fallback_keys="^k",
            )
            time.sleep(config.settle_sec)
            save_confirm = _find_save_confirmation_dialog(pid)
            if save_confirm is not None:
                _click_first_visible_button_with_title(
                    save_confirm,
                    ["Hayir", "No", "&Hayir", "&No"],
                )
                time.sleep(config.settle_sec)
        except Exception:
            # If there is nothing to close, continue.
            pass

        live_main_raw = _find_main_optiplan_window()
        if live_main_raw:
            main = app.window(handle=live_main_raw.handle)

        # 1) New order/job, with deterministic retry on transient modal errors.
        last_new_error: list[str] = []
        for attempt in range(1, 4):
            _close_visible_dialogs(pid)
            try:
                _menu_select_first(
                    main,
                    paths=[
                        "Dosya->Yeni",
                        "File->New",
                    ],
                )
            except Exception as exc:
                # Some environments open the save dialog even when menu_select raises.
                save_dialog_raw = _find_visible_dialog(pid, ".opjx")
                if save_dialog_raw is not None:
                    break

                # Typical case: "MenuItem Yeni is disabled" while an active job window is open.
                if "disabled" in str(exc).lower():
                    _invoke_menu_or_keys(
                        main,
                        paths=[
                            "Dosya->Kapat\tCtrl+K",
                            "File->Close\tCtrl+K",
                        ],
                        fallback_keys="^k",
                    )
                    time.sleep(config.settle_sec)
                    live_main_raw = _find_main_optiplan_window()
                    if not live_main_raw:
                        raise RuntimeError("Kapat sonrasi OptiPlanning ana pencere bulunamadi")
                    main = app.window(handle=live_main_raw.handle)
                    _menu_select_first(
                        main,
                        paths=[
                            "Dosya->Yeni",
                            "File->New",
                        ],
                    )
                else:
                    # Last fallback: keyboard shortcut only if main window is enabled.
                    if not main.is_enabled():
                        raise
                    main.set_focus()
                    main.type_keys("^n", set_foreground=True)

            time.sleep(config.settle_sec)

            # If a warning/error dialog appears, close and retry from neutral state.
            warning = _find_warning_dialog(pid)
            if warning is not None:
                last_new_error = _read_dialog_message_lines(warning) or [warning.window_text() or "Yeni adiminda hata"]
                _close_dialog(warning)
                try:
                    _invoke_menu_or_keys(
                        main,
                        paths=[
                            "Dosya->Kapat\tCtrl+K",
                            "File->Close\tCtrl+K",
                        ],
                        fallback_keys="^k",
                    )
                    time.sleep(config.settle_sec)
                    save_confirm = _find_save_confirmation_dialog(pid)
                    if save_confirm is not None:
                        _click_first_visible_button_with_title(
                            save_confirm,
                            ["Hayir", "No", "&Hayir", "&No"],
                        )
                        time.sleep(config.settle_sec)
                except Exception:
                    pass
                live_main_raw = _find_main_optiplan_window()
                if live_main_raw:
                    main = app.window(handle=live_main_raw.handle)
                continue

            # Wait briefly for save dialog. Retry if it doesn't appear.
            try:
                save_dialog_raw = _wait_visible_dialog(
                    pid,
                    ".opjx",
                    timeout_sec=min(6.0, config.timeout_sec),
                )
                break
            except TimeoutError:
                try:
                    _invoke_menu_or_keys(
                        main,
                        paths=[
                            "Dosya->Kapat\tCtrl+K",
                            "File->Close\tCtrl+K",
                        ],
                        fallback_keys="^k",
                    )
                    time.sleep(config.settle_sec)
                    save_confirm = _find_save_confirmation_dialog(pid)
                    if save_confirm is not None:
                        _click_first_visible_button_with_title(
                            save_confirm,
                            ["Hayir", "No", "&Hayir", "&No"],
                        )
                        time.sleep(config.settle_sec)
                except Exception:
                    pass
                live_main_raw = _find_main_optiplan_window()
                if live_main_raw:
                    main = app.window(handle=live_main_raw.handle)
                continue

        if save_dialog_raw is None:
            detail = " / ".join(last_new_error) if last_new_error else "Yeni adimindan sonra .opjx kaydet diyalogu acilmadi"
            raise TimeoutError(detail)

    # 2) Save order/job with provided name
    save_dialog = app.window(handle=save_dialog_raw.handle)
    _set_first_edit_text(save_dialog_raw, config.list_name)
    _click_first_visible_button_with_title(save_dialog_raw, ["Kaydet", "Save"])
    time.sleep(config.settle_sec * 2)  # Kaydet sonrasi ekstra bekleme

    # Kaydet sonrasi birden fazla dialog gelebilir (overwrite, uyari, onay)
    # Tekrarli kontrol ile hepsini handle et
    for _dialog_round in range(5):
        time.sleep(0.3)

        # Overwrite prompt (same filename exists)
        overwrite = _find_overwrite_dialog(pid)
        if overwrite is not None:
            _click_first_visible_button_with_title(overwrite, ["Evet", "Yes", "&Evet", "&Yes"])
            time.sleep(config.settle_sec)
            continue

        # Yes/No confirmation dialogs
        save_confirm = _find_save_confirmation_dialog(pid)
        if save_confirm is not None:
            _click_first_visible_button_with_title(save_confirm, ["Evet", "Yes", "&Evet", "&Yes"])
            time.sleep(config.settle_sec)
            continue

        # Warning dialog
        warning = _find_warning_dialog(pid)
        if warning is not None:
            warn_lines = _read_dialog_message_lines(warning)
            _close_dialog(warning)
            if not _has_main_with_list_name(pid, config.list_name):
                if warn_lines:
                    raise RuntimeError(" / ".join(warn_lines))
                raise RuntimeError("Kaydet adiminda OptiPlanning uyari penceresi acildi")
            break

        # Eger title zaten dogru ise cik
        if _has_main_with_list_name(pid, config.list_name):
            break

    # Main title should now contain [list_name]
    _wait_for(
        lambda: _has_main_with_list_name(pid, config.list_name),
        timeout_sec=config.timeout_sec,
        description=f"main window with [{config.list_name}]",
    )

    # Refetch main window (title/handle can change after "New")
    live_main_raw = _find_main_optiplan_window()
    if not live_main_raw:
        raise RuntimeError("OptiPlanning ana pencere bulunamadi (save sonrasi)")
    main = app.window(handle=live_main_raw.handle)

    # 3) New worklist/job (+)
    # "Otomatik liste yaratma" checkbox isareti varsa worklist otomatik olusur — bu adim atlanabilir
    try:
        _invoke_menu_or_keys(
            main,
            paths=[
                "D\u00fczenle->Yeni \u00c7al\u0131\u015fma Listesi/\u00c7al\u0131\u015fma\t+",
                "Edit->New Worklist/Job\t+",
            ],
            fallback_keys="{VK_ADD}",
        )
        time.sleep(config.settle_sec)
    except Exception:
        # Menu item bulunamazsa fallback key zaten denenecek, hata onemli degil
        pass

    # 4) Worklist dialog with same name
    # "Otomatik liste yaratma" aktifse .opdx diyalogu acilmaz — timeout'u kisa tut
    try:
        wl_dialog_raw = _wait_visible_dialog(pid, ".opdx", timeout_sec=min(8.0, config.timeout_sec))
        _set_first_edit_text(wl_dialog_raw, config.list_name)
        _click_first_visible_button_with_title(wl_dialog_raw, ["Yeni", "New"])
    except TimeoutError:
        # "Otomatik liste yaratma" isaretli — worklist zaten olusturulmus, devam et
        pass

    # Worklist dialog should close
    _wait_for(
        lambda: not any(
            w.is_visible() and ".opdx" in (w.window_text() or "").lower()
            for w in Desktop(backend="win32").windows(process=pid, class_name="#32770")
        ),
        timeout_sec=config.timeout_sec,
        description="worklist dialog close",
    )


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="OptiPlanning stage-1 UI automation (New -> Save -> New Worklist)."
    )
    parser.add_argument("--name", dest="list_name", help="Liste/Order adi (dosya kuralina gore)")
    parser.add_argument("--xlsx", dest="xlsx_path", help="XLSX dosya yolu (isim bu dosyadan da alinabilir)")
    parser.add_argument("--exe", dest="exe_path", default=DEFAULT_EXE, help="OptiPlan.exe yolu")
    parser.add_argument(
        "--no-start",
        action="store_true",
        help="OptiPlanning kapaliysa otomatik baslatma",
    )
    parser.add_argument("--timeout", type=float, default=25.0, help="Bekleme timeout (sn)")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)

    if not args.list_name and not args.xlsx_path:
        print("HATA: --name veya --xlsx vermelisiniz.", file=sys.stderr)
        return 2

    if args.xlsx_path:
        if not os.path.exists(args.xlsx_path):
            print(f"HATA: XLSX bulunamadi: {args.xlsx_path}", file=sys.stderr)
            return 2
        xlsx_name = _derive_name_from_xlsx(args.xlsx_path)
    else:
        xlsx_name = None

    if args.list_name:
        list_name = _validate_list_name(args.list_name)
    else:
        list_name = _validate_list_name(xlsx_name or "")

    # Strict naming rule: if both are provided, names must match.
    if xlsx_name and _normalize_name(list_name) != _normalize_name(xlsx_name):
        print(
            f"HATA: liste adi ile xlsx dosya adi ayni olmali. liste='{list_name}', xlsx='{xlsx_name}'",
            file=sys.stderr,
        )
        return 2

    cfg = UiConfig(
        list_name=list_name,
        exe_path=args.exe_path,
        start_if_closed=not args.no_start,
        timeout_sec=args.timeout,
    )

    try:
        run_stage1(cfg)
        print(f"TAMAM: '{list_name}' icin New + Save + New Worklist adimlari tamamlandi.")
        return 0
    except Exception as exc:
        print(f"HATA: Otomasyon basarisiz: {exc!r}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
