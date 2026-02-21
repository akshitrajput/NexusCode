import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./Home";
import EditorRoom from "./EditorRoom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* The Landing Page */}
        <Route path="/" element={<Home />} />
        
        {/* The Dynamic Editor Room */}
        <Route path="/room/:roomId" element={<EditorRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;