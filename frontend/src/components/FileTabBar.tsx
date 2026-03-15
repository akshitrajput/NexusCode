import React from "react";

interface FileMeta {
  id: string;
  name: string;
  language: string;
  createdAt: number;
}

interface FileTabBarProps {
  files: FileMeta[];
  activeFileId: string | null;
  setActiveFileId: (id: string) => void;
  editingFileId: string | null;
  editFileNameBuffer: string;
  setEditFileNameBuffer: (val: string) => void;
  startRename: (file: FileMeta) => void;
  commitRename: (fileId: string) => void;
  deleteFile: (fileId: string) => void;
  createNewFile: () => void;
  getFileIcon: (langId: string) => string;
}

export default function FileTabBar({
  files, activeFileId, setActiveFileId, editingFileId,
  editFileNameBuffer, setEditFileNameBuffer, startRename,
  commitRename, deleteFile, createNewFile, getFileIcon
}: FileTabBarProps) {
  return (
    <div 
      className="file-tabs-container"
      style={{ 
        display: "flex", 
        backgroundColor: "#1e1e1e", 
        overflowX: "auto", 
        overflowY: "hidden", /* FIX: Ban vertical scrolling completely */
        borderBottom: "1px solid #333", 
        alignItems: "center",
        flexShrink: 0, 
        height: "36px", /* FIX: Strict hard-locked height */
        flexWrap: "nowrap" /* FIX: Prevent tabs from wrapping to a second line */
      }}
    >
      {files.map((file) => (
        <div
          key={file.id}
          className="file-tab" 
          onClick={() => setActiveFileId(file.id)}
          style={{
            padding: "0 10px", /* Removed top/bottom padding to rely on height and align-items */
            height: "100%", /* Fill the container height exactly */
            backgroundColor: activeFileId === file.id ? "#1e1e1e" : "#2d2d2d",
            color: activeFileId === file.id ? "#fff" : "#888",
            borderTop: activeFileId === file.id ? "2px solid #007acc" : "2px solid transparent",
            borderRight: "1px solid #252526",
            cursor: "pointer", 
            display: "flex", 
            alignItems: "center", 
            gap: "8px",
            fontSize: "13px", 
            maxWidth: "140px", 
            minWidth: "80px", 
            userSelect: "none",
            flexShrink: 0, /* Prevent tabs from getting crushed */
            boxSizing: "border-box"
          }}
        >
          <img src={getFileIcon(file.language || "javascript")} alt="icon" style={{ width: "16px", height: "16px", flexShrink: 0 }} />
          
          {editingFileId === file.id ? (
            <input 
              autoFocus type="text" value={editFileNameBuffer}
              onChange={(e) => setEditFileNameBuffer(e.target.value)}
              onBlur={() => commitRename(file.id)}
              onKeyDown={(e) => e.key === "Enter" && commitRename(file.id)}
              style={{ background: "#1e1e1e", color: "white", border: "1px solid #007acc", outline: "none", padding: "0 2px", fontSize: "13px", width: "100%", height: "20px" }}
            />
          ) : (
            <span 
              onDoubleClick={(e) => { e.stopPropagation(); startRename(file); }}
              title={file.name} 
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexGrow: 1 }}
            >
              {file.name}
            </span>
          )}

          <span 
            className="tab-close-btn"
            onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }} 
            title="Delete File"
            style={{ fontSize: "16px", flexShrink: 0 }} 
          >
            ×
          </span>
        </div>
      ))}
      
      <div 
        className="add-file-btn"
        onClick={createNewFile} 
        style={{ cursor: "pointer", color: "#aaa", fontWeight: "bold", fontSize: "16px", flexShrink: 0, marginLeft: "4px" }}
        title="Create New File"
      >
        +
      </div>
    </div>
  );
}