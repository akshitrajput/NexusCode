import { useRef } from "react";
import { useParams } from "react-router-dom";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";

export default function EditorRoom() {
  // Extract the roomId from the URL (e.g., /room/abc-123 -> roomId = "abc-123")
  const { roomId } = useParams();
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    const doc = new Y.Doc();

    // DYNAMIC ROOM ASSIGNMENT: We pass the URL parameter to the Go server
    const provider = new WebsocketProvider(
      "ws://localhost:8080", 
      roomId as string,      // No more hardcoded "room-1"!
      doc                    
    );
    
    const type = doc.getText("monaco");

    new MonacoBinding(
      type,
      editor.getModel()!,
      new Set([editor]),
      provider.awareness
    );

    provider.on('status', (event: any) => {
      console.log(`Yjs Status [Room: ${roomId}]:`, event.status);
    });
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
       <div style={{ padding: "10px", background: "#1e1e1e", color: "#fff", display: "flex", justifyContent: "space-between" }}>
        <span><strong>NexusCode</strong> - Workspace</span>
        <span style={{ color: "#aaa", fontSize: "0.9em" }}>Room ID: {roomId}</span>
      </div>
      <Editor
        height="90vh"
        theme="vs-dark"
        defaultLanguage="javascript"
        onMount={handleEditorDidMount} 
        options={{
          minimap: { enabled: false },
        }}
      />
    </div>
  );
}