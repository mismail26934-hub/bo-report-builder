from __future__ import annotations

import io
import re
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

import pandas as pd

EXCEL_EXTENSIONS = {".xlsx", ".xls", ".XLSX", ".XLS"}

# Stable job ids + fixed output filenames (each process overwrites previous)
JOB_ID_BO = "bo"
JOB_ID_PARTVIZ = "partviz"
JOB_ID_ORDER_ITEM = "order-item"
JOB_ID_PROGRESS_SOURCE = "progress-source"
OUTPUT_COMPARE = "compare.xlsx"
OUTPUT_PSC_SO = "psc_so_unique.xlsx"
OUTPUT_SAP_DOC = "sap_sales_document_unique.xlsx"
OUTPUT_PARTVIZ_MERGED = "partviz_merged.xlsx"
OUTPUT_ORDER_ITEM_PRICE = "order_item_price_per_material.xlsx"
OUTPUT_PURCHASING_DOCUMENT = "purchasing_document_unique.xlsx"

# PartViz milestone sort order (lower index = earlier in output)
MILESTONE_ORDER = [
    "Cancelled",
    "Griefed",
    "ESD Needed",
    "Future Dated",
    "ESD Available",
    "Sourced",
    "Shipped",
]


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [
        re.sub(r"\s+", " ", str(c)).strip()
        for c in df.columns
    ]
    return df


def _column_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


def find_column(df: pd.DataFrame, candidates: list[str]) -> str:
    key_map = {_column_key(c): c for c in df.columns}
    for candidate in candidates:
        key = _column_key(candidate)
        if key in key_map:
            return key_map[key]
    raise KeyError(
        f"Kolom tidak ditemukan. Dicari: {candidates}. Tersedia: {list(df.columns)}"
    )


def list_excel_files(folder: Path) -> list[Path]:
    if not folder.exists():
        return []
    files: list[Path] = []
    for path in folder.iterdir():
        if (
            path.is_file()
            and not path.name.startswith("~$")
            and path.suffix.lower() in {".xlsx", ".xls"}
        ):
            files.append(path)
    return sorted(files)


def read_excel_source(
    source: Path | BinaryIO | bytes,
    filename: str | None = None,
    usecols=None,
) -> pd.DataFrame:
    if isinstance(source, Path):
        df = pd.read_excel(source, dtype=str, usecols=usecols)
    elif isinstance(source, (bytes, bytearray)):
        df = pd.read_excel(io.BytesIO(source), dtype=str, usecols=usecols)
    else:
        content = source.read()
        df = pd.read_excel(io.BytesIO(content), dtype=str, usecols=usecols)

    df = _normalize_columns(df)
    # Drop fully empty rows (common blank line under header)
    df = df.dropna(how="all").reset_index(drop=True)
    return df


def unique_series(series: pd.Series) -> pd.Series:
    cleaned = (
        series.dropna()
        .astype(str)
        .str.strip()
        .replace({"": pd.NA, "nan": pd.NA, "None": pd.NA, "NaT": pd.NA})
        .dropna()
    )
    return cleaned.drop_duplicates().sort_values().reset_index(drop=True)


def parse_filter_values(raw: str) -> list[str]:
    """Split multi-value filters: comma / semicolon / whitespace."""
    parts = re.split(r"[,;\s]+", str(raw).strip())
    values = [p.strip() for p in parts if p.strip()]
    # preserve order, drop duplicates
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


def parse_exclude_values(raw: str) -> list[str]:
    """Split exclude list by comma/semicolon only (keep spaces & colons in part numbers)."""
    if not str(raw).strip():
        return []
    parts = re.split(r"[,;]+", str(raw).strip())
    values = [p.strip() for p in parts if p.strip()]
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


@dataclass
class ProcessResult:
    job_id: str
    sales_office: str
    plant: str
    exclude_part_numbers: str
    excluded_row_count: int
    excluded_so_count: int
    excluded_so_preview: list[str]
    psc_so_count: int
    sap_doc_count: int
    combined_count: int
    matched_count: int
    only_psc_count: int
    only_sap_count: int
    psc_files: list[str]
    sap_files: list[str]
    files: dict[str, Path]
    preview: dict[str, list[str]]


