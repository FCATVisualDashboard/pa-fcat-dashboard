import { useEffect, useRef } from "react";
import jfkImg from "../assets/jfk.png";

function CanvasPage() {
  const canvasRef = useRef(null);

  const draw = (canvas, ctx, img) => {
    const GRID_SIZE = 20;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(
      canvas.width / img.width,
      canvas.height / img.height,
    );

    const imgWidth = img.width * scale;
    const imgHeight = img.height * scale;

    const offsetX = (canvas.width - imgWidth) / 2;
    const offsetY = (canvas.height - imgHeight) / 2;

    ctx.drawImage(img, offsetX, offsetY, imgWidth, imgHeight);

    const cellWidth = imgWidth / GRID_SIZE;
    const cellHeight = imgHeight / GRID_SIZE;

    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + i * cellWidth, offsetY);
      ctx.lineTo(offsetX + i * cellWidth, offsetY + imgHeight);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + i * cellHeight);
      ctx.lineTo(offsetX + imgWidth, offsetY + i * cellHeight);
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

    const handleResize = () => {
      draw(canvas, ctx, img);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}

export default CanvasPage;
