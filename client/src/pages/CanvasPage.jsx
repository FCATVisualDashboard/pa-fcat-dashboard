import { useEffect, useRef } from "react";
import jfkImg from "../assets/aerial.jpg";

function CanvasPage() {
  const canvasRef = useRef(null);

  const draw = (canvas, ctx, img) => {
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

    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;

    for (let x = 0; x <= canvas.width; x += CELL_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= canvas.height; y += CELL_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = jfkImg;

    img.onload = () => {
      draw(canvas, ctx, img);
    };

    const handleResize = () => draw(canvas, ctx, img);
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

      {/* Navbar placeholder */}
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

      {/* Canvas container */}
      <div style={{
        flex: 1,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
      }}>
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