import { useEffect, useState, type FormEvent } from "react";
import { downloadUrl } from "./api/boReport";
import { useFolders, useProcessPartviz, useProcessReport } from "./hooks/useBoReport";

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

export default function App() {
  const folders = useFolders();
  const processMutation = useProcessReport();
  const partvizMutation = useProcessPartviz();

  const [salesOffice, setSalesOffice] = useState("0G38");
  const [plant, setPlant] = useState("1G38");
  const [excludePartNumbers, setExcludePartNumbers] = useState("DELIVERY_CHARGE:ZZ");
  const [source, setSource] = useState<"folder" | "upload">("folder");
  const [pscFiles, setPscFiles] = useState<FileList | null>(null);
  const [sapFiles, setSapFiles] = useState<FileList | null>(null);

  const [partvizSource, setPartvizSource] = useState<"folder" | "upload">("folder");
  const [partvizFiles, setPartvizFiles] = useState<FileList | null>(null);

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

  const result = processMutation.data;
  const partvizResult = partvizMutation.data;

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Internal tool</p>
        <h1>BO Report</h1>
        <p className="lede">
          Filter PSC <code>Sales_Office</code> → unique <code>SO_Number</code>.
          Exclude SAP <code>Material No</code> (row-level), filter{" "}
          <code>Plant</code> → unique <code>Sales document</code>. Gabungkan
          keduanya (remove duplicate), plus bandingkan matched / only PSC /
          only SAP. Juga gabungkan & urutkan Excel PartViz berdasarkan milestone.
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
                <StatCard label="Matched" value={result.matched_count} />
                <StatCard label="Only PSC" value={result.only_psc_count} />
                <StatCard label="Only SAP" value={result.only_sap_count} />
              </div>
              {result.exclude_part_numbers ? (
                <p className="muted">
                  Exclude Material No: <code>{result.exclude_part_numbers}</code>
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

              <div className="preview-grid">
                <PreviewList title="Preview gabungan unik" items={result.preview.combined ?? []} />
                <PreviewList title="Preview SO (PSC)" items={result.preview.psc_so ?? []} />
                <PreviewList title="Preview Sales document" items={result.preview.sap_doc ?? []} />
                <PreviewList title="Preview matched" items={result.preview.matched ?? []} />
                <PreviewList title="Preview only PSC" items={result.preview.only_psc ?? []} />
                <PreviewList title="Preview only SAP" items={result.preview.only_sap ?? []} />
              </div>
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

                <div className="preview-block">
                  <h3>Preview (15 baris pertama)</h3>
                  {partvizResult.preview.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            {Object.keys(partvizResult.preview[0]).map((col) => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {partvizResult.preview.map((row, idx) => (
                            <tr key={`pv-${idx}`}>
                              {Object.keys(partvizResult.preview[0]).map((col) => (
                                <td key={col}>{row[col]}</td>
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
              </>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
