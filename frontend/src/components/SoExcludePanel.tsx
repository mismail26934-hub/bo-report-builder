import { useEffect, useState, type FormEvent } from "react";
import type { SoExcludeRow } from "../api/boReport";
import {
  useCreateSoExclude,
  useDeleteSoExclude,
  useSoExclude,
  useUpdateSoExclude,
} from "../hooks/useBoReport";

export function SoExcludePanel() {
  const soExclude = useSoExclude();
  const createMutation = useCreateSoExclude();
  const updateMutation = useUpdateSoExclude();
  const deleteMutation = useDeleteSoExclude();

  const [open, setOpen] = useState(false);
  const [soNumber, setSoNumber] = useState("");
  const [po, setPo] = useState("");
  const [remark, setRemark] = useState("");
  const [editing, setEditing] = useState<SoExcludeRow | null>(null);

  function resetForm() {
    setSoNumber("");
    setPo("");
    setRemark("");
    setEditing(null);
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  function startEdit(row: SoExcludeRow) {
    setEditing(row);
    setSoNumber(row.SO_Number);
    setPo(row.PO ?? "");
    setRemark(row.REMARK ?? "");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      SO_Number: soNumber.trim(),
      PO: po.trim(),
      REMARK: remark.trim(),
    };
    if (!payload.SO_Number) return;

    if (editing) {
      updateMutation.mutate(
        { soNumber: editing.SO_Number, payload },
        { onSuccess: () => resetForm() },
      );
    } else {
      createMutation.mutate(payload, { onSuccess: () => resetForm() });
    }
  }

  function onDelete(row: SoExcludeRow) {
    if (!window.confirm(`Hapus SO_Number ${row.SO_Number}?`)) return;
    deleteMutation.mutate(row.SO_Number, {
      onSuccess: () => {
        if (editing?.SO_Number === row.SO_Number) resetForm();
      },
    });
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setSoNumber("");
        setPo("");
        setRemark("");
        setEditing(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;
  const mutationError =
    (createMutation.error as Error | null)?.message ||
    (updateMutation.error as Error | null)?.message ||
    (deleteMutation.error as Error | null)?.message;
  const rowCount = soExclude.data?.length ?? 0;

  return (
    <div className="so-exclude">
      <div className="so-exclude-header">
        <div>
          <h3>Exclude SO_Number</h3>
          <p className="muted">
            Master exclude di Excel <code>data-so-exclude</code>
            {rowCount ? ` — ${rowCount} SO` : ""}. Data tetap dipakai saat
            proses filter.
          </p>
        </div>
        <button
          type="button"
          className="toggle"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          Kelola exclude SO
          {rowCount ? ` (${rowCount})` : ""}
        </button>
      </div>

      {open ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeModal}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="so-exclude-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 id="so-exclude-modal-title">Exclude SO_Number</h3>
                <p className="muted">
                  CRUD tersimpan ke <code>data-so-exclude/so_exclude.xlsx</code>
                </p>
              </div>
              <button
                type="button"
                className="toggle"
                onClick={closeModal}
                aria-label="Tutup"
              >
                Tutup
              </button>
            </div>

            <form className="form so-exclude-form" onSubmit={onSubmit}>
              <label>
                SO_Number
                <input
                  value={soNumber}
                  onChange={(e) => setSoNumber(e.target.value)}
                  placeholder="SO number"
                  required
                  autoFocus
                />
              </label>
              <label>
                PO
                <input
                  value={po}
                  onChange={(e) => setPo(e.target.value)}
                  placeholder="PO (opsional)"
                />
              </label>
              <label>
                REMARK
                <input
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Remark (opsional)"
                />
              </label>
              <div className="so-exclude-actions">
                <button type="submit" disabled={busy}>
                  {editing
                    ? updateMutation.isPending
                      ? "Menyimpan…"
                      : "Update"
                    : createMutation.isPending
                      ? "Menambah…"
                      : "Tambah"}
                </button>
                {editing ? (
                  <button
                    type="button"
                    className="toggle"
                    onClick={resetForm}
                    disabled={busy}
                  >
                    Batal
                  </button>
                ) : null}
              </div>
            </form>

            {mutationError ? <p className="error">{mutationError}</p> : null}
            {soExclude.isLoading ? (
              <p className="muted">Memuat daftar exclude…</p>
            ) : null}
            {soExclude.isError ? (
              <p className="error">
                Gagal memuat exclude: {(soExclude.error as Error).message}
              </p>
            ) : null}

            <div className="table-wrap so-exclude-table">
              <table>
                <thead>
                  <tr>
                    <th>SO_Number</th>
                    <th>PO</th>
                    <th>REMARK</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rowCount ? (
                    soExclude.data!.map((row) => (
                      <tr key={row.SO_Number}>
                        <td>{row.SO_Number}</td>
                        <td>{row.PO || "—"}</td>
                        <td>{row.REMARK || "—"}</td>
                        <td className="row-actions">
                          <button
                            type="button"
                            className="toggle"
                            onClick={() => startEdit(row)}
                            disabled={busy}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="danger-btn"
                            onClick={() => onDelete(row)}
                            disabled={busy}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="muted">
                        Belum ada data exclude
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
