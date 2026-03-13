import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import Quill from "quill";
import { QuillBinding } from "y-quill";
import QuillCursors from "quill-cursors";
import "quill/dist/quill.snow.css";

Quill.register("modules/cursors", QuillCursors);
const USER_COLORS = ["#ffb61e", "#0088ff", "#27ae60", "#9b59b6", "#e74c3c", "#00ced1"];

export default function EditorRoom() {
  const { roomId } = useParams();
  
  // --- CORE UI STATE ---
  const [username, setUsername] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  
  // --- PRESENCE & UI STATE ---
  const [activeUsers, setActiveUsers] = useState<{id: number, name: string, color: string}[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const monacoEditorRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null); 
  const quillInstanceRef = useRef<Quill | null>(null);

  const yDocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const monacoBindingRef = useRef<MonacoBinding | null>(null);
  const quillBindingRef = useRef<QuillBinding | null>(null);

  // Engine Refs
  const lastActivityRef = useRef<Record<number, number>>({});
  const knownUsersRef = useRef<Set<number>>(new Set());
  const isSyncedRef = useRef(false); // BUG 3 FIX: Sync Lock
  const toastTimeoutRef = useRef<any>(null);
  const myClientIdRef = useRef<number | null>(null);
  const localThrottleRef = useRef<number>(0);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    if (!hasJoined) return;

    const doc = new Y.Doc();
    const provider = new WebsocketProvider("ws://localhost:8080", roomId as string, doc);
    const userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    
    // Set initial state
    provider.awareness.setLocalStateField("user", { name: username, color: userColor });
    myClientIdRef.current = provider.awareness.clientID;

    // BUG 3 FIX: Wait for initial server sync before allowing Toasts
    provider.on('sync', (isSynced: boolean) => {
      isSyncedRef.current = isSynced;
    });

    const updatePresenceAndCSS = () => {
      const states = provider.awareness.getStates();
      const now = Date.now();
      let cssText = '';
      const currentUsers: {id: number, name: string, color: string}[] = [];

      states.forEach((state: any, clientId: number) => {
        if (state.user) {
          currentUsers.push({ id: clientId, ...state.user });

          // BUG 3 FIX: Only toast if the room is fully synced AND it's a new person
          if (!knownUsersRef.current.has(clientId)) {
            knownUsersRef.current.add(clientId);
            if (isSyncedRef.current && clientId !== provider.awareness.clientID) {
              showToast(`🚀 ${state.user.name} joined the workspace`);
            }
          }

          const lastActive = lastActivityRef.current[clientId] || now;
          const isIdle = (now - lastActive) > 5000;

          // Always show cursor location
          cssText += `
            .yRemoteSelectionHead-${clientId} { border-color: ${state.user.color}; }
            .yRemoteSelection-${clientId} { background-color: ${state.user.color}40; }
          `;

          if (!isIdle) {
            cssText += `
              .yRemoteSelectionHead-${clientId}::after {
                content: "${state.user.name}";
                position: absolute;
                top: -18px; left: -2px;
                background-color: ${state.user.color}; color: white;
                font-family: sans-serif; font-size: 11px; font-weight: bold;
                padding: 2px 6px; border-radius: 4px; white-space: nowrap; pointer-events: none; z-index: 10;
              }
              .ql-cursor-${clientId} .ql-cursor-flag { opacity: 1 !important; transition: opacity 0.3s; }
            `;
          } else {
            cssText += `.ql-cursor-${clientId} .ql-cursor-flag { opacity: 0 !important; transition: opacity 0.3s; }`;
          }
        }
      });

      setActiveUsers(currentUsers);

      let styleEl = document.getElementById('dynamic-cursors');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dynamic-cursors';
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = cssText;
    };

    provider.awareness.on('change', ({ added, updated, removed }: any) => {
      const now = Date.now();
      added.forEach((id: number) => { lastActivityRef.current[id] = now; });
      updated.forEach((id: number) => { lastActivityRef.current[id] = now; });
      removed.forEach((id: number) => { 
        delete lastActivityRef.current[id]; 
        knownUsersRef.current.delete(id);
      });
      updatePresenceAndCSS();
    });

    const idleCheckerInterval = setInterval(updatePresenceAndCSS, 1000);

    yDocRef.current = doc;
    providerRef.current = provider;

    if (wrapperRef.current && !quillInstanceRef.current) {
      const editorDiv = document.createElement("div");
      wrapperRef.current.append(editorDiv);
      quillInstanceRef.current = new Quill(editorDiv, {
        theme: "snow",
        modules: { cursors: true, toolbar: [ [{ header: [1, 2, false] }], ["bold", "italic", "underline"], ["code-block"] ] },
      });
      quillBindingRef.current = new QuillBinding(doc.getText("docs"), quillInstanceRef.current, provider.awareness);
    }

    if (monacoEditorRef.current && !monacoBindingRef.current) {
      monacoBindingRef.current = new MonacoBinding(
        doc.getText("code"), monacoEditorRef.current.getModel()!, new Set([monacoEditorRef.current]), provider.awareness
      );
    }

    // BUG 1 FIX: Global Activity Tracker. 
    // If user types without moving mouse, we force a network pulse every 1.5s
    const handleLocalActivity = () => {
      const now = Date.now();
      if (now - localThrottleRef.current > 1500) {
        localThrottleRef.current = now;
        // Updating a local state field forces an awareness broadcast to everyone
        provider.awareness.setLocalStateField("lastPulse", now);
      }
    };
    window.addEventListener("keydown", handleLocalActivity);
    window.addEventListener("mousemove", handleLocalActivity);

    // Close Dropdown if clicked outside
    const closeDropdown = () => setShowDropdown(false);
    window.addEventListener("click", closeDropdown);

    return () => {
      clearInterval(idleCheckerInterval);
      window.removeEventListener("keydown", handleLocalActivity);
      window.removeEventListener("mousemove", handleLocalActivity);
      window.removeEventListener("click", closeDropdown);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (monacoBindingRef.current) monacoBindingRef.current.destroy();
      if (quillBindingRef.current) quillBindingRef.current.destroy();
      provider.destroy();
      doc.destroy();
      quillInstanceRef.current = null;
      if (wrapperRef.current) wrapperRef.current.innerHTML = "";
      const styleEl = document.getElementById('dynamic-cursors');
      if (styleEl) styleEl.remove();
    };
  }, [roomId, hasJoined]);

  const handleMonacoMount: OnMount = (editor) => {
    monacoEditorRef.current = editor;
    if (yDocRef.current && providerRef.current && !monacoBindingRef.current) {
      monacoBindingRef.current = new MonacoBinding(
        yDocRef.current.getText("code"), editor.getModel()!, new Set([editor]), providerRef.current.awareness
      );
    }
  };

  // --- BUG 2 FIX: AVATAR SEGREGATION LOGIC ---
  const myId = myClientIdRef.current;
  const me = activeUsers.find(u => u.id === myId);
  const others = activeUsers.filter(u => u.id !== myId);
  const visibleOthers = others.slice(0, 3);
  const hiddenOthers = others.slice(3);

  const avatarStyle = {
    width: "32px", height: "32px", borderRadius: "50%", color: "white", 
    display: "flex", justifyContent: "center", alignItems: "center", 
    fontSize: "14px", fontWeight: "bold", border: "2px solid #252526", 
    boxShadow: "0 0 0 1px rgba(0,0,0,0.2)", cursor: "default"
  };

  if (!hasJoined) {
    return (
      <div style={{ height: "100vh", width: "100vw", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#1e1e1e", color: "white" }}>
        <div style={{ background: "#252526", padding: "40px", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", gap: "20px", width: "300px" }}>
          <h2 style={{ margin: 0, textAlign: "center" }}>Join Workspace</h2>
          <input type="text" placeholder="Enter your name..." value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && username.trim()) setHasJoined(true); }} style={{ padding: "10px", borderRadius: "4px", border: "1px solid #444", background: "#333", color: "white", outline: "none" }} autoFocus />
          <button onClick={() => { if (username.trim()) setHasJoined(true); }} disabled={!username.trim()} style={{ padding: "10px", borderRadius: "4px", border: "none", background: username.trim() ? "#007acc" : "#555", color: "white", cursor: username.trim() ? "pointer" : "not-allowed", fontWeight: "bold" }}>Enter Room</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", backgroundColor: "#1e1e1e", overflow: "hidden", position: "relative" }}>
      
      {/* Top Header */}
      <div style={{ padding: "10px 20px", background: "#252526", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333" }}>
        <span><strong>NexusCode</strong> - Workspace</span>
        
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          
          {/* AVATAR UI (Google Docs Style) */}
          <div style={{ display: "flex", alignItems: "center" }}>
            
            {/* 1. Visible Others (Overlapping) */}
            <div style={{ display: "flex" }}>
              {visibleOthers.map((user, idx) => (
                <div key={user.id} title={user.name} style={{ ...avatarStyle, backgroundColor: user.color, marginLeft: idx === 0 ? "0px" : "-10px", zIndex: 10 - idx }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>

            {/* 2. Hidden Users Bubble (+X) */}
            {hiddenOthers.length > 0 && (
              <div style={{ position: "relative" }}>
                <div 
                  onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }} 
                  style={{ ...avatarStyle, backgroundColor: "#e2e8f0", color: "#333", marginLeft: "-10px", zIndex: 0, cursor: "pointer" }}
                >
                  +{hiddenOthers.length}
                </div>

                {/* Dropdown Menu for hidden users */}
                {showDropdown && (
                  <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "45px", right: "0", background: "#333", border: "1px solid #444", borderRadius: "6px", padding: "8px 0", minWidth: "150px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", zIndex: 100 }}>
                    <div style={{ padding: "4px 12px", fontSize: "12px", color: "#aaa", borderBottom: "1px solid #444", marginBottom: "4px" }}>Other Viewers</div>
                    {hiddenOthers.map(u => (
                      <div key={u.id} style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
                        <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: u.color }}></div>
                        {u.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* 3. Current User (You) - Displayed on the far right with a gap */}
            {me && (
              <div title={`${me.name} (You)`} style={{ ...avatarStyle, backgroundColor: me.color, marginLeft: "15px", border: "2px solid #007acc" }}>
                {me.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <span style={{ color: "#aaa", fontSize: "0.9em", borderLeft: "1px solid #444", paddingLeft: "15px" }}>Room: {roomId}</span>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", width: "100%" }}>
        <div style={{ flex: 1, borderRight: "1px solid #333", minWidth: 0 }}>
          <Editor height="100%" theme="vs-dark" defaultLanguage="javascript" onMount={handleMonacoMount} options={{ minimap: { enabled: false } }} />
        </div>
        <div style={{ flex: 1, backgroundColor: "#fff", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "10px", backgroundColor: "#f3f3f3", borderBottom: "1px solid #ddd", color: "#333", fontWeight: "bold" }}>📄 Main Documentation</div>
          <div ref={wrapperRef} style={{ flex: 1, display: "flex", flexDirection: "column", color: "#000", overflowY: "auto" }} />
        </div>
      </div>

      {toastMsg && (
        <div style={{ position: "absolute", bottom: "20px", right: "20px", backgroundColor: "#007acc", color: "white", padding: "12px 24px", borderRadius: "6px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontWeight: "bold", fontSize: "14px", zIndex: 1000, transition: "opacity 0.3s ease-in-out", opacity: 1 }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}