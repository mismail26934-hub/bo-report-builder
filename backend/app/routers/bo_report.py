from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.services.excel_service import (
    OUTPUT_COMPARE,
    OUTPUT_ORDER_ITEM_PRICE,
    OUTPUT_PARTVIZ_MERGED,
    OUTPUT_PURCHASING_DOCUMENT,
    OUTPUT_PSC_SO,
    OUTPUT_SAP_DOC,
    SOURCE_ITEM_USECOLS,
    list_excel_files,
    process_dataframes,
    process_order_item_price_dataframes,
    process_partviz_dataframes,
    process_progress_source_dataframes,
    read_excel_source,
)
from app.services.so_exclude_service import (
    create_so_exclude,
    delete_so_exclude,
    ensure_crud_file,
    list_so_exclude_rows,
    load_exclude_so_numbers,
    update_so_exclude,
)
from app.services.file_storage_service import replace_folder_uploads
from app.services.data_upload_service import (
    DATA_UPLOAD_DATASETS,
    DATA_UPLOAD_LABELS,
    list_data_upload_datasets,
    resolve_data_upload_dir,
)


router = APIRouter(prefix="/api", tags=["bo-report"])

# In-memory job registry for download paths (process lifetime)
JOBS: dict[str, dict[str, Path]] = {}


class FolderInfo(BaseModel):
    psc_dir: str
    sap_dir: str
    partviz_dir: str
    order_item_dir: str
    source_item_dir: str
    parts_progress_dir: str
    so_exclude_dir: str
    estimasi_dir: str
    bo_last_dir: str
    zmim_cpavail_dir: str
    zmmm_stock_info_dir: str
    zmmm_stock_info_hub_dir: str
    zmpu_po_moni_dir: str
    psc_files: list[str]
    sap_files: list[str]
    partviz_files: list[str]
    order_item_files: list[str]
    source_item_files: list[str]
    parts_progress_files: list[str]
    so_exclude_files: list[str]
    estimasi_files: list[str]
    bo_last_files: list[str]
    zmim_cpavail_files: list[str]
    zmmm_stock_info_files: list[str]
    zmmm_stock_info_hub_files: list[str]
    zmpu_po_moni_files: list[str]
    data_upload_datasets: list[dict[str, str]] = Field(default_factory=list)
    default_sales_office: str
    default_plant: str
    default_exclude_part_numbers: str


class DataUploadResponse(BaseModel):
    dataset: str
    label: str
    folder: str
    saved_files: list[str]
    backup_dir: str | None = None
    file_count: int
    files: list[str]


class ProcessResponse(BaseModel):
    job_id: str
    sales_office: str
    plant: str
    exclude_part_numbers: str
    excluded_row_count: int
    excluded_so_count: int
    excluded_so_preview: list[str] = Field(default_factory=list)
    psc_so_count: int
    sap_doc_count: int
    combined_count: int
    matched_count: int
    only_psc_count: int
    only_sap_count: int
    psc_files: list[str]
    sap_files: list[str]
    downloads: dict[str, str]
    preview: dict[str, list[str]] = Field(default_factory=dict)


class SoExcludeRow(BaseModel):
    SO_Number: str
    PO: str = ""
    REMARK: str = ""


class SoExcludeCreate(BaseModel):
    SO_Number: str
    PO: str = ""
    REMARK: str = ""


class SoExcludeUpdate(BaseModel):
    SO_Number: str | None = None
    PO: str | None = None
    REMARK: str | None = None


class PartvizProcessResponse(BaseModel):
    job_id: str
    row_count: int
    file_count: int
    source_files: list[str]
    milestone_order: list[str]
    milestone_counts: dict[str, int]
    unknown_milestone_count: int
    downloads: dict[str, str]
    preview: list[str] = Field(default_factory=list)


class OrderItemPriceProcessResponse(BaseModel):
    job_id: str
    row_count: int
    material_count: int
    file_count: int
    invalid_row_count: int
    source_files: list[str]
    downloads: dict[str, str]
    preview: list[dict[str, str]] = Field(default_factory=list)


