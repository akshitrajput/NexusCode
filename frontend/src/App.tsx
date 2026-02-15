import { useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";

function App() {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Initialize Yjs Document
    const doc = new Y.Doc();

    // Connecting to Go WebSocket Server
    const provider = new WebsocketProvider(
      "ws://localhost:8080", // Server URL
      "room-1",              // Room Name
      doc                    // The Doc to sync
    );
    
    // Define the shared type (Text)
    const type = doc.getText("monaco");

    // Bind Yjs to Monaco
    new MonacoBinding(
      type,
      editor.getModel()!,
      new Set([editor]),
      provider.awareness
    );

    // Debugging: Log when connected
    provider.on('status', (event: any) => {
      console.log("Yjs WebSocket Status:", event.status);
    });
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
       <div style={{ padding: "10px", background: "#1e1e1e", color: "#fff" }}>
        <strong>NexusCode</strong> - Distributed CRDT Engine (Phase 3)
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

export default App;