def extract_psc_so_numbers(df: pd.DataFrame, sales_office: str) -> pd.Series:
    office_col = find_column(df, ["Sales_Office", "Sales Office", "SALES_OFFICE"])
    so_col = find_column(df, ["SO_Number", "SO_NUMBER", "SO Number", "Sales document"])

    office_values = df[office_col].astype(str).str.strip()
    filtered = df[office_values == str(sales_office).strip()]
    return unique_series(filtered[so_col])


def exclude_sap_material_rows(
    df: pd.DataFrame, exclude_parts: list[str]
) -> tuple[pd.DataFrame, int]:
    """Drop SAP rows whose Material No is in exclude_parts (row-level only)."""
    if not exclude_parts:
        return df, 0
    material_col = find_column(
        df,
        ["Material No", "Material_No", "Material Number", "Material", "MATNR"],
    )
    material_values = df[material_col].astype(str).str.strip()
    mask_exclude = material_values.isin(exclude_parts)
    excluded_count = int(mask_exclude.sum())
    return df.loc[~mask_exclude].reset_index(drop=True), excluded_count


def exclude_so_values(
    series: pd.Series, exclude_sos: set[str]
) -> tuple[pd.Series, list[str]]:
    """Drop SO / Sales document values present in exclude_sos."""
    if not exclude_sos:
        return series, []
    values = series.astype(str).str.strip()
    removed = sorted({v for v in values.tolist() if v in exclude_sos})
    kept = values[~values.isin(exclude_sos)]
    return unique_series(kept), removed


def extract_sap_sales_documents(df: pd.DataFrame, plants: list[str]) -> pd.Series:
    if not plants:
        raise ValueError("Plant wajib diisi.")
    plant_col = find_column(df, ["Plant", "PLANT", "Werks", "WERKS"])
    doc_col = find_column(
        df,
        ["Sales document", "Sales_document", "SALES_DOCUMENT", "SO_Number", "SO_NUMBER"],
    )
    plant_values = df[plant_col].astype(str).str.strip()
    filtered = df[plant_values.isin(plants)]
    return unique_series(filtered[doc_col])