class ProgressSourceProcessResponse(BaseModel):
    job_id: str
    source_item_row_count: int
    parts_progress_row_count: int
    purchasing_document_count: int
    material_count: int
    excluded_qty_equal_count: int
    source_item_files: list[str]
    parts_progress_files: list[str]
    downloads: dict[str, str]
    preview: list[str] = Field(default_factory=list)
    material_preview: list[str] = Field(default_factory=list)


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/folders", response_model=FolderInfo)
def get_folders() -> FolderInfo:
    psc_dir = settings.resolved_psc_dir
    sap_dir = settings.resolved_sap_dir
    partviz_dir = settings.resolved_partviz_dir
    order_item_dir = settings.resolved_order_item_dir
    source_item_dir = settings.resolved_source_item_dir
    parts_progress_dir = settings.resolved_parts_progress_dir
    so_exclude_dir = settings.resolved_so_exclude_dir
    ensure_crud_file(so_exclude_dir)

    estimasi_dir = resolve_data_upload_dir("estimasi")
    bo_last_dir = resolve_data_upload_dir("bo-last")
    zmim_cpavail_dir = resolve_data_upload_dir("sap-zmim-cpavail")
    zmmm_stock_info_dir = resolve_data_upload_dir("sap-zmmm-stock-info")
    zmmm_stock_info_hub_dir = resolve_data_upload_dir("sap-zmmm-stock-info-hub")
    zmpu_po_moni_dir = resolve_data_upload_dir("sap-zmpu-po-moni")

    return FolderInfo(
        psc_dir=str(psc_dir),
        sap_dir=str(sap_dir),
        partviz_dir=str(partviz_dir),
        order_item_dir=str(order_item_dir),
        source_item_dir=str(source_item_dir),
        parts_progress_dir=str(parts_progress_dir),
        so_exclude_dir=str(so_exclude_dir),
        estimasi_dir=str(estimasi_dir),
        bo_last_dir=str(bo_last_dir),
        zmim_cpavail_dir=str(zmim_cpavail_dir),
        zmmm_stock_info_dir=str(zmmm_stock_info_dir),
        zmmm_stock_info_hub_dir=str(zmmm_stock_info_hub_dir),
        zmpu_po_moni_dir=str(zmpu_po_moni_dir),
        psc_files=[p.name for p in list_excel_files(psc_dir)],
        sap_files=[p.name for p in list_excel_files(sap_dir)],
        partviz_files=[p.name for p in list_excel_files(partviz_dir)],
        order_item_files=[p.name for p in list_excel_files(order_item_dir)],
        source_item_files=[p.name for p in list_excel_files(source_item_dir)],
        parts_progress_files=[
            p.name for p in list_excel_files(parts_progress_dir)
        ],
        so_exclude_files=[p.name for p in list_excel_files(so_exclude_dir)],
        estimasi_files=[p.name for p in list_excel_files(estimasi_dir)],
        bo_last_files=[p.name for p in list_excel_files(bo_last_dir)],
        zmim_cpavail_files=[p.name for p in list_excel_files(zmim_cpavail_dir)],
        zmmm_stock_info_files=[
            p.name for p in list_excel_files(zmmm_stock_info_dir)
        ],
        zmmm_stock_info_hub_files=[
            p.name for p in list_excel_files(zmmm_stock_info_hub_dir)
        ],
        zmpu_po_moni_files=[p.name for p in list_excel_files(zmpu_po_moni_dir)],
        data_upload_datasets=list_data_upload_datasets(),
        default_sales_office=settings.default_sales_office,
        default_plant=settings.default_plant,
        default_exclude_part_numbers=settings.default_exclude_part_numbers,
    )


@router.post("/data-upload/{dataset_key}", response_model=DataUploadResponse)
async def upload_data_files(
    dataset_key: str,
    files: list[UploadFile] | None = File(default=None),
) -> DataUploadResponse:
    if dataset_key not in DATA_UPLOAD_DATASETS:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset tidak dikenal: {dataset_key}",
        )
    if not files:
        raise HTTPException(
            status_code=400,
            detail="Minimal satu file Excel (.xlsx / .xls) wajib diunggah.",
        )

    max_bytes = settings.max_upload_mb * 1024 * 1024
    payloads: list[tuple[str, bytes]] = []
    for upload in files:
        _validate_upload(upload)
        content = await upload.read()
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"File terlalu besar (max {settings.max_upload_mb} MB): "
                    f"{upload.filename}"
                ),
            )
        filename = upload.filename or "upload.xlsx"
        # Validate readable Excel before replacing folder contents
        try:
            read_excel_source(content, filename=filename)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=400,
                detail=f"Gagal membaca Excel {filename}: {exc}",
            ) from exc
        payloads.append((filename, content))

    folder = resolve_data_upload_dir(dataset_key)
    try:
        saved, backup_dir = replace_folder_uploads(folder, payloads)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Gagal menyimpan upload: {exc}",
        ) from exc

    current_files = [p.name for p in list_excel_files(folder)]
    return DataUploadResponse(
        dataset=dataset_key,
        label=DATA_UPLOAD_LABELS[dataset_key],
        folder=str(folder),
        saved_files=[p.name for p in saved],
        backup_dir=str(backup_dir) if backup_dir else None,
        file_count=len(saved),
        files=current_files,
    )


