import React from "react";

interface JoinWorkspaceProps {
  username: string;
  setUsername: (name: string) => void;
  setHasJoined: (val: boolean) => void;
}

export default function JoinWorkspace({ username, setUsername, setHasJoined }: JoinWorkspaceProps) {
  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#1e1e1e", color: "white" }}>
      <div style={{ background: "#252526", padding: "40px", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", gap: "20px", width: "300px" }}>
        <h2 style={{ margin: 0, textAlign: "center" }}>Join Workspace</h2>
        <input 
          type="text" placeholder="Enter your name..." value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          onKeyDown={(e) => { if (e.key === 'Enter' && username.trim()) setHasJoined(true); }} 
          style={{ padding: "10px", borderRadius: "4px", border: "1px solid #444", background: "#333", color: "white", outline: "none" }} autoFocus 
        />
        <button 
          onClick={() => { if (username.trim()) setHasJoined(true); }} 
          disabled={!username.trim()} 
          style={{ padding: "10px", borderRadius: "4px", border: "none", background: username.trim() ? "#007acc" : "#555", color: "white", cursor: username.trim() ? "pointer" : "not-allowed", fontWeight: "bold" }}
        >
          Enter Room
        </button>
      </div>
    </div>
  );
}