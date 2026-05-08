import { useState, useRef, useCallback, useEffect } from "react";
import API_BASE_URL from "../config";
import { STATUS_COLORS } from "../colorMap";

const STATUS_LABELS = {
  OVERDUE: "Overdue",
  WASSGN:  "Unapproved",
  APPR:    "Approved",
  CONCL:   "Completed",
  INACTIVE:"Inactive",
};

function Badge({ status }) {
  const color = STATUS_COLORS[status] || "#888";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 12,
      fontSize: 12,
      fontWeight: "bold",
      backgroundColor: color + "22",
      color,
      border: `1px solid ${color}`,
    }}>
      {STATUS_LABELS[status] || status || "—"}
    </span>
  );
}

export default function WorkOrderPage() {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState("idle"); // idle | previewing | uploading | done | error
  const [preview, setPreview] = useState(null);   // { count, records }
  const [result, setResult] = useState(null);     // upload result
  const [errorMsg, setErrorMsg] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Fetch existing work orders ──────────────────────────────────────────────
  const fetchWorkOrders = useCallback(() => {
    setLoadingList(true);
    fetch(`${API_BASE_URL}/api/workorders`)
      .then(r => r.json())
      .then(data => { setWorkOrders(Array.isArray(data) ? data : []); setLoadingList(false); })
      .catch(() => setLoadingList(false));
  }, []);

  useEffect(() => { fetchWorkOrders(); }, [fetchWorkOrders]);

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleFile = async (file) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setErrorMsg("Only .xlsx or .xls files are accepted.");
      setStage("error");
      return;
    }
    setPendingFile(file);
    setStage("previewing");
    setErrorMsg("");

    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE_URL}/api/workorders/upload?preview=true`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data.detail ? data.error + " — " + data.detail : data.error) || "Preview failed");
      setPreview(data);
    } catch (err) {
      setErrorMsg(err.message);
      setStage("error");
    }
  };

  // ── Confirm upload ───────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!pendingFile) return;
    setStage("uploading");
    const fd = new FormData();
    fd.append("file", pendingFile);
    try {
      const res = await fetch(`${API_BASE_URL}/api/workorders/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data.detail ? data.error + " — " + data.detail : data.error) || "Upload failed");
      setResult(data);
      setStage("done");
      fetchWorkOrders();
    } catch (err) {
      setErrorMsg(err.message);
      setStage("error");
    }
  };

  const handleReset = () => {
    setStage("idle");
    setPreview(null);
    setResult(null);
    setPendingFile(null);
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Delete single ────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/api/workorders/${encodeURIComponent(id)}`, { method: "DELETE" });
      fetchWorkOrders();
    } catch {}
    setDeleteTarget(null);
  };

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = filterStatus === "ALL"
    ? workOrders
    : workOrders.filter(wo => {
        if (filterStatus === "OVERDUE") return wo.is_overdue;
        return wo.status === filterStatus;
      });

  // ── Styles ────────────────────────────────────────────────────────────────────
  const page = {
    background: "linear-gradient(to top, #0b0b0b, #1a1a1a)",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };
  const card = {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 10,
    padding: "24px",
    marginBottom: 24,
  };
  const th = {
    textAlign: "left",
    padding: "10px 14px",
    fontSize: 12,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    borderBottom: "1px solid #333",
  };
  const td = {
    padding: "10px 14px",
    fontSize: 14,
    borderBottom: "1px solid #222",
    verticalAlign: "middle",
  };

  return (
    <div style={page}>
      {/* Navbar */}
      <div style={{ backgroundColor: "#1a1a1a", borderBottom: "2px solid #eeff00", height: 50, display: "flex", alignItems: "center", padding: "0 24px", gap: 24 }}>
        <a href="/" style={{ color: "#fff", textDecoration: "none", fontWeight: "bold", fontSize: 16 }}>Maximo FCAT PM Dashboard</a>
        <a href="/canvas" style={{ color: "#aaa", textDecoration: "none", fontSize: 14 }}>Map View</a>
        <a href="/admin" style={{ color: "#aaa", textDecoration: "none", fontSize: 14 }}>Admin Mapper</a>
        <span style={{ color: "#eeff00", fontSize: 14, fontWeight: "bold" }}>Work Orders</span>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
        <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 8 }}>Work Order Management</h1>
        <p style={{ color: "#888", marginTop: 0, marginBottom: 28 }}>
          Upload a daily Excel export to sync work orders with the map. Existing records are updated in-place; new ones are inserted.
        </p>

        {/* ── Upload Card ────────────────────────────────────────────────────── */}
        <div style={card}>
          <h2 style={{ fontSize: 16, margin: "0 0 16px 0" }}>📤 Import from Excel</h2>

          {stage === "idle" && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? "#007AFF" : "#444"}`,
                  borderRadius: 8,
                  padding: "48px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  backgroundColor: dragging ? "#007AFF11" : "#111",
                  transition: "0.2s",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 16, fontWeight: "bold", marginBottom: 6 }}>
                  Drag & drop your Excel file here
                </div>
                <div style={{ color: "#666", fontSize: 13 }}>
                  or click to browse — .xlsx and .xls supported
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
              />
              <div style={{ marginTop: 16, padding: "12px 16px", backgroundColor: "#111", borderRadius: 6, fontSize: 13, color: "#666", lineHeight: 1.6 }}>
                <strong style={{ color: "#aaa" }}>Expected columns</strong> (names are matched flexibly):{" "}
                <code style={{ color: "#eeff00" }}>Work Order ID</code>,{" "}
                <code style={{ color: "#eeff00" }}>PM ID</code>,{" "}
                <code style={{ color: "#eeff00" }}>Status</code>,{" "}
                <code style={{ color: "#eeff00" }}>Target Start Date</code>,{" "}
                <code style={{ color: "#eeff00" }}>Frequency</code>,{" "}
                <code style={{ color: "#eeff00" }}>Description</code>
              </div>
            </>
          )}

          {stage === "previewing" && preview && (
            <>
              <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ padding: "6px 14px", backgroundColor: "#007AFF22", border: "1px solid #007AFF", borderRadius: 20, fontSize: 13, color: "#007AFF" }}>
                  {preview.count} rows detected in <strong>{pendingFile?.name}</strong>
                </div>
                {preview.unlinked > 0 && (
                  <div style={{ padding: "6px 14px", backgroundColor: "#FF9F0A22", border: "1px solid #FF9F0A", borderRadius: 20, fontSize: 13, color: "#FF9F0A" }}>
                    ⚠ {preview.unlinked} rows have no matching area (will import as unlinked)
                  </div>
                )}
                <span style={{ color: "#666", fontSize: 13 }}>
                  {preview.count > 50 ? `Showing first 50 rows below.` : ""}
                </span>
              </div>

              <div style={{ overflowX: "auto", borderRadius: 6, border: "1px solid #333", marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: "#111" }}>
                      {["Work Order ID", "PM ID", "Status", "Target Start Date", "Frequency", "Description"].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.records.map((r, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#161616" : "#111" }}>
                        <td style={td}><code style={{ color: "#eeff00" }}>{r.work_order_id}</code></td>
                        <td style={td}>{r.pm_id || <span style={{ color: "#555" }}>—</span>}</td>
                        <td style={td}>{r.status ? <Badge status={r.status} /> : <span style={{ color: "#555" }}>—</span>}</td>
                        <td style={td}>{r.target_start_date ? new Date(r.target_start_date).toLocaleDateString() : <span style={{ color: "#555" }}>—</span>}</td>
                        <td style={td}>{r.frequency || <span style={{ color: "#555" }}>—</span>}</td>
                        <td style={td} style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description || <span style={{ color: "#555" }}>—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={handleConfirm} style={{ padding: "10px 24px", backgroundColor: "#34C759", color: "#fff", border: "none", borderRadius: 6, fontWeight: "bold", cursor: "pointer", fontSize: 14 }}>
                  ✓ Confirm Import ({preview.count} rows)
                </button>
                <button onClick={handleReset} style={{ padding: "10px 18px", backgroundColor: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
                  Cancel
                </button>
              </div>
            </>
          )}

          {stage === "uploading" && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#888" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <div>Importing work orders…</div>
            </div>
          )}

          {stage === "done" && result && (
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: "bold", marginBottom: 4 }}>Import complete</div>
                <div style={{ color: "#888", fontSize: 14 }}>
                  <span style={{ color: "#34C759" }}>{result.inserted} inserted</span>
                  {" · "}
                  <span style={{ color: "#007AFF" }}>{result.updated} updated</span>
                  {" · "}
                  {result.total} total rows processed
                </div>
              </div>
              <button onClick={handleReset} style={{ marginLeft: "auto", padding: "8px 20px", backgroundColor: "#222", color: "#aaa", border: "1px solid #444", borderRadius: 6, cursor: "pointer" }}>
                Upload another file
              </button>
            </div>
          )}

          {stage === "error" && (
            <div style={{ padding: 16, backgroundColor: "#FF3B3022", border: "1px solid #FF3B30", borderRadius: 6 }}>
              <div style={{ color: "#FF3B30", fontWeight: "bold", marginBottom: 6 }}>Upload failed</div>
              <div style={{ color: "#ddd", fontSize: 14 }}>{errorMsg}</div>
              <button onClick={handleReset} style={{ marginTop: 12, padding: "6px 16px", backgroundColor: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: 6, cursor: "pointer" }}>
                Try again
              </button>
            </div>
          )}
        </div>

        {/* ── Work Orders Table ───────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>📋 Current Work Orders ({workOrders.length})</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["ALL", "OVERDUE", "WASSGN", "APPR", "CONCL", "INACTIVE"].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 12,
                    border: `1px solid ${filterStatus === s ? (STATUS_COLORS[s] || "#007AFF") : "#444"}`,
                    backgroundColor: filterStatus === s ? (STATUS_COLORS[s] || "#007AFF") + "22" : "transparent",
                    color: filterStatus === s ? (STATUS_COLORS[s] || "#007AFF") : "#888",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: "bold",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {loadingList ? (
            <div style={{ color: "#555", textAlign: "center", padding: 40 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: "#555", textAlign: "center", padding: 40 }}>
              {workOrders.length === 0
                ? "No work orders yet. Upload an Excel file above to get started."
                : "No work orders match this filter."}
            </div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: 6, border: "1px solid #333" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: "#111" }}>
                    {["Work Order ID", "PM ID", "Status", "Due Date", "Frequency", "Description", ""].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((wo, i) => (
                    <tr key={wo.work_order_id} style={{ backgroundColor: i % 2 === 0 ? "#161616" : "#111" }}>
                      <td style={td}><code style={{ color: "#eeff00" }}>{wo.work_order_id}</code></td>
                      <td style={td}>{wo.pm_id || <span style={{ color: "#555" }}>—</span>}</td>
                      <td style={td}>
                        <Badge status={wo.is_overdue ? "OVERDUE" : wo.status} />
                      </td>
                      <td style={{ ...td, color: wo.is_overdue ? "#FF3B30" : "#fff" }}>
                        {wo.target_start_date
                          ? new Date(wo.target_start_date).toLocaleDateString()
                          : <span style={{ color: "#555" }}>Unscheduled</span>}
                      </td>
                      <td style={td}>{wo.frequency || <span style={{ color: "#555" }}>—</span>}</td>
                      <td style={{ ...td, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {wo.description || <span style={{ color: "#555" }}>—</span>}
                      </td>
                      <td style={td}>
                        {deleteTarget === wo.work_order_id ? (
                          <span style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => handleDelete(wo.work_order_id)} style={{ padding: "3px 10px", backgroundColor: "#FF3B30", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Confirm</button>
                            <button onClick={() => setDeleteTarget(null)} style={{ padding: "3px 8px", backgroundColor: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Cancel</button>
                          </span>
                        ) : (
                          <button onClick={() => setDeleteTarget(wo.work_order_id)} style={{ padding: "3px 10px", backgroundColor: "transparent", color: "#FF3B30", border: "1px solid #FF3B30", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}