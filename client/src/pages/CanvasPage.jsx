import { useEffect, useRef, useState } from "react";
import jfkImg from "../assets/aerial.jpg";
import '../navbar.css';
import API_BASE_URL from "../config";
import { STATUS_COLORS } from "../colorMap";

const STATUS_LABELS = {
  OVERDUE:  "Overdue",
  WASSGN:   "Unapproved",
  APPR:     "Approved",
  CONCL:    "Completed",
  INACTIVE: "Inactive",
};

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || "#888";
  return (
    <span style={{
      display: "inline-block", padding: "5px 14px", borderRadius: 20,
      fontSize: 13, fontWeight: "bold",
      backgroundColor: color + "22", color, border: `1px solid ${color}`,
      letterSpacing: "0.5px",
    }}>
      {STATUS_LABELS[status] || status || "Unknown"}
    </span>
  );
}

function InfoRow({ label, value, valueColor }) {
  return (
    <div>
      <div style={{ color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, color: valueColor || "#fff" }}>{value}</div>
    </div>
  );
}

function CanvasPage() {
  const canvasRef = useRef(null);
  const imgRef    = useRef(null);
  const [dashboardData, setDashboardData] = useState({ cells: [], centers: [], work_orders: [] });
  const [currentTime,   setCurrentTime]   = useState(new Date());
  const [cellMap,       setCellMap]       = useState(new Map());
  const [hoverInfo,     setHoverInfo]     = useState(null);
  const [selectedZone,  setSelectedZone]  = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [workOrderMap,  setWorkOrderMap]  = useState(new Map());
  const [compliance,    setCompliance]    = useState({ total: 0, completed: 0, overdue: 0 });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/dashboard`)
      .then(r => r.json())
      .then(data => {
        setDashboardData(data);

        const map = new Map();
        data.cells?.forEach(cell => map.set(`${cell.x_pos},${cell.y_pos}`, cell));
        setCellMap(map);

        const woMap = new Map();
        data.work_orders?.forEach(wo => {
          const score = wo.is_overdue ? 2 : wo.status !== 'CONCL' ? 1 : 0;
          if (!woMap.has(wo.pm_id) || score > (woMap.get(wo.pm_id)._score || 0))
            woMap.set(wo.pm_id, { ...wo, _score: score });
        });
        setWorkOrderMap(woMap);

        if (data.work_orders?.length) {
          setCompliance({
            total:     data.work_orders.length,
            completed: data.work_orders.filter(w => w.status === 'CONCL').length,
            overdue:   data.work_orders.filter(w => w.is_overdue).length,
          });
        }
      })
      .catch(err => console.error("Dashboard fetch failed:", err));
  }, []);

  const compliancePct = compliance.total
    ? Math.round((compliance.completed / compliance.total) * 100)
    : null;

  const CELL_SIZE = 4, COLS = 854, ROWS = 480;

  const draw = (canvas, ctx, img, data) => {
    if (!data?.cells || !data?.centers) return;
    canvas.width  = COLS * CELL_SIZE;
    canvas.height = ROWS * CELL_SIZE;

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
    ctx.drawImage(img, (canvas.width - img.width*scale)/2, (canvas.height - img.height*scale)/2, img.width*scale, img.height*scale);

    data.cells.forEach(cell => {
      ctx.fillStyle = (STATUS_COLORS[cell.status] || STATUS_COLORS.undefined) + "99";
      ctx.fillRect(cell.x_pos*CELL_SIZE, cell.y_pos*CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });

    if (isSidebarOpen && selectedZone) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      data.cells.forEach(cell => {
        if (cell.pm_id === selectedZone.pm_id)
          ctx.fillRect(cell.x_pos*CELL_SIZE, cell.y_pos*CELL_SIZE, CELL_SIZE, CELL_SIZE);
      });
    }

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width;  x += CELL_SIZE) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y = 0; y <= canvas.height; y += CELL_SIZE) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y);  ctx.stroke(); }

    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    data.centers.forEach(zone => {
      const x = zone.center_x * CELL_SIZE, y = zone.center_y * CELL_SIZE;
      const color = STATUS_COLORS[zone.status] || "#888";
      const tw = ctx.measureText(zone.description).width;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.beginPath(); ctx.roundRect(x - tw/2 - 8, y - 14, tw + 16, 28, 6); ctx.fill();
      ctx.fillStyle = color;
      ctx.fillText(zone.description, x, y);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current, img = imgRef.current;
    if (canvas && img) draw(canvas, canvas.getContext("2d"), img, dashboardData);
  }, [dashboardData, isSidebarOpen, selectedZone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.src = jfkImg;
    img.onload = () => { imgRef.current = img; draw(canvas, ctx, img, dashboardData); };
    const onResize = () => { if (imgRef.current) draw(canvas, ctx, imgRef.current, dashboardData); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const getZoneData = (cellData) => ({ ...(workOrderMap.get(cellData.pm_id) || {}), ...cellData });

  const toGridPos = (e, canvas) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - r.left)  * (canvas.width  / r.width)  / CELL_SIZE),
      y: Math.floor((e.clientY - r.top)   * (canvas.height / r.height) / CELL_SIZE),
    };
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = toGridPos(e, canvas);
    const cell = cellMap.get(`${x},${y}`);
    setHoverInfo(cell ? { x: e.clientX + 16, y: e.clientY + 16, data: getZoneData(cell) } : null);
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = toGridPos(e, canvas);
    const cell = cellMap.get(`${x},${y}`);
    if (cell) { setSelectedZone(getZoneData(cell)); setIsSidebarOpen(true); setHoverInfo(null); }
    else       { setIsSidebarOpen(false); setSelectedZone(null); }
  };

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
<div style={{ background: "linear-gradient(to top, #0b0b0b, #1a1a1a)", width: "100vw", minHeight: "100vh", display: "flex", flexDirection: "column", boxSizing: "border-box", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Navbar */}
      <div style={{ backgroundColor: "#1a1a1a", borderBottom: "2px solid #eeff00", flexShrink: 0, height: 50 }}>
        <nav className="navbar" role="navigation">
          <div className="navbar-left"><a href="/">Maximo FCAT PM Dashboard</a></div>
          <div className="navbar-center">
            <ul>
              <li><a href="/canvas" style={{ color: "#eeff00" }}>Map View</a></li>
              <li><a href="/workorders">Work Orders</a></li>
            </ul>
          </div>
          <div className="navbar-right">
            {compliancePct !== null && (
              <span className="navbar-stat" style={{ marginRight: 20 }}>
                <span className="navbar-stat-label">Compliance:</span>
                <span className="navbar-stat-value" style={{ color: compliancePct >= 80 ? '#34C759' : compliancePct >= 50 ? '#FF9F0A' : '#FF3B30' }}>
                  {compliancePct}%
                </span>
              </span>
            )}
            {compliance.overdue > 0 && (
              <span className="navbar-stat" style={{ marginRight: 20 }}>
                <span className="navbar-stat-label">Overdue:</span>
                <span className="navbar-stat-value" style={{ color: "#FF3B30" }}>{compliance.overdue}</span>
              </span>
            )}
            <span className="navbar-stat">
              <span className="navbar-stat-label">{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="navbar-stat-value">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </span>
          </div>
        </nav>
      </div>

      {/* Main */}
      <div style={{ flex: 1, position: "relative", display: "flex", overflow: "hidden" }}>

        {/* Canvas area */}
        <div style={{ flex: 1, padding: 20 }}>
          <canvas
            ref={canvasRef}
            style={{ display: "block", width: "100%", aspectRatio: "16/9", border: "1px solid #2a2a2a", borderRadius: 8, cursor: hoverInfo ? "zoom-in" : "default" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverInfo(null)}
            onClick={handleCanvasClick}
          />
          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#666" }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: STATUS_COLORS[key] }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 380,
          backgroundColor: "#111", borderLeft: "1px solid #222",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.7)",
          transform: isSidebarOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          zIndex: 100, display: "flex", flexDirection: "column", color: "#fff",
        }}>
          {selectedZone ? (
            <>
              {/* Header */}
              <div style={{ padding: "18px 20px", borderBottom: "1px solid #1e1e1e", backgroundColor: "#1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Zone</div>
                  <div style={{ fontSize: 22, fontWeight: "bold" }}>{selectedZone.description || selectedZone.pm_id}</div>
                  {selectedZone.description && <div style={{ fontSize: 12, color: "#444", marginTop: 3 }}>PM ID: {selectedZone.pm_id}</div>}
                </div>
                <button onClick={() => { setIsSidebarOpen(false); setSelectedZone(null); }}
                  style={{ background: "none", border: "none", color: "#444", fontSize: 26, cursor: "pointer", lineHeight: 1, padding: "0 0 0 12px", marginTop: 2 }}
                  onMouseEnter={e => e.currentTarget.style.color = "#aaa"}
                  onMouseLeave={e => e.currentTarget.style.color = "#444"}
                >&times;</button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                <div style={{ marginBottom: 22 }}>
                  <StatusBadge status={selectedZone.status} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {selectedZone.work_order_id && (
                    <InfoRow label="Work Order ID" value={selectedZone.work_order_id} valueColor="#eeff00" />
                  )}
                  <InfoRow
                    label="Target Start Date"
                    value={fmtDate(selectedZone.target_start_date) || <span style={{ color: "#444" }}>Unscheduled</span>}
                    valueColor={selectedZone.status === 'OVERDUE' ? '#FF3B30' : undefined}
                  />
                  <InfoRow
                    label="Frequency"
                    value={selectedZone.frequency || <span style={{ color: "#444" }}>N/A</span>}
                  />
                </div>

                <div style={{ borderTop: "1px solid #1e1e1e", margin: "22px 0" }} />

                <a href="/workorders" style={{
                  display: "block", textAlign: "center", padding: "10px",
                  backgroundColor: "#007AFF15", color: "#007AFF",
                  border: "1px solid #007AFF44", borderRadius: 6,
                  textDecoration: "none", fontWeight: "bold", fontSize: 14,
                }}>
                  View All Work Orders →
                </a>
              </div>

              {/* Footer — Admin tucked here */}
              <div style={{ padding: "10px 20px", borderTop: "1px solid #1a1a1a", display: "flex", justifyContent: "flex-end" }}>
                <a href="/admin"
                  style={{ color: "#2a2a2a", fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}
                  onMouseEnter={e => e.currentTarget.style.color = "#555"}
                  onMouseLeave={e => e.currentTarget.style.color = "#2a2a2a"}
                >
                  ⚙ Admin Mapper
                </a>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 14 }}>
              Click a zone on the map
            </div>
          )}
        </div>
      </div>

      {/* Hover tooltip */}
      {!isSidebarOpen && hoverInfo?.data && (
        <div style={{
          position: "fixed", left: hoverInfo.x, top: hoverInfo.y,
          backgroundColor: "rgba(12,12,12,0.94)", backdropFilter: "blur(8px)",
          border: `1px solid ${STATUS_COLORS[hoverInfo.data.status] || '#2a2a2a'}`,
          borderRadius: 8, padding: "10px 14px", color: "#fff",
          boxShadow: "0 4px 20px rgba(0,0,0,0.7)", pointerEvents: "none", zIndex: 1000, minWidth: 200,
        }}>
          <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 6, borderBottom: "1px solid #1e1e1e", paddingBottom: 5 }}>
            {hoverInfo.data.description || hoverInfo.data.pm_id}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <span style={{ color: "#555" }}>Status</span>
              <span style={{ fontWeight: "bold", color: STATUS_COLORS[hoverInfo.data.status] || "#fff" }}>
                {STATUS_LABELS[hoverInfo.data.status] || hoverInfo.data.status || "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <span style={{ color: "#555" }}>Due Date</span>
              <span style={{ color: hoverInfo.data.status === 'OVERDUE' ? '#FF3B30' : '#ccc' }}>
                {hoverInfo.data.target_start_date
                  ? new Date(hoverInfo.data.target_start_date).toLocaleDateString()
                  : <span style={{ color: "#333" }}>—</span>}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CanvasPage;