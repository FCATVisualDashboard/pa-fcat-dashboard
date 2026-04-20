import { useRef, useEffect, useState } from "react";
import aerialImg from "../assets/aerial.jpg";
import API_BASE_URL from "../config";
import pmOverlayImg from "../assets/Airfield_PM_Areas.png";

export default function AdminMapper() {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const lastDrawRef = useRef(null);

  const [actionView, setActionView] = useState("add");
  const [editingPmId, setEditingPmId] = useState(null);

  const [paintedCells, setPaintedCells] = useState(new Set());
  const [isPainting, setIsPainting] = useState(false);
  const [savedAreas, setSavedAreas] = useState([]);
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState("paint");
  const [pmId, setPmId] = useState("");

  const [deleteInput, setDeleteInput] = useState("");
  const [polygonPath, setPolygonPath] = useState([]);

  // OVERLAY STATE
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.4);
  const [overlayRotation, setOverlayRotation] = useState(0);
  const [overlayOffsetX, setOverlayOffsetX] = useState(0);
  const [overlayOffsetY, setOverlayOffsetY] = useState(0);

  // OVERLAY INTERACTION TRACKING
  const [overlayMode, setOverlayMode] = useState("locked");
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

  // UNDO / REDO
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const strokeStartRef = useRef(null);

  const CELL_SIZE = 4;
  const COLS = 854;
  const ROWS = 480;
  const CANVAS_WIDTH = CELL_SIZE * COLS;
  const CANVAS_HEIGHT = CELL_SIZE * ROWS;

  // ─── DATA FETCHING ───────────────────────────────────────────────────────────

  const fetchSavedGrids = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/grid/all`);
      if (response.ok) {
        const data = await response.json();
        setSavedAreas(data);
      }
    } catch (error) {
      console.error("Error fetching saved grids:", error);
    }
  };

  // ─── LIFECYCLE ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchSavedGrids();

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
      draw();
    };
  }, []);

  useEffect(() => {
    if (paintedCells.size === 0 && mode === "erase") {
      setMode("paint");
    }
  }, [paintedCells.size, mode]);

  // Reset state when switching away from edit mode
  useEffect(() => {
    if (actionView !== "edit") {
      setEditingPmId(null);
      setPaintedCells(new Set());
      setPmId("");
      setDescription("");
    }
  }, [actionView]);

  // Clear painted cells when entering delete mode
  useEffect(() => {
    if (actionView === "delete") {
      setPaintedCells(new Set());
      setMode("paint");
    }
  }, [actionView]);

  // Re-draw canvas when relevant state changes
  useEffect(() => {
    draw();
  }, [
    paintedCells,
    savedAreas,
    showOverlay,
    overlayOpacity,
    overlayRotation,
    overlayOffsetX,
    overlayOffsetY,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
      if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        handleRedo();
      }
      if (!e.ctrlKey && (e.key === "p" || e.key === "P")) setMode("paint");
      if (!e.ctrlKey && (e.key === "e" || e.key === "E")) setMode("erase");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paintedCells]);

  // ─── DRAWING ─────────────────────────────────────────────────────────────────

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

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

    // Draw overlay if enabled
    if (showOverlay && overlayRef.current) {
      ctx.save();
      ctx.globalAlpha = overlayOpacity;
      const centerX = offsetX + imgWidth / 2 + overlayOffsetX;
      const centerY = offsetY + imgHeight / 2 + overlayOffsetY;
      ctx.translate(centerX, centerY);
      ctx.rotate((overlayRotation * Math.PI) / 180);
      ctx.drawImage(
        overlayRef.current,
        -imgWidth / 2,
        -imgHeight / 2,
        imgWidth,
        imgHeight,
      );
      ctx.restore();
    }

    // Draw saved database cells in blue
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

    // Draw active painted cells in red
    ctx.fillStyle = "rgba(255, 69, 58, 0.7)";
    paintedCells.forEach((cellKey) => {
      const [gridX, gridY] = cellKey.split(",").map(Number);
      ctx.fillRect(gridX * CELL_SIZE, gridY * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });

    // Draw grid lines
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

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  const getGridCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return {
      gridX: Math.floor(x / CELL_SIZE),
      gridY: Math.floor(y / CELL_SIZE),
    };
  };

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
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
    return cells;
  };

  // ─── PAINT ───────────────────────────────────────────────────────────────────

  const applyPaint = (cellsArray) => {
    setPaintedCells((prev) => {
      redoStackRef.current = [];
      setRedoCount(0);

      const nextSet = new Set(prev);
      cellsArray.forEach((cell) => {
        if (mode === "paint") nextSet.add(cell);
        else if (mode === "erase") nextSet.delete(cell);
      });
      return nextSet;
    });
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all painted cells?")) {
      undoStackRef.current = [];
      redoStackRef.current = [];
      setUndoCount(0);
      setRedoCount(0);
      setPaintedCells(new Set());
      setMode("paint");
    }
  };

  // ─── UNDO / REDO ─────────────────────────────────────────────────────────────

  const handleUndo = () => {
    if (undoStackRef.current.length === 0) return;
    const previous = undoStackRef.current.pop();
    redoStackRef.current.push(new Set(paintedCells));
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    setPaintedCells(previous);
  };

  const handleRedo = () => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop();
    undoStackRef.current.push(new Set(paintedCells));
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    setPaintedCells(next);
  };

  // ─── SAVE / DELETE ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!pmId) {
      alert("Please enter a PM ID before saving!");
      return;
    }
    if (paintedCells.size === 0) {
      alert("Please paint some cells on the map before saving!");
      return;
    }

    const payload = {
      pm_id: pmId,
      description: description,
      coordinates: Array.from(paintedCells),
    };

    try {
      const endpoint = editingPmId
        ? `${API_BASE_URL}/api/grid/edit/${editingPmId}`
        : `${API_BASE_URL}/api/grid/save`;
      const method = editingPmId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 409) {
        const data = await response.json();
        alert(data.error);
        return;
      }
      if (!response.ok) throw new Error("Failed to save to database");

      const data = await response.json();
      alert(`Success: ${data.message} (${paintedCells.size} cells)`);

      fetchSavedGrids();
      setPaintedCells(new Set());
      setPmId("");
      setDescription("");
      setEditingPmId(null);
      setMode("paint");
      undoStackRef.current = [];
      redoStackRef.current = [];
      setUndoCount(0);
      setRedoCount(0);
    } catch (error) {
      console.error("Error saving area:", error);
      alert(
        "There was an error saving the area. Check your terminal for backend errors.",
      );
    }
  };

  const executeDelete = async (targetPmId) => {
    if (!targetPmId) return alert("Please provide a PM ID to delete.");

    if (
      window.confirm(
        `Are you absolutely sure you want to permanently delete the area: ${targetPmId}?`,
      )
    ) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/grid/delete/${targetPmId}`,
          {
            method: "DELETE",
          },
        );

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

  // ─── CANVAS EVENTS ───────────────────────────────────────────────────────────

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
      const centerX = canvas.width / 2 + overlayOffsetX;
      const centerY = canvas.height / 2 + overlayOffsetY;
      const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
      setIsRotating(true);
      overlayStartAngleRef.current = angle;
      overlayInitialRotRef.current = overlayRotation;
      return;
    }

    // DELETE: click on or near a blue area to delete it
    if (actionView === "delete") {
      const TOLERANCE = 2;
      const clickedCell = savedAreas.find(
        (c) =>
          Math.abs(c.x_pos - gridX) <= TOLERANCE &&
          Math.abs(c.y_pos - gridY) <= TOLERANCE,
      );
      if (clickedCell) {
        executeDelete(clickedCell.pm_id);
      }
      return; // never paint in delete mode
    }

    // EDIT: click to select an area first, then allow painting
    if (actionView === "edit" && !editingPmId) {
      const TOLERANCE = 2;
      const clickedCell = savedAreas.find(
        (c) =>
          Math.abs(c.x_pos - gridX) <= TOLERANCE &&
          Math.abs(c.y_pos - gridY) <= TOLERANCE,
      );
      if (clickedCell) {
        const targetPmId = clickedCell.pm_id;
        const cellsForPm = savedAreas.filter((c) => c.pm_id === targetPmId);
        setPmId(targetPmId);
        setDescription(cellsForPm[0]?.description || "");
        setEditingPmId(targetPmId);
        const newPainted = new Set();
        cellsForPm.forEach((c) => newPainted.add(`${c.x_pos},${c.y_pos}`));
        setPaintedCells(newPainted);
        setMode("paint");
      }
      return; // don't start painting until area is selected
    }

    // ADD or EDIT with area already selected: snapshot then paint
    strokeStartRef.current = new Set(paintedCells);
    setIsPainting(true);
    setPolygonPath([{ x: gridX, y: gridY }]);
    applyPaint([`${gridX},${gridY}`]);
  };

  const handleCanvasMouseMove = (e) => {
    // INTERCEPT: Overlay Dragging
    if (isDragging) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;
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
      const centerX = canvas.width / 2 + overlayOffsetX;
      const centerY = canvas.height / 2 + overlayOffsetY;
      const currentAngle = Math.atan2(mouseY - centerY, mouseX - centerX);
      const angleDiff = currentAngle - overlayStartAngleRef.current;
      const angleDiffDegrees = angleDiff * (180 / Math.PI);
      setOverlayRotation(overlayInitialRotRef.current + angleDiffDegrees);
      return;
    }

    if (overlayMode !== "locked") return;
    if (!isPainting || actionView === "delete") return;

    const { gridX, gridY } = getGridCoordinates(e);
    const lastPoint = polygonPath[polygonPath.length - 1];

    if (lastPoint && (lastPoint.x !== gridX || lastPoint.y !== gridY)) {
      setPolygonPath((prev) => [...prev, { x: gridX, y: gridY }]);
      const cellsToUpdate = getCellsOnLine(
        lastPoint.x,
        lastPoint.y,
        gridX,
        gridY,
      );
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

    // Push the pre-stroke snapshot once the full stroke is complete
    if (strokeStartRef.current !== null) {
      undoStackRef.current.push(strokeStartRef.current);
      strokeStartRef.current = null;
      setUndoCount(undoStackRef.current.length);
    }

    setIsPainting(false);

    // Auto-fill polygon if shape was drawn in paint mode
    if (polygonPath.length > 2 && mode === "paint") {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const path = new Path2D();
      path.moveTo(polygonPath[0].x * CELL_SIZE, polygonPath[0].y * CELL_SIZE);
      for (let i = 1; i < polygonPath.length; i++) {
        path.lineTo(polygonPath[i].x * CELL_SIZE, polygonPath[i].y * CELL_SIZE);
      }
      path.closePath();

      const minX = Math.min(...polygonPath.map((p) => p.x));
      const maxX = Math.max(...polygonPath.map((p) => p.x));
      const minY = Math.min(...polygonPath.map((p) => p.y));
      const maxY = Math.max(...polygonPath.map((p) => p.y));

      const filledCells = [];
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const testX = x * CELL_SIZE + CELL_SIZE / 2;
          const testY = y * CELL_SIZE + CELL_SIZE / 2;
          if (ctx.isPointInPath(path, testX, testY)) {
            filledCells.push(`${x},${y}`);
          }
        }
      }
      applyPaint(filledCells);
    }

    setPolygonPath([]);
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#121212",
        color: "white",
        minHeight: "100vh",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          marginBottom: "15px",
          backgroundColor: "#1a1a1a",
          padding: "12px 20px",
          borderRadius: "8px",
          border: "1px solid #333",
          boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
        }}
      >
        {/* Segmented Control */}
        <div
          style={{
            display: "flex",
            backgroundColor: "#000",
            padding: "4px",
            borderRadius: "6px",
          }}
        >
          <button
            onClick={() => setActionView("add")}
            style={{
              padding: "6px 16px",
              backgroundColor: actionView === "add" ? "#333" : "transparent",
              color: actionView === "add" ? "white" : "#888",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              transition: "0.2s",
            }}
          >
            Add Area
          </button>
          <button
            onClick={() => {
              setActionView("edit");
              setPaintedCells(new Set());
            }}
            style={{
              padding: "6px 16px",
              backgroundColor:
                actionView === "edit" ? "#007AFF" : "transparent",
              color: actionView === "edit" ? "white" : "#888",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              transition: "0.2s",
            }}
          >
            Edit Area
          </button>
          <button
            onClick={() => setActionView("delete")}
            style={{
              padding: "6px 16px",
              backgroundColor:
                actionView === "delete" ? "#ff453a" : "transparent",
              color: actionView === "delete" ? "white" : "#888",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              transition: "0.2s",
            }}
          >
            Delete Area
          </button>
        </div>

        {/* Vertical Divider */}
        <div
          style={{ width: "1px", height: "30px", backgroundColor: "#444" }}
        ></div>

        {/* Contextual Controls */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            gap: "15px",
          }}
        >
          {actionView === "add" || actionView === "edit" ? (
            <>
              <input
                type="text"
                value={pmId}
                onChange={(e) => setPmId(e.target.value)}
                placeholder="PM ID (e.g. 6671234)"
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #555",
                  backgroundColor: "#222",
                  color: "white",
                  width: "150px",
                }}
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Location Name"
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #555",
                  backgroundColor: "#222",
                  color: "white",
                  width: "200px",
                }}
              />

              <div style={{ display: "flex", gap: "5px", marginLeft: "10px" }}>
                <button
                  onClick={() => setMode("paint")}
                  style={{
                    padding: "6px 15px",
                    backgroundColor: mode === "paint" ? "#007AFF" : "#333",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Paint
                </button>
                {paintedCells.size > 0 && (
                  <>
                    <button
                      onClick={() => setMode("erase")}
                      style={{
                        padding: "6px 15px",
                        backgroundColor: mode === "erase" ? "#ff453a" : "#333",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Erase
                    </button>
                    <button
                      onClick={handleClearAll}
                      style={{
                        padding: "6px 15px",
                        backgroundColor: "transparent",
                        color: "#ff9f0a",
                        border: "1px solid #ff9f0a",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Clear All
                    </button>
                  </>
                )}
              </div>

              {/* Undo / Redo */}
              <div style={{ display: "flex", gap: "5px" }}>
                <button
                  onClick={handleUndo}
                  disabled={undoCount === 0}
                  title="Undo (Ctrl+Z)"
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#333",
                    color: undoCount === 0 ? "#555" : "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: undoCount === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  ↩ Undo {undoCount > 0 && `(${undoCount})`}
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoCount === 0}
                  title="Redo (Ctrl+Y)"
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#333",
                    color: redoCount === 0 ? "#555" : "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: redoCount === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  ↪ Redo {redoCount > 0 && `(${redoCount})`}
                </button>
              </div>

              {/* Shortcuts Tooltip */}
              <div style={{ position: "relative" }}>
                <button
                  onMouseEnter={(e) =>
                    (e.currentTarget.nextSibling.style.display = "block")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.nextSibling.style.display = "none")
                  }
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#222",
                    color: "#aaa",
                    border: "1px solid #444",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  ⌨ Shortcuts
                </button>
                <div
                  style={{
                    display: "none",
                    position: "absolute",
                    top: "110%",
                    left: 0,
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #444",
                    borderRadius: "6px",
                    padding: "12px 16px",
                    minWidth: "180px",
                    zIndex: 100,
                    boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
                    color: "white",
                    fontSize: "13px",
                    lineHeight: "2",
                  }}
                >
                  <div
                    style={{
                      fontWeight: "bold",
                      marginBottom: "6px",
                      color: "#aaa",
                    }}
                  >
                    Keyboard Shortcuts
                  </div>
                  <div>
                    ↩{" "}
                    <kbd
                      style={{
                        backgroundColor: "#333",
                        padding: "2px 6px",
                        borderRadius: "3px",
                      }}
                    >
                      Ctrl+Z
                    </kbd>{" "}
                    Undo
                  </div>
                  <div>
                    ↪{" "}
                    <kbd
                      style={{
                        backgroundColor: "#333",
                        padding: "2px 6px",
                        borderRadius: "3px",
                      }}
                    >
                      Ctrl+Y
                    </kbd>{" "}
                    Redo
                  </div>
                  <div>
                    🖌{" "}
                    <kbd
                      style={{
                        backgroundColor: "#333",
                        padding: "2px 6px",
                        borderRadius: "3px",
                      }}
                    >
                      P
                    </kbd>{" "}
                    Paint mode
                  </div>
                  <div>
                    ⌫{" "}
                    <kbd
                      style={{
                        backgroundColor: "#333",
                        padding: "2px 6px",
                        borderRadius: "3px",
                      }}
                    >
                      E
                    </kbd>{" "}
                    Erase mode
                  </div>
                </div>
              </div>

              <button
                onClick={handleSave}
                style={{
                  padding: "8px 20px",
                  backgroundColor: "#34C759",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  marginLeft: "auto",
                }}
              >
                Save Area
              </button>
            </>
          ) : (
            <>
              {/* Delete Controls */}
              <span style={{ color: "#aaa", fontStyle: "italic" }}>
                Click a blue area on the map to delete it, or:
              </span>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="Enter PM ID"
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #555",
                  backgroundColor: "#222",
                  color: "white",
                  marginLeft: "auto",
                }}
              />
              <button
                onClick={() => executeDelete(deleteInput)}
                style={{
                  padding: "6px 15px",
                  backgroundColor: "#ff453a",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Delete
              </button>
            </>
          )}

          {/* Blueprint Mode Toggle */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                backgroundColor: showOverlay ? "#333" : "#222",
                padding: "8px 15px",
                borderRadius: "6px",
                border: showOverlay ? "1px solid #007AFF" : "1px solid #444",
                transition: "0.2s",
              }}
            >
              <input
                type="checkbox"
                checked={showOverlay}
                onChange={(e) => setShowOverlay(e.target.checked)}
                style={{
                  width: "16px",
                  height: "16px",
                  cursor: "pointer",
                  accentColor: "#007AFF",
                }}
              />
              Blueprint Mode
            </label>
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        style={{
          position: "relative",
          width: "100%",
          borderRadius: "4px",
          overflow: "hidden",
          border: "2px solid #ff453a",
        }}
      >
        {/* Floating Overlay Control Panel */}
        {showOverlay && (
          <div
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              backgroundColor: "rgba(20, 20, 20, 0.85)",
              backdropFilter: "blur(8px)",
              padding: "15px",
              borderRadius: "8px",
              border: "1px solid #444",
              color: "white",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              zIndex: 10,
            }}
          >
            <h4 style={{ margin: 0, fontSize: "14px", color: "#aaa" }}>
              Overlay Tools
            </h4>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "5px" }}
            >
              <label style={{ fontSize: "12px" }}>
                Opacity: {Math.round(overlayOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                style={{ width: "150px" }}
              />
            </div>

            <div style={{ display: "flex", gap: "5px", marginTop: "5px" }}>
              <button
                onClick={() => setOverlayMode("move")}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: overlayMode === "move" ? "#007AFF" : "#333",
                  color: "white",
                  transition: "0.2s",
                }}
              >
                Move
              </button>
              <button
                onClick={() => setOverlayMode("rotate")}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor:
                    overlayMode === "rotate" ? "#007AFF" : "#333",
                  color: "white",
                  transition: "0.2s",
                }}
              >
                Rotate
              </button>
            </div>

            <button
              onClick={() => setOverlayMode("locked")}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "4px",
                border: "none",
                fontWeight: "bold",
                cursor: "pointer",
                backgroundColor: overlayMode === "locked" ? "#34C759" : "#444",
                color: "white",
                transition: "0.2s",
              }}
            >
              {overlayMode === "locked"
                ? "Locked (Ready to Paint)"
                : "Unlocked"}
            </button>
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            cursor:
              isRotating || isDragging
                ? "grabbing"
                : overlayMode === "move" || overlayMode === "rotate"
                  ? "grab"
                  : actionView === "delete"
                    ? "pointer"
                    : mode === "paint"
                      ? "crosshair"
                      : "cell",
            display: "block",
            borderRadius: "4px",
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
