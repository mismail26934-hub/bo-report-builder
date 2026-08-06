from __future__ import annotations

import threading
from pathlib import Path

import pandas as pd

from app.services.excel_service import find_column, list_excel_files, read_excel_source

COLUMNS = ["SO_Number", "PO", "REMARK"]
CRUD_FILENAME = "so_exclude.xlsx"

_lock = threading.Lock()


def ensure_so_exclude_dir(folder: Path) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def crud_file_path(folder: Path) -> Path:
    return ensure_so_exclude_dir(folder) / CRUD_FILENAME


def _empty_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=COLUMNS)


def _normalize_cell(value: object) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    text = str(value).strip()
    if text.lower() in {"nan", "none", "nat"}:
        return ""
    return text


def _normalize_frame(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty and list(df.columns) == []:
        return _empty_frame()

    so_col = find_column(df, ["SO_Number", "SO_NUMBER", "SO Number", "Sales document"])
    try:
        po_col = find_column(df, ["PO", "Po", "Purchase Order", "PO_Number"])
    except KeyError:
        po_col = None
    try:
        remark_col = find_column(df, ["REMARK", "Remark", "Remarks", "NOTES", "Note"])
    except KeyError:
        remark_col = None

    rows: list[dict[str, str]] = []
    for _, row in df.iterrows():
        so_number = _normalize_cell(row.get(so_col))
        if not so_number:
            continue
        rows.append(
            {
                "SO_Number": so_number,
                "PO": _normalize_cell(row.get(po_col)) if po_col else "",
                "REMARK": _normalize_cell(row.get(remark_col)) if remark_col else "",
            }
        )
    return pd.DataFrame(rows, columns=COLUMNS)


def ensure_crud_file(folder: Path) -> Path:
    path = crud_file_path(folder)
    if not path.exists():
        _empty_frame().to_excel(path, index=False)
    return path


def load_crud_frame(folder: Path) -> pd.DataFrame:
    path = ensure_crud_file(folder)
    try:
        df = read_excel_source(path)
    except Exception:
        return _empty_frame()
    if df.empty:
        return _empty_frame()
    try:
        return _normalize_frame(df)
    except KeyError:
        return _empty_frame()


def save_crud_frame(folder: Path, df: pd.DataFrame) -> None:
    path = crud_file_path(folder)
    out = df.reindex(columns=COLUMNS).fillna("")
    out.to_excel(path, index=False)


def list_so_exclude_rows(folder: Path) -> list[dict[str, str]]:
    with _lock:
        df = load_crud_frame(folder)
    return [
        {
            "SO_Number": _normalize_cell(row.SO_Number),
            "PO": _normalize_cell(row.PO),
            "REMARK": _normalize_cell(row.REMARK),
        }
        for row in df.itertuples(index=False)
    ]


def create_so_exclude(
    folder: Path,
    so_number: str,
    po: str = "",
    remark: str = "",
) -> dict[str, str]:
    so_number = _normalize_cell(so_number)
    po = _normalize_cell(po)
    remark = _normalize_cell(remark)
    if not so_number:
        raise ValueError("SO_Number wajib diisi.")

    with _lock:
        df = load_crud_frame(folder)
        existing = set(df["SO_Number"].astype(str).str.strip().tolist()) if not df.empty else set()
        if so_number in existing:
            raise ValueError(f"SO_Number sudah ada: {so_number}")
        new_row = pd.DataFrame([{"SO_Number": so_number, "PO": po, "REMARK": remark}])
        df = pd.concat([df, new_row], ignore_index=True)
        save_crud_frame(folder, df)

    return {"SO_Number": so_number, "PO": po, "REMARK": remark}


def update_so_exclude(
    folder: Path,
    so_number: str,
    po: str | None = None,
    remark: str | None = None,
    new_so_number: str | None = None,
) -> dict[str, str]:
    so_number = _normalize_cell(so_number)
    if not so_number:
        raise ValueError("SO_Number wajib diisi.")

    with _lock:
        df = load_crud_frame(folder)
        if df.empty:
            raise ValueError(f"SO_Number tidak ditemukan: {so_number}")

        mask = df["SO_Number"].astype(str).str.strip() == so_number
        if not mask.any():
            raise ValueError(f"SO_Number tidak ditemukan: {so_number}")

        idx = df.index[mask][0]
        updated_so = _normalize_cell(new_so_number) if new_so_number is not None else so_number
        if not updated_so:
            raise ValueError("SO_Number wajib diisi.")

        if updated_so != so_number:
            others = set(
                df.loc[~mask, "SO_Number"].astype(str).str.strip().tolist()
            )
            if updated_so in others:
                raise ValueError(f"SO_Number sudah ada: {updated_so}")

        df.at[idx, "SO_Number"] = updated_so
        if po is not None:
            df.at[idx, "PO"] = _normalize_cell(po)
        if remark is not None:
            df.at[idx, "REMARK"] = _normalize_cell(remark)

        save_crud_frame(folder, df)
        row = df.loc[idx]
        return {
            "SO_Number": _normalize_cell(row["SO_Number"]),
            "PO": _normalize_cell(row["PO"]),
            "REMARK": _normalize_cell(row["REMARK"]),
        }


def delete_so_exclude(folder: Path, so_number: str) -> None:
    so_number = _normalize_cell(so_number)
    if not so_number:
        raise ValueError("SO_Number wajib diisi.")

    with _lock:
        df = load_crud_frame(folder)
        if df.empty:
            raise ValueError(f"SO_Number tidak ditemukan: {so_number}")
        mask = df["SO_Number"].astype(str).str.strip() == so_number
        if not mask.any():
            raise ValueError(f"SO_Number tidak ditemukan: {so_number}")
        df = df.loc[~mask].reset_index(drop=True)
        save_crud_frame(folder, df)


def load_exclude_so_numbers(folder: Path) -> set[str]:
    """Collect unique SO_Number from all Excel files in data-so-exclude."""
    ensure_so_exclude_dir(folder)
    files = list_excel_files(folder)
    if not files:
        return set()

    values: set[str] = set()
    with _lock:
        for path in files:
            try:
                df = read_excel_source(path)
            except Exception:
                continue
            if df.empty:
                continue
            try:
                normalized = _normalize_frame(df)
            except KeyError:
                continue
            for so in normalized["SO_Number"].tolist():
                text = _normalize_cell(so)
                if text:
                    values.add(text)
    return values
