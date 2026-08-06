import { useMemo, useState, type FormEvent } from "react";
import type { DataUploadDataset, DataUploadResponse, FolderInfo } from "../api/boReport";
import { useFolders, useUploadDataFiles } from "../hooks/useBoReport";

const FALLBACK_DATASETS: DataUploadDataset[] = [
  { key: "estimasi", label: "Estimasi", folder: "data-estimasi", path: "" },
  { key: "bo-last", label: "BO Last", folder: "data-bo-last", path: "" },
  {
    key: "sap-zmim-cpavail",
    label: "SAP ZMIM CPAvail",
    folder: "data-sap-zmim_cpavail",
    path: "",
  },
  {
    key: "sap-zmmm-stock-info",
    label: "SAP ZMMM Stock Info",
    folder: "data-sap-zmmm_stock_info",
    path: "",
  },
  {
    key: "sap-zmmm-stock-info-hub",
    label: "SAP ZMMM Stock Info Hub",
    folder: "data-sap-zmmm_stock_info-hub",
    path: "",
  },
  {
    key: "sap-zmpu-po-moni",
    label: "SAP ZMPU PO Moni",
    folder: "data-sap-zmpu_po_moni",
    path: "",
  },
];

const FILES_BY_KEY: Record<string, keyof FolderInfo> = {
  estimasi: "estimasi_files",
  "bo-last": "bo_last_files",
  "sap-zmim-cpavail": "zmim_cpavail_files",
  "sap-zmmm-stock-info": "zmmm_stock_info_files",
  "sap-zmmm-stock-info-hub": "zmmm_stock_info_hub_files",
  "sap-zmpu-po-moni": "zmpu_po_moni_files",
};

function DatasetUploadCard({
  dataset,
  currentFiles,
}: {
  dataset: DataUploadDataset;
  currentFiles: string[];
}) {
  const uploadMutation = useUploadDataFiles();
  const [files, setFiles] = useState<FileList | null>(null);
  const [lastResult, setLastResult] = useState<DataUploadResponse | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!files?.length) return;
    const form = e.currentTarget;
    uploadMutation.mutate(
      { datasetKey: dataset.key, files },
      {
        onSuccess: (result) => {
          setLastResult(result);
          setFiles(null);
          form.reset();
        },
      },
    );
  }

  return (
    <section className="panel data-upload-card">
      <h3>{dataset.label}</h3>
      <p className="muted">
        Folder <code>{dataset.folder}</code>. Upload akan memindahkan file lama
        ke <code>backup/</code> lalu menyimpan file baru.
      </p>

      <div className="folder-info">
        <strong>File saat ini</strong>
        <ul>
          {currentFiles.length ? (
            currentFiles.map((name) => <li key={name}>{name}</li>)
          ) : (
            <li className="muted">Kosong</li>
          )}
        </ul>
      </div>

      <form className="form" onSubmit={onSubmit}>
        <label>
          File Excel (.xlsx) — multiple
          <input
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => setFiles(e.target.files)}
            required
          />
        </label>
        <button type="submit" disabled={uploadMutation.isPending || !files?.length}>
          {uploadMutation.isPending ? "Mengunggah…" : "Upload & simpan"}
        </button>
        {uploadMutation.isError ? (
          <p className="error">{(uploadMutation.error as Error).message}</p>
        ) : null}
        {lastResult ? (
          <p className="muted">
            Tersimpan {lastResult.file_count} file
            {lastResult.backup_dir ? " (file lama di-backup)" : ""}.
          </p>
        ) : null}
      </form>
    </section>
  );
}

export function DataUploadSection() {
  const folders = useFolders();
  const datasets = useMemo(() => {
    const fromApi = folders.data?.data_upload_datasets;
    return fromApi?.length ? fromApi : FALLBACK_DATASETS;
  }, [folders.data?.data_upload_datasets]);

  return (
    <section className="feature-block">
      <header className="feature-header">
        <h2>Upload Data Excel</h2>
        <p className="muted">
          Unggah Excel ke folder data tambahan. File lama dipindah ke{" "}
          <code>backup/&lt;timestamp&gt;/</code>, file baru disimpan ke folder
          masing-masing.
        </p>
      </header>

      {folders.isLoading ? (
        <p className="muted">Memuat daftar folder…</p>
      ) : null}
      {folders.isError ? (
        <p className="error">
          Gagal memuat folder: {(folders.error as Error).message}
        </p>
      ) : null}

      <div className="data-upload-grid">
        {datasets.map((dataset) => {
          const filesKey = FILES_BY_KEY[dataset.key];
          const raw = filesKey ? folders.data?.[filesKey] : undefined;
          const currentFiles = Array.isArray(raw) ? (raw as string[]) : [];
          return (
            <DatasetUploadCard
              key={dataset.key}
              dataset={dataset}
              currentFiles={currentFiles}
            />
          );
        })}
      </div>
    </section>
  );
}
