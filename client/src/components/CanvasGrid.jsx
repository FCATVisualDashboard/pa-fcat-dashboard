import { useState } from "react";
import "./CanvasGrid.css";

const GRID_SIZE = 20;

function CanvasGrid() {
  const [grid] = useState(
    Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill("transparent"))
  );


  return (
    <div className="canvas-container">
      <div className="canvas-grid">
        {grid.map((row, i) =>
          row.map((color, j) => (
            <div
              key={`${i}-${j}`}
              className="canvas-cell"
              style={{ backgroundColor: color }}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default CanvasGrid;