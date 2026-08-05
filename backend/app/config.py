from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "BO Report API"
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"
    project_root: Path = Path(__file__).resolve().parents[2]
    psc_dir: Path | None = None
    sap_dir: Path | None = None
    partviz_dir: Path | None = None
    order_item_dir: Path | None = None
    source_item_dir: Path | None = None
    parts_progress_dir: Path | None = None
    output_dir: Path | None = None
    default_sales_office: str = "0G38"
    default_plant: str = "1G38"
    default_exclude_part_numbers: str = "DELIVERY_CHARGE:ZZ"
    max_upload_mb: int = 80

    @property
    def resolved_psc_dir(self) -> Path:
        return self.psc_dir or (self.project_root / "data-psc")

    @property
    def resolved_sap_dir(self) -> Path:
        return self.sap_dir or (self.project_root / "data-sap-zmmm_open_bo")

    @property
    def resolved_partviz_dir(self) -> Path:
        return self.partviz_dir or (self.project_root / "data-partviz")

    @property
    def resolved_order_item_dir(self) -> Path:
        return self.order_item_dir or (
            self.project_root / "data-sap-zvsd_parts_progress-order_item"
        )

    @property
    def resolved_source_item_dir(self) -> Path:
        return self.source_item_dir or (
            self.project_root / "data-sap-zvsd_parts_progress-source_item"
        )

    @property
    def resolved_parts_progress_dir(self) -> Path:
        return self.parts_progress_dir or (
            self.project_root / "data-sap-zvsd_parts_progress"
        )

    @property
    def resolved_output_dir(self) -> Path:
        path = self.output_dir or (self.project_root / "output")
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
