from __future__ import annotations

import re
import shutil
from datetime import datetime
from pathlib import Path

from app.services.excel_service import list_excel_files

BACKUP_DIR_NAME = "backup"


def _safe_filename(name: str | None) -> str:
    raw = (name or "upload.xlsx").strip() or "upload.xlsx"
    # keep basename only; block path traversal
    raw = Path(raw).name
    raw = re.sub(r"[^\w.\- ()+]", "_", raw)
    if Path(raw).suffix.lower() not in {".xlsx", ".xls"}:
        raw = f"{raw}.xlsx"
    return raw or "upload.xlsx"


def _unique_path(folder: Path, filename: str) -> Path:
    candidate = folder / filename
    if not candidate.exists():
        return candidate
    stem = candidate.stem
    suffix = candidate.suffix
    index = 2
    while True:
        alt = folder / f"{stem}_{index}{suffix}"
        if not alt.exists():
            return alt
        index += 1


def backup_folder_excel(folder: Path) -> Path | None:
    """
    Move current Excel files in folder into folder/backup/<timestamp>/.
    Returns backup path, or None if nothing was moved.
    """
    folder.mkdir(parents=True, exist_ok=True)
    current = list_excel_files(folder)
    if not current:
        return None

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = folder / BACKUP_DIR_NAME / stamp
    # avoid collision if called twice in the same second
    if backup_dir.exists():
        n = 2
        while (folder / BACKUP_DIR_NAME / f"{stamp}_{n}").exists():
            n += 1
        backup_dir = folder / BACKUP_DIR_NAME / f"{stamp}_{n}"
    backup_dir.mkdir(parents=True, exist_ok=True)

    for path in current:
        target = backup_dir / path.name
        if target.exists():
            target = _unique_path(backup_dir, path.name)
        shutil.move(str(path), str(target))
    return backup_dir


def save_upload_files(
    folder: Path,
    files: list[tuple[str, bytes]],
) -> list[Path]:
    """Write uploaded bytes into folder (after optional backup)."""
    folder.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    used_names: set[str] = set()
    for original_name, content in files:
        filename = _safe_filename(original_name)
        if filename in used_names:
            stem = Path(filename).stem
            suffix = Path(filename).suffix
            n = 2
            while f"{stem}_{n}{suffix}" in used_names:
                n += 1
            filename = f"{stem}_{n}{suffix}"
        used_names.add(filename)
        path = _unique_path(folder, filename)
        path.write_bytes(content)
        saved.append(path)
    return saved


def replace_folder_uploads(
    folder: Path,
    files: list[tuple[str, bytes]],
) -> tuple[list[Path], Path | None]:
    """
    Backup existing Excel files, then save new uploads into folder.
    Returns (saved_paths, backup_dir_or_none).
    """
    if not files:
        raise ValueError("Tidak ada file untuk disimpan.")
    backup_dir = backup_folder_excel(folder)
    saved = save_upload_files(folder, files)
    return saved, backup_dir
