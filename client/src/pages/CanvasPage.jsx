import { useEffect, useRef, useState } from "react";
import jfkImg from "../assets/aerial.jpg";
import { STATUS_COLORS } from "../colorMap";

function CanvasPage() {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [dashboardData, setDashboardData] = useState({ cells: [], centers: [] });

  useEffect(() => {
    fetch("http://localhost:5001/api/dashboard")
      .then(res => res.json())
      .then(data => setDashboardData(data))
      .catch(err => console.error("Failed to fetch dashboard data:", err))
  }, []);

  const draw = (canvas, ctx, img, data) => {
    const CELL_SIZE = 20;
    const COLS = 192;
    const ROWS = 108;

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
      const color = STATUS_COLORS[cell.status] || STATUS_COLORS.GRAY;
      ctx.fillStyle = color + "99" // "99" adds ~60% opacity in hex
      ctx.fillRect(cell.x_pos * CELL_SIZE, cell.y_pos * CELL_SIZE, CELL_SIZE, CELL_SIZE)
    })

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

  return (
    <div style={{
      backgroundColor: "#121212",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        height: "60px",
        backgroundColor: "#1a1a1a",
        borderBottom: "1px solid #333",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        flexShrink: 0,
      }}>
        <span style={{ color: "white", fontWeight: "bold", fontSize: "18px" }}>
          JFK FCAT PM Dashboard
        </span>
      </div>

      <div style={{ flex: 1, padding: "20px" }}>
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            aspectRatio: "16 / 9",
            border: "2px solid #ff453a",
          }}
        />
      </div>
    </div>
  );
}

export default CanvasPage;