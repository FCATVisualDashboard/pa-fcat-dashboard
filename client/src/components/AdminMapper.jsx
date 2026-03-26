import { useRef, useEffect, useState } from 'react';
import aerialImg from "../assets/aerial.jpg";

export default function AdminMapper() {
    const canvasRef = useRef(null);
    const imageRef = useRef(null);

    const [paintedCells, setPaintedCells] = useState(new Set());
    const [isPainting, setIsPainting] = useState(false);
    const [savedAreas, setSavedAreas] = useState([]);

    const [mode, setMode] = useState("paint"); // Tracks if we are painting or erasing
    const [pmId, setPmId] = useState("");      // Tracks the text in the input box

    const CELL_SIZE = 20;
    const COLS = 192;
    const ROWS = 108;
    const CANVAS_WIDTH = CELL_SIZE * COLS;
    const CANVAS_HEIGHT = CELL_SIZE * ROWS;

    const fetchSavedGrids = async () => {
        try {
            const response = await fetch("http://localhost:5000/api/grid/all");
            if (response.ok) {
                const data = await response.json();
                setSavedAreas(data); // save the database rows to React state
            }
        } catch (error) {
            console.error("Error fetching saved grids:", error);
        }
    };

    useEffect(() => {
        fetchSavedGrids(); // load saved areas from the database when the component mounts
        const img = new Image();
        img.src = aerialImg;

        img.onload = () => {
            imageRef.current = img;
            draw();
        }
    }, []);

    useEffect(() => {
        if (paintedCells.size === 0 && mode === "erase") {
            setMode("paint");
        }
    }, [paintedCells.size, mode]);

    const draw = () => {
        const canvas = canvasRef.current;
        const img = imageRef.current;

        if (!canvas || !img) return; // safety check
        const ctx = canvas.getContext('2d');

        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;

        ctx.fillStyle = "#1e1e1e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);


        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const imgWidth = img.width * scale;
        const imgHeight = img.height * scale;
        const offsetX = (canvas.width - imgWidth) / 2;
        const offsetY = (canvas.height - imgHeight) / 2;

        ctx.drawImage(img, offsetX, offsetY, imgWidth, imgHeight);

        // draw the saved database cells first (in translucent blue)
        ctx.fillStyle = "rgba(10, 132, 255, 0.5)"; 
        savedAreas.forEach(cell => {
            ctx.fillRect(cell.x_pos * CELL_SIZE, cell.y_pos * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        });

        // draw the active painted cells over top (in translucent red)
        ctx.fillStyle = "rgba(255, 69, 58, 0.7)"; 
        paintedCells.forEach(cellKey => {
            const [gridX, gridY] = cellKey.split(',').map(Number);
            ctx.fillRect(gridX * CELL_SIZE, gridY * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        });

        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"; 
        ctx.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += CELL_SIZE) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += CELL_SIZE) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
    };

    // re-draw the canvas if either the painted cells or the saved database cells change

    useEffect(() => {
        draw();
    }, [paintedCells, savedAreas]);

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

    // paint vs erase
    if (mode === "paint") {
         // Add the coordinate to the Set
        if (!paintedCells.has(cellKey)) {
                setPaintedCells(prev => new Set(prev).add(cellKey));
            }
        } else if (mode === "erase") {
            // Remove the coordinate from the Set
            if (paintedCells.has(cellKey)) {
                setPaintedCells(prev => {
                    const nextSet = new Set(prev);
                    nextSet.delete(cellKey);
                    return nextSet;
                });
            }
        }

    };

    const handleClearAll = () => {
        if (window.confirm("Are you sure you want to clear all painted cells?")) {
            setPaintedCells(new Set());
            setMode("paint"); 
        }
    };

    const handleSave = async () => {
        if (!pmId) {
            alert("Please enter a PM ID before saving!");
            return;
        }
        if (paintedCells.size === 0) {
            alert("Please paint some cells on the map before saving!");
            return;
        }

        // convert the React Set into a standard array for the db
        const payload = {
            pm_id: pmId,
            coordinates: Array.from(paintedCells)
        };

        try {
            // send the new data to PostgreSQL
            const response = await fetch("http://localhost:5000/api/grid/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Failed to save to database");

            const data = await response.json();
            alert(`Success: ${data.message} (${paintedCells.size} cells)`);
            
            // refresh the saved data from the database so the red cells turn blue
            fetchSavedGrids();

            setPaintedCells(new Set());
            setPmId("");
            setMode("paint");

        } catch (error) {
            console.error("Error saving area:", error);
            alert("There was an error saving the area. Check your terminal for backend errors.");
        }
    };



    return (
        <div style={{ padding: "20px", backgroundColor: "#121212", color: "white", minHeight: "100vh" }}>
             <div style={{ marginBottom: "15px", display: "flex", gap: "20px", alignItems: "center" }}>
                <div>
                    <label style={{ marginRight: "10px", fontWeight: "bold" }}>PM ID:</label>
                    <input
                        type="text" 
                        value={pmId}
                        onChange={(e) => setPmId(e.target.value)} 
                        placeholder="e.g., 6671234"
                        style={{ padding: "5px", borderRadius: "4px", border: "1px solid #555" }}
                    />
                </div>

                <div>
                    <button 
                        onClick={() => setMode("paint")}
                        style={{ padding: "5px 15px", marginRight: "5px", backgroundColor: mode === "paint" ? "#007AFF" : "#444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                    >
                        Paint Mode
                    </button>
                    {paintedCells.size > 0 && (
                        <>
                            <button 
                                onClick={() => setMode("erase")}
                                style={{ padding: "5px 15px", marginRight: "5px", backgroundColor: mode === "erase" ? "#ff453a" : "#444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                            >
                                Erase Mode
                            </button>
                            <button 
                                onClick={handleClearAll}
                                style={{ padding: "5px 15px", backgroundColor: "#ff9f0a", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                            >
                                Clear All
                            </button>
                        </>
                    )}
                </div>

                <button
                    onClick={handleSave}
                    style={{ padding: "5px 20px", backgroundColor: "#34C759", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", marginLeft: "auto" }}
                >
                    Save Area
                </button>
            </div>

            <canvas
                ref={canvasRef}
                style={{
                    border: "2px solid #ff453a",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    cursor: mode === "paint" ? "crosshair" : "cell",
                    display: "block",
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