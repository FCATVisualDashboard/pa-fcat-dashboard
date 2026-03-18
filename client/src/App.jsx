import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CanvasPage from "./pages/CanvasPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/canvas" element={<h1>Home</h1>} />
        <Route path="/" element={<CanvasPage />} />
      </Routes>
    </Router>
  );
}

export default App;