export type FolderInfo = {
  psc_dir: string;
  sap_dir: string;
  partviz_dir: string;
  order_item_dir: string;
  source_item_dir: string;
  parts_progress_dir: string;
  so_exclude_dir: string;
  estimasi_dir: string;
  bo_last_dir: string;
  zmim_cpavail_dir: string;
  zmmm_stock_info_dir: string;
  zmmm_stock_info_hub_dir: string;
  zmpu_po_moni_dir: string;
  psc_files: string[];
  sap_files: string[];
  partviz_files: string[];
  order_item_files: string[];
  source_item_files: string[];
  parts_progress_files: string[];
  so_exclude_files: string[];
  estimasi_files: string[];
  bo_last_files: string[];
  zmim_cpavail_files: string[];
  zmmm_stock_info_files: string[];
  zmmm_stock_info_hub_files: string[];
  zmpu_po_moni_files: string[];
  data_upload_datasets: DataUploadDataset[];
  default_sales_office: string;
  default_plant: string;
  default_exclude_part_numbers: string;
};

export type DataUploadDataset = {
  key: string;
  label: string;
  folder: string;
  path: string;
};

export type DataUploadResponse = {
  dataset: string;
  label: string;
  folder: string;
  saved_files: string[];
  backup_dir: string | null;
  file_count: number;
  files: string[];
};

export type ProcessResponse = {
  job_id: string;
  sales_office: string;
  plant: string;
  exclude_part_numbers: string;
  excluded_row_count: number;
  excluded_so_count: number;
  excluded_so_preview: string[];
  psc_so_count: number;
  sap_doc_count: number;
  combined_count: number;
  matched_count: number;
  only_psc_count: number;
  only_sap_count: number;
  psc_files: string[];
  sap_files: string[];
  downloads: Record<string, string>;
  preview: Record<string, string[]>;
};

export type SoExcludeRow = {
  SO_Number: string;
  PO: string;
  REMARK: string;
};

export type SoExcludePayload = {
  SO_Number: string;
  PO?: string;
  REMARK?: string;
};

export type PartvizProcessResponse = {
  job_id: string;
  row_count: number;
  file_count: number;
  source_files: string[];
  milestone_order: string[];
  milestone_counts: Record<string, number>;
  unknown_milestone_count: number;
  downloads: Record<string, string>;
  preview: string[];
};

export type OrderItemPriceProcessResponse = {
  job_id: string;
  row_count: number;
  material_count: number;
  file_count: number;
  invalid_row_count: number;
  source_files: string[];
  downloads: Record<string, string>;
  preview: Record<string, string>[];
};

export type ProgressSourceProcessResponse = {
  job_id: string;
  source_item_row_count: number;
  parts_progress_row_count: number;
  purchasing_document_count: number;
  material_count: number;
  source_item_files: string[];
  parts_progress_files: string[];
  downloads: Record<string, string>;
  preview: string[];
  material_preview: string[];
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) {
      return data.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join(", ");
    }
    return JSON.stringify(data);
  } catch {
    return res.statusText || "Request failed";
  }
}