def process_dataframes(
    psc_frames: list[tuple[str, pd.DataFrame]],
    sap_frames: list[tuple[str, pd.DataFrame]],
    sales_office: str,
    plant: str,
    output_dir: Path,
    exclude_part_numbers: str = "",
    exclude_so_numbers: set[str] | None = None,
) -> ProcessResult:
    if not psc_frames:
        raise ValueError("Tidak ada data PSC untuk diproses.")
    if not sap_frames:
        raise ValueError("Tidak ada data SAP untuk diproses.")

    plants = parse_filter_values(plant)
    if not plants:
        raise ValueError("Plant wajib diisi.")
    plant_label = ", ".join(plants)

    exclude_parts = parse_exclude_values(exclude_part_numbers)
    exclude_label = ", ".join(exclude_parts)
    exclude_sos = exclude_so_numbers or set()

    psc_df = pd.concat([frame for _, frame in psc_frames], ignore_index=True)
    sap_df = pd.concat([frame for _, frame in sap_frames], ignore_index=True)
    sap_df, excluded_row_count = exclude_sap_material_rows(sap_df, exclude_parts)

    so_numbers = extract_psc_so_numbers(psc_df, sales_office)
    sales_docs = extract_sap_sales_documents(sap_df, plants)

    so_numbers, removed_psc = exclude_so_values(so_numbers, exclude_sos)
    sales_docs, removed_sap = exclude_so_values(sales_docs, exclude_sos)
    excluded_so_preview = sorted(set(removed_psc) | set(removed_sap))
    excluded_so_count = len(excluded_so_preview)

    psc_set = set(so_numbers.tolist())
    sap_set = set(sales_docs.tolist())
    matched = sorted(psc_set & sap_set)
    only_psc = sorted(psc_set - sap_set)
    only_sap = sorted(sap_set - psc_set)
    combined = unique_series(pd.concat([so_numbers, sales_docs], ignore_index=True))

    output_dir.mkdir(parents=True, exist_ok=True)
    psc_path = output_dir / OUTPUT_PSC_SO
    sap_path = output_dir / OUTPUT_SAP_DOC
    compare_path = output_dir / OUTPUT_COMPARE

    so_numbers.to_frame("SO_Number").to_excel(psc_path, index=False)
    sales_docs.to_frame("Sales_document").to_excel(sap_path, index=False)

    with pd.ExcelWriter(compare_path, engine="openpyxl") as writer:
        combined.to_frame("SO_Number").to_excel(writer, sheet_name="combined", index=False)
        pd.DataFrame({"SO_Number": matched}).to_excel(writer, sheet_name="matched", index=False)
        pd.DataFrame({"SO_Number": only_psc}).to_excel(writer, sheet_name="only_psc", index=False)
        pd.DataFrame({"Sales_document": only_sap}).to_excel(writer, sheet_name="only_sap", index=False)

    return ProcessResult(
        job_id=JOB_ID_BO,
        sales_office=sales_office,
        plant=plant_label,
        exclude_part_numbers=exclude_label,
        excluded_row_count=excluded_row_count,
        excluded_so_count=excluded_so_count,
        excluded_so_preview=excluded_so_preview[:20],
        psc_so_count=len(so_numbers),
        sap_doc_count=len(sales_docs),
        combined_count=len(combined),
        matched_count=len(matched),
        only_psc_count=len(only_psc),
        only_sap_count=len(only_sap),
        psc_files=[name for name, _ in psc_frames],
        sap_files=[name for name, _ in sap_frames],
        files={
            "psc_so": psc_path,
            "sap_doc": sap_path,
            "compare": compare_path,
        },
        preview={
            "psc_so": so_numbers.head(20).tolist(),
            "sap_doc": sales_docs.head(20).tolist(),
            "combined": combined.head(20).tolist(),
            "matched": matched[:20],
            "only_psc": only_psc[:20],
            "only_sap": only_sap[:20],
            "excluded_so": excluded_so_preview[:20],
        },
    )


@dataclass
class PartvizResult:
    job_id: str
    row_count: int
    file_count: int
    source_files: list[str]
    milestone_order: list[str]
    milestone_counts: dict[str, int]
    unknown_milestone_count: int
    files: dict[str, Path]
    preview: list[str]


def process_partviz_dataframes(
    frames: list[tuple[str, pd.DataFrame]],
    output_dir: Path,
) -> PartvizResult:
    if not frames:
        raise ValueError("Tidak ada data PartViz untuk diproses.")

    merged = pd.concat([frame for _, frame in frames], ignore_index=True)
    milestone_col = find_column(merged, ["Milestone", "MILESTONE", "milestone"])

    values = merged[milestone_col].astype(str).str.strip()
    values = values.replace({"nan": pd.NA, "None": pd.NA, "NaT": pd.NA, "": pd.NA})
    merged = merged.assign(**{milestone_col: values})

    known = set(MILESTONE_ORDER)
    order_index = {name: i for i, name in enumerate(MILESTONE_ORDER)}
    merged = merged.assign(
        _milestone_rank=merged[milestone_col].map(order_index).fillna(len(MILESTONE_ORDER)),
        _milestone_name=merged[milestone_col].fillna("\uffff").astype(str),
    )
    merged = (
        merged.sort_values(["_milestone_rank", "_milestone_name"], kind="mergesort")
        .drop(columns=["_milestone_rank", "_milestone_name"])
        .reset_index(drop=True)
    )

    counts_raw = merged[milestone_col].fillna("(empty)").value_counts()
    milestone_counts: dict[str, int] = {}
    for name in MILESTONE_ORDER:
        milestone_counts[name] = int(counts_raw.get(name, 0))
    unknown_milestone_count = 0
    for name, count in counts_raw.items():
        if name not in known:
            milestone_counts[str(name)] = int(count)
            unknown_milestone_count += int(count)

    output_dir.mkdir(parents=True, exist_ok=True)
    merged_path = output_dir / OUTPUT_PARTVIZ_MERGED
    merged.to_excel(merged_path, index=False)

    # Unique milestones in sorted order (known first, then unknown alpha)
    present = set(
        merged[milestone_col].dropna().astype(str).str.strip().tolist()
    )
    preview = [name for name in MILESTONE_ORDER if name in present]
    unknown_names = sorted(n for n in present if n not in known)
    preview.extend(unknown_names)

    return PartvizResult(
        job_id=JOB_ID_PARTVIZ,
        row_count=len(merged),
        file_count=len(frames),
        source_files=[name for name, _ in frames],
        milestone_order=list(MILESTONE_ORDER),
        milestone_counts=milestone_counts,
        unknown_milestone_count=unknown_milestone_count,
        files={"partviz_merged": merged_path},
        preview=preview,
    )