@router.get("/so-exclude", response_model=list[SoExcludeRow])
def get_so_exclude() -> list[SoExcludeRow]:
    rows = list_so_exclude_rows(settings.resolved_so_exclude_dir)
    return [SoExcludeRow(**row) for row in rows]


@router.post("/so-exclude", response_model=SoExcludeRow)
def post_so_exclude(payload: SoExcludeCreate) -> SoExcludeRow:
    try:
        row = create_so_exclude(
            settings.resolved_so_exclude_dir,
            so_number=payload.SO_Number,
            po=payload.PO,
            remark=payload.REMARK,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SoExcludeRow(**row)


@router.put("/so-exclude/{so_number}", response_model=SoExcludeRow)
def put_so_exclude(so_number: str, payload: SoExcludeUpdate) -> SoExcludeRow:
    try:
        row = update_so_exclude(
            settings.resolved_so_exclude_dir,
            so_number=so_number,
            po=payload.PO,
            remark=payload.REMARK,
            new_so_number=payload.SO_Number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SoExcludeRow(**row)


@router.delete("/so-exclude/{so_number}")
def remove_so_exclude(so_number: str) -> dict[str, str]:
    try:
        delete_so_exclude(settings.resolved_so_exclude_dir, so_number)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "deleted", "SO_Number": so_number}


def _validate_upload(file: UploadFile) -> None:
    name = file.filename or ""
    suffix = Path(name).suffix.lower()
    if suffix not in {".xlsx", ".xls"}:
        raise HTTPException(status_code=400, detail=f"File tidak didukung: {name}")


async def _read_uploads(
    files: list[UploadFile],
    usecols=None,
    persist_dir: Path | None = None,
) -> list[tuple[str, object]]:
    """
    Read uploaded Excel into dataframes.
    If persist_dir is set: after all files parse OK, move existing Excel in that
    folder to backup/<timestamp>/ then save the new uploads there.
    """
    max_bytes = settings.max_upload_mb * 1024 * 1024
    payloads: list[tuple[str, bytes]] = []
    frames: list[tuple[str, object]] = []

    for upload in files:
        _validate_upload(upload)
        content = await upload.read()
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"File terlalu besar (max {settings.max_upload_mb} MB): {upload.filename}",
            )
        filename = upload.filename or "upload.xlsx"
        try:
            df = read_excel_source(
                content,
                filename=filename,
                usecols=usecols,
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=400,
                detail=f"Gagal membaca Excel {filename}: {exc}",
            ) from exc
        payloads.append((filename, content))
        frames.append((filename, df))

    if persist_dir is not None:
        try:
            saved, _backup = replace_folder_uploads(persist_dir, payloads)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500,
                detail=f"Gagal menyimpan upload ke folder: {exc}",
            ) from exc
        # Prefer saved filenames (may be uniquified)
        frames = [
            (path.name, frame)
            for path, (_, frame) in zip(saved, frames, strict=True)
        ]

    return frames


