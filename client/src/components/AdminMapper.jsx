import { useRef, useEffect, useState } from 'react';
import jfkImg from "../assets/jfk.png";

export default function AdminMapper() {
    const canvasRef = useRef(null);

    const [paintedCells, setPaintedCells] = useState(new Set());
    const [isPainting, setIsPainting] = useState(false);

    const CELL_SIZE = 20;
    const COLS = 192;
    const ROWS = 108;
    const CANVAS_WIDTH = CELL_SIZE * COLS;
    const CANVAS_HEIGHT = CELL_SIZE * ROWS;

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return; // Safety check
        const ctx = canvas.getContext('2d');

        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;

        ctx.fillStyle = "#1e1e1e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const img = new Image();
        img.src = jfkImg;

        img.onload = () => {
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const imgWidth = img.width * scale;
            const imgHeight = img.height * scale;
            const offsetX = (canvas.width - imgWidth) / 2;
            const offsetY = (canvas.height - imgHeight) / 2;

            ctx.drawImage(img, offsetX, offsetY, imgWidth, imgHeight);

            // draw the painted cells over the map!
            ctx.fillStyle = "rgba(255, 69, 58, 0.7)"; // Translucent Red
            paintedCells.forEach(cellKey => {
                // cellKey looks like "12,5" (x, y). split it back into numbers.
                const [gridX, gridY] = cellKey.split(',').map(Number);
                // draw a 20x20 square exactly at that coordinate
                ctx.fillRect(gridX * CELL_SIZE, gridY * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            });

            // draw the grid overlay
            ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"; 
            ctx.lineWidth = 1;
            for (let x = 0; x <= canvas.width; x += CELL_SIZE) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            }
            for (let y = 0; y <= canvas.height; y += CELL_SIZE) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            }
        };
    };

    // run the draw function once on load, AND anytime 'paintedCells' changes
    useEffect(() => {
        draw();
    }, [paintedCells]);

    const handlePaint = (e) => {
        if (!isPainting) return; // only draw if the mouse button is held down

        const canvas = canvasRef.current;
        // getBoundingClientRect tells how big the canvas is on your specific laptop screen
        const rect = canvas.getBoundingClientRect(); 

        // calculate the difference between your laptop screen size and the 4K internal size
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // apply that scale to the exact pixel clicked
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // snap that raw pixel down to the nearest 20px grid bucket
        const gridX = Math.floor(x / CELL_SIZE);
        const gridY = Math.floor(y / CELL_SIZE);
        const cellKey = `${gridX},${gridY}`;

        // if square isn't already painted, add it to state
        if (!paintedCells.has(cellKey)) {
            setPaintedCells(prev => new Set(prev).add(cellKey));
        }
    };

    return (
        <div style={{ padding: "20px", backgroundColor: "#121212", color: "white", minHeight: "100vh" }}>
            <h2>Admin Mapper</h2>
            <p>Cells Painted: {paintedCells.size}</p> {/* track progress */}
            
            <canvas
                ref={canvasRef}
                style={{
                    border: "2px solid #ff453a",
                    width: "100%",
                    maxWidth: "1000px",
                    cursor: "crosshair"
                }}
                //event listeners
                onMouseDown={(e) => { setIsPainting(true); handlePaint(e); }}
                onMouseMove={handlePaint}
                onMouseUp={() => setIsPainting(false)}
                onMouseLeave={() => setIsPainting(false)} // stop painting if the mouse leaves the box
            />
        </div>
    );
}