import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

export default function Home() {
  const navigate = useNavigate();

  const createRoom = () => {
    // Generate a secure random ID (e.g., 123e4567-e89b-12d3-a456-426614174000)
    const roomId = uuidv4();
    // Redirect the user to their new private workspace
    navigate(`/room/${roomId}`);
  };

  return (
    <div style={{ 
      height: "100vh", 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center",
      backgroundColor: "#1e1e1e",
      color: "white",
      fontFamily: "sans-serif"
    }}>
      <h1 style={{ fontSize: "3rem", marginBottom: "10px" }}>NexusCode</h1>
      <p style={{ color: "#aaa", marginBottom: "30px" }}>Distributed Real-Time Collaborative Engine</p>
      
      <button 
        onClick={createRoom}
        style={{
          padding: "15px 30px",
          fontSize: "1.2rem",
          backgroundColor: "#007acc",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          transition: "background 0.2s"
        }}
      >
        Create New Workspace
      </button>
    </div>
  );
}