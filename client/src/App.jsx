import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CanvasPage from "./pages/CanvasPage";
import AdminMapper from "./components/AdminMapper";
import WorkOrderPage from "./pages/WorkOrderPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<h1>Home</h1>} />
        <Route path="/canvas" element={<CanvasPage />} />
        <Route path="/admin" element={<AdminMapper />} />
        <Route path="/workorders" element={<WorkOrderPage />} />
      </Routes>
    </Router>
  );
}

export default App;