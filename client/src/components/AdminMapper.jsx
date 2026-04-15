import { useRef, useEffect, useState } from "react";
import aerialImg from "../assets/aerial.jpg";
import API_BASE_URL from "../config";
import pmOverlayImg from "../assets/Airfield_PM_Areas.png";

export default function AdminMapper() {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const lastDrawRef = useRef(null);

  const [actionView, setActionView] = useState("add"); // "add" or "delete"
  const [editingPmId, setEditingPmId] = useState(null); // tracks what we are editing

  const [paintedCells, setPaintedCells] = useState(new Set());
  const [isPainting, setIsPainting] = useState(false);
  const [savedAreas, setSavedAreas] = useState([]);
  const [description, setDescription] = useState(""); 
  const [mode, setMode] = useState("paint"); // Tracks if we are painting or erasing
  const [pmId, setPmId] = useState(""); // Tracks the text in the input box

  const [deleteInput, setDeleteInput] = useState("");
  const [polygonPath, setPolygonPath] = useState([]);

  // OVERLAY STATE
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.4);
  const [overlayRotation, setOverlayRotation] = useState(0);
  const [overlayOffsetX, setOverlayOffsetX] = useState(0);
  const [overlayOffsetY, setOverlayOffsetY] = useState(0);

  // OVERLAY INTERACTION TRACKING
  const [overlayMode, setOverlayMode] = useState("locked"); // "locked", "move", "rotate"
  const [isRotating, setIsRotating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // REFS FOR SMOOTH MATH
  const overlayRef = useRef(null);
  const overlayStartAngleRef = useRef(0);
  const overlayInitialRotRef = useRef(0);
  const overlayStartDragXRef = useRef(0);
  const overlayStartDragYRef = useRef(0); 
  const overlayInitialOffsetXRef = useRef(0);
  const overlayInitialOffsetYRef = useRef(0);

  const CELL_SIZE = 4;
  const COLS = 854;
  const ROWS = 480;
  const CANVAS_WIDTH = CELL_SIZE * COLS;
  const CANVAS_HEIGHT = CELL_SIZE * ROWS;

  const fetchSavedGrids = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/grid/all`);
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
    };

    const overlay = new Image();
    overlay.src = pmOverlayImg;

    overlay.onload = () => {
      overlayRef.current = overlay;
      draw(); // re-draw in case it loads after the base map
    };
  }, []);

  useEffect(() => {
    if (paintedCells.size === 0 && mode === "erase") {
      setMode("paint");
    }
  }, [paintedCells.size, mode]);

  // if we switch to delete mode, wipe the painted cells so the user can start fresh
  useEffect(() => {
    if (actionView === "delete") {
      setPaintedCells(new Set());
      setMode("paint");
    }
  }, [actionView]);

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;

    if (!canvas || !img) return; // safety check
    const ctx = canvas.getContext("2d");

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.max(
      canvas.width / img.width,
      canvas.height / img.height,
    );
    const imgWidth = img.width * scale;
    const imgHeight = img.height * scale;
    const offsetX = (canvas.width - imgWidth) / 2;
    const offsetY = (canvas.height - imgHeight) / 2;

    ctx.drawImage(img, offsetX, offsetY, imgWidth, imgHeight);

    if (showOverlay && overlayRef.current) {
      ctx.save(); // save the canvas state before opacity and rotation changes
      ctx.globalAlpha = overlayOpacity; // make it translucent

      // find the exact center point to rotate around
      const centerX = offsetX + imgWidth / 2 + overlayOffsetX;
      const centerY = offsetY + imgHeight / 2 + overlayOffsetY;

      // move the canvas origin to the center, and spin it
      ctx.translate(centerX, centerY);
      ctx.rotate((overlayRotation * Math.PI) / 180); // convert degrees to radians

      ctx.drawImage(overlayRef.current, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);

      ctx.restore(); // snap the canvas back to normal so grid stays straight
    }

    // draw the saved database cells first (in translucent blue)
    ctx.fillStyle = "rgba(10, 132, 255, 0.5)";
    savedAreas.forEach((cell) => {
      if (cell.pm_id === editingPmId) return; 
      ctx.fillRect(
        cell.x_pos * CELL_SIZE,
        cell.y_pos * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE,
      );
    });

    // draw the active painted cells over top (in translucent red)
    ctx.fillStyle = "rgba(255, 69, 58, 0.7)";
    paintedCells.forEach((cellKey) => {
      const [gridX, gridY] = cellKey.split(",").map(Number);
      ctx.fillRect(gridX * CELL_SIZE, gridY * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });

    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
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

  // re-draw the canvas if either the painted cells or the saved database cells change

  useEffect(() => {
    draw();
  }, [paintedCells, savedAreas, showOverlay, overlayOpacity, overlayRotation, overlayOffsetX, overlayOffsetY]);

  // helper function to convert raw mouse coordinates into grid coordinates
  const getGridCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    return {
      gridX: Math.floor(x / CELL_SIZE),
      gridY: Math.floor(y / CELL_SIZE)
    };
  };

  // Bresenham's line algorithm to get all cells between two points for smoother drawing
  const getCellsOnLine = (x0, y0, x1, y1) => {
    const cells = [];
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      cells.push(`${x0},${y0}`);
      if (x0 === x1 && y0 === y1) break;
      let e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    return cells;
  };

  const applyPaint = (cellsArray) => {
    setPaintedCells((prev) => {
      const nextSet = new Set(prev);
      cellsArray.forEach(cell => {
        if (mode === "paint") nextSet.add(cell);
        else if (mode === "erase") nextSet.delete(cell);
      });
      return nextSet;
    });
  };

  const startPainting = (e) => {
    setIsPainting(true);
    const { gridX, gridY } = getGridCoordinates(e);
    
    lastDrawRef.current = { x: gridX, y: gridY }; // record starting point
    applyPaint([`${gridX},${gridY}`]);            // paint the first dot
  };

  const drawLine = (e) => {
    if (!isPainting || !lastDrawRef.current) return;
    
    const { gridX, gridY } = getGridCoordinates(e);
    const { x: startX, y: startY } = lastDrawRef.current;
    
    // connect the dots between the last frame and this frame
    const cellsToUpdate = getCellsOnLine(startX, startY, gridX, gridY);
    applyPaint(cellsToUpdate);
    
    // update the memory for the next frame
    lastDrawRef.current = { x: gridX, y: gridY };
  };

  const stopPainting = () => {
    setIsPainting(false);
    lastDrawRef.current = null; // clear the memory so lines don't drag across the screen
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
      description: description,
      coordinates: Array.from(paintedCells),
    };

    try {
    // dynamically choose between saving a new area or updating an old one
    const endpoint = editingPmId 
        ? `${API_BASE_URL}/api/grid/edit/${editingPmId}` 
        : `${API_BASE_URL}/api/grid/save`;
        
      const method = editingPmId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save to database");

      const data = await response.json();
      alert(`Success: ${data.message} (${paintedCells.size} cells)`);

      // refresh the saved data from the database so the red cells turn blue
      fetchSavedGrids();

      setPaintedCells(new Set());
      setPmId("");
      setDescription("");
      setEditingPmId(null);
      setMode("paint");
    } catch (error) {
      console.error("Error saving area:", error);
      alert(
        "There was an error saving the area. Check your terminal for backend errors.",
      );
    }
  };

  const executeDelete = async (targetPmId) => {
    if (!targetPmId) return alert("Please provide a PM ID to delete.");

    if (window.confirm(`Are you absolutely sure you want to permanently delete the area: ${targetPmId}?`)) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/grid/delete/${targetPmId}`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Failed to delete from database");

        alert(`Successfully deleted ${targetPmId}`);
        fetchSavedGrids();
        setDeleteInput("");
      } catch (error) {
        console.error("Error deleting area:", error);
        alert("There was an error deleting the area.");
      }
    }
  };