@dataclass
class OrderItemPriceResult:
    job_id: str
    row_count: int
    material_count: int
    file_count: int
    invalid_row_count: int
    source_files: list[str]
    files: dict[str, Path]
    preview: list[dict[str, str]]


def _to_numeric(series: pd.Series) -> pd.Series:
    """Convert Excel numeric text, including comma separators and parentheses."""
    cleaned = (
        series.astype(str)
        .str.strip()
        .str.replace(",", "", regex=False)
        .str.replace(r"^\((.*)\)$", r"-\1", regex=True)
        .replace({"": pd.NA, "nan": pd.NA, "None": pd.NA, "NaT": pd.NA})
    )
    return pd.to_numeric(cleaned, errors="coerce")


def process_order_item_price_dataframes(
    frames: list[tuple[str, pd.DataFrame]],
    output_dir: Path,
) -> OrderItemPriceResult:
    if not frames:
        raise ValueError("Tidak ada data Order Item untuk diproses.")

    sourced_frames: list[pd.DataFrame] = []
    for name, frame in frames:
        sourced = frame.copy()
        sourced["Source File"] = name
        sourced_frames.append(sourced)
    merged = pd.concat(sourced_frames, ignore_index=True)

    material_col = find_column(
        merged,
        ["Material", "Material No", "Material Number", "MATNR"],
    )
    quantity_col = find_column(
        merged,
        ["Order Quantity", "Order Qty", "Ordered Quantity", "Quantity"],
    )
    selling_price_col = find_column(
        merged,
        ["Parts Selling Price", "Part Selling Price", "Selling Price"],
    )
    discount_col = find_column(
        merged,
        ["Discount Total", "Total Discount", "Discount"],
    )

    order_quantity = _to_numeric(merged[quantity_col])
    selling_price = _to_numeric(merged[selling_price_col])
    discount_total = _to_numeric(merged[discount_col])
    valid = (
        order_quantity.notna()
        & order_quantity.ne(0)
        & selling_price.notna()
        & discount_total.notna()
    )

    price_per_material = pd.Series(pd.NA, index=merged.index, dtype="Float64")
    price_per_material.loc[valid] = (
        (selling_price.loc[valid] - discount_total.loc[valid].abs())
        / order_quantity.loc[valid]
    ).round(2)
    merged["Price per Material"] = price_per_material

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / OUTPUT_ORDER_ITEM_PRICE
    merged.to_excel(output_path, index=False)

    preview_columns = [
        column
        for column in [
            material_col,
            quantity_col,
            selling_price_col,
            discount_col,
            "Price per Material",
        ]
        if column in merged.columns
    ]
    preview = (
        merged.loc[valid, preview_columns]
        .head(15)
        .fillna("")
        .astype(str)
        .to_dict(orient="records")
    )
    material_count = int(
        merged[material_col]
        .dropna()
        .astype(str)
        .str.strip()
        .replace("", pd.NA)
        .dropna()
        .nunique()
    )

    return OrderItemPriceResult(
        job_id=JOB_ID_ORDER_ITEM,
        row_count=len(merged),
        material_count=material_count,
        file_count=len(frames),
        invalid_row_count=int((~valid).sum()),
        source_files=[name for name, _ in frames],
        files={"order_item_price": output_path},
        preview=preview,
    )