@router.post("/process", response_model=ProcessResponse)
async def process_report(
    sales_office: Annotated[str, Form()] = settings.default_sales_office,
    plant: Annotated[str, Form()] = settings.default_plant,
    exclude_part_numbers: Annotated[str, Form()] = settings.default_exclude_part_numbers,
    source: Annotated[str, Form()] = "folder",
    psc_files: list[UploadFile] | None = File(default=None),
    sap_files: list[UploadFile] | None = File(default=None),
) -> ProcessResponse:
    sales_office = (sales_office or settings.default_sales_office).strip()
    plant = (plant or settings.default_plant).strip()
    exclude_part_numbers = (exclude_part_numbers or "").strip()
    if not sales_office:
        raise HTTPException(status_code=400, detail="Sales Office wajib diisi.")
    if not plant:
        raise HTTPException(status_code=400, detail="Plant wajib diisi.")

    try:
        if source == "upload":
            if not psc_files or not sap_files:
                raise HTTPException(
                    status_code=400,
                    detail="Upload mode membutuhkan file PSC dan SAP.",
                )
            psc_frames = await _read_uploads(
                psc_files,
                persist_dir=settings.resolved_psc_dir,
            )
            sap_frames = await _read_uploads(
                sap_files,
                persist_dir=settings.resolved_sap_dir,
            )
        else:
            psc_paths = list_excel_files(settings.resolved_psc_dir)
            sap_paths = list_excel_files(settings.resolved_sap_dir)
            if not psc_paths:
                raise HTTPException(status_code=400, detail="Folder data-psc kosong.")
            if not sap_paths:
                raise HTTPException(
                    status_code=400,
                    detail="Folder data-sap-zmmm_open_bo kosong.",
                )
            psc_frames = [(p.name, read_excel_source(p)) for p in psc_paths]
            sap_frames = [(p.name, read_excel_source(p)) for p in sap_paths]

        exclude_sos = load_exclude_so_numbers(settings.resolved_so_exclude_dir)
        result = process_dataframes(
            psc_frames=psc_frames,
            sap_frames=sap_frames,
            sales_office=sales_office,
            plant=plant,
            exclude_part_numbers=exclude_part_numbers,
            exclude_so_numbers=exclude_sos,
            output_dir=settings.resolved_output_dir,
        )
    except HTTPException:
        raise
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Gagal memproses: {exc}") from exc

    JOBS[result.job_id] = result.files
    downloads = {
        key: f"/api/download/{result.job_id}/{key}"
        for key in result.files
    }

    return ProcessResponse(
        job_id=result.job_id,
        sales_office=result.sales_office,
        plant=result.plant,
        exclude_part_numbers=result.exclude_part_numbers,
        excluded_row_count=result.excluded_row_count,
        excluded_so_count=result.excluded_so_count,
        excluded_so_preview=result.excluded_so_preview,
        psc_so_count=result.psc_so_count,
        sap_doc_count=result.sap_doc_count,
        combined_count=result.combined_count,
        matched_count=result.matched_count,
        only_psc_count=result.only_psc_count,
        only_sap_count=result.only_sap_count,
        psc_files=result.psc_files,
        sap_files=result.sap_files,
        downloads=downloads,
        preview=result.preview,
    )


@router.post("/partviz/process", response_model=PartvizProcessResponse)
async def process_partviz(
    source: Annotated[str, Form()] = "folder",
    partviz_files: list[UploadFile] | None = File(default=None),
) -> PartvizProcessResponse:
    try:
        if source == "upload":
            if not partviz_files:
                raise HTTPException(
                    status_code=400,
                    detail="Upload mode membutuhkan minimal satu file PartViz.",
                )
            frames = await _read_uploads(
                partviz_files,
                persist_dir=settings.resolved_partviz_dir,
            )
        else:
            paths = list_excel_files(settings.resolved_partviz_dir)
            if not paths:
                raise HTTPException(
                    status_code=400,
                    detail="Folder data-partviz kosong.",
                )
            frames = [(p.name, read_excel_source(p)) for p in paths]

        result = process_partviz_dataframes(
            frames=frames,
            output_dir=settings.resolved_output_dir,
        )
    except HTTPException:
        raise
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Gagal memproses PartViz: {exc}") from exc

    JOBS[result.job_id] = result.files
    downloads = {
        key: f"/api/download/{result.job_id}/{key}"
        for key in result.files
    }

    return PartvizProcessResponse(
        job_id=result.job_id,
        row_count=result.row_count,
        file_count=result.file_count,
        source_files=result.source_files,
        milestone_order=result.milestone_order,
        milestone_counts=result.milestone_counts,
        unknown_milestone_count=result.unknown_milestone_count,
        downloads=downloads,
        preview=result.preview,
    )