export async function fetchFolders(): Promise<FolderInfo> {
  const res = await fetch(`${API_BASE}/api/folders`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function uploadDataFiles(
  datasetKey: string,
  files: FileList | File[],
): Promise<DataUploadResponse> {
  const list = Array.from(files);
  if (!list.length) {
    throw new Error("Minimal satu file Excel wajib diunggah.");
  }
  const form = new FormData();
  list.forEach((file) => form.append("files", file));
  const res = await fetch(
    `${API_BASE}/api/data-upload/${encodeURIComponent(datasetKey)}`,
    { method: "POST", body: form },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchSoExclude(): Promise<SoExcludeRow[]> {
  const res = await fetch(`${API_BASE}/api/so-exclude`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function createSoExclude(
  payload: SoExcludePayload,
): Promise<SoExcludeRow> {
  const res = await fetch(`${API_BASE}/api/so-exclude`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      SO_Number: payload.SO_Number,
      PO: payload.PO ?? "",
      REMARK: payload.REMARK ?? "",
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function updateSoExclude(
  soNumber: string,
  payload: SoExcludePayload,
): Promise<SoExcludeRow> {
  const res = await fetch(
    `${API_BASE}/api/so-exclude/${encodeURIComponent(soNumber)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        SO_Number: payload.SO_Number,
        PO: payload.PO ?? "",
        REMARK: payload.REMARK ?? "",
      }),
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function deleteSoExclude(soNumber: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/so-exclude/${encodeURIComponent(soNumber)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(await parseError(res));
}

export type ProcessPayload = {
  salesOffice: string;
  plant: string;
  excludePartNumbers: string;
  source: "folder" | "upload";
  pscFiles?: FileList | null;
  sapFiles?: FileList | null;
};

export async function processReport(payload: ProcessPayload): Promise<ProcessResponse> {
  const form = new FormData();
  form.append("sales_office", payload.salesOffice);
  form.append("plant", payload.plant);
  form.append("exclude_part_numbers", payload.excludePartNumbers);
  form.append("source", payload.source);

  if (payload.source === "upload") {
    if (!payload.pscFiles?.length || !payload.sapFiles?.length) {
      throw new Error("Upload mode membutuhkan file PSC dan SAP.");
    }
    Array.from(payload.pscFiles).forEach((file) => form.append("psc_files", file));
    Array.from(payload.sapFiles).forEach((file) => form.append("sap_files", file));
  }

  const res = await fetch(`${API_BASE}/api/process`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export type PartvizProcessPayload = {
  source: "folder" | "upload";
  partvizFiles?: FileList | null;
};

export async function processPartviz(
  payload: PartvizProcessPayload,
): Promise<PartvizProcessResponse> {
  const form = new FormData();
  form.append("source", payload.source);

  if (payload.source === "upload") {
    if (!payload.partvizFiles?.length) {
      throw new Error("Upload mode membutuhkan minimal satu file PartViz.");
    }
    Array.from(payload.partvizFiles).forEach((file) =>
      form.append("partviz_files", file),
    );
  }

  const res = await fetch(`${API_BASE}/api/partviz/process`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export type OrderItemPriceProcessPayload = {
  source: "folder" | "upload";
  orderItemFiles?: FileList | null;
};

export async function processOrderItemPrice(
  payload: OrderItemPriceProcessPayload,
): Promise<OrderItemPriceProcessResponse> {
  const form = new FormData();
  form.append("source", payload.source);

  if (payload.source === "upload") {
    if (!payload.orderItemFiles?.length) {
      throw new Error("Upload mode membutuhkan minimal satu file Order Item.");
    }
    Array.from(payload.orderItemFiles).forEach((file) =>
      form.append("order_item_files", file),
    );
  }

  const res = await fetch(`${API_BASE}/api/order-item-price/process`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export type ProgressSourceProcessPayload = {
  source: "folder" | "upload";
  sourceItemFiles?: FileList | null;
  partsProgressFiles?: FileList | null;
};

export async function processProgressSource(
  payload: ProgressSourceProcessPayload,
): Promise<ProgressSourceProcessResponse> {
  const form = new FormData();
  form.append("source", payload.source);

  if (payload.source === "upload") {
    if (
      !payload.sourceItemFiles?.length ||
      !payload.partsProgressFiles?.length
    ) {
      throw new Error(
        "Upload mode membutuhkan file Source Item dan Parts Progress.",
      );
    }
    Array.from(payload.sourceItemFiles).forEach((file) =>
      form.append("source_item_files", file),
    );
    Array.from(payload.partsProgressFiles).forEach((file) =>
      form.append("parts_progress_files", file),
    );
  }

  const res = await fetch(`${API_BASE}/api/progress-source/process`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export function downloadUrl(path: string): string {
  return `${API_BASE}${path}`;
}
