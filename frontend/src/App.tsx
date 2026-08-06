import { useEffect, useState, type FormEvent } from "react";
import { downloadUrl } from "./api/boReport";
import { DataUploadSection } from "./components/DataUploadSection";
import { SoExcludePanel } from "./components/SoExcludePanel";
import {
  useFolders,
  useProcessOrderItemPrice,
  useProcessPartviz,
  useProcessProgressSource,
  useProcessReport,
} from "./hooks/useBoReport";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="preview-block">
      <h3>{title}</h3>
      {items?.length ? (
        <ul>
          {items.map((item) => (
            <li key={`${title}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Tidak ada data</p>
      )}
    </div>
  );
}

function PreviewTable({
  title,
  rows,
}: {
  title: string;
  rows: Record<string, string>[];
}) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return (
    <div className="preview-block">
      <h3>{title}</h3>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`preview-${index}`}>
                  {columns.map((column) => (
                    <td key={column}>{row[column]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Tidak ada data</p>
      )}
    </div>
  );
}

export default function App() {
  const folders = useFolders();
  const processMutation = useProcessReport();
  const partvizMutation = useProcessPartviz();
  const orderItemMutation = useProcessOrderItemPrice();
  const progressSourceMutation = useProcessProgressSource();

  const [salesOffice, setSalesOffice] = useState("0G38");
  const [plant, setPlant] = useState("1G38");
  const [excludePartNumbers, setExcludePartNumbers] = useState("DELIVERY_CHARGE:ZZ");
  const [source, setSource] = useState<"folder" | "upload">("folder");
  const [pscFiles, setPscFiles] = useState<FileList | null>(null);
  const [sapFiles, setSapFiles] = useState<FileList | null>(null);

  const [partvizSource, setPartvizSource] = useState<"folder" | "upload">("folder");
  const [partvizFiles, setPartvizFiles] = useState<FileList | null>(null);
  const [orderItemSource, setOrderItemSource] = useState<"folder" | "upload">(
    "folder",
  );
  const [orderItemFiles, setOrderItemFiles] = useState<FileList | null>(null);
  const [progressSource, setProgressSource] = useState<
    "folder" | "upload"
  >("folder");
  const [sourceItemFiles, setSourceItemFiles] =
    useState<FileList | null>(null);
  const [partsProgressFiles, setPartsProgressFiles] =
    useState<FileList | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (folders.data?.default_sales_office) {
      setSalesOffice(folders.data.default_sales_office);
    }
    if (folders.data?.default_plant) {
      setPlant(folders.data.default_plant);
    }
    if (folders.data?.default_exclude_part_numbers !== undefined) {
      setExcludePartNumbers(folders.data.default_exclude_part_numbers);
    }
  }, [
    folders.data?.default_sales_office,
    folders.data?.default_plant,
    folders.data?.default_exclude_part_numbers,
  ]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    processMutation.mutate({
      salesOffice,
      plant,
      excludePartNumbers,
      source,
      pscFiles,
      sapFiles,
    });
  }

  function onPartvizSubmit(e: FormEvent) {
    e.preventDefault();
    partvizMutation.mutate({
      source: partvizSource,
      partvizFiles,
    });
  }

  function onOrderItemSubmit(e: FormEvent) {
    e.preventDefault();
    orderItemMutation.mutate({
      source: orderItemSource,
      orderItemFiles,
    });
  }

  function onProgressSourceSubmit(e: FormEvent) {
    e.preventDefault();
    progressSourceMutation.mutate({
      source: progressSource,
      sourceItemFiles,
      partsProgressFiles,
    });
  }

  const result = processMutation.data;
  const partvizResult = partvizMutation.data;
  const orderItemResult = orderItemMutation.data;
  const progressSourceResult = progressSourceMutation.data;

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Internal tool</p>
        <h1>BO Report</h1>
        <p className="lede">
          Filter PSC <code>Sales_Office</code> → unique <code>SO_Number</code>.
          Exclude SAP <code>Material No</code> (row-level), filter{" "}
          <code>Plant</code> → unique <code>Sales document</code>. Exclude{" "}
          <code>SO_Number</code> dari Excel <code>data-so-exclude</code>.
          Gabungkan keduanya (remove duplicate), plus bandingkan matched / only
          PSC / only SAP. Juga gabungkan & urutkan Excel PartViz berdasarkan
          milestone. Hitung harga per Material dari SAP ZVSD Parts Progress
          Order Item.
        </p>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>Proses PSC × SAP</h2>
          <form className="form" onSubmit={onSubmit}>
            <label>
              Sales Office (PSC)
              <input
                value={salesOffice}
                onChange={(e) => setSalesOffice(e.target.value)}
                placeholder="0G38"
                required
              />
            </label>

            <label>
              Plant (SAP) — bisa lebih dari satu, pisah koma
              <input
                value={plant}
                onChange={(e) => setPlant(e.target.value)}
                placeholder="1G38,1383"
                required
              />
            </label>

            <label>
              Exclude part number (SAP Material No) — baris material dibuang
              <input
                value={excludePartNumbers}
                onChange={(e) => setExcludePartNumbers(e.target.value)}
                placeholder="DELIVERY_CHARGE:ZZ"
              />
            </label>

            <fieldset>
              <legend>Sumber data</legend>
              <label className="radio">
                <input
                  type="radio"
                  name="source"
                  checked={source === "folder"}
                  onChange={() => setSource("folder")}
                />
                Folder server (`data-psc` & `data-sap-zmmm_open_bo`)
              </label>
              <label className="radio">
                <input
                  type="radio"
                  name="source"
                  checked={source === "upload"}
                  onChange={() => setSource("upload")}
                />
                Upload file Excel
              </label>
            </fieldset>

            {source === "folder" ? (
              <div className="folder-info">
                {folders.isLoading && <p className="muted">Memuat daftar file…</p>}
                {folders.isError && (
                  <p className="error">
                    Gagal memuat folder: {(folders.error as Error).message}
                  </p>
                )}
                {folders.data && (
                  <>
                    <div>
                      <strong>PSC</strong>
                      <ul>
                        {folders.data.psc_files.length ? (
                          folders.data.psc_files.map((f) => <li key={f}>{f}</li>)
                        ) : (
                          <li className="muted">Kosong</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <strong>SAP ZMMM Open BO</strong>
                      <ul>
                        {folders.data.sap_files.length ? (
                          folders.data.sap_files.map((f) => <li key={f}>{f}</li>)
                        ) : (
                          <li className="muted">Kosong</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <strong>SO Exclude (`data-so-exclude`)</strong>
                      <ul>
                        {folders.data.so_exclude_files?.length ? (
                          folders.data.so_exclude_files.map((f) => (
                            <li key={f}>{f}</li>
                          ))
                        ) : (
                          <li className="muted">Kosong</li>
                        )}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="uploads">
                <label>
                  File PSC (.xlsx)
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    multiple
                    onChange={(e) => setPscFiles(e.target.files)}
                    required={source === "upload"}
                  />
                </label>
                <label>
                  File SAP (.xlsx)
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    multiple
                    onChange={(e) => setSapFiles(e.target.files)}
                    required={source === "upload"}
                  />
                </label>
              </div>
            )}

            <button type="submit" disabled={processMutation.isPending}>
              {processMutation.isPending ? "Memproses…" : "Proses filter"}
            </button>

            {processMutation.isError && (
              <p className="error">{(processMutation.error as Error).message}</p>
            )}
          </form>

          <SoExcludePanel />
        </section>

        <section className="panel">
          <h2>Hasil PSC × SAP</h2>
          {!result && !processMutation.isPending && (
            <p className="muted">Belum ada hasil. Jalankan proses untuk melihat ringkasan.</p>
          )}
          {processMutation.isPending && (
            <p className="muted">Membaca Excel dan menghapus duplikat…</p>
          )}
          {result && (
            <>
              <div className="stats">
                <StatCard label={`SO unik (PSC ${result.sales_office})`} value={result.psc_so_count} />
                <StatCard label={`Sales doc unik (SAP Plant ${result.plant})`} value={result.sap_doc_count} />
                <StatCard label="Gabungan unik" value={result.combined_count} />
                <StatCard label="Baris SAP di-exclude" value={result.excluded_row_count} />
                <StatCard label="SO di-exclude" value={result.excluded_so_count} />
                <StatCard label="Matched" value={result.matched_count} />
                <StatCard label="Only PSC" value={result.only_psc_count} />
                <StatCard label="Only SAP" value={result.only_sap_count} />
              </div>
              {result.exclude_part_numbers ? (
                <p className="muted">
                  Exclude Material No: <code>{result.exclude_part_numbers}</code>
                </p>
              ) : null}
              {result.excluded_so_count > 0 ? (
                <p className="muted">
                  Exclude SO_Number:{" "}
                  <code>
                    {(result.excluded_so_preview ?? []).join(", ") ||
                      `${result.excluded_so_count} SO`}
                  </code>
                </p>
              ) : null}

              <div className="downloads">
                <a href={downloadUrl(result.downloads.compare)} download>
                  Download compare (combined + matched / only_psc / only_sap)
                </a>
                <a href={downloadUrl(result.downloads.psc_so)} download>
                  Download PSC SO
                </a>
                <a href={downloadUrl(result.downloads.sap_doc)} download>
                  Download SAP document
                </a>
              </div>

              <button
                type="button"
                className="toggle"
                aria-expanded={showPreview}
                onClick={() => setShowPreview((visible) => !visible)}
              >
                {showPreview ? "Sembunyikan preview" : "Tampilkan preview"}
              </button>

              {showPreview && (
                <div className="preview-grid">
                  <PreviewList title="Preview gabungan unik" items={result.preview.combined ?? []} />
                  <PreviewList title="Preview SO (PSC)" items={result.preview.psc_so ?? []} />
                  <PreviewList title="Preview Sales document" items={result.preview.sap_doc ?? []} />
                  <PreviewList title="Preview matched" items={result.preview.matched ?? []} />
                  <PreviewList title="Preview only PSC" items={result.preview.only_psc ?? []} />
                  <PreviewList title="Preview only SAP" items={result.preview.only_sap ?? []} />
                  <PreviewList
                    title="Preview SO di-exclude"
                    items={result.preview.excluded_so ?? result.excluded_so_preview ?? []}
                  />
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <section className="feature-block">
        <header className="feature-header">
          <h2>PartViz — Gabung & Urut Milestone</h2>
          <p className="muted">
            Gabungkan multiple Excel dari <code>data-partviz</code> (atau upload),
            lalu urutkan baris berdasarkan kolom <code>Milestone</code>.
          </p>
        </header>

        <div className="layout">
          <section className="panel">
            <h2>Proses PartViz</h2>
            <form className="form" onSubmit={onPartvizSubmit}>
              <fieldset>
                <legend>Sumber data</legend>
                <label className="radio">
                  <input
                    type="radio"
                    name="partviz-source"
                    checked={partvizSource === "folder"}
                    onChange={() => setPartvizSource("folder")}
                  />
                  Folder server (`data-partviz`)
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    name="partviz-source"
                    checked={partvizSource === "upload"}
                    onChange={() => setPartvizSource("upload")}
                  />
                  Upload multiple file Excel
                </label>
              </fieldset>

              {partvizSource === "folder" ? (
                <div className="folder-info">
                  {folders.isLoading && <p className="muted">Memuat daftar file…</p>}
                  {folders.data && (
                    <div>
                      <strong>PartViz</strong>
                      <ul>
                        {folders.data.partviz_files?.length ? (
                          folders.data.partviz_files.map((f) => <li key={f}>{f}</li>)
                        ) : (
                          <li className="muted">Kosong</li>
                        )}
                      </ul>
                    </div>
                  )}
                  <ol className="milestone-order">
                    <li>Cancelled</li>
                    <li>Griefed</li>
                    <li>ESD Needed</li>
                    <li>Future Dated</li>
                    <li>ESD Available</li>
                    <li>Sourced</li>
                    <li>Shipped</li>
                  </ol>
                </div>
              ) : (
                <div className="uploads">
                  <label>
                    File PartViz (.xlsx) — multiple
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      multiple
                      onChange={(e) => setPartvizFiles(e.target.files)}
                      required={partvizSource === "upload"}
                    />
                  </label>
                </div>
              )}

              <button type="submit" disabled={partvizMutation.isPending}>
                {partvizMutation.isPending ? "Menggabungkan…" : "Gabung & urutkan"}
              </button>

              {partvizMutation.isError && (
                <p className="error">{(partvizMutation.error as Error).message}</p>
              )}
            </form>
          </section>

          <section className="panel">
            <h2>Hasil PartViz</h2>
            {!partvizResult && !partvizMutation.isPending && (
              <p className="muted">Belum ada hasil. Jalankan proses untuk melihat ringkasan.</p>
            )}
            {partvizMutation.isPending && (
              <p className="muted">Membaca, menggabungkan, dan mengurutkan Excel…</p>
            )}
            {partvizResult && (
              <>
                <div className="stats">
                  <StatCard label="Total baris" value={partvizResult.row_count} />
                  <StatCard label="File sumber" value={partvizResult.file_count} />
                  <StatCard
                    label="Milestone tidak dikenal"
                    value={partvizResult.unknown_milestone_count}
                  />
                </div>

                <div className="stats">
                  {partvizResult.milestone_order.map((name) => (
                    <StatCard
                      key={name}
                      label={name}
                      value={partvizResult.milestone_counts[name] ?? 0}
                    />
                  ))}
                </div>

                <div className="downloads">
                  <a href={downloadUrl(partvizResult.downloads.partviz_merged)} download>
                    Download PartViz merged (urut milestone)
                  </a>
                </div>

                <PreviewList
                  title="Preview milestone (unik & urut)"
                  items={partvizResult.preview ?? []}
                />
              </>
            )}
          </section>
        </div>
      </section>

      <section className="feature-block">
        <header className="feature-header">
          <h2>Order Item — Harga per Material</h2>
          <p className="muted">
            Gabungkan multiple Excel SAP ZVSD Parts Progress Order Item dan
            hitung <code>(Parts Selling Price - ABS(Discount Total)) / Order Quantity</code>.
          </p>
        </header>

        <div className="layout">
          <section className="panel">
            <h2>Proses Order Item</h2>
            <form className="form" onSubmit={onOrderItemSubmit}>
              <fieldset>
                <legend>Sumber data</legend>
                <label className="radio">
                  <input
                    type="radio"
                    name="order-item-source"
                    checked={orderItemSource === "folder"}
                    onChange={() => setOrderItemSource("folder")}
                  />
                  Folder server (`data-sap-zvsd_parts_progress-order_item`)
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    name="order-item-source"
                    checked={orderItemSource === "upload"}
                    onChange={() => setOrderItemSource("upload")}
                  />
                  Upload multiple file Excel
                </label>
              </fieldset>

              {orderItemSource === "folder" ? (
                <div className="folder-info">
                  {folders.isLoading && (
                    <p className="muted">Memuat daftar file…</p>
                  )}
                  {folders.data && (
                    <div>
                      <strong>SAP ZVSD Parts Progress — Order Item</strong>
                      <ul>
                        {folders.data.order_item_files?.length ? (
                          folders.data.order_item_files.map((file) => (
                            <li key={file}>{file}</li>
                          ))
                        ) : (
                          <li className="muted">Kosong</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="uploads">
                  <label>
                    File Order Item (.xlsx) — multiple
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      multiple
                      onChange={(e) => setOrderItemFiles(e.target.files)}
                      required={orderItemSource === "upload"}
                    />
                  </label>
                </div>
              )}

              <button type="submit" disabled={orderItemMutation.isPending}>
                {orderItemMutation.isPending
                  ? "Menghitung…"
                  : "Gabung & hitung harga"}
              </button>
              {orderItemMutation.isError && (
                <p className="error">
                  {(orderItemMutation.error as Error).message}
                </p>
              )}
            </form>
          </section>

          <section className="panel">
            <h2>Hasil Harga per Material</h2>
            {!orderItemResult && !orderItemMutation.isPending && (
              <p className="muted">
                Belum ada hasil. Jalankan proses untuk melihat ringkasan.
              </p>
            )}
            {orderItemMutation.isPending && (
              <p className="muted">
                Membaca, menggabungkan, dan menghitung harga…
              </p>
            )}
            {orderItemResult && (
              <>
                <div className="stats">
                  <StatCard label="Total baris" value={orderItemResult.row_count} />
                  <StatCard
                    label="Material unik"
                    value={orderItemResult.material_count}
                  />
                  <StatCard label="File sumber" value={orderItemResult.file_count} />
                  <StatCard
                    label="Baris tidak valid"
                    value={orderItemResult.invalid_row_count}
                  />
                </div>
                <div className="downloads">
                  <a
                    href={downloadUrl(
                      orderItemResult.downloads.order_item_price,
                    )}
                    download
                  >
                    Download harga per Material
                  </a>
                </div>
                <PreviewTable
                  title="Preview harga per Material (15 baris pertama)"
                  rows={orderItemResult.preview ?? []}
                />
              </>
            )}
          </section>
        </div>
      </section>

      <section className="feature-block">
        <header className="feature-header">
          <h2>Parts Progress — Purchasing Document</h2>
          <p className="muted">
            Gabungkan multiple Excel Source Item dan Parts Progress, exclude
            baris Source Item dengan <code>Order Quantity = OD Quantity</code>,
            lalu ambil unique <code>Purchasing Document</code> dari Source Item.
          </p>
        </header>

        <div className="layout">
          <section className="panel">
            <h2>Proses Source Item × Parts Progress</h2>
            <form className="form" onSubmit={onProgressSourceSubmit}>
              <fieldset>
                <legend>Sumber data</legend>
                <label className="radio">
                  <input
                    type="radio"
                    name="progress-source"
                    checked={progressSource === "folder"}
                    onChange={() => setProgressSource("folder")}
                  />
                  Folder server
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    name="progress-source"
                    checked={progressSource === "upload"}
                    onChange={() => setProgressSource("upload")}
                  />
                  Upload multiple file Excel
                </label>
              </fieldset>

              {progressSource === "folder" ? (
                <div className="folder-info">
                  {folders.isLoading && (
                    <p className="muted">Memuat daftar file…</p>
                  )}
                  {folders.data && (
                    <>
                      <div>
                        <strong>Source Item</strong>
                        <ul>
                          {folders.data.source_item_files?.length ? (
                            folders.data.source_item_files.map((file) => (
                              <li key={file}>{file}</li>
                            ))
                          ) : (
                            <li className="muted">Kosong</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <strong>Parts Progress</strong>
                        <ul>
                          {folders.data.parts_progress_files?.length ? (
                            folders.data.parts_progress_files.map((file) => (
                              <li key={file}>{file}</li>
                            ))
                          ) : (
                            <li className="muted">Kosong</li>
                          )}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="uploads">
                  <label>
                    File Source Item (.xlsx) — multiple
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      multiple
                      onChange={(e) => setSourceItemFiles(e.target.files)}
                      required={progressSource === "upload"}
                    />
                  </label>
                  <label>
                    File Parts Progress (.xlsx) — multiple
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      multiple
                      onChange={(e) => setPartsProgressFiles(e.target.files)}
                      required={progressSource === "upload"}
                    />
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={progressSourceMutation.isPending}
              >
                {progressSourceMutation.isPending
                  ? "Memproses…"
                  : "Ambil Purchasing Document unik"}
              </button>
              {progressSourceMutation.isError && (
                <p className="error">
                  {(progressSourceMutation.error as Error).message}
                </p>
              )}
            </form>
          </section>

          <section className="panel">
            <h2>Hasil Purchasing Document</h2>
            {!progressSourceResult &&
              !progressSourceMutation.isPending && (
                <p className="muted">
                  Belum ada hasil. Jalankan proses untuk melihat ringkasan.
                </p>
              )}
            {progressSourceMutation.isPending && (
              <p className="muted">
                Membaca Excel dan menghapus duplikat…
              </p>
            )}
            {progressSourceResult && (
              <>
                <div className="stats">
                  <StatCard
                    label="Baris Source Item"
                    value={progressSourceResult.source_item_row_count}
                  />
                  <StatCard
                    label="Baris Parts Progress"
                    value={progressSourceResult.parts_progress_row_count}
                  />
                  <StatCard
                    label="Exclude Qty = OD Qty"
                    value={progressSourceResult.excluded_qty_equal_count}
                  />
                  <StatCard
                    label="Purchasing Document unik"
                    value={progressSourceResult.purchasing_document_count}
                  />
                  <StatCard
                    label="Material unik (rejection blank)"
                    value={progressSourceResult.material_count}
                  />
                </div>
                <p className="muted">
                  Baris Source Item dengan <code>Order Quantity = OD Quantity</code>{" "}
                  dibuang sebelum ambil unique.
                </p>
                <div className="downloads">
                  <a
                    href={downloadUrl(
                      progressSourceResult.downloads.purchasing_document,
                    )}
                    download
                  >
                    Download Purchasing Document & Material unik
                  </a>
                </div>
                <div className="preview-grid">
                  <PreviewList
                    title="Preview Purchasing Document unik"
                    items={progressSourceResult.preview ?? []}
                  />
                  <PreviewList
                    title="Preview Material unik (rejection blank)"
                    items={progressSourceResult.material_preview ?? []}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </section>

      <DataUploadSection />
    </div>
  );
}
