import { downloadUrl } from "../api/boReport";
import { useProcessBoGuide } from "../hooks/useBoReport";

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
                <tr key={`bo-guide-preview-${index}`}>
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

export function BoGuideSection() {
  const mutation = useProcessBoGuide();
  const result = mutation.data;

  return (
    <section className="feature-block">
      <header className="feature-header">
        <h2>Generate BO Report (Guide)</h2>
        <p className="muted">
          Isi sheet <code>Data Template</code> dari{" "}
          <code>guide-bo-report/Guide BO Report.xlsx</code> mengikuti mapping
          sheet <code>Guide</code>. Base data dari{" "}
          <code>data-sap-zvsd_parts_progress-source_item</code> dengan exclude{" "}
          <code>Order Quantity = OD Quantity</code> dan{" "}
          <code>DELIVERY_CHARGE:ZZ</code>, Reason for rejection blank, exclude
          Order Qty = Total OD Qty, isi Action, convert number. Tanggal
          diformat <code>dd-mmm-yyyy</code>.
        </p>
      </header>

      <div className="layout">
        <section className="panel">
          <h2>Proses Generate</h2>
          <p className="muted">
            Pastikan folder data (PO Moni, CPAvail, Stock Info, Estimasi, BO
            Last, Parts Progress) dan output PartViz / Order Item Price sudah
            tersedia.
          </p>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Generating…" : "Generate BO Report"}
          </button>
          {mutation.isError ? (
            <p className="error">{(mutation.error as Error).message}</p>
          ) : null}
        </section>

        <section className="panel">
          <h2>Hasil BO Report</h2>
          {!result && !mutation.isPending ? (
            <p className="muted">
              Belum ada hasil. Jalankan generate untuk mengisi Data Template.
            </p>
          ) : null}
          {mutation.isPending ? (
            <p className="muted">
              Membaca Source Item, filter, dedupe, convert number, lalu VLOOKUP sesuai Guide…
            </p>
          ) : null}
          {result ? (
            <>
              <div className="stats">
                <div className="stat">
                  <div className="stat-value">{result.row_count}</div>
                  <div className="stat-label">Baris Data Template</div>
                </div>
                <div className="stat">
                  <div className="stat-value">
                    {result.excluded_qty_equal_count}
                  </div>
                  <div className="stat-label">Exclude Qty = OD Qty</div>
                </div>
                <div className="stat">
                  <div className="stat-value">
                    {result.excluded_delivery_charge_count}
                  </div>
                  <div className="stat-label">Exclude DELIVERY_CHARGE:ZZ</div>
                </div>
                <div className="stat">
                  <div className="stat-value">
                    {result.excluded_rejection_count}
                  </div>
                  <div className="stat-label">Exclude Reason for rejection</div>
                </div>
                <div className="stat">
                  <div className="stat-value">
                    {result.excluded_exact_duplicate_count}
                  </div>
                  <div className="stat-label">Remove duplicate (7 field)</div>
                </div>
                <div className="stat">
                  <div className="stat-value">
                    {result.excluded_duplicate_count}
                  </div>
                  <div className="stat-label">Exclude Order Qty = Total OD</div>
                </div>
                <div className="stat">
                  <div className="stat-value">
                    {result.source_item_files.length}
                  </div>
                  <div className="stat-label">File Source Item</div>
                </div>
              </div>
              {result.missing_sources.length ? (
                <p className="muted">
                  Sumber kosong/tidak ada:{" "}
                  <code>{result.missing_sources.join(", ")}</code>
                </p>
              ) : null}
              <div className="downloads">
                <a href={downloadUrl(result.downloads.bo_report)} download>
                  Download bo_report.xlsx (Data Template + Guide)
                </a>
              </div>
              <PreviewTable
                title="Preview Data Template (15 baris)"
                rows={result.preview ?? []}
              />
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
