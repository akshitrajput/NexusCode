import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { v4 as uuidv4 } from "uuid";

// --- COMPONENTS ---
import FileTabBar from "./components/FileTabBar";
import TopHeader from "./components/TopHeader";
import JoinWorkspace from "./components/JoinWorkspace";
import DocsPanel from "./components/DocsPanel"; // NEW IMPORT

// --- ASSETS ---
import iconC from "./assets/C_icon.webp";
import iconCpp from "./assets/C++_icon.png";
import iconGo from "./assets/Go_icon.png";
import iconHtml from "./assets/HTML_icon.png";
import iconJava from "./assets/Java_icon.png";
import iconJs from "./assets/Javascript_icon.webp";
import iconPy from "./assets/Python_icon.png";

const USER_COLORS = ["#ffb61e", "#0088ff", "#27ae60", "#9b59b6", "#e74c3c", "#00ced1"];

const FILE_TYPES = [
  { id: "javascript", label: "JavaScript", icon: iconJs, ext: ".js" },
  { id: "python", label: "Python", icon: iconPy, ext: ".py" },
  { id: "cpp", label: "C++", icon: iconCpp, ext: ".cpp" },
  { id: "c", label: "C", icon: iconC, ext: ".c" },
  { id: "go", label: "Go", icon: iconGo, ext: ".go" },
  { id: "java", label: "Java", icon: iconJava, ext: ".java" },
  { id: "html", label: "HTML", icon: iconHtml, ext: ".html" },
];

interface FileMeta { id: string; name: string; language: string; createdAt: number; }

