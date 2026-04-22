import { useEffect, useRef, useState } from "react";
import jfkImg from "../assets/aerial.jpg";
import '../navbar.css'
import API_BASE_URL from "../config";
import { STATUS_COLORS } from "../colorMap";

function CanvasPage() {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [dashboardData, setDashboardData] = useState({ cells: [], centers: [] });
  const [currentTime, setCurrentTime] = useState(new Date());

  // state for tooltip hover info
  const [cellMap, setCellMap] = useState(new Map());
  const [hoverInfo, setHoverInfo] = useState(null);

  // state for slide-out sidebar
  const [selectedZone, setSelectedZone] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const lastRefreshed = "Today at 6:00 AM";
  const complianceData = {
    total: 24,
    completed: 18,
    approved: 3,
    unapproved: 2,
    overdue: 1,
  };
  const compliancePct = Math.round((complianceData.completed / complianceData.total) * 100);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/dashboard`)
      .then(res => res.json())
      .then(data => {
        setDashboardData(data);

        const map = new Map();
        if (data.cells) {
          data.cells.forEach(cell => {
            map.set(`${cell.x_pos},${cell.y_pos}`, cell);
          });
        }
        setCellMap(map);
      })

      .catch(err => console.error("Failed to fetch dashboard data:", err))
  }, []);


  const CELL_SIZE = 4;
  const COLS = 854;
  const ROWS = 480;

  const draw = (canvas, ctx, img, data) => {
    if (!data || !data.cells || !data.centers){
      return;
    }

    canvas.width = COLS * CELL_SIZE;
    canvas.height = ROWS * CELL_SIZE;

    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
    const imgWidth = img.width * scale;
    const imgHeight = img.height * scale;
    const offsetX = (canvas.width - imgWidth) / 2;
    const offsetY = (canvas.height - imgHeight) / 2;

    ctx.drawImage(img, offsetX, offsetY, imgWidth, imgHeight);

    // draw colored grid cells per status
    data.cells.forEach(cell => {
      const color = STATUS_COLORS[cell.status] || STATUS_COLORS.undefined;
      ctx.fillStyle = color + "99";
      ctx.fillRect(cell.x_pos * CELL_SIZE, cell.y_pos * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });

    // highlight the actively selected zone in white if the sidebar is open
    if (isSidebarOpen && selectedZone) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)"; // White highlight
      data.cells.forEach(cell => {
        if (cell.pm_id === selectedZone.pm_id) {
          ctx.fillRect(cell.x_pos * CELL_SIZE, cell.y_pos * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      });
    }

    // draw grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += CELL_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += CELL_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // draw labels over each zone center
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    data.centers.forEach(zone => {
      const x = zone.center_x * CELL_SIZE;
      const y = zone.center_y * CELL_SIZE;
      const color = STATUS_COLORS[zone.status] || STATUS_COLORS.GRAY;

      const textWidth = ctx.measureText(zone.description).width;
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.beginPath();
      ctx.roundRect(x - textWidth / 2 - 8, y - 14, textWidth + 16, 28, 6);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.fillText(zone.description, x, y);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    draw(canvas, ctx, img, dashboardData);
  }, [dashboardData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = jfkImg;

    img.onload = () => {
      imgRef.current = img;
      draw(canvas, ctx, img, dashboardData);
    };

    const handleResize = () => {
      if (imgRef.current) draw(canvas, ctx, imgRef.current, dashboardData);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // convert mouse position to internal 4K canvas coordinates
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // snap to the nearest grid cell
    const gridX = Math.floor(x / CELL_SIZE);
    const gridY = Math.floor(y / CELL_SIZE);
    
    // check if we have data for this specific grid coordinate
    const cellData = cellMap.get(`${gridX},${gridY}`);

    if (cellData) {
      // offset the tooltip slightly so it doesn't get covered by the cursor
      setHoverInfo({
        x: e.clientX + 15,
        y: e.clientY + 15,
        data: cellData
      });
    } else {
      // clear the tooltip if hovering over an empty part of the map
      setHoverInfo(null);
    }
  };

  // click handler to open/close sidebar
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const gridX = Math.floor(x / CELL_SIZE);
    const gridY = Math.floor(y / CELL_SIZE);
    
    const cellData = cellMap.get(`${gridX},${gridY}`);

    if (cellData) {
      // if clicked a zone, open the sidebar and clear the hover tooltip
      setSelectedZone(cellData);
      setIsSidebarOpen(true);
      setHoverInfo(null); 
    } else {
      // if clicked empty space, close the sidebar
      setIsSidebarOpen(false);
      setSelectedZone(null);
    }
  };

  return (
    <div style={{
  background: 'linear-gradient(to top, #0b0b0b, #333232)',
  width: '100vw',
  minHeight: '100vh',    
  margin: 0,
  padding: 0,
  display: 'flex',         
  flexDirection: 'column', 
  boxSizing: 'border-box',  
  overflow: 'auto'          
}}>

      <div style={{
  backgroundColor: "#1a1a1a",
  borderBottom: "2px solid #eeff00",
  flexShrink: 0,
  height: "50px",
}}>
  <nav className="navbar" role="navigation">
    <div className="navbar-left">
      <a href="/">JFK FCAT PM Dashboard</a>
    </div>
    <div className="navbar-center">
      <ul>
        <li>
          <span className="navbar-stat">
            <span className="navbar-stat-label">Last Refreshed:</span>
            <span className="navbar-stat-value">{lastRefreshed}</span>
          </span>
        </li>
        <li>
          <span className="navbar-stat">
            <span className="navbar-stat-label">Compliance:</span>
            <span className="navbar-stat-value" style={{ color: compliancePct >= 80 ? '#34C759' : compliancePct >= 50 ? '#FF9F0A' : '#FF3B30' }}>
              {compliancePct}%
            </span>
          </span>
        </li>
        {/* <li>
          <span className="navbar-stat">
            <span className="navbar-stat-label">Overdue:</span>
            <span className="navbar-stat-value" style={{ color: complianceData.overdue > 0 ? '#FF3B30' : '#34C759' }}>
              {complianceData.overdue}
            </span>
          </span>
        </li> */}
      </ul>
    </div>
    <div className="navbar-right">
      <span className="navbar-stat">
        <span className="navbar-stat-label">
          {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        <span className="navbar-stat-value">
          {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </span>
    </div>
  </nav>
</div>
      {/* Main Content Area (Canvas + Sidebar) */}
      <div style={{ flex: 1, position: "relative", display: "flex" }}>
        
        {/* Canvas Container */}
        <div style={{ flex: 1, padding: "20px", transition: "padding-right 0.3s ease" }}>
          <canvas
            ref={canvasRef}
            style={{
              display: "block",
              width: "100%",
              aspectRatio: "16 / 9",
              border: "2px solid #ff453a",
              cursor: hoverInfo ? "pointer" : "crosshair"
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverInfo(null)}
            onClick={handleCanvasClick} 
          />
        </div>

        {/* Slide-Out Sidebar */}
        <div style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "400px",
          backgroundColor: "rgba(20, 20, 20, 0.98)",
          borderLeft: "1px solid #333",
          boxShadow: "-5px 0 25px rgba(0,0,0,0.7)", 
          transform: isSidebarOpen ? "translateX(0)" : "translateX(100%)", 
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          color: "white"
        }}>
          
          {selectedZone && (
            <>
              {/* Sidebar Header */}
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                padding: "20px", 
                borderBottom: "1px solid #333",
                backgroundColor: "#1a1a1a"
              }}>
                <h2 style={{ margin: 0, fontSize: "20px" }}>{selectedZone.pm_id}</h2>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  style={{ 
                    background: "none", border: "none", color: "#888", fontSize: "28px", 
                    cursor: "pointer", padding: "0 5px", lineHeight: "1" 
                  }}
                >
                  &times;
                </button>
              </div>

              {/* Sidebar Scrollable Body */}
              <div style={{ padding: "25px 20px", flex: 1, overflowY: "auto" }}>
                
                {/* Status Badge */}
                <div style={{ marginBottom: "30px" }}>
                  <span style={{ 
                    display: "inline-block",
                    padding: "6px 12px", 
                    borderRadius: "20px", 
                    backgroundColor: (STATUS_COLORS[selectedZone.status] || '#555') + "33", 
                    color: STATUS_COLORS[selectedZone.status] || '#fff',
                    border: `1px solid ${STATUS_COLORS[selectedZone.status] || '#555'}`,
                    fontWeight: "bold",
                    fontSize: "14px"
                  }}>
                    {selectedZone.status || 'STATUS UNKNOWN'}
                  </span>
                </div>

                {/* Detailed Data Rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div>
                    <label style={{ color: "#888", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Description</label>
                    <div style={{ fontSize: "16px", marginTop: "4px" }}>{selectedZone.description || 'No description provided.'}</div>
                  </div>

                  <div>
                    <label style={{ color: "#888", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Target Start Date</label>
                    <div style={{ fontSize: "16px", marginTop: "4px" }}>
                      {selectedZone.target_start_date ? new Date(selectedZone.target_start_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Unscheduled'}
                    </div>
                  </div>

                  <div>
                    <label style={{ color: "#888", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Maintenance Frequency</label>
                    <div style={{ fontSize: "16px", marginTop: "4px" }}>{selectedZone.frequency || 'N/A'}</div>
                  </div>

                  {/* Placeholder for future expansion (e.g. Notes, Action Buttons) */}
                  <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #333" }}>
                    <label style={{ color: "#888", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Actions</label>
                    <button style={{ 
                      width: "100%", marginTop: "10px", padding: "10px", 
                      backgroundColor: "#007AFF", color: "white", border: "none", 
                      borderRadius: "6px", cursor: "pointer", fontWeight: "bold" 
                    }}>
                      Update Work Order
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating Tooltip (Only renders if sidebar is closed) */}
      {!isSidebarOpen && hoverInfo && hoverInfo.data && (
        <div style={{
          position: "fixed",
          left: hoverInfo.x,
          top: hoverInfo.y,
          backgroundColor: "rgba(20, 20, 20, 0.75)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          border: `1px solid ${STATUS_COLORS[hoverInfo.data.status] || '#555'}`,
          borderRadius: "8px",
          padding: "12px 16px",
          color: "#fff",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          pointerEvents: "none",
          zIndex: 1000,
          minWidth: "200px"
        }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", borderBottom: "1px solid #444", paddingBottom: "6px" }}>
            {hoverInfo.data.pm_id}
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#aaa" }}>Status:</span>
              <span style={{ fontWeight: "bold", color: STATUS_COLORS[hoverInfo.data.status] || '#fff' }}>
                {hoverInfo.data.status || 'N/A'}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#aaa" }}>Due Date:</span>
              <span>
                {hoverInfo.data.target_start_date ? new Date(hoverInfo.data.target_start_date).toLocaleDateString() : 'Unscheduled'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CanvasPage;