const handleCanvasMouseDown = (e) => {
    const { gridX, gridY } = getGridCoordinates(e);

    // INTERCEPT: Overlay Movement (Dragging)
    if (showOverlay && overlayMode === "move") {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      setIsDragging(true);
      overlayStartDragXRef.current = (e.clientX - rect.left) * scaleX;
      overlayStartDragYRef.current = (e.clientY - rect.top) * scaleY;
      overlayInitialOffsetXRef.current = overlayOffsetX;
      overlayInitialOffsetYRef.current = overlayOffsetY;
      return; 
    }

    // INTERCEPT: Overlay Rotation
    if (showOverlay && overlayMode === "rotate") {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      // Center of the canvas 
      const centerX = (canvas.width / 2) + overlayOffsetX;
      const centerY = (canvas.height / 2) + overlayOffsetY;

      const angle = Math.atan2(mouseY - centerY, mouseX - centerX);

      setIsRotating(true);
      overlayStartAngleRef.current = angle;
      overlayInitialRotRef.current = overlayRotation;
      return; 
    }

    // if in edit mode and haven't selected an area yet, pick one up
    if (actionView === "edit" && !editingPmId) {
      // find the area they clicked on
      const clickedCell = savedAreas.find(c => c.x_pos === gridX && c.y_pos === gridY);
      
      if (clickedCell) {
        const targetPmId = clickedCell.pm_id;
        const cellsForPm = savedAreas.filter(c => c.pm_id === targetPmId);

        // load its data into the form
        setPmId(targetPmId);
        setDescription(cellsForPm[0].description || "");
        setEditingPmId(targetPmId); // locks into edit mode for this ID

        // convert db coordinates back into red painted ink
        const newPainted = new Set();
        cellsForPm.forEach(c => newPainted.add(`${c.x_pos},${c.y_pos}`));
        setPaintedCells(newPainted);
        setMode("paint");
      }
      return; 
    }

    setIsPainting(true);
    setPolygonPath([{ x: gridX, y: gridY }]); // start a brand new path
    
    applyPaint([`${gridX},${gridY}`]); 
  };

  const handleCanvasMouseMove = (e) => {
    // INTERCEPT: Overlay Movement (Dragging)
    if (isDragging) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      // Calculate how far the mouse has moved since clicking
      const dx = mouseX - overlayStartDragXRef.current;
      const dy = mouseY - overlayStartDragYRef.current;

      setOverlayOffsetX(overlayInitialOffsetXRef.current + dx);
      setOverlayOffsetY(overlayInitialOffsetYRef.current + dy);
      return;
    }

    // INTERCEPT: Overlay Rotation
    if (isRotating) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      const centerX = (canvas.width / 2) + overlayOffsetX;
      const centerY = (canvas.height / 2) + overlayOffsetY;

      const currentAngle = Math.atan2(mouseY - centerY, mouseX - centerX);
      const angleDiff = currentAngle - overlayStartAngleRef.current; 
      const angleDiffDegrees = angleDiff * (180 / Math.PI);
      setOverlayRotation(overlayInitialRotRef.current + angleDiffDegrees);
      return; 
    }

    if (overlayMode !== "locked") return; // Prevent hover painting while adjusting

    if (!isPainting || actionView === "delete") return;

    const { gridX, gridY } = getGridCoordinates(e);
    const lastPoint = polygonPath[polygonPath.length - 1];

    // only update if we moved to a new cell
    if (lastPoint && (lastPoint.x !== gridX || lastPoint.y !== gridY)) {
      setPolygonPath(prev => [...prev, { x: gridX, y: gridY }]); 
      
      const cellsToUpdate = getCellsOnLine(lastPoint.x, lastPoint.y, gridX, gridY);
      applyPaint(cellsToUpdate);
    }
  };

  const handleCanvasMouseUp = () => {
    if (isRotating || isDragging) {
      setIsRotating(false);
      setIsDragging(false);
      return;
    }

    if (overlayMode !== "locked") return;

    if (!isPainting || actionView === "delete") return;
    setIsPainting(false);

    // If shape (more than 2 points) AND are in paint mode, auto-fill it
    if (polygonPath.length > 2 && mode === "paint") {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      // build the invisible boundary path
      const path = new Path2D();
      path.moveTo(polygonPath[0].x * CELL_SIZE, polygonPath[0].y * CELL_SIZE);
      for (let i = 1; i < polygonPath.length; i++) {
        path.lineTo(polygonPath[i].x * CELL_SIZE, polygonPath[i].y * CELL_SIZE);
      }
      path.closePath(); 

      // find the bounding box
      const minX = Math.min(...polygonPath.map(p => p.x));
      const maxX = Math.max(...polygonPath.map(p => p.x));
      const minY = Math.min(...polygonPath.map(p => p.y));
      const maxY = Math.max(...polygonPath.map(p => p.y));

      const filledCells = []; // collect all the inside cells

      // scan every cell inside the bounding box
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const testX = (x * CELL_SIZE) + (CELL_SIZE / 2);
          const testY = (y * CELL_SIZE) + (CELL_SIZE / 2);

          if (ctx.isPointInPath(path, testX, testY)) {
            filledCells.push(`${x},${y}`);
          }
        }
      }

      // send the array of filled cells to your applyPaint
      applyPaint(filledCells);
    }

    setPolygonPath([]); // reset the tracker for the next drawing
  };

  return (
    <div style={{ padding: "20px", backgroundColor: "#121212", color: "white", minHeight: "100vh" }}>

      <div style={{
        display: "flex", 
        alignItems: "center", 
        gap: "20px", 
        marginBottom: "15px", 
        backgroundColor: "#1a1a1a", 
        padding: "12px 20px", 
        borderRadius: "8px", 
        border: "1px solid #333",
        boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
      }}>
        
        {/* Segmented Control Switcher */}
        <div style={{ display: "flex", backgroundColor: "#000", padding: "4px", borderRadius: "6px" }}>
          <button 
            onClick={() => setActionView("add")}
            style={{ padding: "6px 16px", backgroundColor: actionView === "add" ? "#333" : "transparent", color: actionView === "add" ? "white" : "#888", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", transition: "0.2s" }}
          >
            Add Area
          </button>
          <button 
            onClick={() => { setActionView("edit"); setPaintedCells(new Set()); }}
            style={{ padding: "6px 16px", backgroundColor: actionView === "edit" ? "#007AFF" : "transparent", color: actionView === "edit" ? "white" : "#888", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", transition: "0.2s" }}
          >
            Edit Area
          </button>
          <button 
            onClick={() => setActionView("delete")}
            style={{ padding: "6px 16px", backgroundColor: actionView === "delete" ? "#ff453a" : "transparent", color: actionView === "delete" ? "white" : "#888", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", transition: "0.2s" }}
          >
            Delete Area
          </button>
        </div>

        {/* Vertical Divider */}
        <div style={{ width: "1px", height: "30px", backgroundColor: "#444" }}></div>

        {/* Contextual Controls (Swaps based on the switch) */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: "15px" }}>
          {actionView === "add" || "edit" ? (
            <>
              {/* Add Area Controls */}
              <input type="text" value={pmId} onChange={(e) => setPmId(e.target.value)} placeholder="PM ID (e.g. 6671234)" style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid #555", backgroundColor: "#222", color: "white", width: "150px" }} />
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Location Name" style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid #555", backgroundColor: "#222", color: "white", width: "200px" }} />
              
              <div style={{ display: "flex", gap: "5px", marginLeft: "10px" }}>
                <button onClick={() => setMode("paint")} style={{ padding: "6px 15px", backgroundColor: mode === "paint" ? "#007AFF" : "#333", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>Paint</button>
                {paintedCells.size > 0 && (
                  <>
                    <button onClick={() => setMode("erase")} style={{ padding: "6px 15px", backgroundColor: mode === "erase" ? "#ff453a" : "#333", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>Erase</button>
                    <button onClick={handleClearAll} style={{ padding: "6px 15px", backgroundColor: "transparent", color: "#ff9f0a", border: "1px solid #ff9f0a", borderRadius: "4px", cursor: "pointer" }}>Clear All</button>
                  </>
                )}
              </div>

              <button onClick={handleSave} style={{ padding: "8px 20px", backgroundColor: "#34C759", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", marginLeft: "auto" }}>
                Save Area
              </button>
            </>
          ) : (
            <>
              {/* Delete Area Controls */}
              <span style={{ color: "#aaa", fontStyle: "italic" }}>
                Click a blue area on the map to delete it, or:
              </span>
              <input 
                type="text" 
                value={deleteInput} 
                onChange={(e) => setDeleteInput(e.target.value)} 
                placeholder="Enter PM ID" 
                style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid #555", backgroundColor: "#222", color: "white", marginLeft: "auto" }} 
              />
              <button 
                onClick={() => executeDelete(deleteInput)} 
                style={{ padding: "6px 15px", backgroundColor: "#ff453a", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
              >
                Delete
              </button>
            </>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <label style={{ 
            display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", 
            fontWeight: "bold", backgroundColor: showOverlay ? "#333" : "#222", 
            padding: "8px 15px", borderRadius: "6px", border: showOverlay ? "1px solid #007AFF" : "1px solid #444",
            transition: "0.2s"
          }}>
            <input 
              type="checkbox" 
              checked={showOverlay} 
              onChange={(e) => setShowOverlay(e.target.checked)} 
              style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#007AFF" }}
            />
            Blueprint Mode
          </label>
        </div>
        </div>
      </div>

     {/* Canvas Container */}
      <div style={{ position: "relative", width: "100%", borderRadius: "4px", overflow: "hidden", border: "2px solid #ff453a" }}>
        
        {/* Floating Overlay Control Panel */}
        {showOverlay && (
          <div style={{
            position: "absolute", top: "20px", right: "20px", 
            backgroundColor: "rgba(20, 20, 20, 0.85)", backdropFilter: "blur(8px)",
            padding: "15px", borderRadius: "8px", border: "1px solid #444",
            color: "white", display: "flex", flexDirection: "column", gap: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)", zIndex: 10
          }}>
            <h4 style={{ margin: 0, fontSize: "14px", color: "#aaa" }}>Overlay Tools</h4>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ fontSize: "12px" }}>Opacity: {Math.round(overlayOpacity * 100)}%</label>
              <input 
                type="range" min="0.1" max="1.0" step="0.05" 
                value={overlayOpacity} onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))} 
                style={{ width: "150px" }}
              />
            </div>

            {/* TOOL SELECTOR */}
            <div style={{ display: "flex", gap: "5px", marginTop: "5px" }}>
              <button 
                onClick={() => setOverlayMode("move")}
                style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "none", cursor: "pointer", backgroundColor: overlayMode === "move" ? "#007AFF" : "#333", color: "white", transition: "0.2s" }}
              >
                 Move
              </button>
              <button 
                onClick={() => setOverlayMode("rotate")}
                style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "none", cursor: "pointer", backgroundColor: overlayMode === "rotate" ? "#007AFF" : "#333", color: "white", transition: "0.2s" }}
              >
                 Rotate
              </button>
            </div>
            
            <button 
              onClick={() => setOverlayMode("locked")}
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "none", fontWeight: "bold", cursor: "pointer", backgroundColor: overlayMode === "locked" ? "#34C759" : "#444", color: "white", transition: "0.2s" }}
            >
               {overlayMode === "locked" ? "Locked (Ready to Paint)" : "Unlocked"}
            </button>
          </div>
        )}

      <canvas
        ref={canvasRef}
        style={{
          border: "2px solid #ff453a",
          width: "100%",
          aspectRatio: "16 / 9",
          cursor: isRotating || isDragging ? "grabbing" : (overlayMode === "move" || overlayMode === "rotate" ? "grab" : (actionView === "delete" ? "pointer" : (mode === "paint" ? "crosshair" : "cell"))),
          borderRadius: "4px"
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp} 
      />
    </div>
    </div>
  );
}
