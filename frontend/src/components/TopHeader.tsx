import React, { useState } from "react";

interface User {
  id: number;
  name: string;
  color: string;
}

interface TopHeaderProps {
  roomId: string;
  activeUsers: User[];
  myClientId: number | null;
  showToast: (msg: string) => void;
}

export default function TopHeader({ roomId, activeUsers, myClientId, showToast }: TopHeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const me = activeUsers.find(u => u.id === myClientId);
  const others = activeUsers.filter(u => u.id !== myClientId);
  const visibleOthers = others.slice(0, 3);
  const hiddenOthers = others.slice(3);

  const avatarStyle = { width: "32px", height: "32px", borderRadius: "50%", color: "white", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "14px", fontWeight: "bold", border: "2px solid #252526", boxShadow: "0 0 0 1px rgba(0,0,0,0.2)", cursor: "default", flexShrink: 0 };

  const handleInvite = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast("📋 Invite link copied to clipboard!");
  };

  return (
    <div style={{ 
      padding: "0 20px", 
      height: "56px", /* FIX: Hard-locked height */
      background: "#252526", 
      color: "#fff", 
      display: "flex", 
      justifyContent: "space-between", 
      alignItems: "center", 
      borderBottom: "1px solid #333",
      flexShrink: 0, /* FIX: Never shrink */
      overflow: "hidden", /* FIX: Never show scrollbars */
      whiteSpace: "nowrap" /* FIX: Prevent text wrapping on zoom */
    }}>
      <span style={{ fontSize: "16px", flexShrink: 0 }}><strong>NexusCode</strong> - Workspace</span>
      
      <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
        
        {/* 1. OTHER JOINEES */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex" }}>
            {visibleOthers.map((user, idx) => (
              <div key={user.id} title={user.name} style={{ ...avatarStyle, backgroundColor: user.color, marginLeft: idx === 0 ? "0px" : "-10px", zIndex: 10 - idx }}>{user.name.charAt(0).toUpperCase()}</div>
            ))}
          </div>
          {hiddenOthers.length > 0 && (
            <div style={{ position: "relative" }}>
              <div onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }} style={{ ...avatarStyle, backgroundColor: "#e2e8f0", color: "#333", marginLeft: "-10px", zIndex: 0, cursor: "pointer" }}>+{hiddenOthers.length}</div>
              {showDropdown && (
                <div style={{ position: "absolute", top: "45px", right: "0", background: "#333", border: "1px solid #444", borderRadius: "6px", padding: "8px 0", minWidth: "150px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", zIndex: 100 }}>
                  <div style={{ padding: "4px 12px", fontSize: "12px", color: "#aaa", borderBottom: "1px solid #444", marginBottom: "4px" }}>Other Viewers</div>
                  {hiddenOthers.map(u => (
                    <div key={u.id} style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", whiteSpace: "nowrap" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: u.color, flexShrink: 0 }}></div>{u.name}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. INVITE BUTTON */}
        <button 
          onClick={handleInvite}
          style={{ padding: "6px 12px", backgroundColor: "#007acc", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px", transition: "background 0.2s", flexShrink: 0 }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#005f9e"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#007acc"}
        >
          <span>🔗</span> Invite
        </button>

        {/* 3. MY AVATAR */}
        {me && (
          <div style={{ display: "flex", alignItems: "center", borderLeft: "1px solid #444", paddingLeft: "15px", height: "32px" }}>
            <div title={`${me.name} (You)`} style={{ ...avatarStyle, backgroundColor: me.color, border: "2px solid #007acc" }}>
              {me.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}