@router.post("/order-item-price/process", response_model=OrderItemPriceProcessResponse)
async def process_order_item_price(
    source: Annotated[str, Form()] = "folder",
    order_item_files: list[UploadFile] | None = File(default=None),
) -> OrderItemPriceProcessResponse:
    try:
        if source == "upload":
            if not order_item_files:
                raise HTTPException(
                    status_code=400,
                    detail="Upload mode membutuhkan minimal satu file Order Item.",
                )
            frames = await _read_uploads(
                order_item_files,
                persist_dir=settings.resolved_order_item_dir,
            )
        else:
            paths = list_excel_files(settings.resolved_order_item_dir)
            if not paths:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Folder data-sap-zvsd_parts_progress-order_item kosong."
                    ),
                )
            frames = [(p.name, read_excel_source(p)) for p in paths]

        result = process_order_item_price_dataframes(
            frames=frames,
            output_dir=settings.resolved_output_dir,
        )
    except HTTPException:
        raise
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Gagal memproses harga Order Item: {exc}",
        ) from exc

    JOBS[result.job_id] = result.files
    downloads = {
        key: f"/api/download/{result.job_id}/{key}"
        for key in result.files
    }
    return OrderItemPriceProcessResponse(
        job_id=result.job_id,
        row_count=result.row_count,
        material_count=result.material_count,
        file_count=result.file_count,
        invalid_row_count=result.invalid_row_count,
        source_files=result.source_files,
        downloads=downloads,
        preview=result.preview,
    )


@router.post(
    "/progress-source/process",
    response_model=ProgressSourceProcessResponse,
)
async def process_progress_source(
    source: Annotated[str, Form()] = "folder",
    source_item_files: list[UploadFile] | None = File(default=None),
    parts_progress_files: list[UploadFile] | None = File(default=None),
) -> ProgressSourceProcessResponse:
    try:
        if source == "upload":
            if not source_item_files or not parts_progress_files:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Upload mode membutuhkan file Source Item dan "
                        "Parts Progress."
                    ),
                )
            source_item_frames = await _read_uploads(
                source_item_files,
                usecols=SOURCE_ITEM_USECOLS,
                persist_dir=settings.resolved_source_item_dir,
            )
            parts_progress_frames = await _read_uploads(
                parts_progress_files,
                usecols=[0],
                persist_dir=settings.resolved_parts_progress_dir,
            )
        else:
            source_item_paths = list_excel_files(
                settings.resolved_source_item_dir
            )
            parts_progress_paths = list_excel_files(
                settings.resolved_parts_progress_dir
            )
            if not source_item_paths:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Folder data-sap-zvsd_parts_progress-source_item "
                        "kosong."
                    ),
                )
            if not parts_progress_paths:
                raise HTTPException(
                    status_code=400,
                    detail="Folder data-sap-zvsd_parts_progress kosong.",
                )
            source_item_frames = [
                (
                    path.name,
                    read_excel_source(
                        path,
                        usecols=SOURCE_ITEM_USECOLS,
                    ),
                )
                for path in source_item_paths
            ]
            parts_progress_frames = [
                (path.name, read_excel_source(path, usecols=[0]))
                for path in parts_progress_paths
            ]

        result = process_progress_source_dataframes(
            source_item_frames=source_item_frames,
            parts_progress_frames=parts_progress_frames,
            output_dir=settings.resolved_output_dir,
        )
    except HTTPException:
        raise
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Gagal memproses Purchasing Document: {exc}",
        ) from exc

    JOBS[result.job_id] = result.files
    downloads = {
        key: f"/api/download/{result.job_id}/{key}"
        for key in result.files
    }
    return ProgressSourceProcessResponse(
        job_id=result.job_id,
        source_item_row_count=result.source_item_row_count,
        parts_progress_row_count=result.parts_progress_row_count,
        purchasing_document_count=result.purchasing_document_count,
        material_count=result.material_count,
        excluded_qty_equal_count=result.excluded_qty_equal_count,
        source_item_files=result.source_item_files,
        parts_progress_files=result.parts_progress_files,
        downloads=downloads,
        preview=result.preview,
        material_preview=result.material_preview,
    )


@router.get("/download/{job_id}/{kind}")
def download_result(job_id: str, kind: str) -> FileResponse:
    job = JOBS.get(job_id)
    if job and kind in job:
        file_path = job[kind]
    else:
        # Fallback: fixed filenames in output/ (overwrite on each process)
        fixed = {
            "psc_so": OUTPUT_PSC_SO,
            "sap_doc": OUTPUT_SAP_DOC,
            "compare": OUTPUT_COMPARE,
            "partviz_merged": OUTPUT_PARTVIZ_MERGED,
            "order_item_price": OUTPUT_ORDER_ITEM_PRICE,
            "purchasing_document": OUTPUT_PURCHASING_DOCUMENT,
        }
        name = fixed.get(kind)
        if not name:
            raise HTTPException(status_code=404, detail="File hasil tidak ditemukan.")
        file_path = settings.resolved_output_dir / name
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File hasil tidak ditemukan.")

    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
