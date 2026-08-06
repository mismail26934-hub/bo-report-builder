from __future__ import annotations

from pathlib import Path

from app.config import settings

# key used by API/UI → folder name under project root
DATA_UPLOAD_DATASETS: dict[str, str] = {
    "estimasi": "data-estimasi",
    "bo-last": "data-bo-last",
    "sap-zmim-cpavail": "data-sap-zmim_cpavail",
    "sap-zmmm-stock-info": "data-sap-zmmm_stock_info",
    "sap-zmmm-stock-info-hub": "data-sap-zmmm_stock_info-hub",
    "sap-zmpu-po-moni": "data-sap-zmpu_po_moni",
}

DATA_UPLOAD_LABELS: dict[str, str] = {
    "estimasi": "Estimasi",
    "bo-last": "BO Last",
    "sap-zmim-cpavail": "SAP ZMIM CPAvail",
    "sap-zmmm-stock-info": "SAP ZMMM Stock Info",
    "sap-zmmm-stock-info-hub": "SAP ZMMM Stock Info Hub",
    "sap-zmpu-po-moni": "SAP ZMPU PO Moni",
}


def resolve_data_upload_dir(dataset_key: str) -> Path:
    folder_name = DATA_UPLOAD_DATASETS.get(dataset_key)
    if not folder_name:
        raise KeyError(f"Dataset tidak dikenal: {dataset_key}")
    path = settings.project_root / folder_name
    path.mkdir(parents=True, exist_ok=True)
    return path


def list_data_upload_datasets() -> list[dict[str, str]]:
    return [
        {
            "key": key,
            "label": DATA_UPLOAD_LABELS[key],
            "folder": folder,
            "path": str(resolve_data_upload_dir(key)),
        }
        for key, folder in DATA_UPLOAD_DATASETS.items()
    ]
