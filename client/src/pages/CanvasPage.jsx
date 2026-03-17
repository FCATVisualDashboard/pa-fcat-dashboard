import CanvasGrid from "../components/CanvasGrid";
import jfkImg from "../assets/jfk.png"; // 🔥 THIS is the fix
import "../components/CanvasPage.css";

function CanvasPage() {
  return (
    <div className="canvas-page">
      
      {/* Wrapper matches image size */}
      <div className="image-wrapper">
        <img src={jfkImg} alt="JFK" className="canvas-bg" />

        {/* Grid sits ON TOP of image */}
        <CanvasGrid />
      </div>

    </div>
  );
}

export default CanvasPage;