@dataclass
class ProgressSourceResult:
    job_id: str
    source_item_row_count: int
    parts_progress_row_count: int
    purchasing_document_count: int
    material_count: int
    excluded_qty_equal_count: int
    source_item_files: list[str]
    parts_progress_files: list[str]
    files: dict[str, Path]
    preview: list[str]
    material_preview: list[str]


SOURCE_ITEM_USECOLS = [
    "Purchasing Document",
    "Material",
    "Reason for rejection",
    "Order Quantity",
    "OD Quantity",
]


def process_progress_source_dataframes(
    source_item_frames: list[tuple[str, pd.DataFrame]],
    parts_progress_frames: list[tuple[str, pd.DataFrame]],
    output_dir: Path,
) -> ProgressSourceResult:
    if not source_item_frames:
        raise ValueError("Tidak ada data Source Item untuk diproses.")
    if not parts_progress_frames:
        raise ValueError("Tidak ada data Parts Progress untuk diproses.")

    source_item_df = pd.concat(
        [frame for _, frame in source_item_frames],
        ignore_index=True,
    )
    parts_progress_df = pd.concat(
        [frame for _, frame in parts_progress_frames],
        ignore_index=True,
    )
    source_item_row_count = len(source_item_df)

    order_qty_col = find_column(
        source_item_df,
        ["Order Quantity", "Order Qty", "Ordered Quantity", "ORDER_QUANTITY"],
    )
    od_qty_col = find_column(
        source_item_df,
        ["OD Quantity", "OD Qty", "Od Quantity", "OD_QUANTITY"],
    )
    order_qty = _to_numeric(source_item_df[order_qty_col])
    od_qty = _to_numeric(source_item_df[od_qty_col])
    qty_equal_mask = order_qty.notna() & od_qty.notna() & order_qty.eq(od_qty)
    excluded_qty_equal_count = int(qty_equal_mask.sum())
    source_item_df = source_item_df.loc[~qty_equal_mask].reset_index(drop=True)

    purchasing_document_col = find_column(
        source_item_df,
        [
            "Purchasing Document",
            "Purchasing_Document",
            "PURCHASING_DOCUMENT",
        ],
    )
    purchasing_documents = unique_series(
        source_item_df[purchasing_document_col]
    )
    material_col = find_column(
        source_item_df,
        ["Material", "Material No", "Material Number", "MATNR"],
    )
    rejection_col = find_column(
        source_item_df,
        [
            "Reason for rejection",
            "Reason For Rejection",
            "Rejection Reason",
        ],
    )
    rejection_values = source_item_df[rejection_col]
    rejection_blank = rejection_values.isna() | (
        rejection_values.astype(str).str.strip().isin(
            ["", "nan", "None", "NaT"]
        )
    )
    materials = unique_series(
        source_item_df.loc[rejection_blank, material_col]
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / OUTPUT_PURCHASING_DOCUMENT
    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        purchasing_documents.to_frame("Purchasing Document").to_excel(
            writer,
            sheet_name="Purchasing Document",
            index=False,
        )
        materials.to_frame("Material").to_excel(
            writer,
            sheet_name="Material",
            index=False,
        )

    return ProgressSourceResult(
        job_id=JOB_ID_PROGRESS_SOURCE,
        source_item_row_count=source_item_row_count,
        parts_progress_row_count=len(parts_progress_df),
        purchasing_document_count=len(purchasing_documents),
        material_count=len(materials),
        excluded_qty_equal_count=excluded_qty_equal_count,
        source_item_files=[name for name, _ in source_item_frames],
        parts_progress_files=[name for name, _ in parts_progress_frames],
        files={"purchasing_document": output_path},
        preview=purchasing_documents.head(20).tolist(),
        material_preview=materials.head(20).tolist(),
    )