export default function EditorRoom() {
  const { roomId } = useParams();
  
  // UI State
  const [username, setUsername] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [activeUsers, setActiveUsers] = useState<{id: number, name: string, color: string}[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isEngineReady, setIsEngineReady] = useState(false); // NEW: Orchestration state
  
  // File System State
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileLang, setNewFileLang] = useState(FILE_TYPES[0].id);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editFileNameBuffer, setEditFileNameBuffer] = useState("");
  
  // Engine Refs
  const monacoEditorRef = useRef<any>(null);
  const yDocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const monacoBindingRef = useRef<MonacoBinding | null>(null);

  const lastActivityRef = useRef<Record<number, number>>({});
  const knownUsersRef = useRef<Set<number>>(new Set());
  const isSyncedRef = useRef(false);
  const toastTimeoutRef = useRef<any>(null);
  const myClientIdRef = useRef<number | null>(null);
  const localThrottleRef = useRef<number>(0);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(null), 3000);
  };

  const bindMonaco = () => {
    if (!monacoEditorRef.current || !yDocRef.current || !providerRef.current || !activeFileId) return;
    if (monacoBindingRef.current) monacoBindingRef.current.destroy();
    const yTextCode = yDocRef.current.getText(activeFileId);
    monacoBindingRef.current = new MonacoBinding(
      yTextCode, monacoEditorRef.current.getModel()!, new Set([monacoEditorRef.current]), providerRef.current.awareness
    );
  };

  useEffect(() => { bindMonaco(); }, [activeFileId]);

  useEffect(() => {
    if (!hasJoined) return;

    const doc = new Y.Doc();
    const provider = new WebsocketProvider("ws://localhost:8080", roomId as string, doc);
    const userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    
    provider.awareness.setLocalStateField("user", { name: username, color: userColor });
    myClientIdRef.current = provider.awareness.clientID;

    const filesMap = doc.getMap<FileMeta>("files-meta");

    const updateFilesState = () => {
      const filesArray = Array.from(filesMap.values()).sort((a, b) => a.createdAt - b.createdAt);
      setFiles(filesArray);
      if (filesArray.length > 0 && !activeFileId) setActiveFileId((prev) => prev ? prev : filesArray[0].id);
    };

    provider.on('sync', (isSynced: boolean) => {
      isSyncedRef.current = isSynced;
      if (isSynced) {
        if (filesMap.keys().next().done) filesMap.set("file-1", { id: "file-1", name: "index.js", language: "javascript", createdAt: Date.now() });
        updateFilesState();
      }
    });

    filesMap.observe(() => updateFilesState());

    const updatePresenceAndCSS = () => {
      const states = provider.awareness.getStates();
      const now = Date.now();
      let cssText = '';
      const currentUsers: {id: number, name: string, color: string}[] = [];

      states.forEach((state: any, clientId: number) => {
        if (state.user) {
          currentUsers.push({ id: clientId, ...state.user });
          if (!knownUsersRef.current.has(clientId)) {
            knownUsersRef.current.add(clientId);
            if (isSyncedRef.current && clientId !== provider.awareness.clientID) showToast(`🚀 ${state.user.name} joined the workspace`);
          }
          const isIdle = (now - (lastActivityRef.current[clientId] || now)) > 5000;
          cssText += `.yRemoteSelectionHead-${clientId} { border-color: ${state.user.color}; } .yRemoteSelection-${clientId} { background-color: ${state.user.color}40; }`;
          if (!isIdle) {
            cssText += `.yRemoteSelectionHead-${clientId}::after { content: "${state.user.name}"; position: absolute; top: -18px; left: -2px; background-color: ${state.user.color}; color: white; font-family: sans-serif; font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 4px; white-space: nowrap; pointer-events: none; z-index: 10; } .ql-cursor-${clientId} .ql-cursor-flag { opacity: 1 !important; transition: opacity 0.3s; }`;
          } else cssText += `.ql-cursor-${clientId} .ql-cursor-flag { opacity: 0 !important; transition: opacity 0.3s; }`;
        }
      });
      setActiveUsers(currentUsers);
      let styleEl = document.getElementById('dynamic-cursors');
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'dynamic-cursors'; document.head.appendChild(styleEl); }
      styleEl.innerHTML = cssText;
    };

    provider.awareness.on('change', ({ added, updated, removed }: any) => {
      const now = Date.now();
      added.forEach((id: number) => { lastActivityRef.current[id] = now; });
      updated.forEach((id: number) => { lastActivityRef.current[id] = now; });
      removed.forEach((id: number) => { delete lastActivityRef.current[id]; knownUsersRef.current.delete(id); });
      updatePresenceAndCSS();
    });

    const idleCheckerInterval = setInterval(updatePresenceAndCSS, 1000);
    
    // Assign refs and trigger children to render
    yDocRef.current = doc; 
    providerRef.current = provider;
    setIsEngineReady(true);

    const handleLocalActivity = () => {
      const now = Date.now();
      if (now - localThrottleRef.current > 1500) { localThrottleRef.current = now; provider.awareness.setLocalStateField("lastPulse", now); }
    };
    window.addEventListener("keydown", handleLocalActivity);
    window.addEventListener("mousemove", handleLocalActivity);

    return () => {
      setIsEngineReady(false);
      clearInterval(idleCheckerInterval); 
      window.removeEventListener("keydown", handleLocalActivity); 
      window.removeEventListener("mousemove", handleLocalActivity);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (monacoBindingRef.current) monacoBindingRef.current.destroy();
      provider.destroy(); 
      doc.destroy(); 
      const styleEl = document.getElementById('dynamic-cursors'); if (styleEl) styleEl.remove();
    };
  }, [roomId, hasJoined]);

  const handleMonacoMount: OnMount = (editor) => { monacoEditorRef.current = editor; bindMonaco(); };

  // --- HANDLERS ---
  const commitNewFile = () => {
    if (!yDocRef.current || newFileName.trim() === "") return;
    const filesMap = yDocRef.current.getMap<FileMeta>("files-meta");
    const newId = uuidv4();
    const langObj = FILE_TYPES.find(f => f.id === newFileLang) || FILE_TYPES[0];
    let finalName = newFileName.trim();
    if (!finalName.includes('.')) finalName += langObj.ext;
    filesMap.set(newId, { id: newId, name: finalName, language: newFileLang, createdAt: Date.now() });
    setActiveFileId(newId); setShowNewFileModal(false); setNewFileName("");
  };

  const startRename = (file: FileMeta) => { setEditingFileId(file.id); setEditFileNameBuffer(file.name); };
  const commitRename = (fileId: string) => {
    if (!yDocRef.current) return;
    if (editFileNameBuffer.trim() !== "") {
      const filesMap = yDocRef.current.getMap<FileMeta>("files-meta");
      const existing = filesMap.get(fileId);
      if (existing) filesMap.set(fileId, { ...existing, name: editFileNameBuffer.trim() });
    }
    setEditingFileId(null); 
  };

  const deleteFile = (fileId: string) => {
    if (!yDocRef.current) return;
    const filesMap = yDocRef.current.getMap<FileMeta>("files-meta");
    if (Array.from(filesMap.keys()).length <= 1) { showToast("Cannot delete the last file."); return; }
    filesMap.delete(fileId);
    if (activeFileId === fileId) {
      const remainingFiles = Array.from(filesMap.values()).filter(f => f.id !== fileId);
      setActiveFileId(remainingFiles.length > 0 ? remainingFiles[0].id : null);
    }
  };

  const getFileIcon = (langId: string) => { const found = FILE_TYPES.find(f => f.id === langId); return found ? found.icon : iconJs; };
  const activeFileObj = files.find(f => f.id === activeFileId);
  const activeLanguage = activeFileObj ? activeFileObj.language : "javascript";

  if (!hasJoined) return <JoinWorkspace username={username} setUsername={setUsername} setHasJoined={setHasJoined} />;

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", backgroundColor: "#1e1e1e", overflow: "hidden", position: "relative" }}>
      
      {/* Creation Modal */}
      {showNewFileModal && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "#252526", padding: "30px", borderRadius: "8px", color: "white", width: "320px", display: "flex", flexDirection: "column", gap: "15px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
            <h3 style={{ margin: 0, borderBottom: "1px solid #444", paddingBottom: "10px" }}>Create New File</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Language / Environment</label>
              <select value={newFileLang} onChange={(e) => setNewFileLang(e.target.value)} style={{ padding: "8px", background: "#333", color: "white", border: "1px solid #444", borderRadius: "4px", outline: "none" }}>
                {FILE_TYPES.map(ft => <option key={ft.id} value={ft.id}>{ft.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ fontSize: "12px", color: "#aaa" }}>File Name</label>
              <input autoFocus type="text" placeholder="e.g. server.js" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commitNewFile()} style={{ padding: "8px", background: "#333", color: "white", border: "1px solid #444", borderRadius: "4px", outline: "none" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button onClick={() => setShowNewFileModal(false)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #555", color: "#ccc", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
              <button onClick={commitNewFile} disabled={!newFileName.trim()} style={{ padding: "8px 16px", background: newFileName.trim() ? "#007acc" : "#555", border: "none", color: "white", borderRadius: "4px", cursor: newFileName.trim() ? "pointer" : "not-allowed" }}>Create File</button>
            </div>
          </div>
        </div>
      )}

      {/* Header Orchestrator */}
      <TopHeader roomId={roomId as string} activeUsers={activeUsers} myClientId={myClientIdRef.current} showToast={showToast} />

      <div style={{ display: "flex", flex: 1, overflow: "hidden", width: "100%" }}>
        
        {/* LEFT PANE: MULTI-FILE CODE EDITOR */}
        <div style={{ flex: 1, borderRight: "1px solid #333", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <FileTabBar 
            files={files} activeFileId={activeFileId} setActiveFileId={setActiveFileId} editingFileId={editingFileId} editFileNameBuffer={editFileNameBuffer} setEditFileNameBuffer={setEditFileNameBuffer} startRename={startRename} commitRename={commitRename} deleteFile={deleteFile} createNewFile={() => setShowNewFileModal(true)} getFileIcon={getFileIcon}
          />
          <div style={{ flex: 1 }}>
            <Editor height="100%" theme="vs-dark" language={activeLanguage} onMount={handleMonacoMount} options={{ minimap: { enabled: false } }} />
          </div>
        </div>

        {/* RIGHT PANE: DOCUMENTATION */}
        {isEngineReady && yDocRef.current && providerRef.current && (
          <DocsPanel yDoc={yDocRef.current} provider={providerRef.current} />
        )}
      </div>

      {toastMsg && (
        <div style={{ position: "absolute", bottom: "20px", right: "20px", backgroundColor: "#007acc", color: "white", padding: "12px 24px", borderRadius: "6px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontWeight: "bold", fontSize: "14px", zIndex: 1000, transition: "opacity 0.3s ease-in-out", opacity: 1 }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}